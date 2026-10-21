/** Completion-based, independently single-flight CRM refresh channels. */
export type RefreshReason = 'initial' | 'automatic' | 'manual' | 'mutation' | 'access';
export class CrmRefreshError extends Error {
  constructor(public code: 'timeout' | 'unavailable' | 'unauthorized') { super(code); }
}
export async function crmJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, {signal, cache: 'no-store'});
  if (!response.ok) throw new CrmRefreshError([401,403].includes(response.status) ? 'unauthorized' : 'unavailable');
  return response.json();
}
type Options = {
  list: (signal: AbortSignal, reason: RefreshReason) => Promise<void>;
  changes: (signal: AbortSignal) => Promise<void>;
  error: (error: unknown, channel: 'list' | 'changes') => void;
  busy: (busy: boolean) => void;
  now?: () => number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
  intervals?: {list: number; changes: number; listTimeout: number; changesTimeout: number};
};
export class CrmPolling {
  private active = false;
  private epoch = 0;
  private lastList = 0;
  private timers: Partial<Record<'list'|'changes', ReturnType<typeof setTimeout>>> = {};
  private flights: Partial<Record<'list'|'changes', {promise: Promise<void>; controller: AbortController}>> = {};
  private failures = {list:0, changes:0};
  private queued = false;
  private now; private setTimer; private clearTimer;
  private intervals;
  constructor(private options: Options) {
    this.now = options.now || Date.now;
    this.setTimer = options.setTimer || ((...args: Parameters<typeof setTimeout>) => setTimeout(...args));
    this.clearTimer = options.clearTimer || ((timer: ReturnType<typeof setTimeout>) => clearTimeout(timer));
    this.intervals = options.intervals || {list:30_000,changes:10_000,listTimeout:20_000,changesTimeout:10_000};
  }
  setVisible(visible: boolean) {
    if (this.active === visible) return;
    this.active = visible; this.epoch++;
    for (const kind of ['list','changes'] as const) {
      this.clearTimer(this.timers[kind]); delete this.timers[kind];
      this.flights[kind]?.controller.abort(); delete this.flights[kind];
    }
    this.options.busy(false); this.queued = false;
    if (visible) {
      if (!this.lastList || this.now()-this.lastList >= this.intervals.list) void this.run('list',this.lastList?'automatic':'initial');
      else this.schedule('list',this.intervals.list-(this.now()-this.lastList));
      void this.run('changes','automatic');
    }
  }
  refresh(reason: RefreshReason = 'manual') {
    if (!this.active) return Promise.resolve();
    if (this.flights.list && reason === 'mutation') this.queued = true;
    if (reason === 'access') { this.setVisible(false); this.setVisible(true); return Promise.resolve(); }
    return this.run('list',reason);
  }
  private schedule(kind: 'list'|'changes', delay?: number) {
    this.clearTimer(this.timers[kind]);
    if (this.active) this.timers[kind] = this.setTimer(()=>void this.run(kind,'automatic'), delay ?? Math.min(120_000,this.intervals[kind]*2**this.failures[kind]));
  }
  private run(kind: 'list'|'changes', reason: RefreshReason): Promise<void> {
    if (!this.active) return Promise.resolve();
    if (this.flights[kind]) return this.flights[kind]!.promise;
    this.clearTimer(this.timers[kind]);
    const epoch=this.epoch, controller=new AbortController();
    if (kind==='list') this.options.busy(true);
    const promise=(async()=>{
      let timeout: ReturnType<typeof setTimeout>;
      try {
        // Timeout rejects even when an underlying transport ignores cancellation.
        const bounded = new Promise<never>((_,reject)=>{
          timeout=this.setTimer(()=>{reject(new CrmRefreshError('timeout'));controller.abort();},kind==='list'?this.intervals.listTimeout:this.intervals.changesTimeout);
          controller.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
        });
        await Promise.race([kind==='list'?this.options.list(controller.signal,reason):this.options.changes(controller.signal),bounded]);
        if (epoch!==this.epoch) return;
        this.failures[kind]=0;
        if (kind==='list') this.lastList=this.now();
      } catch(error) {
        if(epoch===this.epoch && (!(error instanceof DOMException)||error.name!=='AbortError')) {
          this.failures[kind]++; this.options.error(error,kind);
        }
      } finally {
        this.clearTimer(timeout!);
        if(epoch===this.epoch) {
          delete this.flights[kind];
          if(kind==='list') this.options.busy(false);
          this.schedule(kind);
          if(kind==='list'&&this.queued){this.queued=false;void this.run('list','mutation');}
        }
      }
    })();
    this.flights[kind]={promise,controller}; return promise;
  }
}
export function stableCrmOrder<T extends {id:string}>(previous:T[], incoming:T[]) {
  const byId=new Map(incoming.map(row=>[row.id,row]));
  const stable=previous.filter(row=>byId.has(row.id)).map(row=>byId.get(row.id)!);
  const existing=new Set(stable.map(row=>row.id));
  return [...stable,...incoming.filter(row=>!existing.has(row.id))];
}
