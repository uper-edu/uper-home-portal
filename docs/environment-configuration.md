# dev／test／prod 环境配置与打包

按最新确认：dev在本机localhost运行，test在公司云端服务器运行，使用彼此独立的数据源。统一变量名称和构建方式，不共用本地客户库；prod尚未建设。

| 环境 | 配置文件 | 数据库 | 打包产物 |
| --- | --- | --- | --- |
| dev | `.env.dev` | 保留现有本机MySQL／uper_local_crm | `build/dev/web`、`build/dev/runtime` |
| test | `.env.test` | 公司MySQL／uper_trial_home，独立模拟数据 | `build/test/web`、`build/test/runtime` |
| prod | `.env.prod` | 配置项保留，值未建设 | `build/prod/web`、`build/prod/runtime` |

真实配置全部忽略于Git；仅提交 `.env.dev.example`、`.env.test.example`、`.env.prod.example` 占位符模板。原 `.env` 不再自动加载，现有运行进程和原配置保留作本次核对／回退，不由新命令删除或改写。

## 模板与实际值的交付

Git只保存变量名称、说明和占位符。首次创建时在目标环境执行 `cp -n .env.test.example .env.test`，再以0600权限保存并由部署负责人填入实际值；dev／prod替换对应名称。已有私有文件继续复用，只按需更新缺失项，不能每次复制模板覆盖。

数据库账号由数据库管理员提供；AI Key由对应服务管理员提供；Webhook由CRM Bot管理员提供；稳定操作密钥在首次建设时生成并保管。实际值通过受控密钥渠道或目标服务器私有文件交付，不进入Git、聊天、截图、构建日志或发布包。生产尚未建设，不能直接复用测试凭据。

## 本地命令

- `npm run dev`：显式加载 `.env.dev`，运行本地源码。当前已有3000进程时不要再次启动。
- `npm run build:dev`／`npm run build:test`／`npm run build:prod`：分别读取对应环境的公共参数，构建前端及后端纯Node运行包。`npm run build`等同build:dev。
- `npm run start:dev`／`npm run start:test`／`npm run start:prod`：加载对应的私有配置后运行已经构建的同环境后端。
- 迁移、备份、工作进程使用相同加载器，默认dev；显式设置 `PORTAL_ENV=test` 可选择test。涉及写入前仍须检查目标库及操作授权，命令不会自动迁移客户数据。
- 恢复／维护CLI仍要求明确的私有文件路径；使用该环境的配置副本及维护标志，不能把维护配置交给普通应用启动。

## 加载与安全边界

只读取指定文件，不合并 `.env`、`.env.local` 或另一个环境。显式选择环境时清除继承的其他环境数据库、AI、通知及故障测试参数，再加载对应文件。文件缺失、目标不一致或发布包环境与运行环境不一致立即报错。

Docker Compose通过服务器 `/opt/project/home/api/.env.test` 注入配置，容器使用 `PORTAL_ENV=test`、`PORTAL_ENV_SOURCE=injected`。真实环境文件不上传进构建包。公司标准工具适配器只将home项目的env_file及配置读写改为.env.test，其他项目保持原标准。

`PORTAL_ENV`是部署环境名；`NODE_ENV`与`APP_ENV`控制运行安全。云端test仍为production运行安全设置，保留HTTPS、Secure Cookie、数据库账号认证及模拟数据隔离，不能为了叫test而改成宽松的APP_ENV=test。

前端构建只读取 `VITE_` 公共变量，拒绝带密钥／密码／数据库／Webhook含义的VITE变量；不内嵌MYSQL_TRIAL_URL、AI Key或Lark Webhook。后端环境参数在启动时注入，构建包记录环境标识而不固化凭据。

prod可验证静态构建，但 `PORTAL_PRODUCTION_READY=false`，启动将明确拒绝。未来需单独建设生产数据库、域名、密钥和发布门禁，不得复制test数据或凭据直接放行。

## MySQL 迁移与验收基线

整理日期：2026-10-15。以下是已完成阶段的结论摘要，不是本轮重新迁移、恢复、调用外部服务或部署的结果。旧迁移进度、临时端口、账号名单和测试数量不作为当前环境配置依据。

- **唯一业务数据库**：主工程、本地3000及公司测试方案使用MySQL；客户、聊天、测评记录、任务、员工账号、CMS内容／媒体和通知持久化走同一主工程实现。静态题库与三语文案仍可使用JSON；没有改变HSK内容或评分规则。
- **已有数据保护**：2026-10-13的数据迁移演练核对21张源业务表，并单独核对营销活动与7类CMS集合；账号凭据哈希、角色、客户归属、原文、测评分数、任务期限和通知快照保持一致。CMS小数精度问题在演练中被发现并修复，失败导入没有部分提交。
- **迁移后核对**：CMS增量迁移核对23张已有业务表不变，独立恢复核对27张表（含媒体和附件）；2026-10-14本地原生MySQL切换前后28张表指纹一致。这些数量仅表示各次验收快照，不是当前固定表数。认证、读取、并行访问造成的预期变化应单列，不能冒称长期全库不变。
- **事务和任务**：独立InnoDB验收覆盖失败回滚、重复提交、并发认领、指定任务完成及其待发通知精确取消；未选任务、客户归属、已有期限和无关通知不随普通保存被重写。CMS验证版本冲突、批量失败回滚和上传去重；招聘存储与CMS权限分离。
- **通知恢复**：独立进程验证站内任务租约恢复和并发去重；外发结果未知不盲目重发。迁移冻结、恢复暂停和已取消记录保持隔离；历史失败仍保留真实状态，不因渠道配置修复或程序升级自动补发。恢复后新事件与历史队列分别验收。
- **功能验收边界**：2026-10-13独立模拟环境完成Campaign入口、问卷、快速测评、真实OpenAI咨询、注入主模型故障后的真实DeepSeek切换、认领与跟进；完整测评判分在API层核对。CMS浏览器验证保存、发布／撤回、图片和失败草稿保护；三语头部及390／768／1280px布局在其当次版本检查通过。这些结果不等于所有当前浏览器、外部服务或真实销售效率已经重新验证。
- **账号与权限**：迁移保留账号和角色，不通过部署重置密码或按旧文档名单重新授权。当前角色、Owner候选及可访问范围以持久配置和服务端权限检查为准。临时姓名密码重置例外已移除；移除例外不自动修改既有密码。
- **备份与恢复**：原始备份、截图、逐表核对和操作日志继续私有保存，不纳入Git或发布包。普通代码回退保留最新MySQL业务数据；数据库恢复另走空目标库、校验、授权、管理员复核及安全放行，历史通知不重放。具体步骤与限制见[恢复与放行手册](company-trial-recovery-20261014.md)。

当前公司部署、浏览器闭环和真实Lark实收分别以[公司部署验收](company-host-deployment-20261015.md)、[浏览器验收](company-browser-acceptance-20261015.md)和[通知实发验收](company-lark-live-acceptance-20261015.md)为依据；报告内的当次状态不替代运行环境检查。真实销售连续使用、当前目标主机恢复演练及其他未验证项按对应报告继续跟踪，不能从本地模拟通过推定完成。

## 本地独立验收与模板入口

常规部署配置只使用根目录三个环境模板。不要复制本地3000私有连接到独立验收，也不要用公司test模板启动本机模拟库。独立测试必须显式选择新的模拟schema、独立socket／端口、临时强密码和独立构建目录；通知关闭或模拟，只有另行授权才注入真实AI或Lark配置。

现有数据库测试夹具见[MySQL测试辅助程序](../tests/helpers/mysql.mjs)，执行边界见[验收说明](portal-validation.md)。普通`npm run build`会写入`build/dev`；3000正在使用该目录时，验收必须在临时源码副本中构建，不能覆盖在线资源。

## 当前实施结果与限制

公司test已按标准工具部署到`https://home.prototype.uperedu.com`，访客页面按已批准的员工试用范围开放，CRM／CMS／系统管理数据接口仍要求员工登录和角色权限；不再使用共享HTTP Basic门禁。原3000进程、原.env和32张表指纹保持不变。共享MySQL证书未修改；按用户确认，仅test的Docker内部mysql直连允许显式MYSQL_TLS_MODE=disabled，其他远端连接默认要求可信CA。实际结果、待验证项和受控入口说明见[公司部署验收](company-host-deployment-20261015.md)。

## English

Use exactly `.env.dev`, `.env.test` or `.env.prod`. Development uses the existing local MySQL data; company testing uses a separate synthetic database. Build with `build:dev`, `build:test` or `build:prod`; output goes to `build/<environment>`. Only public VITE variables enter browser assets. Server secrets are injected at runtime. Production configuration is reserved and startup remains blocked until explicitly provisioned. MySQL migration acceptance preserved identities, ownership, raw content, assessment scores and deadlines. Historical notification work is held rather than replayed; normal code rollback retains current business data. Isolated acceptance must use a new synthetic database and separate build output, never the running local3000 database or build. Dated evidence does not establish current live-service health.

## Bahasa Indonesia

Gunakan tepat satu berkas `.env.dev`, `.env.test`, atau `.env.prod`. Dev memakai MySQL lokal yang sudah ada; test perusahaan memakai basis data sintetis terpisah. Perintah `build:dev`, `build:test`, dan `build:prod` menghasilkan paket di `build/<lingkungan>`. Hanya variabel VITE publik masuk ke aset browser. Rahasia server disuntikkan saat runtime. Konfigurasi produksi masih dicadangkan dan startup ditolak sampai disiapkan secara eksplisit. Penerimaan migrasi MySQL mempertahankan akun, kepemilikan pelanggan, teks asli, nilai asesmen dan tenggat tugas. Notifikasi historis tetap ditahan; rollback kode mempertahankan data bisnis terbaru. Uji terisolasi wajib memakai basis data sintetis baru dan direktori build terpisah, bukan basis data atau build local3000 yang berjalan. Bukti bertanggal tidak membuktikan kondisi layanan saat ini.
