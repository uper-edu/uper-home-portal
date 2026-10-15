import type { Express, Request } from "express";
export function configureAccessTransport(app: Express, env = process.env) {
  const trusted = (env.ACCESS_TRUSTED_PROXIES || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    trusted.some((x) => !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(x))
  )
    throw Error(
      "Only explicit loopback proxy peers are supported; validate other networks separately",
    );
  if (
    trusted.length &&
    !/^https:\/\/[^/]+$/.test(env.ACCESS_PUBLIC_ORIGIN || "")
  )
    throw Error("A canonical HTTPS origin is required with trusted proxies");
  app.set("trust proxy", (ip: string) => trusted.includes(ip));
  app.use((q, r, next) => {
    if (!q.path.startsWith("/api/")) return next();
    if (
      ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto"].some(
        (h) => q.headers[h],
      ) &&
      !trusted.includes(q.socket.remoteAddress || "")
    ) {
      r.status(403).json({ error: "access_proxy_rejected" });
      return;
    }
    if (
      env.ACCESS_PUBLIC_ORIGIN &&
      (q.protocol !== "https" ||
        q.get("host") !== new URL(env.ACCESS_PUBLIC_ORIGIN).host)
    ) {
      r.status(403).json({ error: "access_origin_rejected" });
      return;
    }
    next();
  });
}
export const trustedOrigin = (q: Request) =>
  process.env.ACCESS_PUBLIC_ORIGIN || `${q.protocol}://${q.get("host")}`;
export const validMutationOrigin = (q: Request) =>
  q.headers.origin === trustedOrigin(q) && !!q.is("application/json");
