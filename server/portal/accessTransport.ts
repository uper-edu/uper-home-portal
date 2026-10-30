import type { Express, Request } from "express";
import {exactPrivateProxy,isCompanyTrial,isProductionDeployment,publicOrigins} from '../companyTrial.ts';
export function configureAccessTransport(app: Express, env = process.env) {
  const trusted = (env.ACCESS_TRUSTED_PROXIES || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    trusted.some((x) => (isCompanyTrial(env) || isProductionDeployment(env)) ? !exactPrivateProxy(x) : !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(x))
  )
    throw Error(
      "Only explicit approved private proxy peers are supported; wildcards and networks are forbidden",
    );
  const origins = publicOrigins(env);
  if (trusted.length && !origins.length)
    throw Error("A canonical HTTPS origin is required with trusted proxies");
  app.set("trust proxy", (ip: string) => trusted.includes(ip));
  app.use((q, r, next) => {
    if (!isCompanyTrial(env) && !q.path.startsWith("/api/")) return next();
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
      origins.length &&
      !origins.includes(`${q.protocol}://${q.get("host")}`)
    ) {
      r.status(403).json({ error: "access_origin_rejected" });
      return;
    }
    next();
  });
}
export const trustedOrigin = (q: Request) => {
  const current = `${q.protocol}://${q.get("host")}`;
  const origins = publicOrigins(process.env);
  return origins.includes(current) ? current : origins[0] || current;
};
export const validMutationOrigin = (q: Request) => {
  const origin = typeof q.headers.origin === "string" ? q.headers.origin : "";
  const current = `${q.protocol}://${q.get("host")}`;
  const origins = publicOrigins(process.env);
  return !!q.is("application/json") && origin === current && (!origins.length || origins.includes(origin));
};
