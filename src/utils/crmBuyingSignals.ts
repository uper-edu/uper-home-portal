/** New observations append to historical signals; absence never clears evidence. */
export const buyingSignalOptions = [
  "Asked price",
  "Asked schedule",
  "Asked payment",
  "Ready to enroll",
] as const;
export function observedBuyingSignals(body: any): string[] {
  return [
    ...new Set(
      [
        ...(Array.isArray(body.buyingSignalsDetected)
          ? body.buyingSignalsDetected
          : []),
        body.buyingSignalDetected,
      ].filter(
        (v): v is string => typeof v === "string" && !!v && v !== "None yet",
      ),
    ),
  ];
}
export function appendBuyingSignals(current: any, observed: string[]) {
  if (!observed.length) return {};
  return {
    buyingSignal: observed.at(-1),
    buyingSignals: [
      ...new Set([
        ...(current.buyingSignals || []),
        ...(current.buyingSignal && current.buyingSignal !== "None yet"
          ? [current.buyingSignal]
          : []),
        ...observed,
      ]),
    ],
  };
}
