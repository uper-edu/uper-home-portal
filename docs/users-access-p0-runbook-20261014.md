# Users & access P0: implementation and recovery runbook

Status: independent synthetic MySQL implementation. This change does not authorize local 3000 cutover, GitHub push, or server deployment. No team-based authorization has been reintroduced.

## Business contract

| Area                | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovery            | Another authorized administrator can reset credentials without changing business roles. The offline recovery tool uses an existing stable account ID, exact-state confirmation, a new strong password, and an independent private record. It grants only the five system administration capabilities when needed; it does not add CRM/CMS access.                                                    |
| Restore             | Restore is into an empty selected database with a checked backup hash. A persistent barrier is installed before import. Interrupted imports cannot start the application. Successful imports clear staff sessions and lock business APIs/notification processing until authorization review is explicitly released.                                                                                  |
| Review              | Compare a separately retained, trusted authorization checkpoint, or independently review every account. Active accounts need a fresh credential reset. Review binds to current active status, role IDs and effective grants. Subsequent authorization changes invalidate that approval. Release requires all accounts reviewed and at least one complete administrator, and revokes review sessions. |
| Reliable management | User/role updates, credential resets, session revocation, handover and restore-review mutations require an operation ID. Unchanged retries reuse the ID. Different content with an existing ID conflicts. Business changes, receipt, handover generation and audit commit in one transaction. A missing receipt is “unconfirmed”, not proof of non-commit.                                           |
| Handover            | Disable or eligibility loss is immediate. Existing customers/tasks keep ownership and deadlines. An authorized CRM Manager selects exact customers and exact tasks, validates recipient access, and explicitly confirms completion after a fresh check. A system-only administrator sees counts, not customer records. Partial transfer never closes unrelated tasks.                                |
| Authentication      | First initialization uses owner-only private credentials unless explicitly running synthetic test mode. Existing initialized accounts are unchanged. A trusted local HTTPS proxy must have an exact canonical origin and overwrite forwarded headers. Login ID and email share the same account limit; source-IP limiting remains separate.                                                          |

Pending/sending/unknown historical notification jobs, unprocessed events, and unfinished task notification sources receive restore holds. Release does **not** remove those holds, replay old failures, change task status, or recalculate deadlines. An ordinary post-release new event follows existing policies.

## Operator procedures

### Normal administrator recovery

1. Use another currently authorized System Administrator.
2. Find the existing user. Do not create a duplicate identity or alter CRM ownership.
3. Reset the password with an explicit reason and operation ID; affected sessions are revoked.
4. If the response is lost, use **Check result** before issuing another reset. Reauthenticate as needed.
5. Verify login and effective access with the recovered account.

Passwords are never included in operation receipts, audit payloads, browser session storage, or checkpoint files. An unsent password can remain in the current form/in-memory request while the tab is open; sign-out clears the in-memory retry payload. After reload or sign-out, metadata remains queryable, but a lost password payload is not blindly reconstructed or resent.

When original input is lost and the result remains unconfirmed, use **Close uncommitted operation** with a reason. The server serializes this with the original request: it either returns an already committed receipt, or writes a terminal cancellation receipt that prevents delayed requests from committing. Concurrent close requests create one audit entry. A committed change is never undone. After a confirmed close, reload the current record before starting a new operation. If closing also loses its response, query the same ID; do not clear browser metadata to bypass the check.

### All administrators unavailable: offline recovery rehearsal

The current CLI is deliberately restricted to `APP_ENV=test`, `TRIAL_DATASET=synthetic`, and a non-3000 target. It cannot presently serve as an operational recovery command for the live local 3000 environment. Removing that execution restriction and validating the real maintenance workflow belong to the separately approved cutover.

Use a private explicit environment file pointing to the independent database. Do not put its contents in a report or Git. Run using Node with the existing TypeScript loader:

```sh
node --import tsx cloud/mysql/access-recovery.mjs --env /private/path/test.env --user EXISTING_STABLE_ID --reason "Approved recovery rehearsal"
```

For an inactive account, add `--enable` only when explicitly approved. The preview shows the exact database, account state and confirmation hash; it does not apply changes.

```sh
node --import tsx cloud/mysql/access-recovery.mjs --env /private/path/test.env --user EXISTING_STABLE_ID --reason "Approved recovery rehearsal" --apply PREVIEW_HASH --record /private/path/recovery-record.json
```

The new password is read through hidden input, not a command-line argument. A stale preview is rejected. The record is created with owner-only permissions and has a unique audit ID. A `prepared` record means the outcome needs reconciliation: query the database audit for that ID before another recovery. A file update can fail after database commit; the file and database are not one atomic storage system.

The recovery capability assumes trusted host/database administrative access. It is not a public recovery endpoint, universal password, or external identity verification mechanism.

No new business role is added by recovery. Explicit `--enable` does reactivate the existing account and its retained roles; inspect those roles in the exact-state preview and obtain the corresponding authorization. Restored databases still keep business access locked until separate per-account review. Recovery clears only that account's failed-login counter, not the global source-IP limits.

### Authorization checkpoint and backup review

```sh
node --import tsx cloud/mysql/access-recovery.mjs --env /private/path/test.env --checkpoint /private/path/authorization.json
node --import tsx cloud/mysql/access-recovery.mjs --env /private/path/restored-test.env --compare-checkpoint /private/path/authorization.json
```

The checkpoint contains account activation, roles, role definitions/revisions and an audit watermark, not credentials. Comparison reports changed account/role IDs and never applies grants. SHA-256 detects changed file contents relative to its recorded hash; it does not prove authorship. Retain the checkpoint and its trusted hash separately from database backups under independent access controls.

After restoring:

1. Stop normal access and workers. Keep the imported database isolated.
2. Recover one existing authorized administrator using the rehearsed offline procedure.
3. Compare with the latest independently trusted checkpoint. If none is available, a responsible administrator must explicitly determine intended authorization for every account; old backup grants are not automatically trusted.
4. Correct obsolete authorization using the existing permission editor. Reset active credentials. Review each account with evidence/reason.
5. Release the business gate only after all accounts are approved. Reauthenticate after release.
6. Verify retained ownership, data and original deadlines. Keep historical notification holds. No automatic resend.
7. If an `access_restore_guard_*` table remains, do not manually drop it to bypass the gate. Treat the restore as interrupted; retain evidence and rehearse a clean restore into a new empty database.

### Staff disable and selected handover

1. Disable the user or remove the relevant eligibility with a reason. Old sessions cease to authorize requests.
2. In **Staff handover**, a system-only administrator can see counts and arrange an authorized CRM Manager to act. No customer access is granted by system administration alone.
3. In CRM, select the customers and tasks to transfer and an eligible receiving Owner. A task on a different customer's record requires receiver access to that record.
4. Submit with a reason. A stale profile/revision is rejected and must be refreshed; do not overwrite concurrent changes.
5. Review remaining items. Confirm completion only when all affected work has been transferred or resolved. Re-enabling the employee does not reclaim already transferred customers.

### HTTPS/authentication readiness

Required server-only configuration introduced by this change:

| Variable                        | Meaning                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACCESS_OPERATION_KEY`          | Stable random secret, at least 32 characters, used for management-request fingerprints. Back up privately with the runtime configuration. Missing it blocks management writes. Rotate only with a receipt/retry transition plan. |
| `ACCESS_INITIAL_PASSWORDS_FILE` | Owner-only JSON mapping initial Login IDs to strong passwords for a genuinely new database. Existing initialized accounts do not require it and are not rewritten.                                                               |
| `ACCESS_ALLOW_TEST_PASSWORDS`   | `true` is accepted only for explicitly isolated synthetic tests. Never enable on a real/server database.                                                                                                                         |
| `ACCESS_TRUSTED_PROXIES`        | Exact comma-separated loopback peer addresses supported by this implementation; no `true`, blanket subnet or arbitrary hop count.                                                                                                |
| `ACCESS_PUBLIC_ORIGIN`          | Exact HTTPS origin when using a trusted proxy. Origin/host/protocol mismatch fails closed.                                                                                                                                       |

The actual reverse proxy must terminate valid TLS, forward to a loopback-only backend, and replace client-supplied forwarded headers. The application must run with production cookie settings. Local tests cover a real verified TLS connection with a test CA explicitly trusted by the test client; they do not install a system CA or bypass a browser warning. Multi-source IP testing uses controlled harness source simulation. Company reverse-proxy configuration, public certificate chains and real browser HTTPS remain a release gate.

## Interfaces and storage

- Additive schema version 8: `access_operations` and `access_handovers`; restore state lives in `access_state`.
- Management POST bodies require `operationId`; stale clients receive a readable refresh/error response.
- `GET /api/crm/auth/operations/:id`: signed-in actor's own receipt; cross-actor lookup requires full system administration. The operation ID is not a credential.
- `POST /api/crm/auth/operations/:id/close`: current actor only, original path and reason required; current permission is rechecked. Returns committed or cancelled atomically, never cancels an already saved change.
- `GET /api/admin/access/handovers`: authorized system summary. `GET/POST /api/crm/access-handovers[/id]`: customer-scoped manager handling.
- `GET /api/admin/access/restore`, `POST .../review`, `POST .../release`: full administrator only; explicit evidence and current restore ID required.
- Concurrent management requests share the policy lock, fresh authorization and one transaction; nested storage calls share that transaction's connection.

## Bahasa Indonesia: panduan ringkas

- **Hasil belum pasti:** simpan ID operasi dan gunakan **Periksa hasil**. Ulangi isi yang sama dengan ID yang sama. Bukti belum ditemukan bukan berarti belum tersimpan. Jangan mengulang reset kata sandi dengan ID baru ketika hasil lama belum pasti.
- **Staf dinonaktifkan:** akses berhenti segera; pelanggan, pemilik tugas dan tenggat lama tidak berubah otomatis. Manajer CRM berwenang memilih pekerjaan dan penerima yang dapat mengaksesnya, lalu memeriksa sisa pekerjaan sebelum menyelesaikan serah terima. Administrator sistem saja hanya melihat jumlah.
- **Pemulihan basis data:** sesi lama dihapus, akses bisnis dikunci dan notifikasi historis ditahan. Bandingkan checkpoint izin terpercaya atau tinjau semua akun secara independen. Reset kredensial akun aktif, konfirmasikan izin tiap akun, lalu buka akses dan login kembali. Jangan mengirim ulang notifikasi lama otomatis.
- **Pemulihan administrator:** utamakan administrator lain. Bila semua tidak dapat login, alat luring memakai akun yang sudah ada, pratinjau, konfirmasi keadaan, kata sandi kuat tersembunyi dan catatan privat terpisah. CLI saat ini hanya untuk latihan sintetis non-3000; prosedur lingkungan sebenarnya belum disahkan.
- **Kesiapan HTTPS:** berkas kredensial awal bersifat privat; kata sandi nama hanya untuk uji sintetis. Gunakan origin HTTPS kanonis dan proksi loopback eksplisit yang menimpa header penerusan. Pengujian TLS lokal bukan pengesahan konfigurasi server perusahaan.

## 中文操作要点

- **结果未知：**保留操作ID，先点“查询结果”。原内容重试沿用原ID；未找到凭证不等于未保存。结果不明时不要换ID重复重置密码。
- **停用交接：**访问立即失效，但不自动改变客户、任务归属和原截止时间。有权CRM管理者明确选择交接项及接收人；系统管理权限本身仅提供数量摘要，不赋予客户访问权。剩余事项重新核对后才能确认完成。
- **恢复数据库：**旧会话清除、业务门禁锁定、历史通知暂停。核对独立可信授权清单；没有可信清单时须逐人确定应有权限。启用账号重置凭据后逐人确认，全部通过才能放行，放行后重新登录。不自动重发旧通知。
- **管理员恢复：**优先用其他有权管理员重置；全部无法登录时，离线工具只针对已有账号，须精确预览、确认、隐藏输入新密码并保存私密独立记录。当前CLI仅支持非3000模拟环境演练，真实环境恢复尚未放行。
- **HTTPS与初始凭据：**新库使用私密强密码文件；姓名密码仅用于隔离模拟测试。真实代理需规范HTTPS来源、可信本机地址并覆盖转发头。本地TLS通过不等于公司服务器部署验收通过。

## Cutover checklist — not executed

Back up current 3000 database and runtime configuration; preserve an independent authorization checkpoint; generate and privately configure the stable operation key; rehearse additive migration on an isolated copy; confirm account/role/ownership/deadline/config fingerprints; retain the new restore review process in rollback tooling. Rehearse actual-maintenance offline recovery and trusted HTTPS proxy/browser behavior before changing live resources. Version 8 tables may remain when rolling back resources; do not delete receipts or handover history and do not restore unsafe duplicate-write behavior. No customer, configuration or historical notification replay is part of this P0 development task.

## Confirmed-result and handover UI behavior

A confirmed result clears obsolete form errors and refreshes the saved record; it does not silently apply other draft edits. Each handover case owns its recipient, selected items and reason. Saving one retains other cases’ drafts; after no work remains, only the completion reason/confirmation is required.

Hasil terkonfirmasi menghapus kesalahan lama dan memuat data tersimpan tanpa menerapkan perubahan draf lain secara otomatis. Setiap kasus serah terima menyimpan penerima, pilihan dan alasannya sendiri; menyimpan satu tidak menghapus draf kasus lainnya.

确认结果后清除旧错误并刷新已保存记录，其余草稿不自动覆盖。各交接的接收人、勾选和原因独立；保存一份保留其他草稿，没有剩余事项后仅需原因和明确完成确认。
