import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { execFileSync } from "node:child_process";
import express from "express";
import { setupNativeTest } from "./helpers/mysql.mjs";
import { configureAccessTransport } from "../server/portal/accessTransport.ts";
test("forwarded headers require an explicit peer and canonical HTTPS origin", () => {
  assert.throws(
    () =>
      configureAccessTransport(express(), {
        ACCESS_TRUSTED_PROXIES: "0.0.0.0/0",
        ACCESS_PUBLIC_ORIGIN: "https://example.invalid",
      }),
    /explicit/,
  );
  assert.throws(
    () =>
      configureAccessTransport(express(), {
        ACCESS_TRUSTED_PROXIES: "127.0.0.1",
      }),
    /HTTPS/,
  );
});
if (process.env.MYSQL_NATIVE_TEST_ENV) {
  await setupNativeTest("access_proxy");
  process.env.PLATFORM_MODE = "local";
  const { initialize } = await import("../server/portal/store.ts");
  const { initializeLocalAccounts } =
    await import("../server/portal/localAuth.ts");
  await initialize();
  await initializeLocalAccounts();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "uper-access-tls-")),
    key = path.join(dir, "key.pem"),
    cert = path.join(dir, "cert.pem");
  await fs.writeFile(
    path.join(dir, "openssl.cnf"),
    "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n",
  );
  execFileSync(
    "/usr/bin/openssl",
    [
      "req",
      "-x509",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-config",
      path.join(dir, "openssl.cnf"),
    ],
    { stdio: "ignore" },
  );
  await fs.chmod(key, 0o600);
  const simulatedClients = new Map<number, string>();
  let backendPort = 0;
  const proxy = https.createServer(
    { key: await fs.readFile(key), cert: await fs.readFile(cert) },
    (q, r) => {
      const headers = {
        ...q.headers,
        host: "localhost:" + proxyPort,
        "x-forwarded-host": "localhost:" + proxyPort,
        "x-forwarded-proto": "https",
        "x-forwarded-for":
          simulatedClients.get(q.socket.remotePort!) || q.socket.remoteAddress,
      };
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: backendPort,
          path: q.url,
          method: q.method,
          headers,
        },
        (response) => {
          r.writeHead(response.statusCode!, response.headers);
          response.pipe(r);
        },
      );
      upstream.on("error", () => {
        r.writeHead(502);
        r.end();
      });
      q.pipe(upstream);
    },
  );
  proxy.listen(0, "127.0.0.1");
  await new Promise<void>((r) => proxy.on("listening", r));
  const proxyPort = (proxy.address() as any).port;
  Object.assign(process.env, {
    ACCESS_TRUSTED_PROXIES: "127.0.0.1",
    ACCESS_PUBLIC_ORIGIN: "https://localhost:" + proxyPort,
    APP_ENV: "production",
    ACCESS_ALLOW_TEST_PASSWORDS: "false",
  });
  const app = express();
  configureAccessTransport(app);
  app.use(express.json());
  const { mountPortal } = await import("../server/portal/runtime.ts");
  await mountPortal(app);
  const backend = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => backend.on("listening", r));
  backendPort = (backend.address() as any).port;
  const ca = await fs.readFile(cert),
    origin = "https://localhost:" + proxyPort;
  function call(
    route: string,
    body?: any,
    { cookie = "", source = "127.0.0.1", headers = {}, trust = true }: any = {},
  ) {
    return new Promise<any>((resolve, reject) => {
      const req = https.request(
        {
          hostname: "localhost",
          family: 4,
          port: proxyPort,
          path: route,
          method: body ? "POST" : "GET",
          ...(trust ? { ca } : {}),
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            Cookie: cookie,
            ...headers,
          },
        },
        (r) => {
          let text = "";
          r.on("data", (x) => (text += x));
          r.on("end", () =>
            resolve({
              status: r.statusCode,
              headers: r.headers,
              data: JSON.parse(text),
            }),
          );
        },
      );
      req.on("socket", (socket) => {
        if (socket.connecting)
          socket.once("connect", () =>
            simulatedClients.set(socket.localPort!, source),
          );
        else simulatedClients.set(socket.localPort!, source);
      });
      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
  await test("verified local TLS proxy: secure cookie, origin checks, trusted IPs, alias limits and distinct staff", async (t) => {
    t.after(async () => {
      await new Promise<void>((r) => proxy.close(() => r()));
      await new Promise<void>((r) => backend.close(() => r()));
      await (await import("../server/portal/store.ts")).pool.end();
      await fs.rm(dir, { recursive: true, force: true });
    });
    await assert.rejects(
      call("/api/crm/auth/me", undefined, { trust: false }),
      /self.signed|certificate/i,
    );
    const login = await call("/api/crm/auth/login", {
      loginId: "Robert",
      password: "Robert",
    });
    assert.equal(login.status, 200);
    const header = login.headers["set-cookie"][0];
    assert.match(header, /; Secure/);
    assert.match(header, /; HttpOnly/);
    assert.match(header, /; SameSite=Strict/);
    const cookie = header.split(";")[0];
    assert.equal(
      (await call("/api/crm/auth/me", undefined, { cookie })).status,
      200,
    );
    assert.equal(
      (
        await call(
          "/api/crm/auth/login",
          { loginId: "Robert", password: "Robert" },
          { headers: { Origin: "https://untrusted.example" } },
        )
      ).status,
      403,
    );
    const forged = await call(
      "/api/crm/auth/login",
      { loginId: "Fenny", password: "Fenny" },
      {
        headers: {
          "x-forwarded-for": "1.2.3.4",
          "x-forwarded-host": "evil.invalid",
          "x-forwarded-proto": "http",
        },
      },
    );
    assert.equal(forged.status, 200);
    const untrustedApp = express();
    configureAccessTransport(untrustedApp, {
      ACCESS_TRUSTED_PROXIES: "",
      ACCESS_PUBLIC_ORIGIN: "",
    });
    untrustedApp.get("/api/check", (_q, r) => r.json({ ok: true }));
    const untrusted = untrustedApp.listen(0, "127.0.0.1");
    await new Promise<void>((r) => untrusted.on("listening", r));
    try {
      const direct = await new Promise<any>((resolve, reject) => {
        const q = http.request(
          {
            hostname: "127.0.0.1",
            port: (untrusted.address() as any).port,
            path: "/api/check",
            headers: {
              "X-Forwarded-Proto": "https",
              "X-Forwarded-For": "1.2.3.4",
            },
          },
          (r) => {
            r.resume();
            r.on("end", () => resolve(r.statusCode));
          },
        );
        q.on("error", reject);
        q.end();
      });
      assert.equal(direct, 403);
    } finally {
      await new Promise<void>((r) => untrusted.close(() => r()));
    }
    const { pool } = await import("../server/portal/store.ts");
    await pool.query("UPDATE crm_users SET email=:p2 WHERE id=:p1", [
      "Fadhil",
      "proxy.fadhil@example.invalid",
    ]);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await call(
            "/api/crm/auth/login",
            {
              loginId: i % 2 ? "Fadhil" : "proxy.fadhil@example.invalid",
              password: "wrong",
            },
            { source: i % 2 ? "127.0.0.2" : "127.0.0.3" },
          )
        ).status,
        401,
      );
    assert.equal(
      (
        await call(
          "/api/crm/auth/login",
          { loginId: "Fadhil", password: "Fadhil" },
          { source: "127.0.0.4" },
        )
      ).status,
      429,
    );
    await pool.query("TRUNCATE crm_login_limits");
    const concurrent = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        call(
          "/api/crm/auth/login",
          {
            loginId: i % 2 ? "Fadhil" : "proxy.fadhil@example.invalid",
            password: "wrong",
          },
          { source: "192.0.2." + ((i % 3) + 1) },
        ),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === 401).length, 5);
    assert.equal(concurrent.filter((r) => r.status === 429).length, 5);
    assert.equal(
      (
        await call(
          "/api/crm/auth/login",
          { loginId: "Wigar", password: "Wigar" },
          { source: "127.0.0.2" },
        )
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/crm/auth/logout", {}, { cookie })).status,
      200,
    );
    assert.equal(
      (await call("/api/crm/auth/me", undefined, { cookie })).status,
      401,
    );
  });
}
