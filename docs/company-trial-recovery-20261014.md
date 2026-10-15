# 公司测试环境管理员恢复与放行

目标：`home.prototype.uperedu.com`。适用于独立synthetic MySQL测试库。下列内容是后续获批维护的运行手册，不是本轮执行服务器命令的授权。本轮仅在本机新建的TLS MySQL与模拟账号中验收；3000未切换或改动。

## 授权与隔离

- 日常先由另一位有效System Administrator使用现有账号管理功能重置密码；恢复不添加CRM／CMS业务角色。Robert与Ethan作为两位模拟完整管理员验证；真实公司环境仍须明确审查授权，不自动提升其他账号。
- 离线维护使用独立0600环境文件，保留 `PORTAL_DEPLOYMENT=company-trial`、`NODE_ENV=production`、`APP_ENV=production`、`TRIAL_DATASET=synthetic`、原目标域名及可信TLS配置，另加 `ACCESS_RECOVERY_MAINTENANCE=true`、`PORTAL_WORKER_ENABLED=false`。不能用APP_ENV=test或本地3000切换标志绕过门禁。该维护文件不能用于启动应用。
- 在线签发仍须当前完整管理员、原因、已有稳定账号、明确启用／恢复系统权限范围、一小时有效的签名许可。恢复到新库时绑定准确库名及备份SHA256；密钥、许可签名及新密码不进入日志、Git或报告。没有有效预授权时，仅可信主机操作员可凭独立可信授权清单及分开保存的校验值、外部审批人／编号准备应急许可；目标须原本是清单中的完整管理员，不能选普通Sales。
- 维护操作员仍须停止应用和全部工作进程，并明确传入 `--services-stopped`。公司应用终身持有数据库运行锁，改密／应急签发在同一数据库锁下执行；应用未停时恢复拒绝，维护未结束时应用不能启动。凭据变更与运行锁位于同一个MySQL会话，连接故障导致事务回滚／锁释放；重试须先查持久结果。
- 公司应用只能在单实例内运行通知工作进程，独立本地worker脚本拒绝公司模式。应用运行锁检查失败时退出；不能仅检查维护容器的localhost端口来宣称另一容器已停。外部持有数据库管理员权限的人及非标准脚本仍属于公司主机治理边界，不能由该锁认证身份。

## 准备与执行

以下命令在对应的、已授权维护容器中运行。生产应用镜像只包含编译代码；备份维护容器还须有兼容的MySQL 8客户端，验证实际 `MYSQL_BIN_DIRECTORY`。容器文件映射、私密所有权及同一TLS／数据库目标须由运维核对。

1. 在正常完整管理员还能登录时，先备份数据库及独立授权清单。用系统页面的恢复准备功能下载仅绑定选定目标的私密许可。正常恢复不需要伪造备份哈希；从备份导入新库的许可必须绑定实际备份。
2. 如需恢复数据库，必须选择NEW EMPTY目标库并核对SHA256。导入安装恢复门禁、撤销旧会话，暂停历史pending／sending／unknown通知、未处理事件及未完成任务的通知来源；不改任务期限或原状态。

```sh
node runtime/cloud/company-trial/maintenance.mjs \
  --env /data/private/company-maintenance.env \
  --restore /data/private/approved-backup.sql \
  --sha256 APPROVED_BACKUP_SHA256 --services-stopped
```

3. 核对精确已有账号与授权人／目标／动作，预览不改密：

```sh
node runtime/cloud/mysql/access-recovery.mjs \
  --env /data/private/company-maintenance.env \
  --authorization /data/private/approved-authorization.json \
  --user Ethan --reason "Approved company maintenance"
```

4. 人工核对预览确认值后，以原操作ID执行；新密码由隐藏输入提供，不放命令参数、环境或聊天：

```sh
node runtime/cloud/mysql/access-recovery.mjs \
  --env /data/private/company-maintenance.env \
  --authorization /data/private/approved-authorization.json \
  --user Ethan --reason "Approved company maintenance" \
  --apply PREVIEW_CONFIRMATION \
  --record /data/private/recovery-record.json --services-stopped
```

只有许可明确允许重新启用时才加 `--enable`，预览和执行范围必须一致。同ID内容重试不重复改密、审计或授予权限；改内容必须重新审批。应用仍运行、预览陈旧、范围不符、记录文件无法安全落盘时均拒绝或回滚。公司普通离线改密也会在同一事务创建复核门禁、清空会话并暂停历史通知，不能跳过放行。

## 结果未知时先查

```sh
node runtime/cloud/mysql/access-recovery.mjs \
  --env /data/private/company-maintenance.env --result OPERATION_UUID
```

- `committed`：当前目标／恢复实例已提交，用新凭据核对；不再次改密。
- `unconfirmed`：尚未找到凭证，不等于失败，保留同ID继续核对。
- `historical`：其他数据库目标／旧恢复实例的凭证，不能当成本次成功。
- `cancelled`：原未提交操作已关闭，迟到执行不能再改密。

CLI只读查询在应用已重新启动后仍可使用；不要求关闭在线应用，不会解除历史暂停。页面用“查询恢复结果”，仅完整System Administrator能跨操作者查询 `offline-recovery`；Sales不能查看该结果。记录文件提交后落盘失败时，先查结果，再用 `--reconcile-record /data/private/recovery-record.json` 修复私密文件，不重复改密。

## 复核与放行

1. 移除维护开关，使用原正常公司运行配置启动；保留正常通知模式。维护文件会被应用启动门禁拒绝。
2. 仅已恢复管理员可登录复核，其余旧凭据不能进入业务。CRM、CMS、聊天、其他业务API保持423锁定，通知worker暂不处理任务。恢复结果可正常查询。健康检查返回200并明确businessReady=false／reviewRequired=true，表示受限管理服务可用，不表示业务已放行，避免部署健康检查误把复核门禁当作故障回滚。
3. 对照独立可信清单逐人核对当前角色／启停；启用账号必须先重置强密码，逐人确认当前授权快照。旧页面或角色已变更的确认拒绝，须刷新复核。
4. 必须所有账号复核完成，且有至少两位有效完整System Administrator。CRM Manager／CMS Operator标签本身不满足条件。日常权限与客户归属不自动扩大。复核期间还必须保留至少一位有效完整管理员在recoveryAdmins许可名单中；不能仅因库里另有一位尚不能进入复核的管理员，就停用或移除唯一复核管理员的权限。
5. 放行会撤销复核期间会话，明确重新登录。历史通知hold记录保持不变，不自动重发失败、未知、暂停通知，也不重算任务期限。新业务事件才按现有Owner→CRM Manager路由进入策略。
6. 核对放行及应用／worker重启后历史任务、事件、通知状态和attempts仍不变；再用一个NEW模拟客户验证站内通知。Lark接口接受、群内实收、员工已读仍是不同事实。

## 已验证与实际限制

本机独立TLS MySQL、编译后纯Node应用、目标域名SNI的本地HTTPS代理、模拟强密码账号，覆盖普通恢复、空库备份恢复、Ethan恢复、结果CLI／API查询、重复请求、事务回滚、逐人复核、双管理员门槛、会话撤销、历史不重放、恢复后新事件通知。真实AI／Lark调用为0。

尚未验证公司Linux容器／VPN、实际MySQL版本／证书、维护容器客户端及私密文件挂载、网络分区、真实操作员审批身份与双人审批、备份和校验值的独立保管。工具记录审批证据，不能认证填写的审批人或提供真正的双人审批。若稳定服务端密钥、可信清单或已有稳定管理员身份丢失，流程拒绝，须另行建立可信恢复依据；没有通用密码或网页后门。

## English

Company offline recovery requires a separate private production maintenance configuration, paused workers, explicit stopped-services confirmation and the same database runtime lock used by the single application instance. Do not use test-mode flags. Use signed, scoped authorization for an existing identity; emergency authorization additionally requires an independently trusted checkpoint/hash and named external approval. Human approval identity and dual control remain company responsibilities.

Ordinary company recovery and backup restore both lock business access, revoke sessions and hold historical notifications. Query the same operation ID before retrying; committed, unconfirmed, historical and cancelled are distinct. Review every current account, reset active credentials and retain two complete System Administrators before release. Release revokes sessions again; sign in with new credentials. Historical holds remain after restart, while new events may generate notifications. Local synthetic acceptance is not company-host, real Lark receipt or real disaster-recovery acceptance.

## Bahasa Indonesia

Pemulihan luring perusahaan memerlukan konfigurasi pemeliharaan produksi privat yang terpisah, pekerja berhenti, konfirmasi penghentian layanan, serta kunci runtime basis data yang sama dengan satu instans aplikasi. Jangan memakai flag mode uji. Gunakan izin bertanda tangan dengan cakupan jelas untuk akun yang sudah ada. Izin darurat juga memerlukan checkpoint/hash independen tepercaya dan persetujuan eksternal bernama; verifikasi identitas manusia dan kendali dua orang tetap menjadi tanggung jawab perusahaan.

Pemulihan akun biasa maupun backup mengunci akses bisnis, mencabut sesi, dan menahan notifikasi historis. Periksa ID operasi yang sama sebelum mencoba ulang; committed, unconfirmed, historical, dan cancelled berbeda. Tinjau tiap akun terkini, reset kredensial akun aktif, dan pastikan dua Administrator Sistem lengkap sebelum membuka akses. Sesudahnya login kembali. Hold historis tetap berlaku setelah restart, sedangkan peristiwa baru dapat menghasilkan notifikasi. Uji sintetis lokal bukan bukti penerapan server perusahaan atau penerimaan nyata Lark.
