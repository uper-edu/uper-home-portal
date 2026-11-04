# UPER 推广归因与转化跟踪

开发与验收基线。本文记录当前设计和验收口径。现有 GA 事件的成立条件及环境配置分别见[事件口径](./ga4-event-contract.md)和[三环境配置](./ga4-environments.md)。

## 1. 完整需求

1. **支持两种独立落地页。** `/link` 聚合在线咨询、手册和社群。Instagram、YouTube、TikTok 等平台共用同一页面。`/chat` 可以独立推广，适用于广告、视频说明、WhatsApp 和二维码，无需经过 `/link`。
2. **支持官网站内入口。** 官网首页、课程页等可以链接到 `/link` 或直接打开 `/chat`。记录哪个站内入口促成了咨询，同时沿用已识别的外部获客来源。
3. **区分自然推广、付费推广和无标记访问。** 运营可按活动、平台、推广方式和具体投放位置查看流量与转化。无法核验推广链接的访问保留相应状态。
4. **跟踪完整路径。** 分别记录落地访问、按钮点击、咨询到达和已确认的业务结果。访客只预览或下载手册时，仍可按原推广链接统计。
5. **明确 CRM 与 GA 分工。** CRM 管活动、推广链接、客户首次来源、报名和核验收款。GA 管访问、站内路径和转化漏斗。两边可按同一活动和推广链接口径对照。真实用户、员工和测试流量分开。
6. **降低运营维护成本。** CRM 生成推广链接，运营选择配置后复制即可。兼容已发布的旧链接，保留历史客户归因。

## 2. 术语与数据结构

| 术语 | 字段 | 含义 |
| --- | --- | --- |
| 营销活动 Campaign | `c` | CRM 活动代码，例如 `hsk-nov`。一个活动可以包含多条推广链接。 |
| 推广链接 Promotion Link | `p` | 全局唯一的推广链接 ID。关联一个活动，配置平台、推广方式、投放位置或素材及落地页。 |
| 自然推广 | 推广方式 | 未付费发布的外部推广，例如 Instagram 主页或 YouTube 自然视频。 |
| 付费推广 | 推广方式 | 付费广告或其他付费投放，和自然推广可属于同一个专项活动。 |
| 无标记访问 | 来源状态 | 未携带可解析的推广标识。GA 仍可根据可用的引荐或搜索信息识别部分来源。 |
| 站内入口 | `entry_point` | 用户点击咨询前所在的站内入口，例如 `homepage_widget` 或 `linkhub`。首选记录为事件字段，可随站内跳转传递。 |
| 站内按钮 | `target`，按需 `cta_id` | `target` 区分咨询、手册等目标。仅需比较同类按钮的位置或版本时增加 `cta_id`。 |
| 界面语言 | `lang` | 控制界面展示。语言切换不改变既有 `p`。 |

常设自然社媒入口共用一个「日常自然推广」Campaign，示例代码为 `social-bio`。按平台和投放位置生成各自的 `p`。专项活动有独立的 Campaign，可同时包含自然和付费推广。报表按「自然推广」跨活动汇总。无标记访问沿用 CRM 的系统 `organic` 兜底，`p` 留空，并与已验证的自然推广分开呈现。系统预置八条固定链接。Instagram、TikTok、YouTube 各有聚合页与直达咨询，分别使用 `bio-ig`／`chat-ig`、`bio-tt`／`chat-tt`、`bio-yt`／`chat-yt`。官网使用 `home-link` 和 `home-chat`。活动及预置链接只读，可以追加新链接。历史 `instagram-bio` 记录保留。

## 3. 归因与传递

1. **生成。** CRM 根据运营选择的活动、渠道、推广方式、位置和落地页生成 `/link?p=…`、`/chat?p=…` 或已纳入落地页白名单的官网地址。新链接只需 `p`。自建链接编号由来源、推广方式、位置或素材（缺省用媒介）、落地页和语言组成，并追加唯一后缀。在 MySQL 强制全局唯一并建立可按 `p` 直接查询的索引或映射。若新增表，以普通关联列和索引建模，由应用在同一事务校验链接归属。
2. **解析。** UPER 服务查询自己的 MySQL，按 `p` 取回活动及推广链接信息。三种落地入口共用规则，包括 `/link`、`/chat` 和携带推广链接的官网页。服务端解析结果用于 GA 首次上报，提交业务数据时再次由 CRM 核验。解析失败或超时可继续浏览和咨询，来源标记为未知或未验证。
3. **站内跳转。** 官网和聚合页沿用已解析的外部来源。在线咨询跳转保留原 `p`，需要串联后续漏斗时同时传递站内入口上下文。比如 `/chat?p=bio-yt&entry_point=linkhub`。使用 URL 参数、标签页状态或现有等效机制时，均须验证刷新和新标签打开能按既定路径正确识别。无可用站内上下文时按直接或未知入口处理。
4. **兼容。** 旧 `c+p` 一致时正常解析，冲突或未知 `p` 标为未验证，不把该次访问计入任一已验证推广链接。已验证的 `p` 以 CRM 登记值为准。只有旧 `c` 时，可按有效活动做活动级归因。只有 UTM 时，GA 保留合法的手工标记，CRM 仅在有明确映射时采用活动归属。显式未知参数不能触发 Instagram 兜底。
5. **保存。** CRM 在首次登记时留存客户获客来源、核验状态及可用的推广链接信息。后续通过另一广告返回，GA 可记录新的访问来源，CRM 保留原始获客来源。复制或转发专属链接仍计入原推广链接的表现，报表措辞使用「经某平台专属链接进入」。

站内按钮用 `entry_point` 和点击事件表达。已有 `p` 足以做外部推广归因。`entry_point` 用于判断用户从哪个站内入口发起咨询，无需作为对外链接必填参数。

## 4. GA 标准字段与典型场景

GA 不查询 CRM。UPER 从已核验的链接配置生成标准来源字段。下表使用 UTM 字段名表达标准值。对外地址栏可以只含 `p`，UPER 在首次发送统计时通过 GA 支持的 `campaign_source`、`campaign_medium`、`campaign_name` 和 `campaign_content` 传递对应值。需要 GA 活动 ID 时使用稳定的 CRM 活动标识映射到 `campaign_id`（对应 `utm_id`）。站内跳转不注入新的来源值。浏览器已有 GA 会话时，新的外部投放来源可用于事件归因，GA 不因此启动新会话或改写原会话来源。[Google 标签配置](https://developers.google.com/analytics/devguides/collection/ga4/reference/config) · [GA 活动与流量来源](https://support.google.com/analytics/answer/11242841)

示例编号供开发与验收使用，正式 `p` 由 CRM 生成。站内入口参数只在需要展示完整漏斗传递时列出。

| 场景 | 落地 URL → 咨询或动作 | `utm_source` | `utm_medium` | `utm_campaign` | `utm_content` |
| --- | --- | --- | --- | --- | --- |
| Instagram 主页 | `/link?p=bio-ig` → `/chat?p=bio-ig&entry_point=linkhub` | `instagram` | `social` | `social-bio` | `profile-bio` |
| YouTube 频道简介 | `/link?p=bio-yt` → `/chat?p=bio-yt&entry_point=linkhub` | `youtube` | `social` | `social-bio` | `channel-description` |
| TikTok 主页 | `/link?p=bio-tt` → `/chat?p=bio-tt&entry_point=linkhub` | `tiktok` | `social` | `social-bio` | `profile-bio` |
| YouTube 自然视频，直推咨询 | `/chat?p=hsk-yt-video01` | `youtube` | `social` | `hsk-nov` | `video-01` |
| TikTok 付费广告，直推咨询 | `/chat?p=hsk-tt-ad-a` | `tiktok` | `paid_social` | `hsk-nov` | `ad-a` |
| WhatsApp 活动广播 | `/link?p=hsk-wa-nov` → `/chat?p=hsk-wa-nov&entry_point=linkhub` | `whatsapp` | `messaging` | `hsk-nov` | `broadcast-nov` |
| YouTube 访客只下载手册 | `/link?p=bio-yt` → 记录手册下载点击 | `youtube` | `social` | `social-bio` | `channel-description` |
| Google 搜索 → 官网首页 → 咨询 | `/` → `/chat?p=home-chat&entry_point=homepage_widget` | 不补写 | 不补写 | 不补写 | 不补写 |
| TikTok 付费广告 → 官网首页 → 聚合页 → 咨询 | `/?p=hsk-tt-ad-home` → `/link?p=hsk-tt-ad-home` → `/chat?p=hsk-tt-ad-home&entry_point=linkhub` | `tiktok` | `paid_social` | `hsk-nov` | `ad-home` |
| 直接进官网 → 聚合页 | `/` → `/link?p=home-link&entry_point=homepage_widget`，记录官网按钮 | 不补写 | 不补写 | 不补写 | 不补写 |
| 直接打开无参数聚合页 | `/link` → `/chat?entry_point=linkhub` | 不补写 | 不补写 | 不补写 | 不补写 |
| 直接打开无参数咨询页 | `/chat`，CRM 采用系统 `organic` 兜底 | 不补写 | 不补写 | 不补写 | 不补写 |

例如，Google 自然搜索用户从官网点咨询时，GA 可保留识别到的 `google / organic`。CRM 的 `organic` 兜底活动与 GA 的自然搜索媒介是两套口径。WhatsApp 等媒介的运营分类以本项目登记的来源和媒介为准，另行核对 GA 默认渠道组的显示。

## 5. 事件与报表

| 观察对象 | 事件及口径 |
| --- | --- |
| 聚合页和咨询到达 | 复用安全的 `page_view`，区分落地路由及站内入口。打开 `/link`、点击咨询和实际到达 `/chat` 分别计数。 |
| 聚合页按钮 | 复用 `link_click` 和 `target`。手册区分预览、新窗查看、下载点击和分享。可用 `asset_id=handbook_2026` 标识文件。下载点击只证明用户触发了下载操作。社群跳出按点击计数，加入成功需独立回执。 |
| 客户咨询结果 | 复用 `questionnaire_complete`、`assessment_complete`、`advisor_request`。按有效保存回执计数并复用现有去重逻辑。点击提交、校验失败、保存结果未知均不能计入成功。 |
| 推广维度 | 复用 `entry_point`、`target`、`source_basis`。按需新增 `promotion_link_id` 及手册动作和资源参数。只允许安全编号和枚举，避免将个人资料、消息原文、完整 URL 或内部回执 ID 上报。 |

- **GA 漏斗。** 聚合路径看「落地 → 咨询点击 → 咨询到达 → 问卷成功」。直推路径从 `/chat` 到达开始。后续分别看测评和顾问请求。手册单独看预览率和预览后下载点击率。转化率的分子、分母按同一批会话计算，事件次数用于衡量点击量。
- **CRM 业务产出。** 按活动汇总，按推广链接下钻，比较新增客户、报名、已核验收款。有明确广告成本时再计算获客成本和报名成本。CRM 员工操作所属会话单独分析，客户获客到成交通过 CRM 来源记录对照。
- **环境和验收。** 沿用现有两个属性、三个数据流。客户分析筛选生产客户流量，员工和模拟测试分开。先用 DebugView 核对参数实收，再核对流量获取报表的标准来源维度和自定义维度。普通自定义事件可直接采集，常规报表需要的自定义参数按需登记。[GA4 自定义事件与参数](https://support.google.com/analytics/answer/12229021) · [GA4 流量获取报告](https://support.google.com/analytics/answer/12923437)

## 6. 实施顺序与验收

1. **维护预置入口。** 社媒主页发布对应的固定短链。官网无推广标记时使用自身的预置链接，已有外部标记时沿用原来源。裸 `/link` 保持未标记。
2. **核对链接与事件。** CRM 的链接、二维码和新物料使用同一个 `?p=…` 地址。核对落地、按钮、咨询到达和保存结果四个环节。官网预置编号用于 CRM 和 GA 事件分组，保留 GA 的实际流量来源。
3. **验证有效与异常路径。** 覆盖语言切换、刷新、新标签、无标记、无效编号、冲突参数、超时、回执重试和返回客户。核对历史首次来源。
4. **发布前验证。** 在目标环境核对预置与索引，并用新会话验证 GA 实收和流量报表。发布继续沿用目标环境的放行流程。[推广链接实现](../../server/portal/campaignPromotion.ts)
