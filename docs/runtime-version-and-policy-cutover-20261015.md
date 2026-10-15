# 运行版本、健康状态与遗留测试策略收尾

## 授权边界

本轮仅本地实现与独立MySQL模拟验收，不切换3000、不部署公司站点、不推送GitHub。公司实际的TEST-handoff-delay策略本轮保持原样；停用步骤先在独立库验证，待后续切换授权时执行。没有改客户、账号、权限、客户归属、原任务期限、HSK题库或评分。

## 统一版本契约

- `/api/version` 返回启动时固定的环境与版本快照，`/api/health.version`使用同一对象；HTTP头为`X-UPER-Environment`与`X-UPER-Build`。全部禁止缓存，不返回数据库地址、私有配置路径、密码、密钥或Webhook。
- 环境为dev／test／prod；NODE_ENV=production只是运行安全设置，不会将公司test误标为prod。健康接口dataset读取实际TRIAL_DATASET，未知值明确unknown。
- 构建记录完整Git提交号、dirty标记、可执行源码摘要、公开前端配置摘要、构建ID及UTC构建时间。私有env、客户data、备份与日志不参加源码摘要。
- 前端编译常量、前端portal-build.json与后端portal-build.json来自同一份身份记录。源码在构建途中发生变化会拒绝完成构建；前后端身份缺失、不同或与运行环境不符时，打包服务拒绝启动。
- 本地源码模式明确标注source，不冒充不可变发布包；既有无版本元信息的运行进程不会因为代码更新自行获得新身份。只有后续重启／切换才能运行新接口。
- CRM／CMS／系统管理共用账号菜单中的版本信息。若已打开页面与服务版本不同，提示先保存工作再刷新，不自动刷新或清除草稿。
- 本轮仍有未提交源码，dirty=true是准确结果，不应手动改为false。后续在明确提交范围、审查并同步后，从对应提交重新构建再切换；不能只改Git SHA声称产物来自新提交。

## 停用遗留测试策略

维护工具：`cloud/mysql/retire-test-policy.mjs`。只处理精确ID TEST-handoff-delay，且要求其仍为handoff.requested、delay、60分钟；匹配不到预期条件时拒绝猜测。

- 需要明确停止应用及worker；公司环境还必须使用私有维护配置和数据库应用互斥锁。不是公开API，也不借助浏览器提供的操作者名称。
- 先preview取得与当前配置／版本／相关任务绑定的确认摘要，再apply并填写原因。配置或任务状态变化后需重新预览。
- 仅将该规则enabled设为false并增加规则版本；其他条件保持原值。相关pending／failed／unknown任务增加隔离记录，原状态、尝试次数、结果及期限不改写。发现sending任务则拒绝执行，先核对结果。
- 不处理其他规则或任务，不取消客户业务任务，不发送通知、不重放历史。幂等重试不会重复增加规则版本或审计事件。
- 停用不是删除历史。恢复旧代码也不能解除这些隔离或重新启用测试规则。

示例（仅供后续获得切换授权的操作人员执行）：

```sh
node runtime/cloud/mysql/retire-test-policy.mjs --env /PRIVATE/maintenance.env --services-stopped --preview
node runtime/cloud/mysql/retire-test-policy.mjs --env /PRIVATE/maintenance.env --services-stopped --apply --confirm PREVIEW_CONFIRMATION --reason 'Retire the approved legacy delay test policy'
```

维护env必须0600、当前操作人员拥有、不是软链。复用目标环境既有连接与稳定密钥；只在临时副本设置维护标志、worker=false，不覆盖正常服务的私有配置。

## 密码与WhatsApp

临时姓名密码重置的源模块、测试、模板开关与调用已清理。管理员设置临时密码恢复通常的至少8位校验，不改变现有密码哈希、账号、角色或会话。旧私有配置里残留的false值不会授权短密码；新清单不再提供此开关。

保留并纳入本轮的WhatsApp修复：从资料／测评页点击客户面板联系入口，切回跟进页显示统一预览。打开预览或外部工具不登记联系、不完成任务，停止联系状态的限制不变。无历史备注、原文或评分改写。

## 本轮验收结果

- 独立MySQL完整测试370项通过，0失败、0跳过；类型检查、dev与test独立打包、255条原生SQL清单及diff检查通过。新增和修改内容密钥扫描未发现实际密钥。
- 独立4504浏览器验证CRM、CMS及系统管理共用账号菜单显示同一构建身份；英文、印尼文、中文展示正确。资料与测评页的WhatsApp入口均能切回跟进页并显示预览，不打开外部工具、不记录人工联系、不完成任务。
- 遗留规则维护测试覆盖状态冲突、旧预览失效、在途发送拒绝、其他规则不变、历史状态不改写及隔离后worker零外部调用；没有对公司库执行停用。
- 本地3000的32张表及私有配置指纹前后完全一致。公司私有配置指纹一致；公司在线数据库期间有变化（会话、审计、对话、内容与活动等），本轮只读核对，不能据此宣称整库逐字节不变。
- 独立库未配置真实Lark渠道，界面的10项通知异常来自默认策略缺失渠道引用，不是10次发送失败；该库发送记录为0。本轮不包含新的AI调用或真实群实收验收。
- 版本界面截图与完整测试日志保存在本地忽略的`.local-backups/runtime-identity-20261015/`；其中模拟数据及私有验收文件不列入Git同步清单。

## 后续同步清单（本轮不执行）

1. 核对仅本轮运行版本、健康状态、策略维护、WhatsApp及三语文档／验收变更；不加入旧cloud-trial报告、旧模板、真实env、客户数据、日志或备份。
2. 再执行独立MySQL完整回归、类型检查、dev/test构建、原生SQL清单与diff检查，并扫描密钥。
3. 确认origin仍为uper-edu/uper-home-portal；获得同步授权后提交／推送，并核对远端SHA。
4. 从该提交重新构建，核对前后端身份与包摘要；GitHub同步不等于运行环境切换。

## 3000及公司切换清单（分别授权、分别执行）

1. 记录现有进程／发布号、静态入口、数据库与私有配置指纹；备份对应schema及私有配置。不要用备份覆盖仍在使用的数据库。
2. 确认无进行中的AI生成或通知发送，停止目标应用及worker。公司只操作home，不重启共享MySQL／nginx或其他站点。
3. 在既有目标库执行该策略的预览／确认停用；目标库没有规则时记录不存在，不创建它。隔离只针对该规则相关的未完成发送记录，不解除既有历史holds。
4. 保留目标环境原账号、权限、归属、期限、运营配置、通知条件与Webhook。公司复用现有.env.test；3000的旧.env→.env.dev迁移只在校验同一数据库与同一私有值后执行，不直接覆盖。
5. 原子切换同一次构建的前后端产物，再启动目标应用；核对/api/version、/api/health、HTTP头及账号菜单一致。源码模式要如实标注，不能用Git HEAD冒充旧进程版本。
6. 验证登录、权限、资料／测评页WhatsApp预览、跟进记录与任务状态。确认该测试策略停用，历史任务不发送，新事件仍按其他有效策略处理。涉及正式群实收须使用明确TEST客户并单独记录，不凭模拟结果宣称实收。
7. 对比客户数据、账号／角色、归属、测评分数、原任务期限及运营配置；列明预期的策略版本、隔离和审计变化，不冒称整个数据库零变化。
8. 回退保留当前业务数据库、正常私有配置和策略隔离。不要退回姓名密码例外，不恢复测试延迟规则，不解除历史holds。

## English

The shared account menu shows the running environment and build identity. `/api/version`, health and response headers use the same captured identity. Dirty builds and source mode are explicit. Save your work before refreshing when the page and server versions differ. Health reports the actual dataset. The retired name-password reset exception is removed without resetting accounts. The legacy delay policy is disabled only through reviewed maintenance; queued historical work is held rather than replayed. This round does not deploy, switch local3000, change company configuration or push GitHub.

## Bahasa Indonesia

Menu akun bersama menampilkan lingkungan dan identitas build yang berjalan. `/api/version`, pemeriksaan kesehatan dan header respons memakai identitas yang sama. Build dengan perubahan yang belum dikomit dan mode sumber ditandai jelas. Simpan pekerjaan sebelum memuat ulang jika versi halaman berbeda dari server. Dataset dilaporkan sesuai konfigurasi. Pengecualian reset kata sandi berdasarkan nama dihapus tanpa mereset akun. Kebijakan penundaan lama hanya dinonaktifkan melalui pemeliharaan yang ditinjau; antrean historis ditahan, bukan dikirim ulang. Tahap ini tidak melakukan deployment, mengganti local3000, mengubah konfigurasi perusahaan atau push GitHub.
