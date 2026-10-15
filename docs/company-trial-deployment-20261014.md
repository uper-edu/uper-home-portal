# Company trial deployment — local adaptation and release checklist

Target: `https://home.prototype.uperedu.com`, including `/chat`, `/crm`, `/cms`, `/system` and `/api`. This is the user-approved same-origin exception to the company tool's default split-domain setup. No Sites, Google Cloud or Redis dependency is introduced. This document does not authorize server execution or external testers.

## Runtime and package

- `PORTAL_DEPLOYMENT=company-trial` is a separate gate. It requires production cookies/transport, synthetic data, existing database-backed authentication, a stable private operation key, explicit trusted proxies and MySQL TLS. It rejects local cutover, mock identities, fault injection and fixed test credentials. Local 3000 retains its existing gate and socket.
- The container listens on `0.0.0.0:8080`, with no host port mapping. Only nginx reaches it on the private backend network. `PLATFORM_MODE=local` is the existing database account provider, not a mock role supplied by the browser.
- Run `node scripts/build-company-trial.mjs` locally. Output goes only to ignored `.local-backups/company-trial-20261014/package`. The package contains compiled ESM modules, immutable imported JSON/SQL, frontend assets, dependency manifests, Dockerfile and release metadata. No `.env`, customer data, logs, backup dumps, TypeScript sources or source maps are included. Preserving ESM boundaries avoids async-cycle deadlocks and keeps SQL resource paths correct. JSON import attributes are emitted for pure Node execution.
- Use Node 24.19.0 as the pinned runtime template. Docker image pull, Linux container installation/permissions and memory suitability have not been verified on the company host. Builds never happen on the server.
- `cloud/company-trial/server.env.example`, `maintenance.env.example`, `Dockerfile`, `compose.review.yml` and `nginx.conf.template` are review artifacts. They are NOT applied by this task. Run `python3 scripts/prepare-company-deployment-tool.py` to prepare a private, locally validated adapter and backend-only manifest. It reuses the standard deployment tool, preserves new-domain confirmation/rollback, allows only the approved combined home deployment, substitutes the reviewed deny-all streaming proxy, and requires HTTP 200 for health acceptance. No SSH module is imported or network command executed during preparation; the installed skill is unchanged. Do not run the unadapted default split-domain command or silently overwrite existing site configurations. Review the generated adapter again before any future authorized deployment.

## Database, credentials and first initialization

1. Prepare a NEW `uper_trial_home` schema (standard MySQL 8, utf8mb4_0900_bin) and an application-specific account. The company tool normally creates `home`; it must be configured/extended for this dedicated schema. Never point the trial at `uper_local_crm` or import local customer data. The runtime currently runs idempotent schema migrations on startup, so the account needs schema-scoped DDL in addition to application DML; no global admin grants.
2. Connect to `mysql:3306` over the backend network, using a CA whose server certificate has a SAN matching `mysql`. `MYSQL_CA_PEM` contains the certificate, not a file path. Never disable verification. Numeric IP TLS hosts are rejected because the current driver skips its hostname verification path for them. Wrong CA and DNS-name mismatch must fail.
3. The private server `.env` belongs at `/opt/project/home/api/.env` with mode 0600, managed through the company tool. Inject DB password (URL-encoded), authorized OpenAI/DeepSeek keys and a new stable random `ACCESS_OPERATION_KEY`; never use a frontend VITE variable. Preserve approved AI model/base URL overrides; this task adds no AI quota.
4. For a NEW empty synthetic environment, provide `/data/private/initial-passwords.json` (name to strong unique password) readable only by the container user, mode 0600. It seeds the existing nine account identities with synthetic credentials; no production password hashes are copied. Coordinate testing accounts before opening access. After successful initialization remove the bootstrap file and env reference. Repeated startup must not reset existing passwords or roles. Ethan's system-administrator assignment, if required for this new environment, is a separate explicit audited permission change; it is not silently seeded.
5. Backups are private. For maintenance use a compatible MySQL 8 client container and `MYSQL_BIN_DIRECTORY` for that container (usually `/usr/bin`), on the backend network. The Node backup helper now supports verified TLS CLI connections using a temporary 0600 CA file, removes that file afterwards, and passes no password in command arguments. The application image intentionally contains no backup client. Restore only to an explicitly selected EMPTY target, compare checksums and retain the security review gate; do not restore an old DB as an ordinary program rollback.

## HTTPS, controlled access and search

- All HTML, API and streaming chat requests remain on the same hostname. Nginx overwrites Host, X-Forwarded-Host, X-Forwarded-Proto and X-Forwarded-For; it never appends an attacker-supplied chain. Streaming buffering is disabled. Keep company ACME handling and TLS renewal paths when integrating the template.
- `ACCESS_TRUSTED_PROXIES` accepts exact loopback/private peer addresses only. No wildcard, CIDR or arbitrary public peer. Obtain nginx's actual private Docker peer, pin/reserve it or update the list safely during maintenance. Never guess its address. Revalidation is needed if its network address changes.
- The backend rejects non-HTTPS/wrong-host requests, including HTML pages, in company mode. Existing mutation same-origin and role/record-scope checks remain active. Session cookies are HttpOnly, Secure and SameSite=Strict; visitor cookies are Secure in production.
- Configure the approved VPN/tester network allowlist at nginx before opening the site. The supplied TLS server template is DENY-ALL until that allowlist is provided. It is not a functioning external invitation mechanism.
- Company trial is entirely `noindex,nofollow,noarchive`; public-page canonical/hreflang/schema are suppressed, robots disallows all, and sitemap/LLM directories return 404. Browser updates keep the same noindex behavior on the exact trial hostname. This does not replace authentication or VPN controls.

## Notifications and no replay

- Start with `PORTAL_WORKER_ENABLED=false`, `PORTAL_NOTIFICATION_MODE=simulation` and all test channels in simulation mode. A running company simulation worker refuses live channels rather than pretending they were simulated. Missing channels fail explicitly.
- After a separately approved TEST receipt check: `PORTAL_WORKER_ENABLED=true`, `PORTAL_NOTIFICATION_MODE=configured`, `LARK_TEST_GROUP=CRM_Leads_Update`. Map policies to this existing logical channel, display CRM Bot, use `secretRef=LARK_GROUP_CRM`, signing off. Only this channel may send live in company trial. Cards always say `UPER · TEST` and link to the same-domain CRM.
- Owner → CRM Manager routing, policy snapshots, unknown-result handling, task cancellation and migration holds remain intact. Starting a worker is not permission to replay old failed/unknown/held jobs. Use the empty synthetic DB or individually reviewed NEW events only. API accepted is not actual group receipt.
- Local acceptance uses only a stubbed Lark transport and synthetic credentials. It does not send a real group notification or call AI.

## Release order and outstanding host checks

1. Confirm VPN connectivity, deployment authority, approved private access ranges and the exact target domain. Read-only inspect existing home site, proxy network, MySQL version/CA/certificate SAN and backups. Do not disrupt other projects.
2. Review the prepared same-origin deployment-tool adapter and explicitly provision the dedicated schema (the standard db command still defaults to home). Validate rendered nginx with `nginx -t`, including streaming, access control, certificate paths and renewal.
3. Create isolated DB/account, privately inject configuration, mount bootstrap file/CA environment, prepare a rollback release and encrypted/offline backup custody. Do not upload the local `.env` or customer data.
4. Build/package locally, verify hashes and forbidden-file scan, install runtime dependencies and test the pinned Linux image. Start behind closed access with worker paused; validate schema readiness, HTTPS health, staff login and role boundaries.
5. Walk Campaign → questionnaire → assessment → consultation → claim → follow-up using NEW synthetic data. Do not alter assessment scoring/content. Check notifications simulated first, then one approved TEST CRM Bot receipt with human confirmation. No historical replay.
6. Check memory, worker restart/lease recovery, AI/provider availability, time zone, log redaction, backup/restore and stable operation-key custody. Only after independent approval open the specified test audience.
7. Roll back the application release/configuration while preserving the database and newly written audit/results. Do not overwrite post-release writes with an old dump. Any incompatible schema rollback needs a separate data plan.

## Administrator recovery and release

Company production maintenance is now explicitly supported with a separate `maintenance.env.example`, `ACCESS_RECOVERY_MAINTENANCE=true`, paused workers and signed authorization. The application refuses to start with the maintenance flag. During review, `/api/health` returns 200 with `businessReady=false` and `reviewRequired=true`; this means the restricted management service is alive, not that business access has been released. A database runtime lease coordinates the application and offline credential changes across containers; localhost alone is not a stop proof. Company notifications run only inside that leased application.

Both ordinary offline administrator recovery and backup restore install the business review gate, revoke sessions and retain historical notification holds. Review every active account with fresh credentials and current authorization snapshots, retain Robert/Ethan as two explicitly authorized complete administrators, then release and sign in again. Release never replays historical notifications. Compiled recovery and maintenance CLI artifacts are included in the locally built package; compatible MySQL client tools still belong in an approved maintenance container. See [company recovery procedure](./company-trial-recovery-20261014.md) for authorization, commands, result query, rollback and actual-host limits.

## Bahasa Indonesia — panduan operasional

Lingkungan uji perusahaan memakai satu domain `home.prototype.uperedu.com`, basis data MySQL sintetis terpisah dan login staf dengan izin yang sama. Data serta konfigurasi lokal 3000 tidak disalin atau diubah. Paket dibangun lokal; kata sandi, kunci API dan Webhook disuntikkan secara privat. Mode perusahaan menolak identitas mock, kata sandi uji tetap, proxy tak tepercaya, HTTP, host salah serta sertifikat MySQL yang tidak valid. Seluruh situs uji tidak diindeks, tetapi tetap memerlukan pembatasan VPN/jaringan dan autentikasi.

Mulai dengan pekerja notifikasi berhenti dan kanal simulasi. Pengiriman nyata hanya ke kanal `CRM_Leads_Update`/CRM Bot dengan label TEST setelah disetujui. Notifikasi historis yang ditahan atau hasilnya tidak diketahui tidak dikirim ulang. Sebelum rilis, validasi alat deployment untuk pengecualian satu domain, sertifikat, izin berkas bootstrap, container Linux, backup dan pemulihan. Pengujian lokal bukan bukti deployment perusahaan atau penerimaan nyata di Lark.

## 中文 — 配置与验收边界

公司测试环境使用统一域名、独立模拟数据和数据库账号登录，不复制或改动本地3000。服务器密钥单独注入；首次账号凭据为私密强密码，不能使用姓名密码或浏览器自报权限。公司模式要求可信代理和MySQL证书校验，全站禁止索引；VPN白名单与登录权限仍须分别配置。

首次暂停通知工作进程，仅使用模拟渠道。真实发送只能进入指定CRM Bot逻辑渠道并标明TEST，须另行确认实收；历史暂停、失败、未知通知不自动补发。部署前仍须核实标准工具的同域支持、MySQL证书、Linux镜像、文件权限、资源、备份及回退。本文及本地验收不代表已连接或部署公司服务器。
