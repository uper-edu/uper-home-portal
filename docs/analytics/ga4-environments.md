# GA三环境数据去向

DataPower账户 `399457165`。域名和业务接口保持不变。GA属性按正式／测试用途隔离；数据流按运行环境区分，不是一个路径一个流。

在线文档第五章为“GA接入与三环境统计规范”，入口为 `/crm?tab=docs#crm-guide-ga-analytics`。正文三语来源为 `src/components/crm/analyticsGuide.json`，环境表直接读取共享映射，导航、搜索、章节定位和打印沿用现有文档组件。

| 环境 | 属性 | Web数据流 | 衡量ID | 允许主机 |
|---|---|---|---|---|
| 本地3000 | UPER Test · 561827503 | UPER Local · 16251883595 | G-RTB5CWXVWV | localhost、127.0.0.1、IPv6回环及.localhost子域 |
| 测试站 | UPER Test · 561827503 | UPER Staging · 16252453328 | G-YTELN0GKTF | home.prototype.uperedu.com，HTTPS |
| 正式站 | UPER Production · 543450253 | UPER Web · 15159406809 | G-SZCY9WLK8X | uperedu.com、www.uperedu.com，HTTPS |

公开ID和目标主机统一维护在 `src/data/analyticsEnvironments.json`；私有 `.env.dev`、`.env.test`、`.env.prod` 只填写各自的 `VITE_UPER_MEASUREMENT_ID`。不得依赖通用 `.env` 的旧正式ID替代缺失配置。构建发现缺失或错配即失败；运行发现主机错配即不启动统计，业务操作仍可用。

## 如何看报表

- 本地与测试站全部为 `traffic_category=internal_test`。UPER Test可按数据流或environment分别查看development、test。
- 正式公开页面为customer，正式CRM/CMS等工作区为internal_employee。后者是有效的员工产品使用数据，应单独分析，不应当作无效测试整体排除。
- 正式公开页面确需测试时，在入口添加 `analytics_test=1`，同一标签后续访问保留internal_test；`analytics_test=0`解除。标记不会进入GA页面URL，不包含个人身份，不是权限控制。跨标签、跨设备需分别标记，无法自动识别所有测试。
- 客户获客分析选择production＋customer；员工产品分析选择production＋internal_employee；两者均排除validation_mode=simulated。不得只用“非internal”排除规则，误丢员工使用数据。
- 三个流关闭增强型衡量，采用现有安全手动事件。两属性使用同样的13个事件维度、2个毫秒指标及5个自定义关键事件。关键事件只按事件计数，无默认货币金额；课程报名不是付款。
- 不新增永久丢弃数据的过滤器，不删除旧历史数据。原正式属性更名不清理曾混入的本地／测试流量；历史报表须结合hostname、时间范围和可用维度判读。

## 配置完成与发布生效

2026-11-02本轮创建Staging流、规范属性／流名称并补齐正式属性的报表定义，仅更新本地文件和3000运行包。未发布测试站或生产站，所以不能声称两个远端已切换或已收到新配置事件。后续授权发布时，分别用test／prod构建，核对实际页面的衡量ID、环境、数据流和GA实收；本地dev包不能上传远端。

GA的URL是流的说明和安装参考；真正的数据去向由页面加载的衡量ID决定。本项目额外加主机核对，避免复制错误构建包造成混报。浏览器拦截、关闭页面及GA处理延迟仍可能造成漏计，业务数据库仍是业务结果依据。

事件成立、隐私与去重规则见[GA事件口径](./ga4-event-contract.md)。
