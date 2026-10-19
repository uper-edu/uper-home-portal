import type { Words, SystemChapter } from "./CrmSystemGuide";
import type { GuideLesson } from "./CrmGuideLearning";
const w = (en: string, id: string, zh: string): Words => [en, id, zh];
const node = (label: Words, detail: Words) => ({ label, detail });
export const panoramaNodes = [
  node(
    w("Marketing entry", "Pintu masuk pemasaran", "营销入口"),
    w(
      "Campaign links and direct visits bring visitors to registration and consultation. An unknown code is reviewed only after a lead is saved.",
      "Tautan kampanye dan kunjungan langsung membawa pengunjung ke registrasi dan konsultasi. Kode tidak dikenal ditinjau setelah lead tersimpan.",
      "活动链接与自然访问连接登记和咨询。未知活动代码只有生成客户记录后才进入待核实来源。",
    ),
  ),
  node(
    w(
      "Registration and consultation",
      "Registrasi dan konsultasi",
      "登记与咨询",
    ),
    w(
      "Registration saves a potential customer. Assessment is optional; AI conversation preserves questions and evidence. These are not mandatory funnel steps.",
      "Registrasi menyimpan calon pelanggan. Asesmen bersifat opsional; percakapan AI menyimpan pertanyaan dan bukti. Semua ini bukan tahapan wajib dalam funnel.",
      "登记保存潜在客户；测评可选，AI对话保留诉求和依据。这些环节不是人人必经的严格漏斗。",
    ),
  ),
  node(
    w("Customer and evidence", "Pelanggan dan bukti", "客户与依据"),
    w(
      "The customer connects the owner, original messages, assessments, tasks and human records. Similar contact details alone do not prove identity.",
      "Pelanggan menghubungkan penanggung jawab, pesan asli, asesmen, tugas, dan catatan staf. Kesamaan kontak saja tidak membuktikan identitas.",
      "客户分别关联负责人、原始消息、测评、任务和人工记录。相似联系方式本身不证明是同一客户。",
    ),
  ),
  node(
    w("Actionable tasks", "Tugas yang dapat ditangani", "可执行任务"),
    w(
      "Structured requests and configured rules can create or supplement tasks. Staff can arrange a next step. Each task retains its action, owner and deadline.",
      "Permintaan terstruktur dan aturan dapat membuat atau melengkapi tugas. Staf dapat menjadwalkan langkah berikutnya. Tiap tugas menyimpan tindakan, penanggung jawab, dan tenggat.",
      "结构化请求及已配置规则可以创建或补充任务，员工也可安排下一步；每项任务分别保存动作、负责人和期限。",
    ),
  ),
  node(
    w(
      "Human outcome and next step",
      "Hasil staf dan langkah berikutnya",
      "人工结果与下一步",
    ),
    w(
      "Staff record what actually happened, confirm selected task outcomes and retain or arrange follow-up. A click or a message does not prove enrollment.",
      "Staf mencatat kejadian sebenarnya, mengonfirmasi hasil tugas terpilih, dan mempertahankan atau mengatur tindak lanjut. Klik atau pesan tidak membuktikan pendaftaran kelas.",
      "员工记录实际事实，逐项确认任务结果，再保留或安排后续工作。点击按钮或出现消息不代表已经报名。",
    ),
  ),
  node(
    w(
      "Notifications and delivery audit",
      "Notifikasi dan audit pengiriman",
      "通知与发送审计",
    ),
    w(
      "Events pass policy, timing, frequency and current-state checks before delivery. Completing a task cancels only its linked pending notifications. API acceptance does not prove receipt or reading.",
      "Peristiwa diperiksa berdasarkan kebijakan, waktu, frekuensi, dan status terkini sebelum dikirim. Penyelesaian tugas hanya membatalkan notifikasi tertunda terkait. Penerimaan API bukan bukti pesan diterima atau dibaca.",
      "事件按策略、时间、频控和当前状态校验后发送。完成任务只取消关联待发通知；接口接受不代表群内实收或员工已读。",
    ),
  ),
  node(
    w("Responsible staff", "Staf penanggung jawab", "责任人与管理者"),
    w(
      "Customer notifications go to a valid owner, otherwise to eligible CRM Managers. Notifications surface work; staff must still handle it.",
      "Notifikasi pelanggan ditujukan kepada penanggung jawab yang valid; jika tidak, kepada CRM Manager yang berwenang. Notifikasi menampilkan pekerjaan, tetapi staf tetap harus menanganinya.",
      "客户通知优先发给有效负责人，否则由有权限的CRM管理者兜底。提醒帮助发现事项，处理仍由员工负责。",
    ),
  ),
];
export const panoramaModules = [
  node(
    w("Marketing Campaigns", "Kampanye Pemasaran", "营销活动"),
    w(
      "Create entry links, review unknown sources and inspect attribution. Registration, assessment, confirmed attendance and enrollment have separate counts.",
      "Buat tautan masuk, tinjau sumber tidak dikenal, dan periksa atribusi. Registrasi, asesmen, kehadiran terkonfirmasi, dan pendaftaran kelas dihitung terpisah.",
      "创建入口链接、核实未知来源并查看归因。登记、测评、确认参与和报名分别计数。",
    ),
  ),
  node(
    w("Leads CRM", "CRM Prospek", "销售线索"),
    w(
      "Prioritize the worklist. Follow-up handles current work; Conversations preserves original messages; Profile holds customer facts; Assessment explains learning-level evidence.",
      "Prioritaskan daftar kerja. Tindak lanjut menangani pekerjaan; Percakapan menyimpan pesan asli; Profil memuat fakta pelanggan; Asesmen menjelaskan bukti level belajar.",
      "从工作列表确定优先事项。跟进处理当前工作，对话保留消息原文，客户资料呈现事实，测评解释水平依据。",
    ),
  ),
  node(
    w("Sales Operations", "Operasional Penjualan", "销售运营"),
    w(
      "Configure the operating calendar, response rules, notification policies and channels. Review delivery audit. Saved task deadlines are not rewritten by a policy change.",
      "Atur kalender operasional, aturan respons, kebijakan notifikasi, dan kanal. Tinjau audit pengiriman. Perubahan kebijakan tidak menulis ulang tenggat tugas tersimpan.",
      "配置运营日历、响应规则、通知策略和渠道，查看发送审计。改策略不重写已保存任务期限。",
    ),
  ),
  node(
    w("User Guide and Docs", "Panduan dan Dokumentasi", "在线文档"),
    w(
      "Start with system explanation to understand the model. Use operating guides to complete a task. Documentation does not itself process customers.",
      "Mulai dari penjelasan sistem untuk memahami model. Gunakan panduan operasi untuk menyelesaikan tugas. Dokumentasi tidak memproses pelanggan.",
      "系统说明帮助理解机制，操作指南说明具体做法；阅读文档本身不处理客户或完成任务。",
    ),
  ),
];
export const panoramaRoles = [
  node(
    w("Customer / visitor", "Pelanggan / pengunjung", "客户／访客"),
    w(
      "Registers, asks questions and submits requests. Customer statements are evidence, not staff-confirmed outcomes.",
      "Mendaftar, bertanya, dan mengajukan permintaan. Pernyataan pelanggan merupakan bukti, bukan hasil yang telah dikonfirmasi staf.",
      "登记、咨询并提出请求。客户原文属于依据，不代表员工已核实或处理。",
    ),
  ),
  node(
    w("Sales", "Sales", "销售"),
    w(
      "Works within assigned access, records follow-up and can claim eligible unassigned customers. Cannot freely transfer customers to another salesperson.",
      "Bekerja sesuai akses, mencatat tindak lanjut, dan dapat mengambil pelanggan belum ditugaskan yang memenuhi syarat. Tidak dapat memindahkan pelanggan ke sales lain secara bebas.",
      "在授权范围内处理客户、记录跟进并认领共享池客户；不能任意将客户转给其他销售。",
    ),
  ),
  node(
    w("CRM Manager", "CRM Manager", "CRM管理者"),
    w(
      "Views all permitted customers, assigns owners, reviews campaign sources, manages operations and investigates exceptions.",
      "Melihat seluruh pelanggan sesuai izin, menetapkan penanggung jawab, meninjau sumber kampanye, mengelola operasional, dan memeriksa masalah.",
      "查看权限范围内全部客户、分配负责人、核实来源、管理运营及处理异常。",
    ),
  ),
  node(
    w("System Administrator", "Administrator Sistem", "系统管理员"),
    w(
      "Manages users, roles, sessions, audits and administrator recovery. CRM business access requires the appropriate business role. A user may hold several roles.",
      "Mengelola pengguna, peran, sesi, audit, dan pemulihan administrator. Akses bisnis CRM memerlukan peran bisnis yang sesuai. Satu pengguna dapat memiliki beberapa peran.",
      "管理用户、角色、会话、审计与管理员恢复。访问CRM业务仍需对应业务角色；一人可以兼任多个角色。",
    ),
  ),
];
export const panoramaConcepts = [
  {
    ...node(
      w("Customer and evidence", "Pelanggan dan bukti", "客户与依据"),
      w(
        "One customer connects conversations, tasks and human records. Each answers a different question.",
        "Satu pelanggan menghubungkan percakapan, tugas, dan catatan staf. Masing-masing menjawab pertanyaan berbeda.",
        "一个客户关联会话、任务和人工记录，分别回答不同问题。",
      ),
    ),
    chapter: "entities",
  },
  {
    ...node(
      w("Independent states", "Status yang terpisah", "独立状态"),
      w(
        "Customer group, sales stage, contact arrangement and task state have different meanings.",
        "Kelompok pelanggan, tahap penjualan, pengaturan kontak, dan status tugas memiliki arti berbeda.",
        "客户分组、销售阶段、联系安排与任务状态有不同含义。",
      ),
    ),
    chapter: "lifecycle",
  },
  {
    ...node(
      w("Evidence and outcomes", "Bukti dan hasil", "依据与结果"),
      w(
        "Assessment supports a learning-level judgment. Enrollment, payment and message receipt each need their own evidence.",
        "Asesmen mendukung penilaian level belajar. Pendaftaran kelas, pembayaran, dan penerimaan pesan memerlukan bukti masing-masing.",
        "测评支持水平判断；报名、付款与通知实收分别需要各自的事实依据。",
      ),
    ),
    chapter: "measurement",
  },
];
export const panoramaSearchAliases: Words = [
  "System purpose and architecture",
  "Tujuan dan arsitektur sistem",
  "系统定位与全景架构",
];
export const panoramaCases = [
  {
    title: w(
      "Unknown campaign code",
      "Kode kampanye tidak dikenal",
      "未知活动代码",
    ),
    trigger: w(
      "Registration saves a lead with an unknown entry code.",
      "Registrasi menyimpan lead dengan kode masuk tidak dikenal.",
      "客户通过未知代码完成登记。",
    ),
    system: w(
      "Preserve the code and list it under sources to review. Visits without a lead do not appear.",
      "Simpan kode dan tampilkan sebagai sumber yang perlu ditinjau. Kunjungan tanpa lead tidak ditampilkan.",
      "保留原代码，进入待核实来源；仅访问而无客户记录不展示。",
    ),
    human: w(
      "A Manager links an existing campaign, creates one, or marks the source invalid with a reason.",
      "Manager menautkan kampanye, membuat kampanye, atau menandai sumber tidak valid dengan alasan.",
      "管理者关联已有活动、创建活动或说明原因后标记无效。",
    ),
    boundary: w(
      "Attribution changes do not change ownership, scores or task deadlines.",
      "Perubahan atribusi tidak mengubah penanggung jawab, skor, atau tenggat tugas.",
      "归因变化不改变客户归属、分数或任务期限。",
    ),
  },
  {
    title: w("No owner assigned", "Belum ada penanggung jawab", "尚无负责人"),
    trigger: w(
      "A customer has no valid owner.",
      "Pelanggan tidak memiliki penanggung jawab yang valid.",
      "客户尚无有效负责人。",
    ),
    system: w(
      "Use the shared unassigned pool and CRM Manager notification fallback.",
      "Gunakan kumpulan pelanggan belum ditugaskan dan notifikasi cadangan ke CRM Manager.",
      "进入未分配共享池，通知由CRM管理者兜底。",
    ),
    human: w(
      "An authorized salesperson claims the customer for themselves, or a Manager assigns an owner.",
      "Sales berwenang mengambil pelanggan untuk dirinya, atau Manager menetapkan penanggung jawab.",
      "有权限的销售认领给自己，或由管理者分配。",
    ),
    boundary: w(
      "Permission and concurrent-claim checks still apply. Shared visibility is not assignment.",
      "Pemeriksaan izin dan pengambilan bersamaan tetap berlaku. Terlihat bersama bukan berarti sudah ditugaskan.",
      "仍受权限与并发校验约束；共享可见不代表已经分配。",
    ),
  },
  {
    title: w(
      "Several explicit requests",
      "Beberapa permintaan eksplisit",
      "多个明确请求",
    ),
    trigger: w(
      "A saved customer requests human help, a booking or enrollment.",
      "Pelanggan tersimpan meminta bantuan staf, pemesanan, atau pendaftaran.",
      "已登记客户提出人工、预约或报名请求。",
    ),
    system: w(
      "Create or supplement the corresponding task under existing rules. Different matters can coexist.",
      "Buat atau lengkapi tugas terkait sesuai aturan. Beberapa urusan berbeda dapat berjalan bersamaan.",
      "按既有规则创建或补充对应任务；不同事项可以并存。",
    ),
    human: w(
      "Verify the request and confirm each outcome.",
      "Verifikasi permintaan dan konfirmasi setiap hasil.",
      "核实请求并逐项确认实际结果。",
    ),
    boundary: w(
      "A request is not a confirmed booking or enrollment. New evidence does not silently replace every old task.",
      "Permintaan bukan pemesanan atau pendaftaran terkonfirmasi. Bukti baru tidak menggantikan semua tugas lama secara diam-diam.",
      "请求不等于确认预约或报名；新依据不静默替代所有旧任务。",
    ),
  },
  {
    title: w(
      "No answer or reply",
      "Tidak dijawab atau dibalas",
      "未接通／未回复",
    ),
    trigger: w(
      "Staff actually call or send a message without a two-way response.",
      "Staf benar-benar menelepon atau mengirim pesan tanpa tanggapan dua arah.",
      "员工实际拨打或发送消息，但未发生双向交流。",
    ),
    system: w(
      "Record a contact attempt, not a successful conversation. Do not complete tasks implicitly.",
      "Catat upaya kontak, bukan komunikasi berhasil. Jangan selesaikan tugas secara otomatis.",
      "记录联系尝试，不计成功沟通，不隐式完成任务。",
    ),
    human: w(
      "Confirm task outcomes and keep or arrange the next step.",
      "Konfirmasi hasil tugas lalu pertahankan atau atur langkah berikutnya.",
      "明确任务结果并保留或安排下一步。",
    ),
    boundary: w(
      "Opening WhatsApp or copying text alone is not a contact record.",
      "Membuka WhatsApp atau menyalin teks saja bukan catatan kontak.",
      "仅打开WhatsApp或复制话术不计作联系记录。",
    ),
  },
  {
    title: w(
      "Complete only one task",
      "Selesaikan satu tugas saja",
      "只完成一个任务",
    ),
    trigger: w(
      "T1, T2 and T3 coexist; staff confirm T1 is complete.",
      "T1, T2, dan T3 berjalan bersamaan; staf mengonfirmasi T1 selesai.",
      "T1、T2和T3并存，员工确认完成T1。",
    ),
    system: w(
      "Complete the selected task and cancel only its linked pending notifications.",
      "Selesaikan tugas terpilih dan batalkan hanya notifikasi tertunda terkait.",
      "仅完成选定任务，取消其关联待发通知。",
    ),
    human: w(
      "Confirm actual completion and review what remains.",
      "Konfirmasi penyelesaian sebenarnya dan tinjau pekerjaan tersisa.",
      "确认真实完成情况，并检查剩余事项。",
    ),
    boundary: w(
      "T2 and T3 retain their deadlines. An API-accepted notice cannot be recalled.",
      "T2 dan T3 mempertahankan tenggat. Notifikasi yang diterima API tidak dapat ditarik kembali.",
      "T2、T3保留原期限；接口已接受的通知不能撤回。",
    ),
  },
  {
    title: w(
      "Wait, pause or stop",
      "Menunggu, tunda, atau berhenti",
      "等待、暂缓或停止",
    ),
    trigger: w(
      "The customer requests later contact or no proactive contact.",
      "Pelanggan meminta dihubungi nanti atau tidak dihubungi secara proaktif.",
      "客户希望稍后联系或停止主动外联。",
    ),
    system: w(
      "Retain tasks and deadlines; use internal review arrangements as configured.",
      "Pertahankan tugas dan tenggat; gunakan pengaturan peninjauan internal sesuai konfigurasi.",
      "保留任务及期限，按配置转为内部核实或复查安排。",
    ),
    human: w(
      "Record the reason and required review time. Explicitly decide whether to resume contact.",
      "Catat alasan dan waktu tinjau yang diperlukan. Putuskan secara eksplisit apakah kontak dilanjutkan.",
      "记录原因和必要复查时间；恢复主动联系需要明确决定。",
    ),
    boundary: w(
      "Review becoming due does not automatically resume contact or erase overdue work.",
      "Jatuh tempo peninjauan tidak otomatis melanjutkan kontak atau menghapus keterlambatan.",
      "复查到期不自动恢复外联，也不抹去逾期事实。",
    ),
  },
  {
    title: w(
      "Notification failure or unknown result",
      "Notifikasi gagal atau hasil tidak diketahui",
      "通知失败或结果未知",
    ),
    trigger: w(
      "Configuration errors, external failure or a timeout occurs.",
      "Terjadi kesalahan konfigurasi, kegagalan eksternal, atau batas waktu.",
      "发生配置错误、外部失败或超时。",
    ),
    system: w(
      "Preserve the actual delivery state and expose the exception to Managers.",
      "Simpan status pengiriman sebenarnya dan tampilkan masalah kepada Manager.",
      "保留真实发送状态，并向管理者展示异常。",
    ),
    human: w(
      "Check the channel and whether delivery may already have occurred before retrying.",
      "Periksa kanal dan kemungkinan pesan telah terkirim sebelum mencoba lagi.",
      "重试前核对渠道，以及是否可能已经送达。",
    ),
    boundary: w(
      "An unknown result is not proof of failure. Do not blindly replay historical notifications.",
      "Hasil tidak diketahui bukan bukti kegagalan. Jangan mengirim ulang riwayat notifikasi tanpa pemeriksaan.",
      "结果未知不等于明确失败，不盲目重放历史通知。",
    ),
  },
];
export const panoramaLesson: GuideLesson = {
  title: w("CRM Overview", "Gambaran Umum CRM", "CRM全景总览"),
  answer: w(
    "CRM connects customer needs, responsibility and the next action. Start here, then explore the mechanisms you need.",
    "CRM menghubungkan kebutuhan pelanggan, tanggung jawab, dan tindakan berikutnya. Mulai di sini, lalu pelajari mekanisme yang Anda perlukan.",
    "CRM把客户需求、责任人和下一步连接起来；先看全貌，再深入所需机制。",
  ),
  value: w(
    "A colleague can take over without guessing: find the request, existing commitments, owner and deadline. Managers can distinguish contact attempts from completed work.",
    "Rekan dapat mengambil alih tanpa menebak: temukan permintaan, komitmen, penanggung jawab, dan tenggat. Manajer dapat membedakan upaya kontak dari pekerjaan selesai.",
    "员工接手时能找到诉求、已有承诺、责任人和期限，不必从聊天中猜测；管理者能区分联系尝试和业务完成。",
  ),
  nodes: panoramaNodes,
  caption: w(
    "The system preserves evidence and routes work. Staff verify facts, confirm outcomes and arrange the next step.",
    "Sistem menyimpan bukti dan menyalurkan pekerjaan. Staf memverifikasi fakta, mengonfirmasi hasil, dan mengatur langkah berikutnya.",
    "系统保存依据并组织工作；员工核实事实、确认结果并安排下一步。",
  ),
  example: w(
    "A customer requests a consultation and a trial. Two tasks can coexist. Completing the consultation does not complete the trial.",
    "Pelanggan meminta konsultasi dan uji coba. Dua tugas dapat berjalan bersamaan. Menyelesaikan konsultasi tidak menyelesaikan uji coba.",
    "客户同时提出咨询与试听请求，两项任务可以并存；完成咨询不代表试听也已完成。",
  ),
  boundary: w(
    "This overview explains existing rules. It does not add an automatic offer engine, live human chat, class assignment or payment verification.",
    "Gambaran ini menjelaskan aturan yang ada. Ini tidak menambahkan mesin penawaran otomatis, chat staf langsung, penempatan kelas, atau verifikasi pembayaran.",
    "本章解释现有规则，不新增自动优惠决策、实时人工坐席、自动分班或付款核验。",
  ),
  shape: "flow",
};
export const panoramaChapter: SystemChapter = {
  key: "panorama",
  title: panoramaLesson.title,
  intro: panoramaLesson.answer,
  blocks: [],
  technical: w(
    "Storage and server access checks are explained in Data dictionary and implementation. Account and version instructions are in Accounts and permissions.",
    "Penyimpanan dan pemeriksaan akses server dijelaskan dalam Kamus data dan implementasi. Petunjuk akun dan versi ada di Akun dan izin akses.",
    "存储与服务端权限校验见“数据字典与技术实现”；账号及版本操作见“账号与权限”。",
  ),
  sources: [
    "src/utils/accessControl.ts",
    "server/portal/runtime.ts",
    "server/portal/followup.ts",
    "src/types/leadSystem.ts",
  ],
  related: "workspace",
};
