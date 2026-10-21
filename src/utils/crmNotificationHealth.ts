export function notificationHealth(ready: any, jobs: any[]) {
  const current = jobs.filter((job) => !job.historicalHold);
  return {
    failed:
      (ready.missingReferences || []).filter((reference: any) => reference.enabled !== false && reference.enabled !== 0).length +
      (ready.channels || []).filter(
        (channel: any) =>
          channel.mode === "live" &&
          (!channel.webhookConfigured ||
            !channel.designatedTestGroup ||
            !channel.signingSecretConfigured),
      ).length +
      current.filter((job) => job.state === "failed").length,
    review: current.filter((job) => job.state === "unknown").length,
  };
}
