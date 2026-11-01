# Personal in-app notifications / 站内通知 / Notifikasi dalam aplikasi

The shared administration header shows a bell for staff with CRM read access. The badge counts only unread, accepted in-app deliveries addressed to that employee and currently visible under customer access. It is independent of Lark binding and sending switches. Opening the drawer does not mark everything read; opening an exact linked record or explicitly marking a notification read acknowledges only that notification. Read state never completes sales work or customer requests.

The right drawer uses the shared operation layer, native modal focus handling, one scrollable body and no editing Save footer. It displays localized event titles, customer names, existing agreement details where present and the delivery timestamp in the viewer's browser timezone. Existing semantic color categories are reused. It supports loading, empty, failure/retry, unavailable-source states and 50-item pagination; the unread count covers all currently authorized deliveries.

The backend uses the employee from the authenticated session, not a supplied recipient. It rechecks active status, roles, current customer visibility and exact customer-scoped source references. A transfer or permission revocation excludes inaccessible rows from the list/count. Other employees' inbox records cannot be read or acknowledged even by a broad-scope manager. Marking read changes only `notification_inbox.content.inboxReadAt`, preserves existing message fields and is idempotent. No schema migration, new delivery, rule change or notification replay occurs.

Links use saved assessment, request, agreement, task, questionnaire/submission, message or conversation identifiers. New customer-message and owner-assignment events retain exact source identifiers. Older notifications without an exact reference remain readable but show that the related record is unavailable, with no guessed latest-record fallback. Deleted or cross-customer references cannot be opened and failed opening does not acknowledge the message.

中文：页头铃铛显示本人未读数，点击打开右侧通知栏。打开通知对应记录或点击“标为已读”只影响通知自身，不代表完成跟进。关联记录缺失时不跳到其他记录。与Lark绑定无关；不新增任务，不修改原期限或业务状态。

Bahasa Indonesia: Lonceng header menampilkan jumlah notifikasi pribadi yang belum dibaca dan membuka panel kanan. Membuka catatan terkait atau menandai dibaca hanya mengubah notifikasi, bukan menyelesaikan tindak lanjut. Catatan yang hilang tidak diganti dengan catatan lain. Fitur ini tidak bergantung pada hubungan Lark, tidak membuat tugas dan tidak mengubah tenggat atau status bisnis.

Presentation: the customer name leads each row, followed by the event and any existing detail. The timestamp stays below. A 40×40px check action marks only that notification read and retains its accessible label.

呈现：客户姓名为首行，随后显示事件及已有内容，时间位于下方；右上角40×40px勾选按钮仅标记该条已读，保留完整无障碍名称。

Tampilan: nama pelanggan di baris pertama, diikuti peristiwa dan detail yang tersedia, lalu waktu. Tombol centang 40×40px hanya menandai notifikasi tersebut dibaca dan memiliki label aksesibel.
