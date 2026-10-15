# 管理员恢复与恢复后放行 — P1 运维说明

本说明取代 P0 手册中“仅模拟工具、无需签名授权”的旧执行步骤。功能实现与验收先在独立 MySQL／模拟账号完成；不代表已切换 3000 或已验证公司服务器。第二管理员由用户指定为 Ethan；本轮只在模拟环境授权，3000 的 Ethan 账号和原角色保持不变。

## 明确的授权边界

1. 正常状态优先由另一位完整 System Administrator 重置账号，不改变业务角色。至少维护 Robert、Ethan 两位有效完整管理员；CRM Manager、CMS Operator 本身不具备系统恢复权限。
2. 离线恢复前，须由当前已登录且拥有完整系统管理权限的管理员，在系统管理的“恢复准备与结果查询”中签发授权。选择**已有稳定账号**，填写原因，并分别确认是否允许重新启用、是否允许恢复系统管理权限。授权不执行改密，也不放行业务。
3. 授权精确绑定 MySQL 主机／端口或本机 socket、数据库、用户 ID／Login ID，默认一小时有效。针对备份恢复的授权还绑定准确备份 SHA-256；非当前数据库必须填写此校验值。目标暂限受支持的本地 MySQL 配置。
4. 授权文件有签名，但不是密码。它仍是敏感操作许可，不可发聊天、提交 Git 或公开存储。下载后移入私密目录并设为 `0600`。工具拒绝公开权限、符号链接、其他用户所有或过大的授权文件。环境文件和独立恢复记录同样私密保管。
5. 签名使用已有私密稳定 `ACCESS_OPERATION_KEY`，按恢复用途隔离计算；不创建通用恢复密码。密钥不返回浏览器、日志、凭证或报告。数据库中的签发凭证只有许可元数据，没有签名，不能直接作为可用许可。
6. 这是“已认证管理员签发 + 可信主机操作员执行”的边界，不是外部身份认证或双人审批系统。持有主机、数据库和服务端密钥的人具有高权限；其身份核验和审批依据须由公司运维制度保证。授权有效期内若需撤销，须在**目标库**执行明确关闭操作；不能承诺离线文件会实时获知另一环境的角色撤销。

## 没有有效预授权、全部管理员无法登录时

不能把“一小时预授权”当作长期应急兜底。此时使用可信主机离线审批流程，不能在网页上绕过登录，也不能随意把普通账号提升为管理员。

前提：独立可信的授权清单及**分开保管的已知校验值**，外部审批编号、审批人、维护原因、明确已有账号及允许的动作。目标账号必须在该可信清单中原本就是有效完整系统管理员；目标库中也必须已有这个稳定ID。缺少清单或可信校验值时工具拒绝，需责任人另行建立可信授权依据，不能拿待恢复库自身的未知权限自动背书。

```sh
node --import tsx cloud/mysql/access-recovery.mjs \
  --env /private/restore.env --emergency --user Ethan \
  --authorization-id UUID --authorization /private/emergency-authorization.json \
  --checkpoint-file /private/trusted-authorization.json \
  --checkpoint-sha256 TRUSTED_CHECKPOINT_SHA256 \
  --approved-by "Incident owner" --approval-reference "Approved incident ticket" \
  --reason "Approved emergency recovery"
```

预览包括目标库、已有账号／角色、可信清单校验值、外部审批编号和当前恢复实例。确认后使用同一组参数，加 `--apply PREVIEW_CONFIRMATION --services-stopped`；确需恢复已丢失的系统管理权限或重新启用时，分别明确加 `--restore-system-access`／`--enable`。

签发仅记录外部审批并生成私密签名文件，不重置密码。后续仍沿用上文标准恢复工具、精确预览、隐藏输入新密码、同ID执行与结果查询。审批人与编号是责任记录，**工具不会认证外部审批人的真实身份，也没有实现双人审批**。可信主机操作员必须在公司流程中核验，不能用任意填写的名称代替审批。

签发记录已提交但输出文件写入失败时，先查询签发结果：

```sh
node --import tsx cloud/mysql/access-recovery.mjs \
  --env /private/restore.env --authorization-result UUID
```

`authorized`只表示签发已记录，不表示密码已经恢复。目标和输入未变时用原ID、原确认值重试，修正私密输出路径即可；不会重复记录签发或改密。目标状态变化或已过期必须重新核对和批准。签名文件写出前没有可用许可；结果查询不输出签名或密码。签发与恢复使用不同审计类型，但关联同一授权／操作ID。

## 恢复流程

### A. 在管理员仍可登录时准备

- 用原有权限管理流程给 Ethan 添加系统管理员角色，保留原 CRM／CMS 角色、账号及密码。核对至少两位完整管理员。实际环境操作仅在后续切换授权范围内执行。
- 生成私密数据库备份与独立授权清单，可信校验值分开保管。授权清单的 SHA-256 只用于检测内容变化，不证明来源可信。
- 确定目标空库名称和备份 SHA-256，再签发绑定该目标及备份的许可。不要猜测目标，也不要把其他数据库许可改名使用。
- 授权准备接口：`GET /api/admin/access/recovery`、`POST /api/admin/access/recovery/authorize`。后者要求完整系统管理员、同源 JSON、原因、明确权限选项和操作 ID。原内容重试返回同一许可；改内容必须新申请。

### B. 导入备份并恢复指定管理员

- 停止目标应用及全部工作进程，保留切换后增量。只向明确选择的空库恢复经过校验的备份。
- 备份恢复自动清除旧会话、安装安全复核门禁、暂停历史待发送／发送中／未知通知、未处理事件及未完成任务的通知来源；原任务状态和截止时间不改。
- 可信操作员使用明确的私密环境文件。独立测试仍要求 `synthetic`／`test`；将来本地实际维护还必须使用 `ACCESS_RECOVERY_MAINTENANCE=true`、原有正确 MySQL 配置、`--services-stopped` 确认。执行前会检查应用端口没有监听；该检查不能代替停止独立工作进程的人工责任。本轮没有对 3000 执行维护。

```sh
node --import tsx cloud/mysql/access-recovery.mjs \
  --env /private/restore.env --authorization /private/authorization.json \
  --user Ethan --reason "Approved maintenance recovery"
```

核对返回的账号、目标、授权人、是否新增系统管理权限、原保留角色、备份恢复 ID 和确认校验值。若许可允许且确需重新启用停用账号，预览与执行都加 `--enable`。

```sh
node --import tsx cloud/mysql/access-recovery.mjs \
  --env /private/restore.env --authorization /private/authorization.json \
  --user Ethan --reason "Approved maintenance recovery" \
  --apply PREVIEW_CONFIRMATION --record /private/recovery-record.json \
  --services-stopped
```

新密码由操作员隐藏输入，至少12字符，不得等于账号ID、Login ID或显示名。必须重新确认当前账号和角色状态，过期、目标错误或陈旧预览拒绝执行。仅当签发时明确允许且目标确实缺少系统管理权限，才增加专用系统管理角色；不新增 CRM／CMS 权限。重新启用会恢复账号原保留角色，必须核对。

### C. 结果未知时先查询，不换 ID 再次改密

授权 ID 同时是恢复操作 ID。恢复改密、会话撤销、必要的恢复角色、审计及结果凭证在同一事务提交。同一内容并发重试只执行一次；不同密码或内容重用 ID 会被拒绝。

```sh
node --import tsx cloud/mysql/access-recovery.mjs \
  --env /private/restore.env --result RECOVERY_OPERATION_ID
```

| 状态 | 含义与下一步 |
| --- | --- |
| `committed` | 当前目标／恢复实例已提交；不再改密，用新凭据验证。 |
| `cancelled` | 原操作已关闭，迟到请求不能再执行。 |
| `unconfirmed` | 尚未找到结果，不证明失败；保留 ID，重查或明确关闭。 |
| `historical` | 该凭证来自其他目标或旧备份恢复实例，不证明当前环境已恢复。重新核对环境并申请当前许可。 |

提交后独立记录文件可能仍停在 `prepared`。应先查询数据库结果；确认后可明确修复该私密文件，而不重新改密：

```sh
node --import tsx cloud/mysql/access-recovery.mjs \
  --env /private/restore.env --result RECOVERY_OPERATION_ID \
  --reconcile-record /private/recovery-record.json
```

原操作始终未确认且需放弃时：

```sh
node --import tsx cloud/mysql/access-recovery.mjs \
  --env /private/restore.env --authorization /private/authorization.json \
  --user Ethan --reason "Approved close after outcome check" --close
```

关闭与执行互斥：已经提交则返回结果，不撤销已保存改动；尚未提交则创建终止凭证。不能靠删除本地文件绕过结果查询。过期许可仍可用于关闭或查询其原操作，不能执行新恢复。

### D. 逐人复核，再放行

- 启动隔离目标应用，使用恢复后的 Ethan 新凭据登录；其他旧账号暂不能进入业务。系统页面允许查询当前恢复结果，业务接口和工作进程保持门禁。
- 对照可信独立清单，或由责任管理员逐人确定应有权限。查看当前角色；启用账号先重置凭据，再确认授权。不能让旧备份自动决定今天的权限。
- 每次确认提交该账号当前授权快照；角色、启停或有效权限发生变化时，旧页面确认会被拒绝。刷新后须重新勾选独立核对确认。
- 放行要求所有账号当前授权已确认，并有至少两位有效完整系统管理员。数量不足即使全部复核也不能放行。
- 放行撤销复核期间会话，需使用新凭据重新登录。放行页面明确提示重新登录，不把随后的401显示成恢复失败。
- **放行不解除任何历史通知暂停记录，不自动重发失败或未知通知。** 历史客户归属、任务截止时间不重算。新的业务事件才进入既有策略；后续处理旧暂停事项须另外明确审核。

## Bahasa Indonesia

Robert dan Ethan menjadi dua Administrator Sistem dalam lingkungan simulasi. Jika semua administrator tidak dapat login dan izin sebelumnya tidak tersedia, persetujuan host darurat memerlukan checkpoint independen dengan hash tepercaya yang disimpan terpisah serta referensi dan nama pemberi persetujuan. Hanya administrator lengkap yang sudah ada dalam checkpoint dapat dipulihkan; identitas pemberi persetujuan tetap diverifikasi melalui prosedur perusahaan. Penetapan Ethan di 3000 belum dilakukan. Izin luring harus diterbitkan administrator lengkap yang sedang login, berlaku satu jam, dan terikat akun, tujuan serta checksum cadangan. Pengaktifan kembali dan pemulihan izin sistem memerlukan persetujuan terpisah. Berkas izin, lingkungan dan catatan disimpan privat dengan mode `0600`.

Operator host tepercaya memeriksa pratinjau lalu memasukkan kata sandi secara tersembunyi. Gunakan ID yang sama untuk mencoba ulang dan memeriksa hasil. `unconfirmed` bukan bukti gagal; `historical` bukan bukti bahwa lingkungan saat ini telah dipulihkan. Rekonsiliasi catatan lokal tidak mereset kata sandi. Penutupan hanya mencegah operasi yang belum tersimpan.

Setelah pemulihan, akses bisnis tetap dikunci. Reset kredensial akun aktif, tinjau setiap snapshot izin terbaru, dan pastikan dua administrator lengkap sebelum membuka akses. Login kembali sesudahnya. Notifikasi historis tetap ditahan; pekerjaan, pemilik dan tenggat tidak berubah otomatis. Konfigurasi server perusahaan, identitas operator nyata dan HTTPS belum disahkan oleh pengujian lokal ini.

## English

Robert and Ethan are the two System Administrators in the synthetic acceptance environment. When every administrator is unavailable and no valid pre-issued authorization exists, emergency host approval requires an independent checkpoint, its separately trusted hash and an external approval reference and named approver. Only an existing complete administrator in that checkpoint is eligible. Human approver identity remains a company-procedure responsibility. Ethan's live 3000 assignment has not changed. A signed offline authorization is issued by an authenticated complete administrator, lasts one hour, and binds the existing identity, exact target and backup checksum. Re-enabling and restoring system privileges require separate explicit scopes. Keep authorization, environment and result files private with mode `0600`.

A trusted host operator checks the exact-state preview and privately enters a new password. Reuse the authorization/operation ID for retries and result queries. `unconfirmed` does not prove failure; `historical` does not confirm recovery in the current target or restore incarnation. Reconcile a private result file without resetting again. Closing only prevents an uncommitted request; it never undoes a committed recovery.

Restored business access stays locked. Reset active credentials, approve every current authorization snapshot and retain two complete administrators before release. Sign in again afterwards. Historical notification holds remain; no ownership or deadline is silently rewritten. Actual company-server configuration, operator identity procedures and HTTPS remain unverified by local acceptance.
