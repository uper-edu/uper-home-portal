# UPER Staging GA实收闭环验收 · 2026-11-02

## 范围与当前结论

延续GitHub main `c39499b8b67ee67aa5a335f0d824ae740bba3618`、测试发布 `20261102-020154` 的远端实收核对。只读访问页面和GA后台，不提交客户、不发送或重放通知、不改变GA或业务配置、不发布生产。

当前结论：页面接入、目标映射及Google收集端204响应已确认，GA后台Staging实收仍待确认。不能把Tag Assistant的Hits Sent、204响应或浏览器资源请求当作GA后台已入库。

## 已核对

- GA账户DataPower，属性UPER Test（561827503）。
- UPER Staging数据流16252453328，衡量ID `G-YTELN0GKTF`，网址 `https://home.prototype.uperedu.com`；与实际页面加载ID完全一致。
- 实际前端版本 `c39499b8b67e-5a71406e67354eb5`。
- `/link?lang=zh` 实际请求：`page_view`，`environment=test`，`traffic_category=internal_test`，`page_location=https://home.prototype.uperedu.com/link`，来源instagram / social / instagram-bio。
- 属性只有Internal Traffic过滤器，操作Exclude、状态Testing；没有Active排除过滤器。本轮未改动。
- Google官方Tag Assistant连接成功，识别UPER Staging、Google tag `GT-5TG3T8ML`，Hits Sent出现Page View及正确目标与来源。
- Tag Assistant显示Consent not configured / Default consent state has not been set yet；没有观察到由产品配置的拒绝同意状态。
- 普通页面资源请求中`ep.debug_mode=true`但未出现`_dbg`；Tag Assistant会话的Page View出现`_dbg=1`。这只能说明调试会话有差异，不能单凭该差异判定普通事件丢失原因。
- 页面控制台未捕获error或warn。
- 用户暂停Chrome操作后，已在本轮指定/link标签的原生Network面板核对collect请求：目标为`www.google-analytics.com/g/collect`，衡量ID为`G-YTELN0GKTF`，响应`204 No Content`。这确认传输成功，排除该次请求被浏览器直接阻止；不等于GA报表已入库。
- GA DebugView目前可展开的事件仍属于本地版本 `4c207d8c967b-a68ad4900868c217`，不能充当Staging实收证据。

## 仍需验证

1. 浏览器对照：用户已授权Chrome只读对照。Chrome访问无参数/link后，通过原有咨询链接进入/chat，停留在未填写的登记表单；实际请求仍指向正确的Staging衡量ID。随后按Staging流筛选的实时报告仍无数据，因此不能归因于内置浏览器。
2. 后台实收：找到包含测试站page_location和c39499b版本的具体事件，核对环境、来源和流归属；随后检查按Staging筛选的实时报告。
3. 标准报表的处理延迟与本次即时DebugView验收分开，不用“48小时”替代即时实收核对。
4. Chrome网络响应已补齐204证据。网络面板检查结束；未关闭扩展、改动隐私设置、清理Cookie或修改代码。Chrome官方Tag Assistant第二轮核对中，Page View包含`_dbg=1`及正确环境、版本、来源；GA DebugView可展开的page_location仍为`http://localhost:3000/crm?tab=campaigns`，不是测试站。

## 本轮状态

Staging按流的实时对比仍显示No data available。两轮Tag Assistant临时调试均已停止，没有保留域名调试开关。当前原因未定，不标记验收通过。

已排除本次collect被浏览器直接阻止、目标衡量ID错配及Active属性过滤器排除。仍未排除Google对请求内容的处理／丢弃、首次数据流初始化延迟或服务端展示异常。204本身不能区分这些情况，因此不把“Google延迟”写成已查明的根因，也不据此修改代码或配置。

下一步：在首次安装处理窗口结束后，再以新的一次只读页面访问核对Staging实时报告及DebugView。若仍无事件，应携本报告中的目标ID、版本、时间和204证据向GA支持进一步查询。无需新建客户、补发业务转化、切换生产衡量ID、删除数据流或停用隐私保护。

Google官方首次安装排查文档说明，首次安装的数据在实时报告中也可能需最多24小时处理。此说明只支持保留“首次处理延迟”的可能性，不能证明本次就是该原因；DebugView仍缺确切Staging事件，因此本验收保持待完成。

## 证据与隐私

私有检查材料位于 `.local-backups/ga-staging-receipt-20261102/`。只保存必要的目标、事件、公开网址与环境字段；不保存完整collect URL、客户端ID、会话ID、客户资料、登录信息或凭证。

## 官方参考

- [Google GA排查指南](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot)：网络响应与DebugView／实时报告分别核对，普通报表需更长处理时间。
- [DebugView说明](https://support.google.com/analytics/answer/7201382)：支持Tag Assistant临时启用调试；客户端隐私控制或同意状态可能影响调试显示。
- [首次安装排查](https://support.google.com/analytics/answer/9311124?hl=en)：首次安装处理窗口、报表阈值及目标ID核对。
