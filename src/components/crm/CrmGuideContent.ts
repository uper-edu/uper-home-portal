export type GuideLanguage = "en" | "id" | "zh";
export const guideSections = [
  {
    key: "process-and-marketing-metrics",
    title: [
      "Sales process and campaign measurement",
      "Proses penjualan dan pengukuran kampanye",
      "销售过程与营销统计",
    ],
    body: [
      [
        "The process overview uses the current filtered customers within your access scope. Managers see it expanded and can inspect groups by current owner; sales can expand their own scope. It is a lifetime cohort snapshot, not a daily employee ranking. Contact attempts are auxiliary; human two-way communication, unresolved tasks and valid future arrangements are the main signals.",
        "Ringkasan proses memakai pelanggan terfilter dalam cakupan akses Anda. Manajer melihatnya terbuka dan dapat meninjau kelompok berdasarkan penanggung jawab saat ini; sales dapat membuka cakupannya sendiri. Ini adalah kondisi kelompok sejak pendaftaran, bukan peringkat harian karyawan. Upaya kontak adalah pendukung; komunikasi manusia dua arah, tugas belum selesai, dan rencana lanjutan yang valid menjadi sinyal utama.",
        "过程概览只使用权限内当前筛选客户。管理者默认展开，可按当前负责人查看；销售可自行展开。它是自登记以来的客户群快照，不是员工每日排名。联系尝试仅为辅助，重点看人工双向沟通、未完成事项和有效后续安排。",
      ],
      [
        "First human contact is elapsed time from registration to the first submitted contact record, including unanswered attempts. The first successful two-way contact is measured separately. AI replies, administrative records and missing times do not count. Record submission time is not an exact call time. Unassigned wait needs a recorded ownership change. Current stage duration needs a stage timestamp and excludes closed customers. Missing evidence is not zero. These are natural elapsed durations, not working-hour SLA calculations.",
        "Kontak staf pertama adalah durasi sejak pendaftaran hingga catatan kontak pertama dikirim, termasuk upaya tanpa balasan. Kontak dua arah berhasil pertama diukur terpisah. Balasan AI, catatan administratif, dan waktu hilang tidak dihitung. Waktu pengiriman catatan bukan waktu telepon tepat. Waktu belum ditugaskan memerlukan perubahan penanggung jawab tercatat. Durasi tahap saat ini memerlukan waktu tahap dan mengecualikan pelanggan tertutup. Bukti hilang bukan nol. Durasi ini adalah waktu berlalu alami, bukan perhitungan SLA jam kerja.",
        "首条人工联系按登记到首条人工联系记录提交的自然时长计算，包含未接通尝试；首次有效双向沟通另计。AI 回复、非联系记录及缺失时间不计入。记录提交时间不是精确通话发生时间。未分配时长须有归属变化时间，当前阶段停留须有阶段时间且不含关闭客户。缺失证据不是零。这些自然时长不等于按工作日历计算的 SLA。",
      ],
      [
        "Current overdue means an unfinished task with a real past deadline. A historical overdue event or a completed task is not current overdue. Late completion uses the processing record time and is shown separately. Unknown or historical tasks go to evidence review, not a fabricated no-task count.",
        "Terlambat saat ini berarti tugas belum selesai dengan tenggat nyata yang telah lewat. Peristiwa terlambat historis atau tugas selesai bukan keterlambatan saat ini. Penyelesaian terlambat memakai waktu catatan pemrosesan dan ditampilkan terpisah. Tugas historis atau tidak diketahui masuk tinjauan bukti, bukan jumlah tanpa tugas yang direkayasa.",
        "当前逾期是有真实过去期限的未完成任务；历史逾期事件及已完成任务不计入。逾期后处理使用处理记录提交时间，单独呈现。时间未知或历史任务进入证据待核实，不假装没有任务。",
      ],
      [
        "Campaigns count saved registrations, server assessment evidence, staff-confirmed participation and enrollment separately. Participation is recorded in Profile with a campaign, onsite/online mode and check-in or meeting evidence; it never follows automatically from a questionnaire, test or trial stage. A correction requires a reason and retains its audit; repeated saves do not duplicate attendance.",
        "Kampanye menghitung pendaftaran tersimpan, bukti asesmen server, partisipasi terkonfirmasi staf, dan pendaftaran kelas secara terpisah. Partisipasi dicatat di Profil dengan kampanye, mode di lokasi/daring, serta bukti check-in atau pertemuan; tidak otomatis mengikuti kuesioner, tes, atau tahap uji coba. Koreksi memerlukan alasan dan menyimpan audit; penyimpanan berulang tidak menggandakan kehadiran.",
        "活动分别统计已保存登记、服务端测评证据、员工确认参与和报名。参与在客户资料中选择活动、现场／线上方式并填写签到或会议依据；问卷、测评及试听阶段都不会自动确认出席。纠正须说明原因并保留审计，重复提交不重复计数。",
      ],
      [
        "Enrollment share uses enrollment records divided by first-attributed saved customers; with no denominator it is not calculable. Repeated link opens are not unique visitors or QR attendance. Cross-campaign participation counts campaign-customer pairs, and can include customers acquired elsewhere. Recorded amounts and planned budget are not verified collections, actual spend, profit or ROI. A saved sales stage alone does not confirm a signed contract, assigned class, campus visit or payment; the timeline states the recorded status and does not invent missing class information. Campaign summary and cards use the same campaign search, type and status filters. Customer counts follow access permissions and do not inherit worklist filters. Public onboarding links expose campaign content, not CRM metrics.",
        "Proporsi pendaftaran kelas memakai catatan pendaftaran kelas dibagi pelanggan tersimpan dengan atribusi pertama; tanpa penyebut, rasio tidak dapat dihitung. Pembukaan tautan berulang bukan pengunjung unik atau kehadiran QR. Partisipasi lintas kampanye menghitung pasangan kampanye-pelanggan dan dapat mencakup pelanggan dari kampanye lain. Nominal tercatat dan anggaran rencana bukan penerimaan terverifikasi, pengeluaran aktual, laba, atau ROI. Tahap penjualan tersimpan saja tidak membuktikan kontrak, kelas yang ditetapkan, kunjungan kampus, atau pembayaran; linimasa menampilkan status tercatat tanpa mengarang informasi kelas yang hilang. Ringkasan dan kartu kampanye memakai filter pencarian, jenis, dan status kampanye yang sama. Jumlah pelanggan mengikuti izin akses dan tidak mewarisi filter daftar kerja. Tautan onboarding publik menampilkan konten kampanye, bukan metrik CRM.",
        "报名占比以报名记录除以首次归因登记客户；无分母时不可计算。重复链接访问不是独立访客或扫码到场。跨活动参与计活动—客户对，可包含从其他活动获客的客户。登记金额和计划预算不等于已核验收款、实际花费、利润或 ROI。仅保存销售阶段不能证明签约、班级分配、校区到访或缴费；时间轴只展示已记录状态，不补造缺失班级。营销汇总与活动卡片使用同一组活动搜索、类型及状态筛选；客户计数遵守权限，不继承工作列表筛选；公开问卷入口仅返回活动内容，不返回 CRM 指标。",
      ],
    ],
  },
  {
    key: "visual-status",
    title: [
      "Status colors and action priority",
      "Warna status dan prioritas tindakan",
      "状态颜色与操作优先级",
    ],
    body: [
      [
        "Teal highlights primary actions and selection. Red means current overdue or failure; amber means due today or review; blue means unread new information; green means completed or confirmed. Customer group and historical context stay neutral. Buying signals open evidence in Profile and are not instructions to contact urgently.",
        "Hijau kebiruan menandai tindakan utama dan pilihan. Merah berarti terlambat saat ini atau gagal; kuning berarti jatuh tempo hari ini atau perlu ditinjau; biru berarti informasi baru belum dibaca; hijau berarti selesai atau terkonfirmasi. Kelompok pelanggan dan konteks historis tetap netral. Sinyal pembelian membuka bukti di Profil, bukan instruksi menghubungi segera.",
        "青绿色突出主操作与选中；红色表示当前逾期或失败，琥珀色表示今天到期或待核实，蓝色表示未读新信息，绿色表示完成或确认。客户分组及历史信息保持中性。购买信号仅打开资料依据，不等于立即联系指令。",
      ],
    ],
  },
  {
    key: "failure-and-accessibility",
    title: [
      "Recovery and keyboard access",
      "Pemulihan dan akses keyboard",
      "异常恢复与键盘操作",
    ],
    body: [
      [
        "A failed save retains the draft and keeps the current customer. If the server accepted it but the reply was lost, retry without changing the draft; the same request is not saved twice.",
        "Penyimpanan gagal mempertahankan draf dan pelanggan saat ini. Jika server menerima tetapi balasan hilang, coba lagi tanpa mengubah draf; permintaan yang sama tidak disimpan dua kali.",
        "保存失败保留草稿和当前客户。服务器已保存但响应丢失时，保留原内容重试，同一请求不会重复保存。",
      ],
      [
        "Temporary connection failure does not sign you out. If access changes, old customer details close and your own draft remains in this page memory. Reopen after access returns to continue. Refreshing or closing the page clears unsaved memory; explicit sign-out clears your drafts.",
        "Gangguan koneksi sementara tidak mengeluarkan akun. Saat akses berubah, detail pelanggan ditutup dan draf sendiri tetap dalam memori halaman. Buka kembali setelah akses pulih. Memuat ulang/menutup halaman menghapus draf belum tersimpan; keluar akun menghapus draf Anda.",
        "临时断线不会退出登录。权限变化会关闭旧客户资料，自己的草稿保留在当前页内存中；恢复权限后重新打开客户可继续。刷新或关闭页面会清除未保存的内存草稿，主动退出会清除自己的草稿。",
      ],
      [
        "Use Tab and Shift+Tab to move between controls, arrow keys to navigate choices and tabs, Enter to select, and Escape to close a choice or contact preview. Errors receive focus. Mobile module navigation stays on one row; scroll horizontally to reach other modules.",
        "Gunakan Tab/Shift+Tab untuk berpindah kontrol, panah untuk pilihan dan tab, Enter untuk memilih, Escape untuk menutup pilihan atau pratinjau kontak. Fokus berpindah ke pesan kesalahan. Navigasi modul pada layar kecil tetap satu baris; geser untuk membuka modul lainnya.",
        "使用Tab／Shift+Tab切换控件，方向键切换选项和页签，Enter选择，Escape关闭选项或联系预览；错误提示获得焦点。手机模块导航保持单行；横向滚动可进入其他模块。",
      ],
    ],
  },
  {
    key: "efficient-followup",
    title: ["Daily sales work", "Pekerjaan penjualan harian", "日常销售跟进"],
    body: [
      [
        "Sales start in their own Needs handling queue; Managers see all customers. Reset restores role defaults. Reading clears unread marks, not tasks.",
        "Staf penjualan mulai dari antrean Perlu ditangani miliknya; Pengelola melihat semua pelanggan. Reset memulihkan tampilan peran. Membaca hanya menghapus tanda belum dibaca, bukan tugas.",
        "销售默认进入本人需处理队列，管理者查看全部客户。重置恢复角色默认；读取只清除未读，不完成任务。",
      ],
      [
        "Choose a contact result explicitly. Attempts and connected/replied records are separate; summaries retain staff original wording. Save and next advances only after server confirmation.",
        "Pilih hasil kontak secara eksplisit. Percobaan dan kontak yang tersambung/dibalas dihitung terpisah; ringkasan mempertahankan teks asli staf. Simpan dan lanjut berpindah hanya setelah konfirmasi server.",
        "联系结果必须主动选择；尝试与接通／回复分别统计，摘要保留员工原文。保存并下一位只在服务器确认后跳转。",
      ],
      [
        "Customer language is independent of the interface. Preview and edit before WhatsApp or copying. Opening does not prove sending or contact.",
        "Bahasa pelanggan terpisah dari antarmuka. Tinjau dan edit sebelum WhatsApp atau menyalin. Membuka tidak membuktikan pengiriman atau kontak.",
        "客户沟通语言独立于界面；WhatsApp与复制前预览编辑，打开不代表发送或联系。",
      ],
      [
        "Waiting and nurturing require a reason and review time. Stopping requires a reason. Existing deadlines remain; reminders become internal review. Restore contact with a reason, never automatically.",
        "Menunggu dan pembinaan memerlukan alasan dan waktu tinjauan. Penghentian memerlukan alasan. Tenggat lama tetap; pengingat menjadi tinjauan internal. Pulihkan kontak dengan alasan, tidak otomatis.",
        "等待和培育须填写原因与复查时间，停止须说明原因。原截止时间保留，提醒转内部复查；恢复须说明原因，不自动恢复。",
      ],
      [
        "Missing Lark channels are configuration failures. Simulation is explicit; API acceptance is not group receipt. Sales and operations use CRM Bot with distinct labels.",
        "Kanal Lark yang hilang adalah kegagalan konfigurasi. Simulasi dipilih eksplisit; penerimaan API bukan penerimaan grup. Penjualan dan operasional memakai CRM Bot dengan label berbeda.",
        "缺失Lark渠道是配置失败；模拟须明确选择，接口接受不等于群内实收。销售与运营使用CRM Bot，并区分标签。",
      ],
      [
        "The home-page alert counts current notification problems. Historical failures frozen during migration remain in Delivery records with their original status and reason; they are not automatically replayed and do not imply a current channel outage.",
        "Peringatan di halaman utama menghitung masalah notifikasi saat ini. Kegagalan lama yang dibekukan saat migrasi tetap tercatat dalam Riwayat pengiriman beserta status dan alasannya; tidak dikirim ulang otomatis dan tidak berarti kanal sedang bermasalah.",
        "首页告警统计当前通知问题。迁移时冻结的历史失败仍在发送记录中保留原状态和原因，不会自动重发，也不代表当前渠道失效。",
      ],
    ],
  },
  {
    key: "workspace",
    title: ["Customer workspace", "Ruang kerja pelanggan", "客户工作区"],
    body: [
      [
        "Browser tab titles show the current module, Sales Management and UPER. Switching interface language updates titles and descriptions; customer names, messages and notes stay original and do not appear in tab titles. CRM and its sign-in pages are not indexed. Search controls never replace sign-in and permissions. Public website titles and canonical links are separate from staff documentation. The company trial at home.prototype.uperedu.com uses synthetic customers, keeps staff role boundaries and excludes the entire site from indexing; VPN access may be required. Simulated notifications are not proof of CRM Bot receipt.",
        "Judul tab menampilkan modul aktif, Manajemen Penjualan, dan UPER. Pergantian bahasa antarmuka memperbarui judul dan deskripsi; nama, pesan, dan catatan pelanggan tetap asli dan tidak muncul pada judul tab. CRM dan halaman loginnya tidak diindeks. Kontrol pencarian tidak menggantikan login dan izin. Judul serta tautan kanonis situs publik terpisah dari dokumentasi staf. Uji coba perusahaan di home.prototype.uperedu.com memakai pelanggan sintetis, mempertahankan batas peran staf, dan tidak diindeks seluruhnya; akses VPN mungkin diperlukan. Simulasi bukan bukti penerimaan di CRM Bot.",
        "浏览器标签标题依次显示当前功能、销售管理与UPER。切换界面语言时同步更新标题和说明；客户姓名、消息和备注保持原文，不进入标签标题。CRM及登录页禁止搜索索引；搜索控制不能替代登录和权限校验。公开网站的标题与规范链接独立于员工文档。公司试用home.prototype.uperedu.com使用模拟客户，保留员工角色权限，全站禁止索引，访问可能需要VPN；模拟通知不代表CRM Bot群已实收。",
      ],
      [
        "Use Processing priority to order current work without changing classifications or deadlines. The customer panel keeps the next task visible across tabs. Arrow keys, Home and End switch tabs; unsaved follow-up drafts require a choice before leaving. Previous and next customer preserve the selected tab. Profile evidence and assessment technical details are expandable. Conversations retain source messages and can link an original message to follow-up; they do not provide live human chat.",
        "Gunakan Prioritas penanganan untuk mengurutkan pekerjaan saat ini tanpa mengubah klasifikasi atau tenggat. Panel pelanggan tetap menampilkan tugas berikutnya pada semua tab. Tombol panah, Home, dan End berpindah tab; draf tindak lanjut belum tersimpan memerlukan pilihan sebelum keluar. Pelanggan sebelumnya dan berikutnya mempertahankan tab yang dipilih. Dasar profil dan detail teknis asesmen dapat dibuka sesuai kebutuhan. Percakapan mempertahankan pesan sumber dan dapat menautkannya ke tindak lanjut; fitur ini bukan obrolan langsung dengan staf.",
        "可使用处理优先级排序当前工作，不改变分类或截止时间。客户面板在各页签保留下一步任务摘要。方向键及 Home、End 可切换页签，离开未保存的跟进草稿时须明确选择；上一位、下一位客户保留当前页签。客户资料依据和测评技术详情按需展开。对话保留来源原文，可关联到跟进；此处不提供实时人工坐席聊天。",
      ],
      [
        "Current tasks determine deadlines; historical activity is not an unresolved status. Recording contact completes only explicitly selected tasks. Active customers must retain a valid arrangement, schedule a new step or record a reason for no next step. A saved result confirms the completed tasks and the next arrangement. Administrative records do not increase contact counts or claim a customer was reached.",
        "Tugas saat ini menentukan tenggat; aktivitas historis bukan status yang belum terselesaikan. Pencatatan kontak hanya menyelesaikan tugas yang dipilih secara eksplisit. Pelanggan aktif harus mempertahankan pengaturan valid, menjadwalkan langkah baru, atau mencatat alasan tanpa langkah berikutnya. Hasil tersimpan mengonfirmasi tugas selesai dan pengaturan berikutnya. Catatan administratif tidak menambah jumlah kontak atau menyatakan pelanggan sudah dihubungi.",
        "截止状态以当前任务为准，历史动态不代表当前未解决状态。记录联系只完成明确勾选的任务。活跃客户须保留有效安排、安排下一步或记录暂不安排原因。保存结果会说明完成任务及后续去向。非联系处理记录不增加联系次数，也不表示已触达客户。",
      ],
      [
        "CRM uses a shared option-panel style across filters, customer edits, campaign setup, Sales Operations and notifications. A checkmark identifies a single choice; checkboxes identify multiple choices. Escape closes without changing the current draft. Disabled prompts and mandatory table fields cannot be selected or cleared.",
        "CRM memakai gaya panel pilihan yang sama pada filter, penyuntingan pelanggan, kampanye, Operasional Penjualan, dan notifikasi. Tanda centang menandai satu pilihan; kotak centang menandai pilihan jamak. Escape menutup tanpa mengubah draf. Opsi petunjuk yang nonaktif dan kolom tabel wajib tidak dapat dipilih atau dihapus.",
        "CRM 的筛选、客户编辑、营销活动、销售运营和通知统一使用标准选项面板。单选以勾号标记，多选以复选框标记。Escape 关闭，不改变当前草稿；禁用占位项不可选择，字段表的姓名和客户编号不能取消。",
      ],
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
        "The sign-in page uses the same EN, ID and Chinese language buttons as CRM. Choose a language before signing in; the choice is kept in the workspace. Use your existing staff login ID and password. Changing language does not clear entered credentials.",
        "Halaman masuk memakai tombol bahasa EN, ID, dan Mandarin yang sama dengan CRM. Pilih bahasa sebelum masuk; pilihan tetap digunakan di ruang kerja. Gunakan ID akun staf dan kata sandi yang sudah ada. Mengganti bahasa tidak menghapus isian akun.",
        "登录页与 CRM 使用相同的 EN、ID、中文语言按钮。可先选择语言，进入工作区后继续使用该语言。请使用已有员工账号和密码；切换语言不会清空已输入内容。",
      ],
      [
        "In Profile, Customer owner and Sales stage use the same option style as the main list. Search is available for owners; the fixed stage list has no search. Selecting a different value saves it immediately through the existing permission checks; selecting the current value makes no change. Escape closes without saving.",
        "Di Profil, Penanggung jawab pelanggan dan Tahap penjualan memakai gaya pilihan yang sama dengan daftar utama. Penanggung jawab dapat dicari; daftar tahap tetap tidak memiliki pencarian. Memilih nilai berbeda langsung menyimpannya melalui pemeriksaan izin yang berlaku; memilih nilai saat ini tidak mengubah data. Escape menutup tanpa menyimpan.",
        "客户资料中的负责人和销售阶段使用与主列表一致的选项样式。负责人可搜索，固定阶段列表无搜索。选择不同值会按现有权限立即保存；选择当前值不改动数据，Escape 关闭不保存。",
      ],
      [
        "CRM requires staff sign-in. Default CRM Manager roles manage visibility, assignment and operations; Sales handle customers within their scope. Current roles appear in the account menu; the staff directory, not this manual, is the source of current membership. Use the account menu to change your own password or sign out.",
        "CRM mewajibkan login staf. Peran Manajer CRM secara default mengelola visibilitas, penugasan, dan operasional; staf penjualan menangani pelanggan dalam cakupannya. Peran saat ini terlihat di menu akun; daftar staf, bukan panduan ini, menjadi sumber keanggotaan terbaru. Gunakan menu akun untuk mengubah kata sandi sendiri atau keluar.",
        "访问 CRM 须员工登录。默认CRM管理者角色负责可见范围、分配与运营，销售处理权限范围内的客户。当前角色在账号菜单查看，人员名单以员工目录为准，不由手册写死。账号菜单提供修改自己的密码和退出入口。",
      ],
      [
        "System management → Users & access manages staff roles and per-action own/all scopes. Teams do not control access, claiming or routing. Authorized sales share the unassigned pool; customer notifications use valid Owner → authorized CRM Manager. Login ID and an optional unique email use the same password and account. System administrators maintain roles and emails; the separate system guide explains administration. Changes revoke affected sessions and preserve ownership.",
        "Manajemen sistem → Pengguna & akses mengelola peran dan cakupan tindakan sendiri/semua. Tim tidak mengatur izin, pengambilan, atau alur notifikasi. Sales berwenang memakai kumpulan pelanggan tanpa penanggung jawab bersama; notifikasi pelanggan memakai penanggung jawab valid → Manajer CRM berwenang. ID login dan email unik opsional memakai kata sandi serta akun yang sama. Administrator Sistem mengelola peran dan email; panduan sistem terpisah menjelaskan administrasi. Perubahan mencabut sesi terkait dan mempertahankan kepemilikan.",
        "系统管理中的用户与权限配置角色及每项操作的本人／全部范围。团队不参与授权、认领或路由；有权限的销售共用未分配客户池，客户通知按有效负责人 → 有权处理客户的 CRM 管理者路由。登录ID和可选的唯一邮箱使用同一账号及密码。角色、邮箱由系统管理员维护，具体流程见独立系统指南。修改撤销受影响会话，保留客户归属。",
      ],
      [
        "Managers can view all leads and assign active Sales owners. Sales default to their own leads and may view eligible unassigned leads. Sales can claim an unassigned lead only for themselves and cannot transfer their leads to another salesperson. Sales Operations settings are restricted to Managers; the server enforces these permissions.",
        "Manajer CRM dapat melihat semua prospek dan menetapkan staf penjualan aktif sebagai penanggung jawab. Staf penjualan secara default melihat prospek sendiri dan dapat melihat prospek belum ditugaskan yang memenuhi cakupan akses. Staf penjualan hanya dapat mengambil prospek untuk dirinya sendiri dan tidak dapat memindahkan prospek ke staf penjualan lain. Pengaturan Operasional Penjualan dibatasi untuk Manajer CRM; server menerapkan izin ini.",
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
        "Use search, Owner, Tasks and Unread by me for daily work. More filters provides customer group, sales stage, contact status, follow-up situation, learning format and buying signal. Values within one category use OR logic; categories combine with AND logic. Only Owner has a search box. Reset restores your role default.",
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
        "The contact form uses the standard CRM option panel for channel, contact result, stage and buying signal. These fixed lists have no search. Staff identity remains locked to the signed-in employee. Changing form choices edits the draft only; Save follow-up submits the record.",
        "Formulir kontak memakai panel pilihan standar CRM untuk kanal, hasil kontak, tahap, dan sinyal pembelian. Daftar tetap ini tidak memiliki pencarian. Identitas staf tetap terkunci pada akun yang masuk. Perubahan pilihan hanya mengubah draf; Simpan tindak lanjut mengirim catatan.",
        "跟进表单的沟通方式、接通情况、推进阶段和购买信号使用标准 CRM 选项面板，固定选项无搜索。顾问责任人保持为当前登录员工，不可切换。修改选项只编辑草稿，点击保存跟进记录后才提交。",
      ],
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
        "Notification events and trigger conditions keep their searchable choices and historical values. Multiple selections stay open until you finish; clearing removes the filter, not the customer data. Fixed schedule, calendar, recipient and channel-mode choices use the same panel without search. A choice does not activate a draft; use its save controls.",
        "Peristiwa dan kondisi notifikasi tetap dapat dicari dan mempertahankan nilai historis. Panel pilihan jamak tetap terbuka; mengosongkan pilihan menghapus filter, bukan data pelanggan. Jadwal, kalender, penerima, dan mode kanal memakai panel yang sama tanpa pencarian. Pilihan tidak mengaktifkan draf; gunakan tombol simpan yang sesuai.",
        "通知事件与触发条件保留搜索及历史值，多选面板选择后保持打开；清除只取消筛选条件，不删除客户数据。发送安排、工作日历、接收对象和渠道模式等固定选项使用相同面板，无搜索。选择本身不会启用草稿，仍须使用对应保存按钮。",
      ],
      [
        "Configure the business event, searchable multi-select conditions, recipients, delivery timing, and reliability controls. Customer notifications go to the valid Owner; unassigned or invalid Owners route to CRM Managers globally. Draft rules do not send. Enabled changes apply to new events; queued jobs retain their saved rule version.",
        "Konfigurasikan peristiwa bisnis, kondisi pilihan jamak yang dapat dicari, penerima, waktu pengiriman, dan kontrol keandalan. Notifikasi pelanggan ditujukan ke Penanggung jawab yang valid; Penanggung jawab tidak valid atau belum ditugaskan dialihkan secara global ke Manajer CRM. Aturan draf tidak mengirim. Perubahan yang diaktifkan berlaku untuk peristiwa baru; tugas antrean mempertahankan versi aturan tersimpan.",
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
        "Create a campaign, copy its tracking link or QR code, then complete the questionnaire, assessment and AI consultation. Links use the current environment. CRM stores the first campaign attribution and each conversation's campaign separately. Registered leads count saved customer records; Assessments completed counts customers with saved server assessment results. Neither metric proves event attendance. Campaign counts use the current CRM database and saved assessment evidence; revenue includes recorded amounts only, with no assumed fees. Test notices in a live Lark group must be explicitly configured and identified as tests.",
        "Buat kampanye, salin tautan pelacakan atau kode QR, lalu isi kuesioner, asesmen, dan konsultasi AI. Tautan memakai lingkungan saat ini. CRM menyimpan atribusi kampanye pertama dan kampanye setiap percakapan secara terpisah. Prospek terdaftar menghitung catatan pelanggan tersimpan; Asesmen selesai menghitung pelanggan dengan hasil asesmen server tersimpan. Keduanya bukan bukti kehadiran acara. Jumlah prospek memakai basis data CRM saat ini dan bukti asesmen tersimpan; pendapatan hanya mencakup jumlah tercatat, tanpa asumsi biaya. Notifikasi uji di grup Lark aktif harus dikonfigurasi secara eksplisit dan ditandai sebagai pengujian.",
        "创建营销活动，复制专属链接或二维码，再完成问卷、测评和 AI 咨询。链接使用当前环境域名。CRM 分别保存首次活动归因和每次会话的活动来源。已登记客户统计保存成功的客户记录，已完成测评统计已有服务端测评结果的客户；两者均不能证明活动到场。活动统计读取当前 CRM 数据库和已保存的测评依据；营收仅统计已记录金额，不假设学费。向真实 Lark 群发送测试通知须明确配置，并标识为测试。",
      ],
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
        "Use the Sales management workspace for CRM. The account menu shows your current role, password change and sign-out. View website opens a separate tab. Other workspaces have independent permissions and their own operating documentation.",
        "Gunakan ruang Manajemen penjualan untuk CRM. Menu akun menampilkan peran saat ini, perubahan kata sandi, dan keluar. Lihat situs membuka tab baru. Ruang lain memiliki izin dan dokumentasi operasinya sendiri.",
        "CRM 位于销售管理工作区。账号菜单显示当前角色、修改密码和退出，查看网站会打开新标签页。其他工作区的权限及操作说明独立管理。",
      ],
      [
        "Choose the interface language and theme from CRM header preferences. On narrow screens open Language and appearance; sales module navigation stays on a single horizontally scrollable row. Refresh, export and policy actions are beside the page content, not in the global header. Saving policies does not save notification configuration or an unfinished follow-up.",
        "Pilih bahasa antarmuka dan tema dari preferensi header CRM. Pada layar kecil buka Bahasa dan tampilan; navigasi modul penjualan tetap dalam satu baris yang dapat digeser. Muat ulang, ekspor, dan tindakan kebijakan berada di dekat konten halaman, bukan di header global. Menyimpan kebijakan tidak menyimpan konfigurasi notifikasi atau tindak lanjut yang belum selesai.",
        "从 CRM 头部偏好区选择界面语言及主题。窄屏中打开语言与外观；销售模块导航保持单行并支持横向滚动。刷新、导出和策略操作位于页面内容旁，不放在全局头部。保存策略不会保存通知配置或未完成的跟进记录。",
      ],
      [
        "Use EN, ID or Chinese in the header preferences to switch directly between English, Indonesian and Chinese. The selected language is highlighted. Arrow keys change language; Home and End select the first and last choices. Original names, notes and conversations are preserved.",
        "Gunakan EN, ID, atau Mandarin pada preferensi header untuk langsung memilih bahasa Inggris, Indonesia, atau Mandarin. Pilihan aktif disorot. Tombol panah mengganti bahasa; Home dan End memilih opsi pertama dan terakhir. Nama, catatan, dan percakapan asli tetap dipertahankan.",
        "点击头部偏好区的 EN、ID 或中文直接切换语言，当前语言高亮显示。方向键切换语言，Home 和 End 选择首末项。姓名、备注和对话原文保持不变。",
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
        "Language preferences change system labels and documentation, not names, transcripts or notes. If a deadline or assessment is missing, inspect its source instead of inventing a value. Use delivery audit for notification issues and contact a CRM Manager for access or configuration issues.",
        "Preferensi bahasa mengubah label sistem dan dokumentasi, bukan nama, transkrip, atau catatan. Jika tenggat atau asesmen tidak tersedia, periksa sumbernya dan jangan membuat nilai sendiri. Gunakan audit pengiriman untuk masalah notifikasi dan hubungi Manajer CRM untuk masalah akses atau konfigurasi.",
        "语言偏好改变系统标签和文档，不改变姓名、对话与备注。缺失截止时间或测评时，应核查来源，不猜造数值。通知问题查看发送审计；权限和配置问题联系 CRM 管理者。",
      ],
    ],
  },
] as const;
