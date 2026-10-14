export function notificationHealth(ready: any, jobs: any[]) {
  const current = jobs.filter((job) => !job.historicalHold);
  return {
    failed:
      (ready.missingReferences?.length || 0) +
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
