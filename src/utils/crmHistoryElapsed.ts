/** Uses the unfiltered timeline and absolute instants; never the current clock. */
export function historyFirstInstant(groups:{displayAt?:string|null}[]):number|null{
 const values=groups.map(g=>g.displayAt?Date.parse(g.displayAt):NaN).filter(Number.isFinite);
 return values.length?Math.min(...values):null;
}
export function historyElapsedLabel(at:string|null|undefined,baseline:number|null,lang='zh'){
 const instant=at?Date.parse(at):NaN;
 if(baseline===null||!Number.isFinite(instant)||instant<baseline)return '—';
 if(instant===baseline)return lang==='en'?'Start':lang==='id'?'Awal':'起点';
 const seconds=Math.max(1,Math.floor((instant-baseline)/1000)),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
 const unit=lang==='en'?['d','h','m','s']:lang==='id'?[' hari',' jam',' menit',' dtk']:['天','小时','分','秒'];
 const join=lang==='zh'?'':' ';
 const parts=days?[days+unit[0],hours%24?hours%24+unit[1]:'']:hours?[hours+unit[1],minutes%60?minutes%60+unit[2]:'']:minutes?[minutes+(lang==='zh'?'分钟':unit[2])]:[seconds+unit[3]];
 return '+'+parts.filter(Boolean).join(join);
}
