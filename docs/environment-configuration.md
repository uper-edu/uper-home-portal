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

## 当前实施结果与限制

公司test已按标准工具部署到`https://home.prototype.uperedu.com`，访客页面按已批准的员工试用范围开放，CRM／CMS／系统管理数据接口仍要求员工登录和角色权限；不再使用共享HTTP Basic门禁。原3000进程、原.env和32张表指纹保持不变。共享MySQL证书未修改；按用户确认，仅test的Docker内部mysql直连允许显式MYSQL_TLS_MODE=disabled，其他远端连接默认要求可信CA。实际结果、待验证项和受控入口说明见[公司部署验收](company-host-deployment-20261015.md)。

## English

Use exactly `.env.dev`, `.env.test` or `.env.prod`. Development uses the existing local MySQL data; company testing uses a separate synthetic database. Build with `build:dev`, `build:test` or `build:prod`; output goes to `build/<environment>`. Only public VITE variables enter browser assets. Server secrets are injected at runtime. Production configuration is reserved and startup remains blocked until explicitly provisioned.

## Bahasa Indonesia

Gunakan tepat satu berkas `.env.dev`, `.env.test`, atau `.env.prod`. Dev memakai MySQL lokal yang sudah ada; test perusahaan memakai basis data sintetis terpisah. Perintah `build:dev`, `build:test`, dan `build:prod` menghasilkan paket di `build/<lingkungan>`. Hanya variabel VITE publik masuk ke aset browser. Rahasia server disuntikkan saat runtime. Konfigurasi produksi masih dicadangkan dan startup ditolak sampai disiapkan secara eksplisit.
