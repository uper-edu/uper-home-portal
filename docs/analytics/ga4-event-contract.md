# GA4访问与流程统计口径

本规范覆盖 `/link`、`/chat` 和CRM的前端行为观察。GA用于访问、过程和体验分析；客户数量、归属、销售阶段、测评成绩、付款和通知状态仍以业务数据库为准。埋点不能改变原有校验、权限、保存、评分或通知规则。

## 环境与来源

- DataPower账户下采用两个属性、三个Web数据流，详见[三环境配置](./ga4-environments.md)。本地和测试站共用 `UPER Test` 属性但使用独立数据流；生产使用原正式属性并更名为 `UPER Production`，保留原衡量ID和历史数据。
- 构建时要求目标环境与分配的衡量ID一致，页面运行时再核对主机和HTTPS；错配时停止统计，不影响业务页面。环境文件和凭证不入Git。本轮只更新本地配置和3000运行版本，不部署测试站或生产站。
- `environment`：development / test / production / unknown。非生产使用 `traffic_category=internal_test`，生产管理工作区使用 `internal_employee`，生产公开页面使用 `customer`。
- 生产公开页面的验收使用 `?analytics_test=1`，同一标签页后续访问保持测试标记，`?analytics_test=0`解除。正常CRM使用属于员工业务使用，`traffic_type=staff`；测试流量为 `internal`，公开客户为 `external`。报表应分别看客户与员工的真实使用；不能把全部员工使用排除，也不能声称自动识别了所有人工测试或机器人。
- `/link`经产品约定为Instagram Bio专用入口。无c/cid/campaign/p参数时，在初始GA配置、first_visit和session_start之前就设置Instagram / social / instagram-bio；`source_basis=dedicated_entry`表示按入口约定归因，并不证明HTTP引荐来自Instagram。
- `/chat`通用入口不默认Instagram。带活动参数的入口保留活动标记；普通无参数页面后续归因交给GA的会话规则。
- 本地使用独立GA Cookie前缀，不清理已有Cookie。已打开的旧页面需刷新后加载新的统计标识。

## 事件与成立条件

| 流程 | 事件 | 成立条件与用途 |
|---|---|---|
| 页面 | page_view | 手动SPA页面访问，按安全URL和语言去重；模块切换也记录 |
| Bio | link_click | 咨询、手册、社群及社交入口的明确点击；仅传固定target，不上传URL |
| 问卷 | questionnaire_view / start | 显示问卷 / 首次修改输入 |
| 问卷步骤 | questionnaire_step_view / step_next | 显示某一步 / 点击下一步尝试；下一步尝试含校验不通过，不等同成功进入下一步 |
| 问卷校验 | questionnaire_validation_error | 缺少必填或格式不符，仅传步骤和固定原因，不上传字段值 |
| 问卷提交 | questionnaire_submit / questionnaire_save_result | 提交尝试及失败、冲突、结果未知、查询结果；不等同客户已创建 |
| 问卷完成 | questionnaire_complete | 独立咨询入口收到saved=true、submissionId及客户保存回执后 |
| 首页留资 | lead_form_complete | 首页组件收到上述有效留资保存回执后 |
| 测评过程 | assessment_start / resume / section_view / submit / exit | 开始、恢复、题型区、提交尝试及退出；不上传答案或分数 |
| 测评保存 | assessment_save_result / complete | 失败或未知状态；complete必须是相同attemptId且saveStatus=saved及有completedAt的结果 |
| 咨询 | consultation_send / message_saved / result | 发送尝试、原消息已保存、回复结果；模型失败和传输未知分开，回复失败不能算成功 |
| 顾问请求 | advisor_request | 明确handoff操作收到saved=true、awaiting_advisor及recorded/review_required回执；匿名申请可由同次登记的已确认请求回执成立，按原消息ID与直接申请共用去重；AI普通文字、仅登记、contact_required或历史恢复不算新请求 |
| CRM浏览 | crm_customer_view / filter_change | 打开客户、筛选条件变化；只传筛选类别、数量和是否有搜索，不传搜索内容或客户ID |
| CRM操作 | crm_progress_open / action_open / form_cancel_click | 打开进展、阶段、转交、准备联系以及点击取消；取消点击不冒充已丢弃草稿 |
| CRM保存 | crm_save_result | 保存尝试及失败、冲突或结果未知，按operation区分 |
| 进展保存 | crm_progress_saved | 预期客户的回执中包含本次logId，进展先保存但阶段失败时仍只算进展成功 |
| 阶段保存 | crm_stage_updated | 独立阶段和进展附带阶段两个入口都在确认回执后计数 |
| 课程报名 | course_enrollment_confirmed | 人工确认阶段为progress:enrolled的保存回执；不是试听报名或付款，不发送purchase或金额 |
| 负责人 | crm_owner_changed | 请求ID、目标客户与回执的变更后负责人一致 |
| 客户资料 | crm_profile_saved | 目标客户匹配且本次字段采用结果至少有applied；加载最新资料、冲突或未采用不计成功 |

问卷漏斗以各step_view和完成回执分析，不应以“下一步点击数”推算成功人数。咨询发送数含明确重试；成功回执另行去重。

## 隐私、去重与可靠性

- 页面URL只保留已知路由、CRM模块和安全活动代码；去掉客户、会话、消息、OAuth、搜索及定位hash。动态内容路径降为模板路径。引荐页仅保留origin。
- 页面标题由路由和语言确定，不采集客户姓名，也不读取可能滞后的document.title作为事件标题。
- 事件参数白名单只允许枚举、布尔值及有限数值；不上传姓名、邮箱、手机号、原文、问卷答案、题目答案、客户ID、消息ID或错误全文。source/medium/campaign代码不得录入个人信息。
- 回执ID仅用于当前浏览器标签sessionStorage去重，最多保留300项，不作为GA参数。查询同一结果、组件重渲染和同标签刷新不会重复计数。
- 这不是跨标签、跨设备或服务器保证的exactly-once。网络阻断、拦截器、关闭页面和GA处理延迟仍可能漏报；不得用GA覆盖业务对账。
- 所有统计失败均为尽力而为，不能中断业务保存。统计去重写入不等于GA服务端已确认接收，实收必须另外查看后台。
- 测试数据和正式数据分属性隔离；`validation_mode=simulated`仅用于模拟保存回执验收，不能作为真实客户转化。

## GA后台设置与指标

测试流关闭增强型衡量，以免自动历史page_view与手动页面重复，或自动表单/搜索/外链事件携带未审核内容。`send_page_view=false`本身不足以关闭增强型历史访问。

已注册13个事件维度：environment、traffic_category、workspace、source_basis、validation_mode、operation、status、assessment_mode、stage_to、step、entry_point、filter_type、profile_scope。两个毫秒指标：response_time_ms、duration_ms。其他安全参数可在DebugView查看，增加常规报表维度前应评估用途和基数。

五个关键事件为：questionnaire_complete、lead_form_complete、assessment_complete、advisor_request、course_enrollment_confirmed。逐事件计数，不设置默认货币金额。GA向导预置的purchase/qualify_lead/close_convert_lead不是本项目已接通的业务事件。

可用指标：用户/新用户、会话、浏览量、来源/媒介/活动、设备、参与率/跳出率、平均参与时间、事件量、关键事件及漏斗流失。步骤耗时为两次步骤操作间的前端墙钟耗时，可能包含闲置；响应时长为发起到读取结果，不能当作模型纯计算耗时。自定义时长指标是累计数值；平均值需按对应事件数计算。

未实现跨设备客户旅程、真实收入/ROI、客户级营销到报名归因、会话录像或高级滚动深度分析。CRM员工确认报名所在会话属于员工流量，不可直接拼成同一访客的获客漏斗；营销业务转化归因仍需结合CRM来源记录。

## 验证与后续发布

- DebugView/实时用于接收验证；标准报表及新维度通常需24–48小时处理，不能把“浏览器已排队”冒充“后台已收到”。
- 发布前需单独确认正式/测试属性、数据流、增强型历史和自动表单设置，以及上述维度/关键事件。不得把本地测试ID写入正式环境。
- 不自动清理正式历史测试数据，不启用永久排除过滤器，不重放业务或通知来补统计。

参考：[Google手动页面访问说明](https://developers.google.com/analytics/devguides/collection/ga4/views)、[GA排查与数据处理延迟](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot)、[自定义活动归因](https://support.google.com/analytics/answer/11259997)。
