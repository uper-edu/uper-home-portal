export const paymentMinuteMs = 60_000;

export function nextPaymentClockDelay(now:number, deadline:number, firstLesson:number) {
  const remaining = deadline-now;
  const untilMinute = remaining>0 ? remaining%paymentMinuteMs || paymentMinuteMs : Infinity;
  const untilLesson = firstLesson>now ? firstLesson-now : Infinity;
  const delay = Math.min(untilMinute,untilLesson);
  return Number.isFinite(delay) ? Math.min(delay,2_147_483_647) : undefined;
}
