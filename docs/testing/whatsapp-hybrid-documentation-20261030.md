# WhatsApp Hybrid方案文档验收

日期：2026-10-30（America/Vancouver）

## 范围与状态

只增加CRM系统文档章节，未实施WhatsApp接入。第一期建议为Hybrid只接收归档，不开放API发送。

本地入口：`http://localhost:3000/crm?tab=docs#crm-guide-whatsapp-hybrid`

内容覆盖个人App、Business App、Cloud API、第三方收件箱、共存及界面自动化；包含广告获客、身份绑定、费用与免费窗口、原文及AI边界、分期与接入验收门槛。

## 文件

- `src/components/crm/whatsappGuide.json`：三语线上文档正文。
- `src/components/crm/CrmWhatsAppGuide.tsx`：章节注册元数据及现有文档样式下的Markdown阅读。
- `docs/crm/whatsapp-hybrid.md`：中文参考副本，测试检查与线上中文一致。
- `CrmSystemGuide.ts`、`CrmUserGuide.tsx`：沿用目录、搜索、锚点、前后章节和权限外壳；WhatsApp方案独立为第三个一级目录，与系统说明、操作指南并列。
- `tests/crmDocumentation.test.ts`：新章节锚点、三语静态渲染、外部链接保护、内容搜索来源及副本一致性。

修改前备份：`.local-backups/whatsapp-docs-20261030/`。

## 验证

- TypeScript `tsc --noEmit`：通过。
- 文档相关测试：32项通过，0失败，0跳过；包含新增三语静态渲染及来源链接一致性。
- `node scripts/build-portal.mjs dev`：通过，沿用既有包体积／混合动态导入警告；更新本地3000静态产物。
- `git diff --check`：通过。
- 中文电脑端1440×900页面：登录后验收通过。第三个一级目录独立展示；原系统说明10章和操作指南保持。搜索ctwa_clid返回本章且标注WhatsApp接入方案；选择结果清空搜索并恢复正文，面包屑正确。
- 关联操作章节可跳转，浏览器返回恢复WhatsApp章；键盘可访问长文末尾，末尾操作未被遮挡，无整页水平溢出。原文档锚点保留。
- 截图：`.local-backups/whatsapp-docs-third-chapter-20261030/zh-third-chapter.png`、`zh-bottom.png`。临时视口已恢复。
- 未运行其他语言、手机端实机验收或全量业务测试；三语仅自动渲染检查。

## 边界

未修改数据、账号、权限、配置或消息收发业务，未开通Meta账号、提交客户、发送消息、重放通知、推送GitHub或部署服务器。

费用注明核对日及官方／服务商来源。免费服务额度以官方FAQ为依据；印尼单价及广告7天窗口保留来源级别与账号核验条件。共存不能默认保证所有设备、消息类型和员工身份同步。


## 子目录与信息图补充验收（已由下方连续阅读方案替代）

- 第三个一级目录下按原文10个小节独立阅读，移除重复整篇标题的单一条目；原whatsapp-hybrid链接保留为首节。
- 小节标题、目录、面包屑共用同一来源；英文／印尼文同步拆分。每节均有独立锚点并进入上一章／下一章序列。
- 信息图由imagegen生成，存于public/docs-assets/whatsapp-hybrid-v1.png（1536×1024）；已人工查看图中箭头、文本及关闭的API发送路径。英文技术标签共享，三语图注／替代说明。首节显示，其他小节不重复。
- 本地3000中文1440×900：十个子目录、账号→下一章模式比较→浏览器返回正确；搜索ctwa_clid定位广告获客子节，刷新后保持；图像naturalWidth=1536、显示1070、页面无水平溢出；点击原图实际打开1536×1024 PNG。原图临时页已关闭，视口恢复。
- 文档测试32项全通过，包含三个语言各10节静态渲染及首节独有信息图检查。类型检查、dev构建及diff检查通过。未做英文／印尼文浏览器或移动端验收。
- 截图：.local-backups/whatsapp-docs-subchapters-20261030/zh-infographic-and-contents.png。
- 本轮无业务接入、消息发送、客户提交、配置／权限修改、GitHub推送或服务器部署。


## 连续正文与页内目录最终验收

- 第三章恢复为完整连续页面，10个目录小标题分别跳转页内位置；全章只显示一次信息图。
- 本地3000中文1440×900：点击收费目录，目标顶部133px、吸顶栏底部117px，未遮挡；账号目录键盘Enter跳转且目标获得焦点。跳转后10节正文仍同时存在。
- 浏览器返回／前进正确；搜索ctwa_clid定位广告获客段，深链接刷新后恢复该段且完整正文保留；整页无水平溢出。
- 截图：`.local-backups/whatsapp-docs-continuous-20261030/zh-continuous-anchor.png`。
- TypeScript、32项文档测试、dev构建、diff检查通过。未扩大到其他语言或移动端浏览器验收。
