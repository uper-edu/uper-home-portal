export type GuideLanguage = "en" | "id" | "zh";
export const guideSections = [
  {
    key: "buying-evidence-sources",
    title: ["Interests and buying intent evidence", "Minat dan bukti niat pembelian", "关注内容与购买意向依据"],
    body: [
      ["Questionnaire selections describe interests, not an actual inquiry. Profile separates questionnaire interests, buying intent signals and historical labels without evidence. Entries show the source, recorded time and saved answer or original note/message. Missing evidence is never inferred from the current profile.", "Pilihan kuesioner menunjukkan minat, bukan pertanyaan yang benar-benar diajukan. Profil memisahkan minat kuesioner, sinyal niat pembelian, dan label historis tanpa bukti. Entri menampilkan sumber, waktu tercatat, dan jawaban tersimpan atau catatan/pesan asli. Bukti yang hilang tidak disimpulkan dari profil saat ini.", "问卷选项表示关注内容，不等于实际咨询。Profile 区分问卷关注内容、购买意向信号和无依据历史标签。每条显示来源、记录时间及保存的选项或原始备注／消息；不从当前资料推断缺失依据。"],
      ["Explicit Chat booking and enrollment requests share the original message and task with their intent evidence. A repeated request supplements the same open task; separate customer messages remain. A request does not confirm a booking, enrollment or payment. General Chat text is not automatically mined for buying signals.", "Permintaan janji temu dan pendaftaran yang eksplisit di Chat menghubungkan bukti niat dengan pesan asli dan tugas yang sama. Permintaan berulang melengkapi tugas terbuka yang sama; pesan pelanggan tetap terpisah. Permintaan tidak berarti janji temu, pendaftaran, atau pembayaran telah dikonfirmasi. Teks Chat umum tidak otomatis diekstrak menjadi sinyal pembelian.", "Chat 明确预约、报名请求的意向依据与原始消息和任务关联。重复请求补充同一个开放任务；不同客户消息保留。请求不代表已确认预约、报名或付款。普通 Chat 文本不自动提取购买信号。"],
      ["Worklist signals open the exact Profile evidence row, move keyboard focus there and briefly highlight it. Actual intent takes precedence; questionnaire-only customers are labeled as interests. The buying-signal filter uses supported sales and Chat evidence, excluding questionnaire interests and unsupported historical labels. Classification inputs, Tier rules and existing deadlines are unchanged.", "Sinyal pada daftar kerja membuka baris bukti Profil yang tepat, memindahkan fokus keyboard, dan menyorotnya sebentar. Niat nyata diprioritaskan; pelanggan dengan kuesioner saja diberi label minat. Filter sinyal pembelian memakai bukti sales dan Chat, bukan minat kuesioner atau label historis tanpa bukti. Input klasifikasi, aturan Tier, dan tenggat yang ada tidak berubah.", "点击工作列表信号直接定位到 Profile 对应依据，移动键盘焦点并短暂高亮。优先展示实际意向；只有问卷时明确标注关注内容。购买信号筛选使用有依据的销售及 Chat 信号，不包含问卷关注和无依据历史标签。本次不改变分类输入、Tier 规则及已有期限。"],
    ],
  },
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
        "Customer tabs share spacing by information level: main sections use 24px, subsections 16px, heading-to-content spacing 12px, detail-row gaps 8px and label-to-control spacing 4px. Single-line detail cells are at least 24px; main form controls and disclosure rows are at least 44px. Long messages, notes and labels wrap naturally and are never clipped to force equal heights. All customer-group fields use one continuous detail grid, including current group, buying signals and the saved basis.",
        "Tab pelanggan memakai jarak menurut tingkat informasi: bagian utama 24px, subbagian 16px, judul ke isi 12px, antarbaris rincian 8px, serta label ke kontrol 4px. Sel rincian satu baris minimal 24px; kontrol formulir utama dan baris buka-tutup minimal 44px. Pesan, catatan, dan label panjang membungkus secara alami tanpa dipotong agar tingginya sama. Semua kolom grup pelanggan memakai satu kisi rincian berkesinambungan, termasuk grup saat ini, sinyal pembelian, dan dasar tersimpan.",
        "客户页签共用按信息层级定义的间距：主章节24px、子区块16px、标题与内容12px、资料行间8px、标签与控件4px。单行资料单元最小24px，主要表单控件与折叠行最小44px。长消息、备注及标签自然换行，不为等高而截断。客户分组的当前值、购买信号及依据使用同一连续资料网格，不再额外分组留白。",
      ],
      [
        "The four customer tabs use lightweight disclosure rows. Click anywhere on the title row, or focus it and press Enter or Space. A right-pointing arrow means collapsed; a downward arrow means expanded. Sections open independently. Profile uses one divider between main sections and spacing within a section. Expanded content uses static subheadings, without nested disclosures. Current tasks, deadlines, review items and failure messages stay visible. Opening or closing a section does not save information or complete a task; language changes retain its current state and draft.",
        "Keempat tab pelanggan memakai baris buka-tutup sederhana. Klik di mana saja pada baris judul, atau fokuskan lalu tekan Enter atau Spasi. Panah ke kanan berarti tertutup; panah ke bawah berarti terbuka. Setiap bagian dapat dibuka sendiri. Profil memakai satu garis antarbagian utama dan spasi di dalam bagian. Isi yang terbuka memakai subjudul tetap tanpa bagian buka-tutup bertingkat. Tugas saat ini, tenggat, hal yang perlu ditinjau, dan pesan kegagalan tetap terlihat. Membuka atau menutup tidak menyimpan informasi maupun menyelesaikan tugas; pergantian bahasa mempertahankan kondisi dan draf saat ini.",
        "四个客户页签统一使用轻量折叠行。点击标题整行，或聚焦后按Enter、空格展开；向右箭头表示收起，向下表示展开。各区可独立展开；客户资料仅在主要章节之间使用一条分隔线，章节内部使用留白区分。展开后使用静态小标题，不再嵌套折叠。当前任务、期限、待核实事项和失败信息保持可见。展开或收起不会保存信息或完成任务；切换语言保留当前展开状态与草稿。",
      ],
      [
        "Profile has five chapters: Customer and contact details, Learning needs, Sales progress, Customer group, then Acquisition and activity records. Customer group is always expanded. The heading contains only the section name; Current group is the first detail row, followed by the saved classification basis and separate interest/intent evidence. Headings and detail rows use the same hierarchy as other Profile chapters. This area has no disclosure or group-edit control. Empty sales-confirmed and rule-calculated fields are hidden; saved evidence remains available. Rule-calculated means existing rules, not AI prediction. No sales confirmation step is required and no classification is recalculated by this presentation change.",
        "Profil memiliki lima bagian: Data pelanggan dan kontak, Kebutuhan pembelajaran, Kemajuan penjualan, Grup pelanggan, lalu Sumber akuisisi dan catatan kegiatan. Grup pelanggan selalu terbuka. Judul hanya memuat nama bagian; Grup saat ini menjadi baris rincian pertama, diikuti dasar klasifikasi tersimpan dan bukti minat/niat yang terpisah. Judul dan baris rincian mengikuti hierarki bagian Profil lainnya. Bagian ini tidak memiliki kontrol buka-tutup atau pengubah kelompok. Kolom konfirmasi sales dan hasil aturan yang kosong disembunyikan; bukti tersimpan tetap tersedia. Hasil aturan bukan prediksi AI. Konfirmasi sales tidak diwajibkan dan perubahan tampilan tidak menghitung ulang klasifikasi.",
        "客户资料分为客户与联系方式、学习需求、销售进展、客户分组、获客来源与活动记录五章。客户分组为始终展开的独立章节，标题只显示章节名称；当前分组作为第一行资料显示，随后展示已有分组依据、分开的问卷关注与购买意向依据。标题与资料行沿用其他章节的字号和层级，不设折叠或分组修改控件。空的人工确认和规则计算字段隐藏，已有依据继续保留。规则计算不表示AI预测，不要求销售额外确认，也不因展示调整而重算分组。",
      ],
      [
        "Acquisition and activity records is collapsed by default. Acquisition source is separate from learning needs. Source tracking details show only recorded campaign IDs, link placement, acquisition content and context. A missing campaign name stays unrecorded; this update does not resolve names or change first-touch collection. Saved participation, withdrawals and unlinked legacy flags remain available with their original evidence.",
        "Sumber akuisisi dan catatan kegiatan tertutup secara default. Sumber akuisisi terpisah dari kebutuhan belajar. Rincian pelacakan hanya menampilkan ID kampanye, penempatan tautan, materi penarik minat, dan konteks yang tercatat. Nama kampanye yang hilang tetap belum tercatat; pembaruan ini tidak mengubah resolusi nama atau atribusi awal. Partisipasi tersimpan, penarikan konfirmasi, dan penanda lama tanpa kampanye tetap tersedia beserta bukti aslinya.",
        "获客来源与活动记录默认折叠，与学习需求分开。来源追踪详情只显示已记录的活动标识、链接位置、获客引导内容和场景；名称缺失保持未记录，本轮不处理名称解析或首次归因采集。已有参与、撤销和未关联活动的历史标记继续保留原始依据。",
      ],
      [
        "Record event participation is an optional peer section beside Acquisition and activity records. Open it only when needed; events load on demand. New confirmation appears only for a selected seminar, roadshow, webinar or fair. Ads, referrals, organic traffic and unspecified campaign types do not offer new confirmation. A saved historical record for another type can still be withdrawn. Online, offline or hybrid describes the campaign format, not an individual's attendance; it never triggers confirmation automatically.",
        "Catat partisipasi acara adalah bagian opsional sejajar dengan Sumber akuisisi dan catatan kegiatan. Buka hanya bila perlu; daftar acara dimuat saat dibutuhkan. Konfirmasi baru hanya muncul untuk seminar, roadshow, webinar, atau pameran yang dipilih. Iklan, rujukan, trafik organik, dan jenis lain tidak menyediakan konfirmasi baru. Konfirmasi historis untuk jenis lain masih dapat ditarik. Daring, luring, atau campuran menjelaskan format kampanye, bukan kehadiran individu; tidak pernah mengonfirmasi secara otomatis.",
        "记录活动参与是获客来源与活动记录旁的同级可选操作，按需加载活动。选择宣讲、路演、讲座或展会后才出现新增确认按钮；广告、转介绍、自然流量和未明确类型不提供新增确认，其他类型已有的历史确认仍可撤销。线上、线下或混合仅说明活动形式，不代表个人出席，不自动触发确认，也不新增必填签到步骤。",
      ],
      [
        "Profile places Preferred communication language as the last label/value row in Customer and contact details, rather than a separate card. Authorized changes save immediately. Unconfirmed means the customer's preference is unknown; choose a language in Contact preview. This setting supplies the preview's default language, not the employee interface language. Learning goals remain under Learning needs; Owner and sales stage appear under Sales progress. Recorded outcomes, classes and amounts are directly visible there only when saved; a recorded zero amount remains zero. Missing outcome fields and the empty outcome area are hidden. Registration time is under Acquisition and activity records.",
        "Di Profil, Bahasa komunikasi pilihan menjadi baris terakhir pada Data pelanggan dan kontak, bukan kartu terpisah. Perubahan oleh staf berwenang langsung disimpan. Belum dikonfirmasi berarti preferensi pelanggan belum diketahui; pilih bahasa di Pratinjau kontak. Pengaturan ini menentukan bahasa default pratinjau, bukan bahasa antarmuka staf. Tujuan belajar tetap di Kebutuhan belajar; penanggung jawab dan tahap penjualan ada di Kemajuan penjualan. Hasil, kelas, dan jumlah langsung terlihat di sana hanya jika tercatat; jumlah nol tetap ditampilkan sebagai nol. Kolom hasil kosong dan area hasil tanpa data disembunyikan. Waktu pendaftaran ada di Sumber akuisisi dan catatan kegiatan.",
        "客户资料将首选沟通语言作为客户与联系方式中的最后一行展示，不再单独分区；有权限的员工修改后即时保存。未确认表示尚不知道客户偏好，联系预览时须选择语言。该设置决定预览的默认语言，不改变员工界面语言。学习目标保留在学习需求中；负责人和销售阶段位于销售进展。已登记结果、班级及金额仅在有原始记录时直接展示于此，真实零金额仍显示为零；空字段和空结果区隐藏。登记时间移至获客来源与活动记录。",
      ],
      [
        "Browser tab titles show the current module, Sales Management and UPER. Switching interface language updates titles and descriptions; customer names, messages and notes stay original and do not appear in tab titles. CRM and its sign-in pages are not indexed. Search controls never replace sign-in and permissions. Public website titles and canonical links are separate from staff documentation. The company trial at home.prototype.uperedu.com uses synthetic customers, keeps staff role boundaries and excludes the entire site from indexing; VPN access may be required. Simulated notifications are not proof of CRM Bot receipt.",
        "Judul tab menampilkan modul aktif, Manajemen Penjualan, dan UPER. Pergantian bahasa antarmuka memperbarui judul dan deskripsi; nama, pesan, dan catatan pelanggan tetap asli dan tidak muncul pada judul tab. CRM dan halaman loginnya tidak diindeks. Kontrol pencarian tidak menggantikan login dan izin. Judul serta tautan kanonis situs publik terpisah dari dokumentasi staf. Uji coba perusahaan di home.prototype.uperedu.com memakai pelanggan sintetis, mempertahankan batas peran staf, dan tidak diindeks seluruhnya; akses VPN mungkin diperlukan. Simulasi bukan bukti penerimaan di CRM Bot.",
        "浏览器标签标题依次显示当前功能、销售管理与UPER。切换界面语言时同步更新标题和说明；客户姓名、消息和备注保持原文，不进入标签标题。CRM及登录页禁止搜索索引；搜索控制不能替代登录和权限校验。公开网站的标题与规范链接独立于员工文档。公司试用home.prototype.uperedu.com使用模拟客户，保留员工角色权限，全站禁止索引，访问可能需要VPN；模拟通知不代表CRM Bot群已实收。",
      ],
      [
        "Use Processing priority to order current work without changing classifications or deadlines. The customer panel keeps the Priority task summary visible across tabs. Arrow keys, Home and End switch tabs; unsaved follow-up drafts require a choice before leaving. Previous and next customer preserve the selected tab. Profile evidence and assessment technical details are expandable. Conversations retain source messages and can link an original message to follow-up; they do not provide live human chat.",
        "Gunakan Prioritas penanganan untuk mengurutkan pekerjaan saat ini tanpa mengubah klasifikasi atau tenggat. Panel pelanggan tetap menampilkan ringkasan Tugas prioritas pada semua tab. Tombol panah, Home, dan End berpindah tab; draf tindak lanjut belum tersimpan memerlukan pilihan sebelum keluar. Pelanggan sebelumnya dan berikutnya mempertahankan tab yang dipilih. Dasar profil dan detail teknis asesmen dapat dibuka sesuai kebutuhan. Percakapan mempertahankan pesan sumber dan dapat menautkannya ke tindak lanjut; fitur ini bukan obrolan langsung dengan staf.",
        "可使用处理优先级排序当前工作，不改变分类或截止时间。客户面板在各页签保留优先待办摘要。方向键及 Home、End 可切换页签，离开未保存的跟进草稿时须明确选择；左侧客户列表及上一位、下一位客户统一保留当前页签。客户资料依据和测评技术详情按需展开。对话保留来源原文，可关联到跟进；此处不提供实时人工坐席聊天。",
      ],
      [
        "Selecting another customer in the left list or using Previous/Next keeps the current tab and starts reading at the top. Empty tabs remain selected. Selecting the current customer leaves drafts and reading position unchanged. Unsaved edits require Keep editing or Discard draft before leaving; drafts never move to another customer. Task, message and buying-signal links still open their specific tab and content. Loading and errors belong to the selected customer only.",
        "Memilih pelanggan lain di daftar kiri atau memakai Sebelumnya/Berikutnya mempertahankan tab aktif dan memulai bacaan dari atas. Tab kosong tetap dipilih. Memilih pelanggan yang sedang dibuka tidak mengubah draf atau posisi baca. Sebelum keluar, perubahan belum tersimpan memerlukan pilihan Lanjutkan mengedit atau Buang draf; draf tidak dipindahkan ke pelanggan lain. Tautan tugas, pesan dan sinyal pembelian tetap membuka tab serta konten terkait. Pemuatan dan kesalahan hanya berlaku untuk pelanggan yang dipilih.",
        "点击左侧另一位客户或上一位／下一位时保留当前页签，从内容顶部开始阅读；空页签保持选中。再次点击当前客户不改变草稿或阅读位置。离开未保存编辑前须选择继续编辑或放弃，草稿不会带到另一位客户。任务、消息和购买信号入口仍定位对应页签及内容。加载与错误状态仅属于当前客户。",
      ],
      [
        "Current tasks determine deadlines; historical activity is not an unresolved status. Ordinary contact records complete no tasks. A task entry is fixed to that task; saving may keep it open or complete only that task. Active customers must retain a valid arrangement, schedule a new step or record a reason for no next step. A saved result confirms the completed tasks and the next arrangement. Administrative records do not increase contact counts or claim a customer was reached.",
        "Tugas saat ini menentukan tenggat; aktivitas historis bukan status yang belum terselesaikan. Catatan kontak biasa tidak menyelesaikan tugas. Entri tugas mengunci satu tugas; simpan progres atau selesaikan tugas itu saja. Pelanggan aktif harus mempertahankan pengaturan valid, menjadwalkan langkah baru, atau mencatat alasan tanpa langkah berikutnya. Hasil tersimpan mengonfirmasi tugas selesai dan pengaturan berikutnya. Catatan administratif tidak menambah jumlah kontak atau menyatakan pelanggan sudah dihubungi.",
        "截止状态以当前任务为准，历史动态不代表当前未解决状态。普通联系记录不完成任务；从具体任务进入后固定处理该任务，保存时选择保持待处理或完成此任务。活跃客户须保留有效安排、安排下一步或记录暂不安排原因。保存结果会说明完成任务及后续去向。非联系处理记录不增加联系次数，也不表示已触达客户。",
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
        "The panel provides Follow-up, Profile, Assessment and Conversations, in that order. The sales playbook is a reference under Follow-up. Return to the list to keep your current filters.",
        "Panel menyediakan Tindak lanjut, Profil, Asesmen, dan Percakapan, dalam urutan tersebut. Panduan percakapan penjualan tersedia sebagai referensi dalam Tindak lanjut. Kembali ke daftar untuk mempertahankan filter saat ini.",
        "处理面板依次提供跟进、客户资料、测评、对话四个页签；销售话术参考位于跟进页。返回列表保留当前筛选。",
      ],
      [
        "Priority task and the Follow-up task list use the same pending scope: open, overdue and historical-review tasks; closed or enrolled customers exclude historical-review placeholders. Dated tasks sort by their saved deadline, then undated tasks, then historical-review tasks. This is deadline priority, not an AI recommendation. Communication overview shows saved task links for the displayed customer message, with each task's current status. Opening a link locates that task; completed or cancelled tasks open in history. Missing links mean no relationship is recorded, not that the message was handled. Reading a message, a later contact record, and similar text never establish completion or create a task.",
        "Tugas prioritas dan daftar tugas Tindak lanjut memakai cakupan tertunda yang sama: tugas terbuka, terlambat, dan historis yang perlu ditinjau; pelanggan ditutup atau terdaftar tidak menyertakan tugas peninjauan historis. Urutan memakai tenggat tersimpan, lalu tugas tanpa waktu, lalu tugas historis. Ini prioritas tenggat, bukan rekomendasi AI. Ringkasan komunikasi menampilkan tautan tugas tersimpan untuk pesan pelanggan yang ditampilkan, dengan status tugas saat ini. Tautan menuju tugas tersebut; tugas selesai atau dibatalkan dibuka di riwayat. Tanpa tautan berarti hubungan belum tercatat, bukan pesan telah ditangani. Membaca pesan, catatan kontak berikutnya, dan teks serupa tidak membuktikan penyelesaian atau membuat tugas.",
        "优先待办与跟进任务列表使用同一待办范围：开放、逾期及历史待确认任务；已成交或关闭客户排除历史待确认占位任务。有可靠期限的任务按原期限排序，其后为时间待确认任务，再后为历史待确认任务。这是期限优先，不是AI推荐。沟通概况为所展示客户消息列出已保存的任务关联及任务当前状态；点击定位该任务，已完成或取消任务进入历史区。没有关联只表示未记录关联，不表示消息已处理。查看消息、后续联系记录或相似文字都不能证明任务完成，也不因此创建任务。",
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
        "Questionnaire interests appear inside the saved questionnaire event; staff-recorded buying signals appear inside the original follow-up record. These are distinct from actual customer messages. Current profile signals do not generate separate events or borrow the registration time. Missing event time stays unknown; no chat signal extraction is implied. The timeline shows hours, minutes and seconds on the operating calendar. Source labels distinguish customer activity, sales records and system records. Missing authorship stays unspecified. Time sits to the left of content on wide screens, and above content on narrow screens.",
        "Minat kuesioner ditampilkan dalam peristiwa pengiriman kuesioner; sinyal pembelian yang dicatat staf ditampilkan dalam catatan tindak lanjut aslinya, terpisah dari pesan asli pelanggan. Sinyal profil saat ini tidak membuat peristiwa terpisah atau memakai waktu pendaftaran. Waktu yang tidak tercatat tetap tidak diketahui; ini bukan ekstraksi sinyal otomatis dari chat. Linimasa menampilkan jam, menit dan detik menurut kalender operasional. Label sumber membedakan aktivitas pelanggan, catatan sales dan catatan sistem. Penulis yang tidak tercatat tidak ditebak. Waktu berada di kiri isi pada layar lebar, dan di atas isi pada layar sempit.",
        "问卷关注内容显示在对应的提交问卷事件中，员工记录的购买信号显示在原跟进记录中，与客户实际咨询原文区分。当前资料中的信号不再单独生成事件或借用登记时间；事件时间缺失时保留未知，不表示已支持从聊天自动提取信号。时间轴采用运营时区，显示时分秒；来源标签明确区分客户动态、销售记录与系统记录，来源缺失时不猜测。宽屏左侧时间、右侧内容；窄屏将时间放在内容上方，保持连续阅读。",
      ],
      [
        "Customer, recorder, fixed task, saved profile values and drafts remain available. Contact channel, result, task outcome and next arrangement require explicit selection. New task time meaning and a new reschedule time are not preselected. Unchanged stages and buying signals are not overwritten. Older task drafts without an explicit outcome require confirmation; uncertain saves retry the original request. Follow-up offers Record contact and Quick note. Notes stay lightweight and never count as contact or finish tasks. Contact and task records use a focused editor with customer context, the result and the next arrangement. A specific task entry fixes its target: keep it open or complete only that task, with no task picker or multi-selection. Reschedule, replace, cancel and add evidence use contextual dialogs showing the task and time meaning; original deadlines stay intact. Save feedback states the actual effect. Failed saves retain drafts; leaving asks before discarding. Communication overview, full-width task rows and the date-grouped timeline remain the reading view. Task-linked timeline records show the task action and what this record did, with current status and times explicitly labelled as current. Rescheduling preserves the time recorded in that change; replacement distinguishes the original and new task. Missing historical links are never guessed. Original customer messages and staff notes are unchanged.",
        "Pelanggan, pencatat, tugas tetap, nilai profil tersimpan dan draf dipertahankan. Kanal, hasil kontak, hasil tugas dan pengaturan berikutnya harus dipilih secara eksplisit. Makna waktu tugas baru dan waktu penjadwalan ulang tidak diisi otomatis. Tahap dan sinyal pembelian yang tidak diubah tetap tersimpan. Draf tugas lama tanpa hasil eksplisit memerlukan konfirmasi; penyimpanan yang belum pasti diulang dengan permintaan awal. Tindak lanjut menyediakan Catat kontak dan Catatan singkat. Catatan singkat tidak dihitung sebagai kontak atau menyelesaikan tugas. Catatan kontak dan hasil tugas memakai editor khusus dengan konteks pelanggan, hasil, dan rencana berikutnya. Entri tugas mengunci tugas tersebut: biarkan terbuka atau selesaikan tugas itu saja, tanpa pemilih atau pilihan banyak tugas. Perubahan jadwal, penggantian, pembatalan, dan tambahan bukti memakai dialog berkonteks dengan tugas dan makna waktu; tenggat awal tetap. Hasil simpan menjelaskan dampaknya. Kegagalan menyimpan mempertahankan draf; keluar meminta konfirmasi. Ringkasan komunikasi, baris tugas penuh, dan linimasa menurut tanggal tetap menjadi tampilan baca. Catatan linimasa yang terkait tugas menampilkan tindakan tugas dan hasil catatan, dengan status serta waktu saat ini diberi label jelas. Perubahan jadwal menampilkan waktu pada perubahan tersebut; penggantian membedakan tugas awal dan baru. Hubungan historis yang hilang tidak ditebak. Pesan pelanggan dan catatan staf tetap asli.",
        "客户、记录人、指定任务、已有资料和草稿保留；联系渠道、联系结果、任务处理结果及后续安排必须主动选择。新任务的时间含义、改期的新时间不预填；未修改的阶段与购买信号不覆盖。旧任务草稿没有明确处理结果时须重新确认；结果未知的保存仍使用原请求重试。跟进页提供“记录联系”和“记笔记”。笔记轻量输入，不计联系、不完成任务；联系和任务结果使用专注编辑区，依次展示客户背景、本次结果和下一步安排。具体任务入口固定该任务，只选择保持待处理或完成此任务，不再选任务或多选。改期、替代、取消和补充任务信息使用带上下文的弹层，明确任务与时间含义，保留原始期限。保存反馈说明实际影响；失败保留草稿，离开前确认。沟通概况、全宽任务行和按日期分组的时间轴保留为阅读视图。与任务关联的时间轴记录直接展示任务内容及本次操作，并将最新状态和时间标为“任务当前情况”。改期展示本次记录中的改约时间，替代区分原任务和新任务；缺失的历史关联不推测补造。客户消息和人工备注保持原文。",
      ],
      [
        "Ordinary tab switching keeps the customer shell in place and starts the tab content at the top; explicit task or source links locate their target. Only one recording or task-operation form is active at a time. Switching actions, tabs or customers with an unsaved draft asks you to continue editing or discard it. Failed or uncertain saves retain the original draft and request ID. Task details preview the exact linked customer message; opening the full conversation also protects the draft and locates the saved conversation/message IDs. Follow-up history combines a fact and its contact log only when the saved log ID matches, never because text looks similar. Identity review is in Profile; historical details and guidance open on demand.",
        "Pergantian tab biasa mempertahankan posisi panel pelanggan dan membuka isi tab dari atas; tautan tugas atau sumber menuju item terkait. Hanya satu formulir pencatatan atau tindakan tugas yang aktif. Berpindah tindakan, tab, atau pelanggan saat ada draf meminta pilihan lanjut mengedit atau membuang draf. Penyimpanan gagal atau belum pasti mempertahankan draf dan ID permintaan. Detail tugas menampilkan pesan pelanggan yang tepat; membuka percakapan lengkap juga melindungi draf dan menemukan ID percakapan/pesan tersimpan. Riwayat menggabungkan fakta dan catatan kontak hanya bila ID catatan cocok, bukan karena teks mirip. Tinjauan identitas ada di Profil; rincian historis dan panduan dibuka sesuai kebutuhan.",
        "普通页签切换保持客户面板位置，页签内容从顶部开始；明确点击任务或原文入口时才定位对应内容。同时只打开一个记录或任务操作表单。切换操作、页签或客户前，未保存草稿须选择继续编辑或放弃。失败及结果未知时保留原稿与请求ID。任务详情可预览精确关联的客户原话；打开完整对话同样保护草稿，并按已保存的会话及消息ID定位。跟进历史仅按相同记录ID合并事实与联系记录，不按相似文字去重。身份核实位于客户资料；历史细节与销售指导按需查看。",
      ],
      [
        "Response deadline, agreed execution time and internal review time are labeled separately in the worklist, header, task cards and result form. A rescheduled task shows its revised execution time alongside the preserved deadline; the existing overdue fact is not hidden. No saved dates or SLA calculations are rewritten. Missing or unverified dates remain pending review.",
        "Tenggat respons, waktu pelaksanaan yang disepakati, dan waktu tinjauan internal diberi label berbeda di daftar kerja, header, kartu tugas, dan formulir hasil. Tugas yang dijadwalkan ulang menampilkan waktu pelaksanaan baru beserta tenggat yang dipertahankan; fakta keterlambatan tetap terlihat. Tanggal tersimpan dan perhitungan SLA tidak diubah. Waktu yang hilang atau belum terverifikasi tetap menunggu tinjauan.",
        "客户列表、顶部摘要、任务卡片与结果表单统一区分响应截止、约定执行时间及内部复查时间。改期后同时展示改约执行时间与保留期限，不隐藏原逾期事实，不重写已有日期或SLA计算。缺失或未核实时间继续显示待确认。",
      ],
      [
        "First registration creates the initial contact task. The homepage assistant and standalone /chat share conservative recognition of explicit advisor, trial-booking and enrollment requests in English, Indonesian and Chinese. For example, I want to book a trial lesson creates a booking request; a general course question does not. Negated, conditional, quoted or conflicting intentions remain AI consultation. This is limited phrase matching, not autonomous AI decision-making. WhatsApp, calls and offline communication are not synchronized; sales records them and creates tasks as needed.",
        "Pendaftaran pertama membuat tugas kontak awal. Asisten beranda dan /chat memakai pengenalan terbatas yang sama untuk permintaan konsultan, janji kelas percobaan, dan pendaftaran kelas dalam bahasa Inggris, Indonesia, dan Mandarin. Saya ingin menjadwalkan kelas percobaan membuat permintaan janji; pertanyaan umum tentang kelas tidak. Niat negatif, bersyarat, kutipan, atau bertentangan tetap menjadi konsultasi AI. Ini pencocokan ungkapan, bukan keputusan mandiri AI. WhatsApp, telepon, dan komunikasi offline tidak disinkronkan; sales mencatat dan membuat tugas sesuai kebutuhan.",
        "首次登记创建初次联系任务。主页助手和独立 /chat 共用有限的三语明确请求识别：例如“我想预约试听”创建预约请求，普通课程咨询不创建这类请求；否定、条件、引用示例或相互冲突的意向继续由 AI 咨询处理。这是保守的明确表达匹配，不是 AI 自主决定销售行动。WhatsApp、电话和线下沟通未自动同步，由销售记录并按需建任务。",
      ],

      [
        "Quick information notes can be saved at any time without selecting a task or a contact result. They do not complete tasks, change stages or count as contact attempts. Contact records can also be saved without completing tasks: choose Record only; keep arrangements. Stage changes require evidence and retain before/after values.",
        "Catatan informasi singkat dapat disimpan kapan saja tanpa memilih tugas atau hasil kontak. Catatan ini tidak menyelesaikan tugas, mengubah tahap, atau dihitung sebagai upaya kontak. Catatan kontak juga dapat disimpan tanpa menyelesaikan tugas: pilih Catat saja; pertahankan pengaturan. Perubahan tahap memerlukan bukti dan menyimpan nilai sebelum/sesudah.",
        "随手记录可随时保存，无须选择任务或联系结果，不完成任务、不改变阶段、不计为联系尝试。真实联系另用跟进表单，选择“仅记录，保留原安排”，同样不必关联或完成任务。阶段变更须有依据，保留前后值。",
      ],
      [
        "Task arrangements support independent tasks, task information supplements, rescheduling, replacement and cancellation. Rescheduling records a revised execution time and retains the original deadline and overdue history. Replacement cancels the old task with a link to the new one; it is not completion. Review information can be linked to a task or dismissed with a reason. Reading does not resolve it.",
        "Pengaturan tugas mendukung tugas mandiri, informasi tambahan pada tugas, jadwal ulang, penggantian, dan pembatalan. Jadwal ulang menyimpan waktu pelaksanaan baru serta tenggat awal dan riwayat keterlambatan. Penggantian membatalkan tugas lama dengan tautan ke tugas baru; bukan penyelesaian. Informasi dapat ditautkan ke tugas atau dinyatakan tidak perlu tindakan dengan alasan. Membaca tidak menyelesaikannya.",
        "任务安排支持独立事项、补充任务信息、改期、替代和取消。改期记录新执行时间，保留原截止时间与逾期历史。替代会取消原任务并关联新任务，不计为完成。待核实动态可关联任务或说明无需行动；已读不等于已处理。",
      ],
      [
        "Add task information opens from a specific task. The form highlights that fixed target and its deadline; enter Additional information and select Save information. It appends a record to that task without changing its status or deadline, completing it, or merging another task. This differs from repeated Chat requests being linked to an existing task. Task-to-task merging is not provided.",
        "Tambah informasi tugas dibuka dari tugas tertentu. Formulir menonjolkan tugas tujuan yang tetap dan tenggatnya; isi Informasi tambahan lalu pilih Simpan informasi. Catatan ditambahkan ke tugas itu tanpa mengubah status atau tenggat, menyelesaikannya, atau menggabungkan tugas lain. Ini berbeda dari permintaan Chat berulang yang ditautkan ke tugas yang sudah ada. Penggabungan antartugas tidak tersedia.",
        "从具体任务的操作菜单进入“补充任务信息”，表单突出显示固定的目标任务和期限；填写“补充内容”后点击“保存补充”。内容作为该任务的补充记录保存，不改变状态或期限、不完成任务、不合并其他任务。这与Chat重复请求关联到已有任务不同；目前不提供两项任务合并功能。",
      ],
      [
        "Known visitor sessions continue automatically. Matching contact details only produce candidates. Sales may decide candidates when both records are within their existing follow-up permissions; no Manager role is required. Confirmation records a relationship, without merging historical records or changing owners. Different contact details require starting a separate visitor session.",
        "Sesi pengunjung yang dikenal berlanjut otomatis. Kontak cocok hanya menghasilkan kandidat. Sales dapat menilai kandidat jika kedua catatan berada dalam izin tindak lanjutnya; tidak memerlukan peran Manajer. Konfirmasi mencatat hubungan tanpa menggabungkan riwayat atau mengubah penanggung jawab. Kontak berbeda memerlukan sesi pengunjung terpisah.",
        "已知访客会话自动续记，联系方式相同只产生候选。销售在同时具备两个客户的跟进权限时可直接核实，无须 CRM 管理者角色。确认仅建立关系，不合并历史或改变 Owner。联系方式不同需作为另一位使用者开始独立访问。",
      ],
      [
        "If saving times out, preserve the draft and query its result. Retry the original request without changes. New task notification policies are initially disabled; a permitted operator must review and enable them. Existing policies and historical deliveries are not rewritten or replayed.",
        "Jika penyimpanan kehabisan waktu, simpan draf dan periksa hasilnya. Ulangi permintaan awal tanpa perubahan. Kebijakan notifikasi tugas baru awalnya nonaktif; operator berizin harus meninjau dan mengaktifkannya. Kebijakan lama dan riwayat pengiriman tidak ditulis ulang atau diputar ulang.",
        "保存超时后保留草稿并查询结果，使用原请求重试。新增任务通知策略默认关闭，须由有权限人员复核启用；既有策略和历史发送不改写、不重放。",
      ],

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
        "A system receipt means the request was saved, not that sales has handled it. Customer text and the acknowledgement appear in Conversations; the linked task appears in Follow-up and drives current work and eligible notifications. Repeated requests of the same kind reuse an unfinished task, add source evidence and preserve its deadline, even across sessions. Different request types can coexist. Sales records the outcome and explicitly completes the relevant task; an old receipt remains historical evidence.",
        "Konfirmasi sistem berarti permintaan tersimpan, bukan sudah ditangani sales. Teks pelanggan dan konfirmasinya tampil di Percakapan; tugas terkait tampil di Tindak lanjut sebagai pekerjaan saat ini dan dasar notifikasi sesuai kebijakan. Permintaan sejenis memakai kembali tugas yang belum selesai, menambah bukti sumber, dan mempertahankan tenggat, termasuk antarsesi. Jenis permintaan berbeda dapat berjalan bersamaan. Sales mencatat hasil dan memilih tugas yang diselesaikan; konfirmasi lama tetap menjadi bukti historis.",
        "系统回执就是“请求已保存”的确认消息，不代表销售已经处理。客户原话和确认消息在对话中查看，关联任务在跟进中处理，并按策略驱动提醒。同类请求已有未完成任务时，即使来自另一会话也复用原任务、追加原话依据、保留期限；不同类型可以并存。销售记录结果并明确完成对应任务后，旧回执仍作为历史凭据保留，当前进度以任务为准。",
      ],
      [
        "Conversations opens the most recent session. The header shows the last reliable activity time, source and message count. When there is more than one, Conversation history shows the session count including the selected session, with choices ordered by recent activity; messages from different sessions remain separate. Customer and AI messages have explicit role labels, date separators and short times; the full recorded time is available on the time label. Unknown historical times remain unknown. Latest customer message moves to the most recent customer message with a known time in the selected session.",
        "Percakapan membuka sesi terbaru. Header menampilkan waktu aktivitas terakhir yang tercatat, sumber, dan jumlah pesan. Jika ada beberapa sesi, Riwayat percakapan menampilkan jumlah sesi termasuk sesi pilihan, diurutkan menurut aktivitas terbaru; pesan dari sesi berbeda tetap terpisah. Pesan pelanggan dan AI memiliki label peran, pemisah tanggal, dan waktu singkat; waktu lengkap tersedia pada label waktu. Waktu historis yang tidak diketahui tetap demikian. Pesan pelanggan terbaru menuju pesan pelanggan terakhir dengan waktu tercatat dalam sesi pilihan.",
        "对话默认打开最近会话；顶部显示最后可靠活动时间、来源和消息数；存在多个会话时，“历史对话”显示包含当前会话的总数，选项按最近活动排序，不同会话的消息保持分开。客户与AI消息使用明确角色、日期分隔及简短时间；时间标签提供完整记录时间。历史时间未知时仍标为未知。“最新客户消息”定位当前会话中有可靠时间的最近客户消息。",
      ],
      [
        "Conversations preserves the source messages and shows compact task references only. It has no separate task list or Record follow-up buttons. A reference opens Follow-up and focuses the same task, including completed tasks in history. Navigation does not save a contact or complete tasks. The customer header shows only one Priority task summary and a View tasks link. All task processing, adding, adding task information, rescheduling, replacement and cancellation are in Follow-up. A Return to conversation link restores the source session and message. Original request confirmations remain together at the bottom, unchanged. This is not live agent chat.",
        "Percakapan menyimpan pesan sumber dan hanya menampilkan referensi tugas ringkas, tanpa daftar tugas terpisah atau tombol Catat tindak lanjut. Referensi membuka Tindak lanjut dan memfokuskan tugas yang sama, termasuk tugas selesai dalam riwayat. Navigasi tidak menyimpan kontak atau menyelesaikan tugas. Header pelanggan hanya menampilkan ringkasan Tugas prioritas dan Lihat tugas. Semua penanganan, pembuatan, penambahan bukti, penjadwalan ulang, penggantian, dan pembatalan tugas berada di Tindak lanjut. Kembali ke percakapan memulihkan sesi dan pesan sumber. Konfirmasi asli tetap tersimpan bersama di bagian bawah tanpa perubahan. Ini bukan chat langsung dengan staf.",
        "对话页保留消息原文，只显示简洁任务引用，不再维护独立任务列表或重复记录按钮。点击引用进入跟进页并定位同一任务；已完成任务在历史区查看，不会自动保存联系或完成任务。客户顶部仅保留优先待办摘要和“查看任务”。记录跟进、新增、补充任务信息、改期、替代和取消集中在跟进页。“返回对话”恢复原会话及消息位置。原始确认集中保留在底部，不改写。本页不是在线人工聊天。",
      ],
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
        "Assessment focuses on results, response breakdown and expandable evidence. Learning goals stay in Profile; there is no Learning context card. Customer self-report is under Assessment evidence and history, separate from measured results. Without a saved assessment, the overview says No assessment recorded. A self-report is not labeled as predating the test unless its timing is known.",
        "Asesmen berfokus pada hasil, rincian jawaban, dan bukti yang dapat dibuka. Tujuan belajar tetap di Profil; kartu Konteks belajar tidak ditampilkan. Level menurut pelanggan berada di Bukti dan riwayat asesmen, terpisah dari hasil tes. Tanpa asesmen tersimpan, ringkasan menyatakan Belum ada asesmen tercatat. Keterangan pelanggan tidak disebut mendahului tes jika waktunya belum diketahui.",
        "测评页聚焦结果、作答表现和可展开的依据，不再展示学习背景卡片；学习目标留在客户资料。客户自报水平收在测评依据与历史记录，与测评结果区分。没有测评时，概览明确显示尚无测评记录；自报时间不明时，不称作测评前自报。",
      ],
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
      [
        "Read Assessment in three layers: result overview, response breakdown, then expandable Assessment evidence and history. Full results state whether this paper's saved HSK criteria were met; automatic scores do not require routine advisor approval. Quick results suggest a starting point; a saved boundary, incomplete response, inconsistent performance or audio issue explains why review is needed. The test does not assess speaking, handwriting or levels above its coverage.",
        "Baca Asesmen dalam tiga lapisan: ringkasan hasil, rincian jawaban, lalu Bukti dan riwayat asesmen yang dapat dibuka. Hasil lengkap menunjukkan apakah kriteria HSK tersimpan pada tes ini terpenuhi; skor otomatis tidak memerlukan persetujuan rutin konsultan. Hasil cepat menyarankan titik awal; batas hasil, jawaban belum lengkap, hasil tidak konsisten, atau gangguan audio yang tercatat menjelaskan perlunya peninjauan. Tes tidak menguji berbicara, tulisan tangan, atau level di luar cakupannya.",
        "测评按结果概览、作答表现、可展开的测评依据与历史记录三层阅读。完整测评展示是否达到本卷已保存的 HSK 标准，自动评分不要求顾问例行批准。快速测评提供起点建议；接近分界、缺答、难度表现不一致或音频异常时，按已保存原因提示核实。本测评不测口语、手写及覆盖范围以外的等级。",
      ],
      [
        "Original assessment text is preserved under Assessment evidence and history, not presented as a sales note. It keeps its original language and may come from an earlier customer-level record; do not assume it belongs to the latest attempt. Exam and scoring versions remain available for tracing evidence. No history is deleted or regraded.",
        "Teks asesmen asli disimpan di Bukti dan riwayat asesmen, bukan ditampilkan sebagai catatan sales. Bahasa aslinya dipertahankan dan teks dapat berasal dari catatan pelanggan sebelumnya; jangan menganggapnya milik upaya terbaru. Versi tes dan penilaian tetap tersedia untuk penelusuran. Riwayat tidak dihapus atau dinilai ulang.",
        "原始测评说明收在测评依据与历史记录中，不作为销售备注展示。原文保持原语言，可能来自较早的客户级记录，不能默认对应最近一次作答。试卷及评分版本供核对来源；不删除历史、不重新评分。",
      ],
      [
        "In Contact preview, choose Introduction and needs, Discuss assessment results, Course and schedule inquiry, Trial lesson inquiry, Enrollment assistance, or Write your own. Templates are editable drafts, not an approved offer catalogue. Choose the customer's communication language, review the complete message and verify course, fee and availability facts. Changing interface language does not rewrite a draft. Replacing edited text requires confirmation. Copying or opening WhatsApp creates no contact record and completes no task; stopped contact remains blocked.",
        "Di Pratinjau kontak, pilih Perkenalan dan kebutuhan, Bahas hasil asesmen, Informasi kelas dan jadwal, Permintaan kelas percobaan, Bantuan pendaftaran kelas, atau Tulis sendiri. Templat adalah draf yang dapat diedit, bukan katalog penawaran resmi. Pilih bahasa pelanggan, tinjau seluruh pesan, dan periksa kursus, biaya, serta ketersediaan. Mengubah bahasa antarmuka tidak menulis ulang draf. Mengganti teks yang telah diedit memerlukan konfirmasi. Menyalin atau membuka WhatsApp tidak mencatat kontak atau menyelesaikan tugas; penghentian kontak tetap berlaku.",
        "联系预览提供初次联系与需求确认、测评结果沟通、课程与排期沟通、试听需求沟通、报名协助及自由编写。模板是可编辑草稿，不是已批准的 Offer 目录。选择客户沟通语言，核对完整内容及课程、费用和时间事实。切换界面语言不重写草稿，替换已编辑内容须确认。复制或打开 WhatsApp 不登记联系、不完成任务；停止联系限制继续生效。",
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
