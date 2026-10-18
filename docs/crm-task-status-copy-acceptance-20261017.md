# 跟进任务状态文案验收

日期：2026-10-17（America/Vancouver）。仅独立4426；未切换3000、未推送GitHub、未部署服务器。

## 文案与业务口径

| 场景 | English | Bahasa Indonesia | 中文 |
|---|---|---|---|
| 普通开放任务 | To do | Perlu ditindaklanjuti | 待处理 |
| 当天未到期的开放任务 | Due today | Jatuh tempo hari ini | 今天到期 |
| 有效期限已过 | Overdue | Terlambat | 已逾期 |
| 已完成 | Completed | Selesai | 已完成 |
| 已取消 | Cancelled | Dibatalkan | 已取消 |
| 历史待确认 | Historical task: review required | Tugas lama perlu dikonfirmasi | 历史待办待确认 |
| 期限未知 | Deadline pending review | Tenggat perlu dikonfirmasi | 截止时间待确认 |
| 明确暂不安排，附原始原因 | No next step for now | Belum ada langkah berikutnya untuk saat ini | 暂不安排 |
| 尚无后续安排 | Next step not scheduled | Langkah berikutnya belum dijadwalkan | 未安排下一步 |
| 成交/关闭且无未完成事项 | No open follow-up tasks | Tidak ada tugas tindak lanjut terbuka | 无未完成跟进事项 |
| 查询不可用 | Follow-up information unavailable | Informasi tindak lanjut sementara tidak tersedia | 跟进信息暂不可用 |

Follow-up／Tindak lanjut／跟进安排栏目名保留。移除任务状态的Pending前缀，不全局替换其他业务的Pending。共用展示函数覆盖列表、任务卡片、顶部摘要及任务引用；保留原有各层级的信息密度，不额外增加状态徽章。

等待、培育和停止联系为独立的联系安排，不从任务状态猜测等待客户回复。没有新增Awaiting customer reply状态，也没有改变联系安排、任务状态值、SLA、排序、分类或期限。操作人与客户原文保持不变。

## 验收

- 复用独立schema uper_trial_native_customer_navigation_175daa09；worker关闭，通知simulation，AI本地stub。
- 新增7个明确TEST模拟样本：普通开放任务、今天到期、逾期、历史待确认、未安排、明确暂不安排及关闭客户。种子不创建Outbox或通知事件。
- 浏览器英文列表显示Follow-up及Due today／Overdue，无Pending前缀；任务卡片显示To do。切换印尼文和中文后对应文案正确。
- 浏览器核对三语无安排、暂不安排、关闭无事项和历史待确认提示，原因原文保留。
- 英文、印尼文、中文在线手册已在客户工作区章节核对。
- 自动化覆盖三语任务状态、时区判断、已完成/已取消、历史占位日期、原始输入不变、暂不安排与缺少安排的区别、不可用不冒充无任务。
- 相关回归44/44通过；完整测试299项：297通过、2跳过、0失败。类型检查、独立构建及git diff --check通过。
- 独立Build ba3835a63a0b-68198ac2f4632a6f，目录build/p0-trust。3000配置及build/dev标识哈希与原基线一致；未访问或写入3000业务接口。
- 独立库原有客户、任务、员工、运营配置、通知与测评记录逐行哈希不变；仅新增模拟样本及浏览器正常已读标记。

本轮浏览器检查既有状态展示及在线文档；加载失败、已完成/取消等分支由自动化覆盖，未逐项制造浏览器网络故障。未调用真实AI或Lark。

本地证据在忽略目录.local-backups/crm-task-status-copy-20261017/，包括英文列表截图、回归/构建日志和原行哈希基线；不提交数据、配置或秘密。
