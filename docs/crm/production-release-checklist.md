# CRM 生产发布与升级验收清单

每次发布复制一份清单，逐项记录负责人、结果、证据和时间。结果填写通过、失败或不适用。不适用须写明原因。关键项失败、跳过或缺少证据时，暂停放行。

| 发布记录 | 本次填写 |
| --- | --- |
| 发布窗口及所在时区 | |
| 当前生产版本 → 目标提交及构建编号 | |
| 发布范围、数据库迁移及受影响流程 | |
| 发布负责人、销售验收人、财务验收人 | |
| 放行人、回退决策人、值守联系方式 | |
| 备份编号、旧版本位置、预计恢复时间及可接受数据损失 | |
| 观察窗口、监控基线和告警阈值 | |

[English release gates](#production-release-gates) · [Syarat rilis Bahasa Indonesia](#syarat-rilis-produksi)

## 0. 存量数据保护与放行条件

放行标准是每一项存量数据变化都能由已批准的迁移规则或正常业务操作解释。只升级应用时，验收应确认升级本身未改写存量业务数据。涉及数据迁移时，先列明允许变更的表、字段、记录范围和预期结果，再逐项核对。

- [ ] **发布负责人** 审查启动时自动执行的迁移和初始化，明确哪些操作会新增或更新记录。测试站的清库、账号重建和统一初始密码步骤不得用于生产。
- [ ] **运维** 发布前完成可恢复备份并记录恢复点。在隔离库验证恢复；按发布方案记录生产基线，包括客户及归属、账号角色、历史报价、报名、款项、任务和通知队列。使用汇总及校验值留证，避免在验收记录中保存密码、凭证和客户原文。
- [ ] **财务** 按报名项目对照历史标准价、优惠、最终应收、逐笔到账及退款、作废状态和余额。总笔数和总金额一致后，继续核对逐笔差异，防止相互抵消掩盖错误。
- [ ] **运维与业务验收人** 用一致的业务时间点比较前后结果。发布窗口内允许正常写入时，结合审计和流水区分正常业务变化与升级写入。无法区分时，暂停受影响的写入后再核对。上线后的只读验收也按同一标准复查。
- [ ] **放行人** 确认未发现未经批准的删除、覆盖、重复记录或权限变化。有无法解释的差异时，暂停放行和受影响的写入，保存差异证据，按第 5 节决定修复或回退。备份仅作为恢复手段，不能替代前后核对。

## 1. 发布前回归

在测试环境使用拟发布提交和模拟数据。销售、财务和运维分别记录结果。

- [ ] **运维** 核对目标提交、生产域名与数据库标识、环境配置来源。执行 `npm test`、`npm run lint`、`npm run build:prod` 和 `git diff --check`。单列跳过的测试；涉及本次改动的关键场景须补验。记录构建编号和制品校验值。
- [ ] **管理员** 验证销售、财务、经理和无权限账号的访问范围。直接打开受限页面或调用受限操作也应被拒绝。验证改密及重置后的改密要求。新密码为 12–200 个字符，包含大小写字母和数字，符号可选。生产账号初始化方案单独核准，测试站统一初始密码配置仅用于测试站。
- [ ] **销售运营** 核对已发布课程、课时、印尼盾标准价及优惠上限。停用课程后确认新报名无法选择，历史报名仍能查阅。新库或初始化变更时核对两条系统 Campaign、8 门标准 HSK 课程及预置角色，重复执行后核对数量和原有配置。
- [ ] **销售** 从客户详情把阶段改为「已报名」，选择课程，确认优惠及最终应收，填写事实说明或关联原始依据。覆盖无优惠、授权内优惠、超限、缺依据及保存前价格变化。确认失败时阶段和报名项目均未生效。用同一请求重试，核对只有一个报名项目。
- [ ] **财务** 确认报名后即使尚未付款，也会出现在「收款核验」。分别验证销售提交资料待核验和财务直接登记实际到账的路径。模拟应收 Rp 1,200,000、核实到账 Rp 400,000，预期剩余应收 Rp 800,000。再验证收齐、超收、退回、作废及退款，核对原始记录、原因、操作人和汇总。重复流水或并发核验只记一次。核验时已确认报价和优惠不可编辑。
- [ ] **运营** 核对 Lead 列表、客户详情、历史依据、财务入口及课程统计。涉及通知或分析时，在测试接收端核对触发、去重、归因和数据流。验证失败重试使用原操作记录，避免重复发出。
- [ ] **放行人** 审阅销售、财务、运维证据。签核时间与待办项：________。

## 2. 升级演练

数据库结构、初始化规则、历史数据读写或通知队列有变化时执行。纯文案或样式发布可注明不适用。

1. **建立隔离环境。** 从当前生产版本开始，使用经授权的脱敏快照或具有同等结构的样本。覆盖旧报名缺课程明细、旧报价、部分付款、退款、作废、待核验、旧员工角色及未完成任务。使用隔离数据库和模拟通知端，启动前核对连接目标及外发隔离。
2. **记录升级前基线。** 保存客户、报名、款项、课程、账号角色和队列计数。逐笔记录样本的应收、到账、退款和余额，并备份数据库及旧版本运行配置。
3. **执行拟上线步骤。** 使用同一目标制品和迁移顺序，记录耗时、锁等待、失败点及允许的写入窗口。再执行一次启动或初始化，确认不会重复创建课程、Campaign、角色或通知。
4. **核对升级结果。** 对比基线及事先列出的预期差异。旧报价、历史款项、权限与客户归属应符合原记录。测试新增报名和收款核验。检查旧待发任务的处置及是否有历史通知重放。
5. **演练回退。** 先验证旧应用能否读取升级后的数据。若不能，在隔离库实测备份恢复，并用一条模拟升级后新业务演练增量导出、补录和对账。记录实测恢复时长、可恢复时间点和负责签核的人。

- [ ] 演练记录、差异和恢复证据齐全，发布负责人确认可在窗口内执行。

## 3. 发布前确认与上线后快速检查

- [ ] **上线前** 放行人明确批准生产发布。运维确认备份可恢复、旧制品可用、生产环境与测试环境指向正确，并记下发布开始时间。涉及迁移时按演练结果安排写入暂停和恢复窗口。
- [ ] **涉及 Lark 时** 按[正式站 Lark 发布步骤](#production-lark-release)完成配置、迁移和后台恢复检查。
- [ ] **部署后立即** 核对生产 `/api/health` 正常、`/api/version` 与目标提交一致且前后端版本一致。检查容器重启、错误日志、数据库及通知队列。
- [ ] **业务只读检查** 用授权销售和财务账号登录，核对可见入口和客户范围。抽查已有报名的课程、原报价、逐笔款项和余额。空库首发时核对目录、角色及空列表，把首条真实报名和首笔真实到账列为后续观察项。
- [ ] **必要写入** 仅在下一节的隔离条件已验证且获得本次批准时，用一条标记记录验证报名保存和财务列表。真实到账由财务根据实际收款确认。
- [ ] **结束观察** 在约定窗口内核对首批真实业务、保存失败、访问权限和通知积压。记录首笔真实报名与收款验收状态、发现的问题和处理人。未发生的真实业务记为待观察。

<a id="production-lark-release"></a>

### 3.1 正式站 Lark 发布步骤

- [ ] **备份并核对现状。** 运维备份正式数据库和当前运行配置，记录群渠道的 Webhook 引用、签名设置、群和个人渠道的实际发送模式、适用策略，以及待发队列状态。只记录变量名、是否已配置和核对结果，凭证留在正式环境的私有配置中。
- [ ] **由正式环境提供 Lark 配置。** 在正式服务实际加载的私有配置中提供以下变量，保留正式服务器现有的其他配置。

  | 用途 | 变量与检查 |
  | --- | --- |
  | 正式运行环境 | 核对 `PORTAL_ENV=prod`、`PORTAL_DEPLOYMENT=production`。正式部署条件满足后，按发布方案设置 `PORTAL_PRODUCTION_READY=true`。 |
  | 企业应用和个人私信 | `LARK_APP_ID`、`LARK_APP_SECRET`。核对凭证属于正式环境使用的 CRM-Bot，并确认应用已发布且覆盖目标员工。 |
  | 员工自助绑定 | `LARK_TENANT_KEY` 使用已核实的 UPER 企业标识。`LARK_OAUTH_REDIRECT_URI` 使用 `https://uperedu.com/api/crm/lark/callback`，与 Lark 控制台已发布的地址一致。`APP_URL`、`ACCESS_PUBLIC_ORIGIN` 使用 `https://uperedu.com`，并将该地址列入 `ACCESS_ALLOWED_ORIGINS`。核对 `ACCESS_TRUSTED_PROXIES` 和代理转发，确保 CRM 收到正式主机名及 HTTPS 协议，并能处理回调。 |
  | 群通知 | 使用环境变量方式时，由正式环境提供 `LARK_GROUP_CRM`，并确认正式 CRM 群渠道保存了对该变量的引用。核对 Webhook 对应的目标群。如果现有渠道使用加密保存的 Webhook，保留该配置及 `LARK_WEBHOOK_ENCRYPTION_KEY`。群机器人启用签名时，由正式环境提供 CRM 渠道所引用的签名密钥，并核对两端设置一致。 |

- [ ] **在后台暂停状态下执行首次升级。** 首次启动前在正式运行配置中显式设 `PORTAL_WORKER_ENABLED=false`。正式库尚未迁移渠道模式时，保留旧版正式环境中实际生效的 `PORTAL_NOTIFICATION_MODE` 和 `LARK_PERSONAL_DELIVERY_ENABLED`。只有前者为 `configured`，原本为真实发送的群渠道才保留该模式。个人渠道只有在前者为 `configured` 且后者为 `true` 时才迁移为真实发送。缺少这些条件时，相关渠道迁移为模拟。迁移后对照升级前记录核对两个渠道的保存状态，通过后方可从运行配置移除这两项旧变量。回退备份仍保留原值。
- [ ] **只读核对渠道、策略和队列。** 检查自助绑定入口、群渠道的目标和签名状态、个人渠道的模式及策略收件范围。确认应接收私信的员工已在正式 CRM 绑定同一应用。若另行获准演练新绑定或换绑，先确保个人渠道处于模拟模式，因为保存绑定时可能立即发送确认消息。确认待发记录的收件人、时间和处置方式，保留原状态并避免重放历史消息。
- [ ] **获得放行后恢复后台。** 确认服务健康、版本正确、群和个人渠道均处于发布计划指定的模式，且待发队列已有明确处置方案。上述核对通过并获放行人批准后，运维按发布安排使 `PORTAL_WORKER_ENABLED=true` 生效，核对后台已运行，并观察首批正常通知和队列是否有积压或重复发送。

## 4. 测试数据隔离与清理

**生产默认只读验收。** 当前生产写入隔离能力应在每次发布前实际确认。仅添加测试名称无法隔离报表、通知或自动任务。

- [ ] 写入前记录批准人、范围、期限、负责人及预期副作用。验证测试记录能与真实客户、统计、自动分配、提醒、外部通知和分析事件隔离。任一隔离项无法验证时，把该写入场景移到测试环境。
- [ ] 统一使用 `TEST-发布编号-场景`，登记客户、报名、草稿等记录的编号与关联。只使用专用测试身份和接收端。
- [ ] 验收结束按登记编号逐项处理。草稿和专用测试客户在确认关联后走受支持的归档或清理流程。已形成业务历史的误记由有权限人员按业务流程作废并注明原因，保留核验及审计记录。
- [ ] 清理后核对余额、报表、任务和待发队列。另行核查已外发消息或已上报事件，因为清理 CRM 记录无法撤回这些结果。记录遗留项、负责人和处理期限。

## 5. 停止放行与回退

| 触发情况 | 现场动作 |
| --- | --- |
| 健康检查失败、版本不一致、持续重启或关键角色无法登录 | 停止放行，保留日志和失败时间。确认数据兼容后切回旧应用。 |
| 报名无法保存、财务漏单、金额或权限异常、重复入账 | 暂停受影响的写入，保留受影响记录编号，通知销售和财务负责人。对账后由回退决策人选择恢复方案。 |
| 迁移中断、超出批准窗口或出现不可解释的数据差异 | 暂停继续迁移和业务写入。根据演练结果决定修复前进或恢复备份。 |
| 通知发错对象、重复外发或队列持续积压 | 先按批准方案隔离受影响的渠道或工作进程，保留队列与送达证据，再决定修复或回退。 |

1. **判断旧应用是否兼容当前库。** 兼容时按现有部署流程回退应用，并复查健康、登录、报名及收款清单。
2. **判断备份后的业务是否需要保留。** 若须恢复数据库，先冻结写入，保存现库及升级后增量，明确受影响时间段、记录和补录方案。由回退决策人和业务负责人批准后执行恢复。
3. **恢复放行前复验。** 核对版本、权限、应收及净收款，确认新增业务已保留或对账补录，检查队列是否会重复发送。记录恢复时间和最终决定。

业务操作口径见 [课程与报价](course-pricing.md)、[报名与收款核验](payments.md) 和 [系统初始化](system-defaults.md)。


## Production release gates

Record the owner, result, evidence and time for each check. Explain any skipped check. Block release if a required check fails or lacks evidence.

- [ ] **Protect existing records.** Approve the exact tables, fields and records a migration may change. Record a pre-release baseline and verify a recoverable backup in isolation. Compare customer ownership, staff permissions, enrollment prices, individual receipts and refunds, balances, tasks and notification queues. Account for normal business writes separately. Hold release and pause affected writes if a difference cannot be explained.
- [ ] **Run regression tests before release.** In staging, test staff permissions and password changes, course and discount selection, enrollment evidence, final amounts due, and finance verification. Include partial and full payment, refunds, corrections and duplicate submissions. Verify the production build and record the target revision.
- [ ] **Rehearse the upgrade.** Use authorized anonymized data or representative fixtures in an isolated database with simulated notifications. Verify historical records, migration time, repeat initialization and recovery. Rehearse preserving and reconciling business writes made after the backup.
- [ ] **Release Lark notifications.** Supply credentials through the private production configuration. Preserve the former environment settings until the first migration saves the group and personal delivery modes. Keep the worker paused until the channel, recipient, and queue checks pass and the release approver authorizes restart. [Lark release steps](#production-lark-release)
- [ ] **Check production after deployment.** Confirm health and the running revision. Verify sales and finance access and review existing enrollments, historical prices and balances. Observe the first real enrollment and payment.
- [ ] **Control test records.** Default to read-only production checks. Permit a labeled test write only after approval and proof of isolation from reporting, routing, tasks and notifications. Record IDs and use supported archiving or voiding procedures. Retain audit history and reconcile totals.
- [ ] **Stop and recover when necessary.** Hold release for health, permission, data, payment or notification failures. Roll back the application only when the old version can read the current database. Before restoring a database backup, freeze writes, preserve later records, and obtain approval for reconciliation. Verify balances, permissions and notification queues before reopening.

## Syarat rilis produksi

Catat penanggung jawab, hasil, bukti, dan waktu setiap pemeriksaan. Jelaskan pemeriksaan yang dilewati. Tahan rilis jika pemeriksaan wajib gagal atau belum memiliki bukti.

- [ ] **Lindungi data yang sudah ada.** Setujui tabel, kolom, dan catatan yang boleh diubah oleh migrasi. Catat kondisi sebelum rilis dan uji pemulihan cadangan di lingkungan terisolasi. Bandingkan penanggung jawab pelanggan, izin staf, harga saat pendaftaran, setiap penerimaan dan pengembalian dana, saldo, tugas, serta antrean notifikasi. Pisahkan perubahan bisnis normal. Tahan rilis dan hentikan sementara penulisan terkait jika ada selisih yang belum dapat dijelaskan.
- [ ] **Jalankan regresi sebelum rilis.** Di lingkungan uji, periksa izin staf dan perubahan kata sandi, pemilihan kursus dan diskon, bukti pendaftaran, tagihan akhir, serta verifikasi pembayaran. Cakup pembayaran sebagian dan lunas, pengembalian dana, koreksi, dan pengiriman ulang. Periksa hasil build produksi dan catat revisi target.
- [ ] **Simulasikan peningkatan versi.** Gunakan data anonim yang telah disetujui atau data simulasi yang mewakili kondisi nyata di basis data terisolasi dengan notifikasi simulasi. Periksa riwayat, durasi migrasi, inisialisasi ulang, dan pemulihan. Latih penyimpanan serta rekonsiliasi transaksi yang masuk setelah pencadangan.
- [ ] **Rilis notifikasi Lark.** Sediakan kredensial melalui konfigurasi produksi privat. Pertahankan pengaturan lingkungan lama sampai migrasi pertama menyimpan mode pengiriman grup dan pribadi. Jeda proses latar belakang sampai pemeriksaan kanal, penerima, dan antrean lulus, lalu aktifkan kembali setelah mendapat persetujuan rilis. [Langkah rilis Lark](#production-lark-release)
- [ ] **Periksa produksi setelah penerapan.** Pastikan layanan sehat dan revisi yang berjalan sesuai target. Periksa akses tim penjualan dan keuangan, pendaftaran lama, harga saat pendaftaran, dan saldo. Pantau pendaftaran dan pembayaran nyata pertama.
- [ ] **Kendalikan data uji.** Utamakan pemeriksaan baca saja di produksi. Izinkan penulisan data uji berlabel hanya setelah disetujui dan terbukti terisolasi dari laporan, penugasan, tugas, dan notifikasi. Catat ID dan gunakan prosedur arsip atau pembatalan yang tersedia. Simpan riwayat audit dan cocokkan total.
- [ ] **Hentikan rilis dan pulihkan bila diperlukan.** Tahan rilis jika ada masalah layanan, izin, data, pembayaran, atau notifikasi. Kembalikan aplikasi ke versi lama hanya jika versi tersebut dapat membaca basis data saat ini. Sebelum memulihkan cadangan, hentikan penulisan, simpan catatan yang masuk setelah pencadangan, dan minta persetujuan rencana rekonsiliasi. Periksa saldo, izin, dan antrean notifikasi sebelum membuka kembali layanan.
