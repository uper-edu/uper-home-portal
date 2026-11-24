/** Supply the cancellation methods used by the app on browsers with AbortController. */
export function installAbortSignalCompatibility() {
  if (typeof AbortController !== 'function' || typeof AbortSignal !== 'function') return;
  if (typeof AbortSignal.timeout === 'function' && typeof AbortSignal.any === 'function' &&
      typeof AbortSignal.prototype.throwIfAborted === 'function' && 'reason' in AbortSignal.prototype) return;

  const reasons = new WeakMap<AbortSignal, unknown>();
  if (!('reason' in AbortSignal.prototype)) {
    Object.defineProperty(AbortSignal.prototype, 'reason', {
      configurable: true,
      get(this: AbortSignal) {
        if (!this.aborted) return undefined;
        if (!reasons.has(this)) reasons.set(this, new DOMException('The operation was aborted.', 'AbortError'));
        return reasons.get(this);
      },
    });
  }
  const reasonFor = (signal: AbortSignal) => reasons.has(signal) ? reasons.get(signal) :
    (signal.reason === undefined ? new DOMException('The operation was aborted.', 'AbortError') : signal.reason);
  const abort = (controller: AbortController, reason: unknown) => {
    reasons.set(controller.signal, reason);
    controller.abort(reason);
  };

  if (typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = milliseconds => {
      const controller = new AbortController();
      setTimeout(() => abort(controller, new DOMException('The operation timed out.', 'TimeoutError')), milliseconds);
      return controller.signal;
    };
  }

  if (typeof AbortSignal.any !== 'function') {
    AbortSignal.any = signals => {
      const controller = new AbortController();
      const aborted = signals.find(signal => signal.aborted);
      if (aborted) {
        abort(controller, reasonFor(aborted));
        return controller.signal;
      }
      const listeners = signals.map(signal => {
        const cancel = () => {
          for (const listener of listeners) listener.signal.removeEventListener('abort', listener.cancel);
          abort(controller, reasonFor(signal));
        };
        signal.addEventListener('abort', cancel, {once:true});
        return {signal, cancel};
      });
      return controller.signal;
    };
  }

  if (typeof AbortSignal.prototype.throwIfAborted !== 'function') {
    AbortSignal.prototype.throwIfAborted = function (this: AbortSignal) {
      if (this.aborted) throw reasonFor(this);
    };
  }
}
