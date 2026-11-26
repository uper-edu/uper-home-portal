import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { setupNativeTest } from "./helpers/mysql.mjs";
import {spawnSync} from "node:child_process";

test("The offline command rejects retired signed recovery arguments", () => {
  const command = spawnSync(process.execPath, [
    "--import","tsx","cloud/mysql/access-recovery.mjs","--env","unused.env","--authorization","legacy.json",
  ],{encoding:"utf8"});
  assert.notEqual(command.status,0);
  assert.match(command.stderr,/Offline administrator recovery is retired/);
});

if (process.env.MYSQL_NATIVE_TEST_ENV) {
  const fixture = await setupNativeTest("recovery_workflow");
  process.env.PLATFORM_MODE = "local";
  const {mountAccessRecovery}=await import("../server/portal/accessRecovery.ts");
  await test("Backup review stays available while the signed recovery endpoints are removed", () => {
    const routes:string[]=[];
    const collect=(path:string)=>{routes.push(path);};
    mountAccessRecovery({get:collect,post:collect});
    assert.deepEqual(routes, ["/api/admin/access/restore","/api/admin/access/restore/review","/api/admin/access/restore/release"]);
  });
  const { pool } = await import("../server/portal/store.ts"),
    { mountPortal } = await import("../server/portal/runtime.ts"),
    { configureAccessTransport } =
      await import("../server/portal/accessTransport.ts");
  const app = express();
  configureAccessTransport(app);
  app.use(express.json());
  await mountPortal(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const client = (origin = base) => {
    let cookie = "";
    return {
      async call(route: string, body?: any) {
        const r = await fetch(origin + route, {
          method: body ? "POST" : "GET",
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            cookie,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (r.headers.get("set-cookie"))
          cookie = r.headers.get("set-cookie")!.split(";")[0];
        return { status: r.status, data: await r.json() };
      },
      async login(id: string, password = id) {
        return this.call("/api/crm/auth/login", { loginId: id, password });
      },
    };
  };
  const admin = client(),
    sales = client();
  await admin.login("Robert");
  await sales.login("Fadhil");
  const op = (b: any) => ({ ...b, operationId: crypto.randomUUID() });
  await test("Two administrators reset each other and change their own passwords", async t => {
    t.after(async () => {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await pool.end();
    });
    const readUser=async (api:ReturnType<typeof client>,id:string) =>
      (await api.call("/api/admin/access")).data.users.find((user:any)=>user.id===id);
    for (const name of ["Ethan","Monite"]) {
      assert.ok((await readUser(admin,name)).roles.includes("access_admin"));
    }
    const ethan=client();
    assert.equal((await ethan.login("Ethan")).status,200);
    assert.equal((await ethan.call("/api/admin/access")).status,200);
    const roleRoute="/api/admin/access/roles/test-review-role";
    const config={names:["Review role","Peran tinjauan","复核角色"],description:["","",""],grants:{}};
    const role=op({enabled:true,revision:0,config,reason:"TEST create role"});
    assert.equal((await sales.call(roleRoute,role)).status,403);
    assert.equal((await admin.call(roleRoute,role)).data.revision,1);
    const edit=op({...role,revision:1,config:{...config,grants:{"access.read":"all"}},reason:"TEST edit role"});
    const saved=await ethan.call(roleRoute,edit);
    assert.equal(saved.status,200,JSON.stringify(saved.data));
    assert.equal(saved.data.revision,2);
    assert.equal((await ethan.call(roleRoute,edit)).data.replayed,true);
    for (const [operator,account,target,temporary,personal] of [
      [admin,ethan,"Ethan","TEST-temp-Ethan-401","TEST-personal-Ethan-402"],
      [ethan,admin,"Robert","TEST-temp-Robert-403","TEST-personal-Robert-404"],
    ] as const) {
      const before=await readUser(operator,target);
      const route="/api/admin/access/users/"+target+"/password";
      const request=op({revision:before.revision,temporaryPassword:temporary,reason:"TEST mutual reset"});
      assert.equal((await sales.call(route,request)).status,403);
      const [left,right]=await Promise.all([operator.call(route,request),operator.call(route,request)]);
      assert.equal(left.status,200,JSON.stringify(left.data));
      assert.equal(right.status,200,JSON.stringify(right.data));
      assert.deepEqual([left.data.replayed,right.data.replayed].sort(),[false,true]);
      assert.equal((await operator.call("/api/crm/auth/operations/"+request.operationId)).data.state,"committed");
      assert.equal((await account.login(target,temporary)).status,200);
      const changed=op({currentPassword:temporary,newPassword:personal});
      assert.equal((await account.call("/api/crm/auth/password",changed)).status,200);
      assert.equal((await account.call("/api/crm/auth/password",changed)).data.replayed,true);
      assert.equal((await account.login(target,personal)).status,200);
      assert.deepEqual((await readUser(account,target)).roles,before.roles);
    }
  });
}
