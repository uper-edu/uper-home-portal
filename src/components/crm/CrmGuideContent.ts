export type GuideLanguage = "en" | "id" | "zh";
export const guideSections = [
  {
    key: "workspace",
    title: ["Customer workspace", "Ruang kerja pelanggan", "客户工作区"],
    body: [
      [
        "The worklist has four areas: customer identity and owner, learning needs, sales progress, and follow-up. Open a customer to work in the same-page panel. Wide screens keep the customer queue; narrow screens focus on the panel.",
        "Daftar kerja memiliki empat area: identitas dan penanggung jawab pelanggan, kebutuhan belajar, perkembangan penjualan, serta tindak lanjut. Buka pelanggan untuk bekerja di panel pada halaman yang sama. Layar lebar tetap menampilkan antrean pelanggan; layar kecil berfokus pada panel.",
        "工作列表分为客户身份与负责人、学习需求、销售进展、跟进安排四区。打开客户后在同页面板处理；宽屏保留客户队列，窄屏集中显示处理面板。",
      ],
      [
        "The panel provides Follow-up, Conversations, Profile and Assessment. The sales playbook is a reference under Follow-up. Return to the list to keep your current filters.",
        "Panel menyediakan Tindak lanjut, Percakapan, Profil, dan Asesmen. Panduan percakapan penjualan tersedia sebagai referensi dalam Tindak lanjut. Kembali ke daftar untuk mempertahankan filter saat ini.",
        "处理面板提供跟进、对话、客户资料、测评四个页签；销售话术参考位于跟进页。返回列表保留当前筛选。",
      ],
    ],
  },
  {
    key: "access",
    title: ["Accounts and permissions", "Akun dan izin akses", "账号与权限"],
    body: [
      [
        "CRM requires staff sign-in. Suki and Robert are CRM Leaders; Fadhil, Zainul and Wigar are Sales; Tester has both roles. Use the top account menu to change your own password or sign out.",
        "CRM mewajibkan login staf. Suki dan Robert adalah Pengelola CRM; Fadhil, Zainul, dan Wigar adalah staf penjualan; Tester memiliki kedua peran. Gunakan menu akun di bagian atas untuk mengubah kata sandi sendiri atau keluar.",
        "访问 CRM 需要员工登录。Suki、Robert 为 CRM 管理者；Fadhil、Zainul、Wigar 为销售；Tester 同时具有两种角色。顶部账号菜单提供修改自己的密码和退出入口。",
      ],
      [
        "Leaders can view all leads and assign active Sales owners. Sales default to their own leads and may view eligible unassigned leads. Sales can claim an unassigned lead only for themselves and cannot transfer their leads to another salesperson. Sales Operations settings are restricted to Leaders; the server enforces these permissions.",
        "Pemimpin dapat melihat semua prospek dan menetapkan staf penjualan aktif sebagai penanggung jawab. Staf penjualan secara default melihat prospek sendiri dan dapat melihat prospek belum ditugaskan yang memenuhi cakupan akses. Staf penjualan hanya dapat mengambil prospek untuk dirinya sendiri dan tidak dapat memindahkan prospek ke staf penjualan lain. Pengaturan Operasional Penjualan dibatasi untuk Pemimpin; server menerapkan izin ini.",
        "管理者可以查看全部客户，并分配给有效销售账号。销售默认查看本人客户，也能查看权限范围内的未分配客户；只能认领给自己，不能将客户转给其他销售。销售运营配置仅管理者可修改，权限同时由服务端校验。",
      ],
    ],
  },
  {
    key: "filters",
    title: [
      "Filters and field table",
      "Filter dan tabel kolom",
      "筛选与辅助字段表",
    ],
    body: [
      [
        "Use search, Owner, Tasks and Unread by me for daily work. More filters provides customer group, sales stage, contact status, follow-up situation, learning format and buying signal. Values within one category use logika atau; categories combine with logika dan. Only Owner has a search box. Reset restores your role default.",
        "Gunakan pencarian, Penanggung jawab, Tugas, dan Belum dibaca oleh saya untuk pekerjaan harian. Filter lainnya menyediakan kelompok pelanggan, tahap penjualan, status kontak, situasi tindak lanjut, format belajar, dan sinyal pembelian. Pilihan dalam satu kategori memakai logika atau; antarkategori memakai logika dan. Hanya Penanggung jawab memiliki kotak pencarian. Atur ulang mengembalikan tampilan default peran Anda.",
        "日常使用搜索、负责人、跟进任务和仅我未读；更多筛选包含客户分组、销售阶段、联系状态、跟进情形、授课方式和购买信号。同类多选为“或”，不同维度之间为“且”。仅负责人下拉保留搜索；重置恢复角色默认视图。",
      ],
      [
        "Due today uses the configured operating timezone and includes unfinished tasks due on that calendar day. Overdue requires an unfinished task with a real deadline earlier than now. Historical tasks awaiting review are excluded from both. The field table uses the same filtered records; choose fields without changing business data. Name and lead number remain visible.",
        "Jatuh tempo hari ini memakai zona waktu operasional yang dikonfigurasi dan mencakup tugas belum selesai yang jatuh tempo pada hari kalender tersebut. Terlambat memerlukan tugas belum selesai dengan tenggat nyata sebelum waktu sekarang. Tugas historis yang menunggu peninjauan tidak masuk keduanya. Tabel kolom memakai catatan hasil filter yang sama; pilih kolom tanpa mengubah data bisnis. Nama dan nomor prospek tetap terlihat.",
        "今天到期使用配置的运营时区，包含当天截止的未完成任务；逾期要求未完成任务的真实截止时间早于现在。历史待办待确认不计入这两项。字段表使用相同筛选结果；选择显示字段不改变业务数据，姓名和客户编号始终保留。",
      ],
    ],
  },
  {
    key: "followup",
    title: [
      "Follow-up and task completion",
      "Tindak lanjut dan penyelesaian tugas",
      "跟进与任务完成",
    ],
    body: [
      [
        "The list action, state and deadline come from the same persisted task. A task owner may differ from the customer owner. Additional tasks open in the panel. Manual notes are kept separately and do not become system tasks.",
        "Tindakan, status, dan tenggat pada daftar berasal dari tugas tersimpan yang sama. Penanggung jawab tugas dapat berbeda dari penanggung jawab pelanggan. Tugas tambahan dibuka dalam panel. Catatan manual disimpan terpisah dan tidak menjadi tugas sistem.",
        "列表动作、状态、截止时间来自同一条持久任务；任务负责人可以不同于客户负责人。其他任务在面板查看。人工备注独立保留，不被当作系统任务。",
      ],
      [
        "Log a contact with its channel, result, sales stage, summary and next follow-up. Saving records the contact and may create the next task. Viewing clears unread activity only. Completing a task cancels its related queued notifications; it does not retract messages already sent. Review historical tasks before activating them.",
        "Catat kontak beserta kanal, hasil, tahap penjualan, ringkasan, dan tindak lanjut berikutnya. Penyimpanan mencatat kontak dan dapat membuat tugas berikutnya. Membuka pelanggan hanya menghapus status belum dibaca. Menyelesaikan tugas membatalkan notifikasi terkait yang masih mengantre; pesan yang sudah dikirim tidak ditarik kembali. Tinjau tugas historis sebelum mengaktifkannya.",
        "记录沟通方式、联系结果、销售阶段、摘要和下次跟进安排。保存会记录本次联系，并可建立下一项任务。查看客户只清除未读；完成任务会取消关联的待发通知，不会撤回已经发送的消息。启用历史待办前先确认。",
      ],
    ],
  },
  {
    key: "chat",
    title: [
      "Conversations and human requests",
      "Percakapan dan permintaan bantuan konsultan",
      "聊天与转人工",
    ],
    body: [
      [
        "Homepage assistant and standalone chat conversations share the customer record while retaining separate conversation sources. Anonymous messages are linked after registration without copying. Phone or email similarity alone does not prove identity. Original customer text remains unchanged in every interface language.",
        "Percakapan asisten beranda dan chat mandiri berbagi catatan pelanggan, tetapi sumber percakapan tetap terpisah. Pesan anonim ditautkan setelah pendaftaran tanpa disalin. Kesamaan nomor telepon atau email saja tidak membuktikan identitas. Teks asli pelanggan tetap sama dalam setiap bahasa antarmuka.",
        "主页助手与独立聊天共用客户记录，但保留独立会话及来源。匿名消息登记后建立关联，不复制。电话或邮箱相同不能单独证明身份。切换界面语言不会翻译客户原文。",
      ],
      [
        "A human request creates a follow-up request, not a live human chat session. Its actual waiting or completion state is shown. Messages with missing historical timestamps show Unknown time; placeholder dates are not evidence of contact time. Failed or interrupted AI replies are identified separately.",
        "Permintaan bantuan konsultan membuat permintaan tindak lanjut, bukan sesi percakapan langsung dengan konsultan. Status menunggu atau selesai yang sebenarnya ditampilkan. Pesan historis tanpa waktu ditampilkan sebagai Waktu tidak diketahui; tanggal pengganti bukan bukti waktu kontak. Balasan AI yang gagal atau terputus ditandai terpisah.",
        "转人工建立跟进请求，不代表真人已经加入在线对话；显示实际等待或完成状态。历史消息缺失时间显示未知时间，占位日期不代表真实联系时间。AI 失败或中断回复单独标记。",
      ],
    ],
  },
  {
    key: "assessment",
    title: [
      "Learning goals and assessment evidence",
      "Tujuan belajar dan bukti asesmen",
      "学习目标与测评依据",
    ],
    body: [
      [
        "Self-reported level, quick assessment, full assessment and teacher placement are different evidence sources. The list shows a concise source and conclusion; the panel provides available score, question counts, sections and version details. Teacher placement never borrows a paper score. Internal assessment is not an official HSK certificate.",
        "Level yang dilaporkan pelanggan, asesmen cepat, asesmen lengkap, dan penempatan oleh guru merupakan sumber bukti berbeda. Daftar menampilkan sumber dan kesimpulan singkat; panel menyediakan skor, jumlah soal, bagian, serta versi yang tersedia. Penempatan oleh guru tidak memakai skor ujian sebagai skornya. Asesmen internal bukan sertifikat HSK resmi.",
        "自报水平、快速测评、完整测评和教师定级是不同依据。列表显示来源与简明结论；面板提供已有分数、题数、分项和版本。教师定级不借用试卷分数。内部测评不是官方 HSK 证书。",
      ],
      [
        "Presentation and language changes do not regrade attempts or recalculate customer groups. Missing completion times remain unknown. Zero skipped or unanswered questions is displayed as 0.",
        "Perubahan tampilan dan bahasa tidak menilai ulang jawaban atau menghitung ulang kelompok pelanggan. Waktu penyelesaian yang tidak tersedia tetap tidak diketahui. Jumlah soal dilewati atau tidak dijawab yang nol ditampilkan sebagai 0.",
        "展示和语言切换不重新评分或重算客户分组。缺失完成时间仍为未知；跳过或未作答为零时明确显示 0。",
      ],
    ],
  },
  {
    key: "operations",
    title: [
      "Sales Operations: seven modules",
      "Operasional Penjualan: tujuh modul",
      "销售运营：七个模块",
    ],
    body: [
      [
        "The seven modules are Business Schedule, First Response, Call Retries, Watchdog Alerts, Milestones, Reactivation, and Notification settings & delivery audit. Save Policies applies to the first six modules. Notification rules and channels have their own save controls; saving one area does not save the other.",
        "Tujuh modul terdiri dari Jadwal kerja, Respons pertama, Percobaan kontak ulang, Peringatan aktivitas, Tonggak kemajuan, Aktivasi kembali, serta Pengaturan notifikasi dan audit pengiriman. Simpan Kebijakan berlaku untuk enam modul pertama. Aturan notifikasi dan kanal memiliki kontrol simpan sendiri; menyimpan satu area tidak menyimpan area lain.",
        "七个模块为工作日历、首次响应、未回复重试、未联系告警、业务里程碑、沉睡客户复活、通知设置与发送审计。保存策略覆盖前六个模块；通知策略和渠道分别保存，保存一个区域不会保存另一区域。",
      ],
      [
        "New task deadlines use server-side SLA settings and the operating calendar. Changes do not silently rewrite existing deadlines. Notification rules inherit the global calendar by default; custom calendars and daily-summary time are shown only when relevant.",
        "Tenggat tugas baru memakai pengaturan SLA dan kalender operasional di server. Perubahan tidak mengubah tenggat lama secara diam-diam. Aturan notifikasi secara default mengikuti kalender global; kalender khusus dan waktu ringkasan harian hanya ditampilkan bila relevan.",
        "新任务截止时间由服务端 SLA 配置和运营日历计算；修改配置不会静默重写已有截止时间。通知策略默认继承全局日历；仅在适用时显示自定义时间或每日汇总时间。",
      ],
    ],
  },
  {
    key: "notifications",
    title: [
      "Notification rules, channels and delivery audit",
      "Aturan notifikasi, kanal, dan audit pengiriman",
      "通知策略、渠道与发送审计",
    ],
    body: [
      [
        "Configure the business event, searchable multi-select conditions, recipients, delivery timing, and reliability controls. Customer notifications go to the valid Owner; unassigned or invalid Owners route to CRM Leaders globally. Draft rules do not send. Enabled changes apply to new events; queued jobs retain their saved rule version.",
        "Konfigurasikan peristiwa bisnis, kondisi pilihan jamak yang dapat dicari, penerima, waktu pengiriman, dan kontrol keandalan. Notifikasi pelanggan ditujukan ke Penanggung jawab yang valid; Penanggung jawab tidak valid atau belum ditugaskan dialihkan secara global ke Pengelola CRM. Aturan draf tidak mengirim. Perubahan yang diaktifkan berlaku untuk peristiwa baru; tugas antrean mempertahankan versi aturan tersimpan.",
        "配置业务事件、可搜索多选触发条件、接收对象、发送时间和可靠性控制。客户通知发送给有效 Owner；未分配或 Owner 无效时全局路由给 CRM 管理者。草稿不发送；启用后的修改作用于新事件，待发任务保留已保存的策略版本。",
      ],
      [
        "Lark channels identify the group and sending mode. Simulation does not require a Webhook and sends nothing externally. Live mode references a server-side Webhook environment variable and optional signing configuration. Group rate limits belong to the channel. Keys are never entered as ordinary customer data.",
        "Kanal Lark menentukan grup dan mode pengiriman. Simulasi tidak memerlukan Webhook dan tidak mengirim ke luar. Mode nyata merujuk variabel lingkungan Webhook di server dan konfigurasi tanda tangan opsional. Batas laju grup berada pada kanal. Kunci tidak dimasukkan sebagai data pelanggan biasa.",
        "Lark 渠道明确群名称与发送模式。模拟无需 Webhook，也不实际外发；真实模式引用服务端 Webhook 环境变量，可按需配置签名。群级限流属于渠道。密钥不作为普通客户资料输入。",
      ],
      [
        "Pending, sending, API accepted, simulated, failed, unknown and cancelled are distinct states. API acceptance does not mean staff read or completed follow-up. Unknown delivery needs review before retry. Leads list reminders are the daily work entry point; the audit is for tracing delivery and failures. Email and SMS remain unavailable until their senders are connected.",
        "Menunggu, mengirim, diterima API, disimulasikan, gagal, tidak diketahui, dan dibatalkan adalah status berbeda. Penerimaan API tidak berarti staf telah membaca atau menyelesaikan tindak lanjut. Pengiriman yang tidak diketahui perlu diperiksa sebelum dicoba ulang. Pengingat daftar prospek merupakan titik masuk pekerjaan harian; audit digunakan untuk menelusuri pengiriman dan kegagalan. Email dan SMS belum tersedia sampai pengirimnya terhubung.",
        "待发送、发送中、接口接受、模拟、失败、结果未知、已取消是不同状态。接口接受不代表员工已读或已跟进；结果未知需先核查再重试。列表提醒是日常处理入口，发送审计用于追踪通知和故障。Email 和短信在发送器接通前不可作为有效渠道。",
      ],
    ],
  },
  {
    key: "campaigns",
    title: [
      "Marketing campaigns and attribution",
      "Kampanye pemasaran dan atribusi",
      "营销活动与来源归因",
    ],
    body: [
      [
        "The campaign's Chinese display name and its English / Indonesian display name are separate saved fields. Their labels identify where each field is displayed; saving does not translate either name automatically.",
        "Nama tampilan Mandarin dan nama tampilan Inggris / Indonesia pada kampanye disimpan sebagai dua kolom terpisah. Label menunjukkan tempat masing-masing nama ditampilkan; penyimpanan tidak menerjemahkan nama secara otomatis.",
        "活动的中文显示名称和英文／印尼文显示名称是两个独立保存字段；标签说明各自显示位置。保存不会自动翻译名称。",
      ],
      [
        "Use Marketing Campaigns to review campaign information and related leads. First customer source and each conversation source serve different attribution purposes. Customer-entered campaign names and descriptions retain their original wording. Campaign activity does not bypass CRM visibility permissions.",
        "Gunakan Kampanye Pemasaran untuk meninjau informasi kampanye dan prospek terkait. Sumber pertama pelanggan dan sumber setiap percakapan memiliki fungsi atribusi berbeda. Nama dan deskripsi kampanye yang dimasukkan tetap memakai teks aslinya. Aktivitas kampanye tidak melewati izin visibilitas CRM.",
        "营销活动模块用于查看活动信息及相关客户。客户首次来源与每次会话来源承担不同归因用途；输入的活动名称与描述保留原文。营销活动入口不绕过 CRM 数据权限。",
      ],
    ],
  },
  {
    key: "support",
    title: [
      "Daily checks and troubleshooting",
      "Pemeriksaan harian dan pemecahan masalah",
      "日常检查与排错",
    ],
    body: [
      [
        "Use the language dropdown beside the theme control to select English, Indonesian or Chinese. It uses the same single-select interaction as Owner, without a search box. Escape closes it; arrow keys move between options. Original names, notes and conversations are preserved.",
        "Pilih bahasa Inggris, Indonesia, atau Mandarin melalui menu bahasa di sebelah tombol tema. Menu ini memakai pola pilihan tunggal yang sama dengan Penanggung jawab, tanpa kotak pencarian. Escape menutup menu; tombol panah berpindah antaropsi. Nama, catatan, dan percakapan asli tetap dipertahankan.",
        "通过主题按钮旁的语言下拉选择英文、印尼文或中文。样式与负责人单选一致，无搜索框；按 Escape 关闭，方向键移动选项。姓名、备注和对话原文保持不变。",
      ],
      [
        "Delivery records show a localized status summary. Expand Original technical receipt to inspect the provider response in its original language; this evidence is not automatically translated.",
        "Catatan pengiriman menampilkan ringkasan status sesuai bahasa antarmuka. Buka Respons teknis asli untuk memeriksa respons penyedia dalam bahasa aslinya; bukti ini tidak diterjemahkan otomatis.",
        "发送记录显示当前语言的状态摘要；展开原始技术回执可查看服务返回的原文，此证据不自动翻译。",
      ],
      [
        "Start with your role default view, check unread activity and overdue tasks, claim eligible unassigned leads, record contact, and complete or schedule the next task. Refresh after an ownership conflict. A failed save is not a successful follow-up; keep the draft and retry after checking the error.",
        "Mulai dari tampilan default peran, periksa aktivitas belum dibaca dan tugas terlambat, ambil prospek belum ditugaskan yang memenuhi syarat, catat kontak, lalu selesaikan atau jadwalkan tugas berikutnya. Muat ulang setelah konflik kepemilikan. Penyimpanan gagal bukan tindak lanjut yang berhasil; pertahankan draf dan coba lagi setelah memeriksa kesalahan.",
        "从角色默认视图开始，检查未读与逾期任务，认领适用的未分配客户，记录联系，完成或安排下一项任务。归属冲突后刷新。保存失败不算完成跟进，保留草稿并根据错误重试。",
      ],
      [
        "Language preferences change system labels and documentation, not names, transcripts or notes. If a deadline or assessment is missing, inspect its source instead of inventing a value. Use delivery audit for notification issues and contact a CRM Leader for access or configuration issues.",
        "Preferensi bahasa mengubah label sistem dan dokumentasi, bukan nama, transkrip, atau catatan. Jika tenggat atau asesmen tidak tersedia, periksa sumbernya dan jangan membuat nilai sendiri. Gunakan audit pengiriman untuk masalah notifikasi dan hubungi Pengelola CRM untuk masalah akses atau konfigurasi.",
        "语言偏好改变系统标签和文档，不改变姓名、对话与备注。缺失截止时间或测评时，应核查来源，不猜造数值。通知问题查看发送审计；权限和配置问题联系 CRM 管理者。",
      ],
    ],
  },
] as const;
