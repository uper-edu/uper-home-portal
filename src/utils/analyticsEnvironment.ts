export type AnalyticsConfiguration = {
  target: string;
  measurementId: string;
  allowedHosts: string[];
  allowLocalSubdomains: boolean;
  requireHttps: boolean;
};

/** An unknown host or a copied package must never silently send to another environment. */
export function analyticsDestinationAllowed(
  configuration: AnalyticsConfiguration | null,
  measurementId: string,
  href: string,
  mode: string,
) {
  if (
    !configuration ||
    configuration.target !== mode ||
    measurementId !== configuration.measurementId ||
    !/^G-[A-Z0-9]+$/.test(measurementId)
  )
    return false;
  try {
    const url = new URL(href);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      (!configuration.requireHttps || url.protocol === "https:") &&
      (configuration.allowedHosts.includes(url.hostname) ||
        (configuration.allowLocalSubdomains &&
          url.hostname.endsWith(".localhost")))
    );
  } catch {
    return false;
  }
}

/** Explicit QA visit marker, limited to this browser tab; never a business permission. */
export function analyticsInternalTest(
  href: string,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  try {
    const flag = new URL(href).searchParams.get("analytics_test"),
      key = "uper_analytics_test_v1";
    if (flag === "1") {
      try {
        storage?.setItem(key, "1");
      } catch {}
      return true;
    }
    if (flag === "0") {
      try {
        storage?.removeItem(key);
      } catch {}
      return false;
    }
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
}
