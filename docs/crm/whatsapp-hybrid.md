# WhatsApp接入、广告获客与Hybrid方案

<!-- 与 src/components/crm/whatsappGuide.json 的 zh 内容保持同步 -->

线上第三个一级目录采用完整连续正文，目录中的10个小标题跳转到对应页内位置。首节附[Hybrid系统方案信息图](../../public/docs-assets/whatsapp-hybrid-v1.png)，英文技术标签配三语图注及替代说明。

面向销售、CRM经理和开发人员的方案说明。核对日期：2026-10-30。本文记录讨论结论与实施边界，不代表WhatsApp已接入、已开户或已通过验收。

## 建议：第一期采用Hybrid只接收归档

UPER直接对接Meta，不强制引入Chatwoot等第三方收件箱。销售使用公司持有的WhatsApp Business App号码人工回复；CRM通过官方共存事件接收客户来信及App发送回显，按客户渠道身份关联Lead。第一期暂不开放CRM／AI通过API发送，不做自动营销、群发或新的自动任务，不自动改变Tier或销售阶段。

Hybrid（混合接待模式）是UPER方案名称。Meta对应能力叫Coexistence（共存），不是新的产品套餐。先验证共存资格、事件与设备完整性，再决定是否适合正式使用；如不满足准确归档要求，再评估API统一收发。

客户 → 官方号码 → Business App人工接待；客户来信＋App发送回显 → 官方Webhook → CRM原文归档 → AI整理／人工采用。

## 账号与开通的区别

| 类型 | 如何使用／开通 | 与CRM的关系 |
| --- | --- | --- |
| 个人WhatsApp Messenger | 手机号码注册个人App | 不支持通过官方Cloud API直接读取个人聊天 |
| WhatsApp Business App | 注册公司持有的号码，完善企业资料 | 基础聊天免费；注册App不自动获得消息API |
| Business Platform／Cloud API | Meta业务资产下的WABA、业务号码与API授权；配置Webhook | 可编程收发；新号码可直接接入，不必先注册App |
| Hybrid／Coexistence | 为符合资格的现有Business App号码走专门共存流程 | 同号保留App，并同步受支持的官方事件；不是普通API开户自动具备 |

Meta Business Portfolio、WhatsApp Business Account（WABA）、号码、验证方式和凭证归UPER管理。销售登录CRM的员工身份与公司的WhatsApp号码分开。付费Meta Verified徽章、Meta业务验证及API授权不是同一件事；Lark管理员也不等于Meta管理员。

共存的可用地区、账号活跃度、现有连接、Embedded Signup及接入方资格需要单独确认。直接对接Meta的方向，不等于自己的普通开发者应用必然能立即开通共存。不得为尝试接入而先删除现有账号或清空历史。

## 接入方式比较

| 方式 | 多人接待 | 原文与Lead关联 | 成本／限制 |
| --- | --- | --- | --- |
| 个人App或wa.me跳转 | 原生关联设备 | 打开聊天不等于已发送；CRM不能据此获得完整原文 | 基础聊天免费，不满足官方API归档目标 |
| Business App单独使用 | 标准最多4台关联设备；部分付费套餐更多 | App保留聊天，UPER仍需人工记录 | 无基础聊天API消息费；有可选增值费 |
| Cloud API直接接CRM | 销售分别登录CRM，不依靠App设备名额 | 经CRM通道可记录客户身份、发送员工、原文和状态 | 开发维护＋API消息费；需实现窗口、模板及故障恢复 |
| 第三方共享收件箱 | 使用现成员工工作台 | 仍需把外部消息、客户及负责人映射到UPER | 订阅／席位／联系人费可能叠加Meta费用；字段导出需核验 |
| Hybrid只接收归档 | 销售在App接待，CRM管理客户 | 接收来信＋App发送回显；员工身份可能未知 | 低消息成本，但共存资格、设备及消息类型有限制 |
| 本地助手／界面自动化 | 代替人点击App | 可见内容、稳定消息ID、去重及发送结果难保证 | 不作为正式通道；界面变化、错发、重复及官方使用规则风险 |

App标准支持一台主手机及最多4台关联设备。官方部分Meta Verified套餐支持6／8／10台，且可能提供聊天分配；以账号可用套餐为准。不能把“App有多人分配”当成“所有发送员工可通过API准确导出”。

## 广告获客与Lead关联

正式Instagram／Facebook Click-to-WhatsApp消息广告按Business账号和Meta业务资产流程连接，可使用Business App或Platform。客户仍可用个人WhatsApp发来消息。普通wa.me短链接能打开聊天，但不等于原生广告目标，不保证返回广告归因信息。

1. 客户实际发送消息后，按渠道、官方账号范围和客户外部标识（如当前接口提供的wa_id／其他用户标识）查找已有Lead绑定。不要用昵称或AI猜测身份，也不要硬编码外部标识永远等于手机号。
2. 已有绑定则追加原文。陌生身份建立最小Lead候选／登记方案，实施前明确必填和身份校验；未知资料留空，不能绕过现有登记规则填默认值。仅匹配问卷自填号码、共享号码或多个Lead时，人工核对。
3. 持久化实际收到的referral、source_id、source_url及ctwa_clid等字段；字段缺失就保留缺失。广告名、广告组和Campaign必要时按授权补全，不从聊天内容猜测。
4. 同一客户再次来自另一广告，保留新增触点，不能覆盖首次来源或重复建Lead。ctwa_clid识别点击，不能当客户ID；未发消息的点击不能当成已登记客户。
5. 手机App消息回显不提供具体员工时，记录“公司Business App发送／员工未知”。负责人、设备操作者和消息发送者不能互相替代。

## 收费参考：App、API与Hybrid

| 动作 | Meta消息收费边界 |
| --- | --- |
| Business App普通一对一聊天 | 基础聊天不按API消息费计价；仍有网络和号码费用 |
| 客户来信通过Webhook进入CRM | 入站消息不收服务消息费；不会消耗出站1,000条免费额度 |
| 共存模式下App发送及官方回显归档 | 当前共存服务商文档说明App发送不产生WhatsApp API消息费；服务商自身可能收费，具体接入需核实 |
| CRM／AI调用API发送 | 适用API消息类别、收件人市场、免费窗口及额度；人工发送也不自动免费 |
| 接口接入与员工席位 | Meta直接接入无额外平台访问费；自有CRM无第三方席位订阅，但有开发、服务器、存储与AI费用 |
| Meta Verified／增强商业广播／投放广告 | 可选订阅、付费广播及广告费独立核算；地区和账号资格影响报价，不能套用API单价 |

Meta官方FAQ已明确：2026-10-01起，每个业务号码每月前1,000条服务消息免费，从第1,001条起按条收费。这是公司发出的服务回复条数，不是1,000位客户或会话。营销、事务、验证码模板不共享此额度。旧介绍页中的“24小时客服回复无限免费”不能继续用于预算。[官方FAQ](https://whatsappbusiness.com/resources/faq/)

下表为预算参考，未含税、未扣适用免费窗口及折扣。具体单价来自服务商公开表；Meta详细价目页面需登录，本轮未在UPER结算账号核验。正式采用前必须核对账号费率、生效日及结算币种。

| 发给印尼号码的类别 | USD价目／条 | IDR价目／条 |
| --- | --- | --- |
| 服务回复，超过免费额度 | $0.025 | Rp356.65 |
| 营销模板 | $0.0411 | Rp586.33 |
| 普通事务／验证码模板 | $0.025 | Rp356.65 |

USD与IDR是不同结算价目，不是当天汇率换算。国际验证码有独立资格和费率，不能一概套用普通验证码价。[美元参考](https://sleekflow.io/id-id/blog/biaya-whatsapp-business-api) · [印尼盾参考](https://chakrahq.com/id/help/chat/getting-started/understanding-pricing-and-charges)

预算例：一个号码，每月500位客户、公司各发10条非广告免费窗口内的服务回复，共5,000条，扣1,000条后为4,000条。按以上单价计算，API消息费为$100，或IDR价目Rp1,426,600，未含税。若都从App普通聊天发送，基础API消息费为0；开发、网络、存储、可选订阅仍有成本。不是固定月租。

## 第三方费用仅作备选参考

第三方收件箱不是Meta接入的必需条件。以下是核对日官网展示的美元标价，不是UPER采购报价；结算周期、税费、API权限、用户和联系人额度以订单为准。订阅费不能抵扣Meta消息费。

| 方案 | 展示价格 | 需要核对 |
| --- | --- | --- |
| Chatwoot Cloud Startups / Business | $19 / $39，每员工每月 | 免费Cloud方案仅网站聊天；团队、自动化、审计及数据保留依套餐 |
| Chatwoot自托管社区版 | 软件席位费$0 | 服务器、备份、升级仍有成本；高级角色权限及其他企业能力不全部包含 |
| respond.io Growth | 年付折算$159/月起 | Developer API、Webhook事件范围、月活跃联系人及用户超额费；月付另核对 |

不因为已有CRM就认为无需接入开发，也不因为开源免费就认为无需运维。[Chatwoot Cloud价格](https://www.chatwoot.com/pricing) · [自托管价格](https://www.chatwoot.com/pricing/self-hosted-plans) · [respond.io价格](https://respond.io/pricing)

## 24小时窗口与广告免费窗口

24小时客服窗口主要决定能否发自由格式回复；客户最新来信刷新窗口。窗口内仍适用当前服务消息计费，窗口外通常需批准模板。模板类别由实际用途及Meta审核决定，不能把课程推广命名为“通知”就按事务价。

Wati于2026-10更新的文档说明，符合条件的CTWA入口从2026-09-28起可有最长7天免费消息窗口，要求首次来信后24小时内回复。部分Meta介绍页仍写72小时。正式接入前核对生效条件及平台返回信息，不在CRM硬编码7天全部免费或任意内容都能发送。普通主页链接不保证符合资格；广告费、外部AI费仍独立。[最新广告窗口说明](https://support.wati.io/en/articles/11865651-general-faqs-ctwa) · [API计费变更](https://support.wati.io/en/articles/16954666-whatsapp-business-platform-api-pricing-changes-service-messages-and-click-to-message-ads)

## 与现有CRM的边界及分期

当前“准备联系”仅打开wa.me并预填草稿，不证明发送成功。现有对话结构围绕网站访客，实施时需增加渠道身份关联，不能为WhatsApp客户伪造网站visitor会话。本文是规划，不代表当前对话Tab已支持WhatsApp实时同步。

对话Tab保存完整双向原文、附件和实际时间；跟进页显示沟通结论并定位原消息；客户资料展示当前采用值；AI整理属于派生内容，不能替代原文或自动确认测评、报名、客户约定及销售阶段。消息送达、已读、有效沟通和首次联系要求是不同概念，不能直接互相推断。

第一期：核实一个公司号码的共存资格，建立只接收事件的适配层，保存身份、消息ID、原文、附件、事件时间、接收时间和广告触点。保留Webhook原事件及处理结果，验签、幂等去重、乱序与断线恢复；不增加API发送入口。

第二期：把可靠原文接入已有依据定位和AI提取，验证采用与冲突处理。第三期仅在需要时评估CRM发送、模板、费用提示和发送结果查询；发送超时不能盲目重发。任何阶段不新增自动任务、不自动改Tier、不重放通知。

## 接入前验收门槛

- 号码／WABA资产归属、共存接入资格与所需Meta应用能力确认；不删除现有账号试错。
- 客户首次来信、已有Lead、重复手机号、共享号码、转交负责人后续聊均不串客户。
- 真实广告首条消息与自然来信均保留原文；归因字段缺失不伪造，重复触点不重复建客户。
- 手机及实际使用的Mac／Windows／Web关联设备逐一核对客户来信和App回显。部分设备／消息类型可能不支持，不能把已收部分标为全部同步。
- 文字、图片、语音、文件、引用以及编辑／撤回等事件验证；不支持时明确标注，转写不覆盖附件原文。
- 重复、乱序、断线及恢复不丢失或重复归档；核对条数与内容，不以Webhook返回成功代替完整验收。
- API发送保持关闭；不因归档触发自动回复、任务、Tier或阶段改变；通知是否产生必须单独定义并授权。

## 来源与维护

官方产品与设备：[Business App](https://faq.whatsapp.com/641572844337957) · [关联设备](https://faq.whatsapp.com/878854700132604/?cms_platform=android) · [Meta Verified](https://faq.whatsapp.com/3872729742954601/?helpref=uf_share) · [付费商业广播](https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/) · [广告业务关联](https://faq.whatsapp.com/1164217254479464/?cms_platform=android)

技术边界：[共存Webhook事件](https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence/coexistence-webhooks) · [共存功能与费用限制（服务商文档）](https://respond.io/help/whatsapp/whatsapp-coexistence) · [Meta详细计费页（需登录）](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)

接入前、正式购买前及后续费率变更时重新核验来源、日期和账号适用性。服务商报价不等于UPER已经取得的Meta正式账单；文档更新不授权开户、发布、自动消息或修改业务规则。
