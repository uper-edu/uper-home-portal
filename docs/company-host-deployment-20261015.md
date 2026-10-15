# 公司测试环境部署与验收

最新状态：公司测试环境自动Lark已按新授权切换为正式发送，仅处理切换后的新事件，历史队列已隔离。新客户通知已由用户确认实收；完整切换、任务取消与保护核对见[自动Lark验收报告](company-lark-live-acceptance-20261015.md)。下文“仍模拟”描述保留为此前验收时的历史状态。

日期：2026-10-15。目标：`https://home.prototype.uperedu.com`。通过 `uper-server-deploy` 标准工具的项目专用适配器部署，发布版本 `20261015-004119`。没有推送GitHub。

## 当前访问状态更新

最新账号状态：用户随后要求公司测试环境九个账号改为统一测试密码，已通过常规管理员重置接口逐项完成。具体密码仅保存在忽略的私有凭据文件。前述姓名密码记录为历史状态，已失效；用户自改后不会被启动脚本覆盖。本地密码不变。

2026-10-15：用户已授权客服及销售公网试用。已用标准工具移除home站点的共享HTTP Basic门禁；HTTPS、noindex、员工独立登录、角色权限保留。匿名访问首页／chat／crm／cms／system及health成功，匿名员工数据接口401；销售登录成功，System／CMS越权403。应用容器未重启，证书和其他站点配置未改变。下文首次部署的私有门禁记录为历史状态。

Monite已按用户明确授权新增System Administrator，保留CRM Manager与CMS Operator；登录、系统管理及恢复就绪查询通过。当前公司测试管理员为Robert、Ethan、Monite。凭据文件已补充Monite；不是姓名密码。本地同等授权已通过用户正常登录的Robert管理员会话完成；修改前私有备份，保存后重新打开及数据库只读核查三角色一致，审计记录正常。仅用户、操作结果及审计表改变，客户、任务、通知与运营配置保持不变。未修改任何密码。

## 访问与边界

- 首页、`/chat`、`/crm`、`/cms`、`/system`及`/api`使用统一域名和有效HTTPS；证书有效期至2027-01-13，HTTP跳转HTTPS。
- 全站HTTPS Basic访问保护叠加员工数据库登录；所有页面禁止索引。浏览器首先显示的Sign in是站点保护，不是系统员工登录。站点用户名为`uper-trial`；密码及测试员工随机密码仅交付到本机忽略目录的`test-access.txt`，不写在本文或Git中。未开放外部测试者。
- 独立schema `uper_trial_home`、独立账号 `home_trial`，只授权该schema；只使用模拟身份和客户，没有导入本地客户、员工密码哈希或历史通知。
- 按用户明确要求，公司测试MySQL使用Docker私有backend网络`mysql:3306`直连，无客户端证书。显式`MYSQL_TLS_MODE=disabled`例外仅允许company-trial、test、synthetic、production安全门禁及内部mysql主机；公共端点及prod不可用该例外。没有改共享MySQL证书、重启MySQL或变更其他schema。
- 配置为服务器私有`.env.test`，仅运行时注入；前端和后端构建包不含密钥／环境文件。应用不映射宿主端口，只有nginx代理入口。

## 已通过的验收

| 验收 | 结果 |
| --- | --- |
| 独立MySQL回归 | 358通过，0失败，0跳过；类型检查通过 |
| 分环境构建 | dev、test、prod均构建成功；prod启动仍受未建设门禁禁止 |
| Linux运行依赖 | Node24、mysql2、sharp及70个编译模块检查通过 |
| 私有入口与HTTPS | 无访问凭据401；有凭据健康接口200；Secure Cookie；HTML noindex |
| 员工与权限 | 9个模拟账号登录通过；销售不能访问System/CMS；CMS-only账号不能访问CRM；Robert和Ethan为两位System Administrator；恢复就绪查询通过 |
| Campaign闭环 | 从带Campaign ID的聊天入口创建会话、提交模拟问卷、服务端重新计算快速测评，得分16；真实OpenAI gpt-4o完成咨询，回复及模型信息入库 |
| 销售跟进 | Fadhil认领成功；其他销售不能读取其客户或转移归属；10次相同提交只生成1条记录；4个任务中只完成选定任务及取消其待发通知；等待、复查、恢复保留原任务期限 |
| 明确报名及统计 | 当前闭环Campaign登记1、测评1、报名1、确认线上参加1、线下到场0；缺少金额保持未知，不计算虚构ROI |
| 重启与不重放 | 初始化凭据文件及引用已删除；重启只涉及home应用，账号保留；冻结的模拟历史事件没有被处理或生成通知任务 |
| 通知 | 自动worker启用、渠道保持simulation；站内accepted 27、模拟Lark 5、取消1、未来待发1（本次取样）。独立实际TEST卡片仅发送1次，Lark HTTP200／业务码0；用户已确认群内实收、内容及CRM链接正常 |
| 备份 | 公司新schema私有mysqldump备份创建成功；没有导出其他schema |
| 本地与其他项目 | 本地原.env及32张表完整指纹相同；原free-hsk-assessment配置指纹与current版本相同、HTTPS200及证书校验通过；共享基础服务未重启 |

完整闭环Campaign：`test_company_0457bbfe`。模拟客户ID：`9e36b0dc-5abb-4702-831f-39cd0b094ab1`。AI会话ID：`d3bf017b-54aa-4428-9a4f-bf1b5994419f`。它们仅是可查验的模拟验收标识。

第一次验收脚本在构造测评时错误地给非听力题添加播放次数，被本地校验拒绝；修正测试数据后重新完成上述闭环，评分算法未改动。第一次未完成的模拟登记保留为测试痕迹，不能把全站模拟总数当作上述单Campaign的闭环统计。

## 未验证与限制

1. 公司站点的API闭环已通过，**不等同于浏览器完整闭环通过**。自动化内置浏览器能显示员工登录页，但其HTTP Basic凭据缓存／后续刷新失败；登录切换中还记录到一次DOM removeChild错误。尚不能确认该错误来自浏览器注入还是产品。保留保护，未为自动化关闭认证；需使用正常浏览器验证登录、四页签和三语，再决定是否需要修复产品。
2. 真实Lark群实收、内容及CRM链接已由用户确认；不代表员工已读。后续新事件目前仍模拟发送，切为自动真实发送需明确运行决定并检查待发测试任务，不能重放历史记录。
3. 本轮实际AI验证为OpenAI；未在公司部署强制制造OpenAI失败，不把本地既有DeepSeek故障切换验收冒充本次公司实测。
4. 实际服务器新schema已备份；本轮未在共享服务器另建恢复库执行恢复／管理员安全放行演练。独立MySQL既有自动化验收不等于共享服务器恢复演练。
5. 未开放外部用户、未做真实销售效率验证、未建设prod。公开入口可路由但需要站点访问凭据，不应表述为网络层VPN白名单。

## 运维与回退清单

- 私有配置：`/opt/project/home/api/.env.test`，0600；容器数据：`/opt/project/home/api/data`；运行目录：`/opt/project/home/api/current`。
- 当前镜像／容器：`home-api:20261015-004119`／`home-api`。Compose服务名是`api`。只操作此项目，禁止全局镜像清理或重启共享MySQL／nginx容器。
- 用标准工具适配器管理此项目；适配器仅对home更改同域代理、env_file、受控访问和schema名。新发布仍须本地test构建、包扫描、备份、标准预检、nginx校验及HTTPS验收。
- 配置备份及访问凭据属于秘密；不要使用会把完整环境变量打印到终端的env查询命令，不要提交实际.env.test。
- 普通代码回退保留当前MySQL业务数据；不要用旧备份覆盖最新数据。首次部署尚无已验收旧home服务版本，不能声称具备已演练的一键业务回退。紧急处置先暂停home worker／站点访问，保留数据库与日志，再修复或部署已验证版本。
- 需要恢复备份时另走维护门禁、签名授权、管理员核对与安全放行，历史通知保持冻结，不能直接启动旧数据发送worker。

证据与凭据仅位于本机忽略目录`.local-backups/company-deploy-20261015/`及服务器home项目私有目录，不进入Git。用户可通过本机`test-access.txt`获得访问凭据。


## 公司测试账号姓名密码重置（2026-10-15）

用户在明确了解公网访问和管理员账号影响后，确认重置现有九个测试账号。修复已由标准工具部署为`20261015-010709`，共享门禁保持取消；本地3000没有切换或重启。

- 修改前备份独立公司schema及私有环境，记录现有身份、业务角色和业务表指纹。
- 仅公司test、synthetic、canonical HTTPS允许临时开启`ACCESS_COMPANY_NAME_PASSWORD_RESET`；短密码仅限目标Login ID完全匹配。重置沿用管理员授权、角色委派、版本检查、事务审计和幂等结果查询。
- 九个账号重置成功，九个旧会话全部失效，九个新密码均登录通过。Robert、Ethan、Monite管理员权限通过，普通销售仍不能管理用户。结果查询全部committed。
- 临时开关已关闭；不会在每次重启时重置账号，不改变未来常规密码校验。没有增加首次登录强制修改密码功能。
- 浏览器以Monite姓名密码登录`/system`成功，展示System Administrator，截图仅保存在忽略的本机证据目录。
- 本地全部密码哈希及.env指纹相同，未改本地密码。没有推送GitHub、修改HSK规则或向Lark补发历史通知。

English: With explicit user approval, all nine existing company-test passwords were reset to their exact, case-sensitive Login IDs. Old sessions were revoked. The temporary reset switch is off; roles and local passwords are preserved.

Bahasa Indonesia: Atas persetujuan eksplisit pengguna, kata sandi sembilan akun uji perusahaan direset agar sama persis dengan Login ID masing-masing, termasuk huruf besar dan kecil. Sesi lama dicabut. Sakelar reset sementara sudah dinonaktifkan; peran dan kata sandi lokal tetap dipertahankan.

## 2026-10-15 浏览器闭环及测试辅助功能更新

当前公司home发布为20261015-020550。浏览器Campaign→问卷→快速测评→真实gpt-4o→认领→逐项跟进→等待／复查→恢复→模拟报名完成；详细结论、限制和剩余工作见 company-browser-acceptance-20261015.md。当前自动Lark仍为simulation，单次TEST实发与群内实收分开验收。

系统管理新增“测试环境和账号”，仅向完整系统管理员提供预置账号目录及纯文本复制；用户后加账号不列出，角色实时读取，变更后的密码不显示或重置。私有运行时配置 PORTAL_TEST_DIRECTORY_ENABLED=true、PORTAL_TEST_DIRECTORY_INITIAL_PASSWORD=占位符；后者仅由部署管理员安全注入，不能进入Git、发布包或普通日志。非synthetic/test及未启用环境不提供目录。

organic为永久只读系统来源。新访客/chat、?c=home及?c=organic统一归因；其他Campaign独立统计，旧客户首次归因保留。没有改HSK评分或客户分类规则，没有切换本地3000，没有推送GitHub。
