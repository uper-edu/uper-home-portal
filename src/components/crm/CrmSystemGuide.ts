export type Words = readonly [string, string, string];
export type GuideBlock = {
  kind: "flow" | "table" | "example" | "diagram";
  diagram?: "classification" | "acquisition" | "sla" | "notification";
  title: Words;
  items: Words[];
};
export type SystemChapter = {
  key: string;
  title: Words;
  intro: Words;
  blocks: GuideBlock[];
  technical: Words;
  sources: string[];
  related: string;
};
const w = (en: string, id: string, zh: string): Words => [en, id, zh];
export const systemChapters: SystemChapter[] = [
  {
    key: "architecture",
    title: w(
      "System purpose and architecture",
      "Tujuan dan arsitektur sistem",
      "系统定位与全景架构",
    ),
    intro: w(
      "CRM connects acquisition, learning needs and accountable sales follow-up. Automation preserves evidence and schedules work; staff confirm contact, participation and business outcomes.",
      "CRM menghubungkan akuisisi, kebutuhan belajar, dan tindak lanjut yang dapat ditelusuri. Otomatisasi menyimpan bukti dan menjadwalkan pekerjaan; staf mengonfirmasi kontak, partisipasi, dan hasil bisnis.",
      "CRM 将获客、学习需求和有责任人的销售跟进连接起来。系统保存证据并安排事项，员工确认联系、参与和业务结果。",
    ),
    blocks: [
      {
        kind: "flow",
        title: w("Responsibilities", "Pembagian tanggung jawab", "职责关系"),
        items: [
          w(
            "Website / campaign → attract visitors",
            "Situs / kampanye → menarik pengunjung",
            "官网／活动 → 引导访客",
          ),
          w(
            "Chat → questionnaire, assessment, AI consultation",
            "Chat → kuesioner, asesmen, konsultasi AI",
            "聊天 → 问卷、测评、AI 咨询",
          ),
          w(
            "Server + MySQL → persist customer and evidence",
            "Server + MySQL → menyimpan pelanggan dan bukti",
            "服务端＋MySQL → 保存客户与证据",
          ),
          w(
            "CRM staff → claim, contact, record and plan",
            "Staf CRM → mengambil, menghubungi, mencatat, merencanakan",
            "CRM 员工 → 认领、联系、记录与安排",
          ),
          w(
            "Worker → route reminders and audit delivery",
            "Worker → menyalurkan pengingat dan mengaudit pengiriman",
            "后台任务 → 路由提醒与记录发送审计",
          ),
        ],
      },
      {
        kind: "table",
        title: w("Workspace boundaries", "Batas ruang kerja", "工作区边界"),
        items: [
          w('The account menu shared with CMS and System management separates Code (linked GitHub commit) and Build (environment-specific package), with environment and captured source state. Save your work before refreshing if versions differ; source mode and uncommitted builds are labeled explicitly.',
          'Menu akun bersama CMS dan manajemen sistem memisahkan Code (tautan commit GitHub) dan Build (paket sesuai lingkungan), serta menampilkan lingkungan dan status kode yang dicatat. Simpan pekerjaan sebelum memuat ulang jika versi berbeda; mode sumber dan perubahan yang belum dikomit ditandai jelas.',
          '与CMS及系统管理共用的账号菜单分开显示Code（GitHub提交链接）与Build（对应环境的构建包），并显示环境和已记录的源码状态。版本不一致时先保存工作再刷新；源码模式和未提交构建会明确标注。'),
          w(
            "CRM: customers, tasks, campaigns and sales operations",
            "CRM: pelanggan, tugas, kampanye, operasional penjualan",
            "CRM：客户、任务、活动与销售运营",
          ),
          w(
            "CMS independently manages website content. Its operating instructions belong to the Content management workspace.",
            "CMS mengelola konten situs secara terpisah. Petunjuk operasinya tersedia di ruang Manajemen konten.",
            "CMS 独立管理网站内容；具体操作说明在内容管理工作区查阅。",
          ),
          w(
            "Static JSON: questions and translations; MySQL: business records",
            "JSON statis: soal dan terjemahan; MySQL: catatan bisnis",
            "静态 JSON：题库与文案；MySQL：业务记录",
          ),
        ],
      },
    ],
    technical: w(
      "The server enforces access. Documentation and language changes do not mutate records. Current local authentication is not a completed external education-platform integration.",
      "Server menerapkan izin akses. Dokumentasi dan bahasa tidak mengubah catatan. Autentikasi lokal saat ini bukan integrasi platform pendidikan eksternal yang sudah selesai.",
      "权限由服务端执行。文档及语言切换不修改业务记录。当前本地账号认证不代表已经完成外部教育平台联调。",
    ),
    sources: ["server/mysqlApplication.ts", "server/portal/identity.ts"],
    related: "access",
  },
  {
    key: "entities",
    title: w(
      "Core concepts and data relationships",
      "Konsep inti dan hubungan data",
      "核心概念与数据关系",
    ),
    intro: w(
      "A customer is not a conversation, and a message is not a task. Several conversations and tasks can belong to one customer.",
      "Pelanggan berbeda dari percakapan; pesan berbeda dari tugas. Satu pelanggan dapat memiliki beberapa percakapan dan tugas.",
      "客户不等于会话，消息不等于任务。同一客户可以拥有多个会话和多个任务。",
    ),
    blocks: [
      {
        kind: "flow",
        title: w("Relationships", "Hubungan", "对象关联"),
        items: [
          w(
            "Visitor session → server-issued browser identity",
            "Sesi pengunjung → identitas browser dari server",
            "访客会话 → 服务端签发的浏览器身份",
          ),
          w(
            "Customer ← registered visitor; owns multiple conversations",
            "Pelanggan ← pengunjung terdaftar; memiliki beberapa percakapan",
            "客户 ← 已登记访客；关联多个聊天会话",
          ),
          w(
            "Conversation → ordered messages → AI / assessment evidence",
            "Percakapan → pesan berurutan → bukti AI / asesmen",
            "聊天会话 → 有序消息 → AI／测评证据",
          ),
          w(
            "Customer → follow-up tasks → events → notification jobs",
            "Pelanggan → tugas → peristiwa → pekerjaan notifikasi",
            "客户 → 跟进任务 → 业务事件 → 通知任务",
          ),
        ],
      },
      {
        kind: "table",
        title: w(
          "Terms that must stay separate",
          "Istilah yang harus dibedakan",
          "必须区分的概念",
        ),
        items: [
          w(
            "Owner: customer responsibility; task owner: responsibility for one task",
            "Penanggung jawab pelanggan berbeda dari penanggung jawab tugas",
            "客户负责人：客户归属；任务负责人：单项事项的责任人",
          ),
          w(
            "Unread: activity not viewed; unfinished: business work not completed",
            "Belum dibaca: aktivitas belum dilihat; belum selesai: pekerjaan belum ditangani",
            "未读：动态未查看；未处理：业务事项未完成",
          ),
          w(
            "Stage: sales progress; group: classification; contact arrangement: outreach permission and review plan",
            "Tahap: perkembangan penjualan; kelompok: klasifikasi; pengaturan kontak: rencana peninjauan dan pendekatan",
            "销售阶段：进展；客户分组：分类；联系安排：主动联系与复查计划",
          ),
        ],
      },
    ],
    technical: w(
      "Anonymous messages are linked after registration without copying. Matching phone/email is only a candidate signal. Request IDs deduplicate retries; different message IDs preserve repeated text. Missing original times remain unknown.",
      "Pesan anonim ditautkan setelah registrasi tanpa disalin. Telepon/email cocok hanya petunjuk kandidat. ID permintaan mencegah duplikasi percobaan ulang; ID pesan berbeda mempertahankan teks berulang. Waktu asli yang hilang tetap tidak diketahui.",
      "匿名消息登记后关联，不复制。电话／邮箱匹配仅为候选依据。请求 ID 去重重试，不同消息 ID 保留相同文字。原始时间缺失仍为未知。",
    ),
    sources: ["server/portal/runtime.ts", "cloud/mysql/schema.sql"],
    related: "chat",
  },
  {
    key: "acquisition",
    title: w(
      "Campaign-to-customer journey",
      "Alur kampanye ke pelanggan",
      "活动获客与完整闭环",
    ),
    intro: w(
      "The campaign ID connects the entry link to saved attribution. Participation requires separate staff evidence.",
      "ID kampanye menghubungkan tautan masuk dengan atribusi tersimpan. Partisipasi memerlukan bukti staf tersendiri.",
      "活动 ID 将入口链接与保存的来源关联。参与活动须有员工单独确认的证据。",
    ),
    blocks: [
      {
        kind: "diagram",
        diagram: "acquisition",
        title: w("Business swimlane", "Alur tanggung jawab", "业务泳道"),
        items: [
          w(
            "Manager: create campaign → /chat?c=code",
            "Manajer: buat kampanye → /chat?c=code",
            "管理者：创建活动 → /chat?c=code",
          ),
          w(
            "Visitor: open link → register questionnaire [registration count]",
            "Pengunjung: buka tautan → registrasi kuesioner [jumlah registrasi]",
            "访客：打开链接 → 提交问卷登记【登记数】",
          ),
          w(
            "Learner: submit assessment [assessment count] → AI consultation",
            "Pelajar: kirim asesmen [jumlah asesmen] → konsultasi AI",
            "学员：提交测评【测评数】→ AI 咨询",
          ),
          w(
            "Sales: claim / receive assignment → contact → plan next task",
            "Sales: ambil / terima penugasan → kontak → rencanakan tugas",
            "销售：认领／分配 → 联系 → 安排下一步",
          ),
          w(
            "Staff: confirm participation [participation count] and record enrollment [enrollment count]",
            "Staf: konfirmasi partisipasi [jumlah partisipasi] dan catat pendaftaran kelas [jumlah pendaftaran kelas]",
            "员工：确认参与【参与数】与记录报名【报名数】",
          ),
        ],
      },
      {
        kind: "example",
        title: w(
          "Example: registration is not attendance",
          "Contoh: registrasi bukan kehadiran",
          "实例：登记不等于到场",
        ),
        items: [
          w(
            "TEST Learner registers online and completes a test: registration 1, assessment 1, confirmed participation 0. Staff later records online meeting evidence: participation becomes 1.",
            "TEST Learner mendaftar daring dan menyelesaikan tes: registrasi 1, asesmen 1, partisipasi terkonfirmasi 0. Setelah staf mencatat bukti pertemuan daring: partisipasi menjadi 1.",
            "TEST Learner 在线登记并完成测评：登记 1、测评 1、确认参与 0。员工随后记录线上会议证据，确认参与才变为 1。",
          ),
        ],
      },
    ],
    technical: w(
      "First attribution is retained; individual conversations retain their own sources. Repeated link openings are not unique visitors. Cross-campaign participation is separate from acquisition attribution.",
      "Atribusi pertama dipertahankan; percakapan menyimpan sumber masing-masing. Pembukaan tautan berulang bukan pengunjung unik. Partisipasi lintas kampanye terpisah dari atribusi akuisisi.",
      "首次归因保留，每次会话保留自身来源。重复打开链接不等于独立访客。跨活动参与与获客归因分别记录。",
    ),
    sources: [
      "server/portal/attribution.ts",
      "src/utils/crmCampaignMetrics.ts",
    ],
    related: "campaigns",
  },
  {
    key: "classification",
    title: w(
      "Customer classification and rule priority",
      "Klasifikasi pelanggan dan prioritas aturan",
      "客户分组与规则优先级",
    ),
    intro: w(
      "Registration uses the baseline classifier. Follow-up evaluates the full rule chain. A sales-confirmed group can remain effective while a different prediction is retained as evidence.",
      "Registrasi memakai klasifikasi dasar. Tindak lanjut mengevaluasi rantai aturan lengkap. Kelompok terkonfirmasi sales dapat tetap berlaku saat prediksi berbeda disimpan sebagai bukti.",
      "登记使用基础分类，跟进使用完整规则链。人工确认分组可以继续生效，不同预测作为依据保留。",
    ),
    blocks: [
      {
        kind: "diagram",
        diagram: "classification",
        title: w(
          "Full evaluation: early matches stop; baseline then adjustment",
          "Evaluasi lengkap: kecocokan awal berhenti; dasar lalu penyesuaian",
          "完整推演：前三项或院校规则命中即停止；否则基础分类再微调",
        ),
        items: [
          w(
            "R6: no reply + recorded attempts ≥ 3 → nurture",
            "R6: belum dibalas + upaya tercatat ≥ 3 → pembinaan",
            "R6：未回复且触达次数 ≥ 3 → 培育池",
          ),
          w(
            "R1: explicit buying signal → Hot",
            "R1: sinyal pembelian eksplisit → minat tinggi",
            "R1：明确购买信号 → 高意向",
          ),
          w(
            "R2: trial attended → high interest",
            "R2: uji coba dihadiri → minat tinggi",
            "R2：已出席试听 → 高意向",
          ),
          w(
            "R3: teacher / school staff → School",
            "R3: guru / staf sekolah → kerja sama sekolah",
            "R3：教师／学校职员 → 院校合作",
          ),
          w(
            "R4: goal × reported foundation × city / learning format → baseline group",
            "R4: tujuan × dasar yang dilaporkan × kota / format → kelompok dasar",
            "R4：目标 × 自报基础 × 城市／授课方式 → 基础分组",
          ),
          w(
            "R5: assessment done / trial booked upgrades a warm baseline; cold remains cold",
            "R5: asesmen selesai / uji coba dipesan menaikkan kelompok hangat; dingin tetap",
            "R5：完成测评／预约试听可提升中意向基础分组，培育池不因此升档",
          ),
        ],
      },
      {
        kind: "table",
        title: w(
          "Baseline and assessment routing",
          "Dasar klasifikasi dan alur asesmen",
          "基础分类与测评路由",
        ),
        items: [
          w(
            "Work / scholarship / HSK goal + known foundation → high interest; partial foundation in Jakarta with offline/undecided format → warm offline; otherwise warm online. Other goals → nurture.",
            "Tujuan kerja / beasiswa / HSK + dasar diketahui → minat tinggi; dasar belum jelas di Jakarta dengan format luring/belum pasti → minat sedang luring; lainnya → minat sedang daring. Tujuan lain → pembinaan.",
            "就业／留学／HSK 目标且基础明确 → 高意向；基础尚未明确、雅加达且线下／未确定方式 → 线下中意向；其他情况 → 线上中意向。其他目标 → 培育池。",
          ),
          w(
            "Known means self-reported HSK 1–4+; partial means beginner / unsure; zero means complete beginner. These are routing inputs, not certified results.",
            "Diketahui berarti laporan HSK 1–4+; parsial berarti pemula / belum yakin; nol berarti pemula total. Ini masukan alur, bukan hasil bersertifikat.",
            "基础明确指自报 HSK 1–4+；部分基础指初学／不确定；零基础指完全初学。这些是路由输入，不是认证结果。",
          ),
          w(
            "Existing flag rule: partial foundation needs assessment; known or zero can skip it. Questionnaire entry may still offer diagnostic options.",
            "Aturan penanda saat ini: dasar parsial perlu asesmen; dasar diketahui atau nol dapat melewatinya. Alur kuesioner tetap dapat menawarkan opsi diagnostik.",
            "现有标记规则：部分基础需测评，明确基础或零基础可跳过。问卷入口仍可提供诊断选项。",
          ),
          w(
            "Registration baseline additionally recognizes an exam plan within 3 months. It does not evaluate the full no-reply rollback chain.",
            "Dasar registrasi juga mengenali rencana ujian dalam 3 bulan. Tidak mengevaluasi seluruh aturan penurunan saat belum dibalas.",
            "登记基础分类还考虑三个月内考证计划，不执行完整未回复降档链。",
          ),
        ],
      },
      {
        kind: "example",
        title: w(
          "Priority and confirmation examples",
          "Contoh prioritas dan konfirmasi",
          "优先级与人工确认实例",
        ),
        items: [
          w(
            "A price inquiry with No Response and touchCount 3 predicts Cold-Nurture because R6 precedes R1. This is the current counter rule, not proof of three consecutive failed calls.",
            "Pertanyaan harga yang belum dibalas dengan 3 upaya tercatat memprediksi kelompok pembinaan karena R6 mendahului R1. Ini aturan penghitung saat ini, bukan bukti tiga panggilan gagal berturut-turut.",
            "询价客户同时为未回复且已记录触达次数为 3，预测为培育池，因为 R6 优先于 R1。这是当前计数规则，不代表已证明连续三次未接通。",
          ),
          w(
            "A retained sales-confirmed group and a new prediction may differ. Inspect classification evidence; do not treat every prediction as an automatic reassignment.",
            "Kelompok terkonfirmasi sales dan prediksi baru dapat berbeda. Periksa bukti klasifikasi; jangan anggap setiap prediksi mengganti kelompok otomatis.",
            "人工确认分组与新预测可以不同。查看分组依据，不能把每次预测当作自动覆盖。",
          ),
        ],
      },
    ],
    technical: w(
      "Effective group, confirmed group, prediction and source are separate fields. Missing required goal/foundation remains Unqualified. The full classifier currently uses a fixed threshold of 3; cadence filters read the configurable retry threshold. These are separate implementations. Interface language and viewing never reclassify customers.",
      "Kelompok berlaku, konfirmasi, prediksi, dan sumber adalah kolom terpisah. Tujuan/dasar yang wajib tetapi hilang tetap belum dinilai. Klasifikasi lengkap saat ini memakai ambang tetap 3; filter ritme memakai ambang percobaan yang dapat dikonfigurasi. Keduanya implementasi terpisah. Bahasa antarmuka dan membuka data tidak mengklasifikasi ulang.",
      "生效分组、人工确认、预测和来源分别记录。必需目标／基础缺失时保持待评估。完整分类当前使用固定阈值 3；节奏筛选读取可配置重试阈值，两者是不同实现。语言切换和查看不会重算分类。",
    ),
    sources: [
      "src/types/leadSystem.ts",
      "src/types/crmLead.ts",
      "server/portal/salesWorkflow.ts",
    ],
    related: "workspace",
  },
  {
    key: "lifecycle",
    title: w(
      "Sales stages and contact arrangements",
      "Tahap penjualan dan pengaturan kontak",
      "销售阶段与联系安排",
    ),
    intro: w(
      "Stages record business progress, not automatic proof of payment or attendance. Changing contact arrangements does not change classification or complete tasks.",
      "Tahap mencatat perkembangan bisnis, bukan bukti otomatis pembayaran atau kehadiran. Pengaturan kontak tidak mengubah klasifikasi atau menyelesaikan tugas.",
      "阶段记录业务进展，不自动证明付款或到场。联系安排不改变分组，也不完成任务。",
    ),
    blocks: [
      {
        kind: "flow",
        title: w(
          "Typical staff-recorded journey; steps may be skipped",
          "Alur umum yang dicatat staf; tahap dapat dilewati",
          "常见人工记录路径；可跳过不适用阶段",
        ),
        items: [
          w("New → Contacted", "Baru → Dihubungi", "待初访 → 已联系"),
          w(
            "Assessment Booked → Assessment Done",
            "Asesmen dipesan → Asesmen selesai",
            "已预约测评 → 已完成测评",
          ),
          w(
            "Trial Booked → Trial Attended",
            "Uji coba dipesan → Uji coba dihadiri",
            "已预约试听 → 已出席试听",
          ),
          w("Enrolled / Lost", "Terdaftar / Ditutup", "已报名／已关闭"),
        ],
      },
      {
        kind: "table",
        title: w(
          "Independent contact arrangements",
          "Pengaturan kontak terpisah",
          "独立联系安排",
        ),
        items: [
          w(
            "Active: handle current tasks",
            "Aktif: tangani tugas saat ini",
            "正常跟进：处理当前任务",
          ),
          w(
            "Waiting / nurture: reason + future review; retain old deadlines",
            "Menunggu / pembinaan: alasan + tinjauan mendatang; tenggat lama tetap",
            "等待／培育：原因＋未来复查；旧期限保留",
          ),
          w(
            "Stopped: reason required; no proactive contact; internal work remains",
            "Dihentikan: alasan wajib; tanpa kontak proaktif; pekerjaan internal tetap",
            "停止联系：须说明原因；禁止主动外联，内部事项仍保留",
          ),
          w(
            "Review due: staff decides whether to wait, resume or stop",
            "Tinjauan jatuh tempo: staf memutuskan menunggu, melanjutkan, atau berhenti",
            "复查到期：由员工决定继续等待、恢复或停止",
          ),
        ],
      },
    ],
    technical: w(
      "Contact results are Connected, No Response or Wrong Number. Historical Interested values are not new contact results. Stage editing records a state; it does not verify a contract or enroll a student into a class.",
      "Hasil kontak adalah tersambung/dibalas, belum dibalas, atau nomor tidak valid. Nilai minat lama bukan hasil kontak baru. Mengubah tahap mencatat status; tidak memverifikasi kontrak atau memasukkan pelajar ke kelas.",
      "联系结果为已接通／未回复／号码无效。历史意向值不是新的联系结果选项。编辑阶段只是记录状态，不验证合同或自动分班。",
    ),
    sources: ["server/portal/salesWorkflow.ts", "src/utils/crmContact.ts"],
    related: "followup",
  },
  {
    key: "tasks-sla",
    title: w(
      "Tasks, deadlines and SLA",
      "Tugas, tenggat, dan SLA",
      "任务、截止时间与 SLA",
    ),
    intro: w(
      "SLA means Service Level Agreement: the configured response commitment. Task deadlines are persisted; changing settings does not rewrite existing commitments.",
      "SLA berarti Service Level Agreement: komitmen respons yang dikonfigurasi. Tenggat disimpan; perubahan pengaturan tidak menulis ulang komitmen lama.",
      "SLA 是服务水平协议，即配置的响应承诺。任务截止时间持久保存，修改设置不重写已有承诺。",
    ),
    blocks: [
      {
        kind: "flow",
        title: w(
          "Task state and handling",
          "Status dan penanganan tugas",
          "任务状态与处理",
        ),
        items: [
          w(
            "Business request → create open task with owner and deadline",
            "Permintaan bisnis → tugas terbuka dengan penanggung jawab dan tenggat",
            "业务请求 → 创建有责任人与期限的开放任务",
          ),
          w(
            "Past deadline + unfinished → overdue",
            "Lewat tenggat + belum selesai → terlambat",
            "超过期限且未完成 → 逾期",
          ),
          w(
            "Record outcome + explicitly select task → complete that task",
            "Catat hasil + pilih tugas secara eksplisit → selesaikan tugas tersebut",
            "记录结果并明确选择任务 → 完成该项任务",
          ),
          w(
            "Cancel only its queued notifications; retain other tasks",
            "Batalkan hanya notifikasi terkait yang mengantre; tugas lain tetap",
            "只取消该任务待发通知；其他任务保留",
          ),
        ],
      },
      {
        kind: "diagram",
        diagram: "sla",
        title: w(
          "Sample calendar: Jakarta, Mon–Sat 09:00–20:00, 3 natural hours",
          "Kalender contoh: Jakarta, Sen–Sab 09:00–20:00, 3 jam berlalu",
          "示例日历：雅加达，周一至周六 09:00–20:00，自然时长 3 小时",
        ),
        items: [
          w(
            "Monday 10:00 → Monday 13:00",
            "Senin 10:00 → Senin 13:00",
            "周一 10:00 → 周一 13:00",
          ),
          w(
            "Monday 23:00 → start Tuesday 09:00 → due Tuesday 12:00",
            "Senin 23:00 → mulai Selasa 09:00 → jatuh tempo Selasa 12:00",
            "周一 23:00 → 周二 09:00 起算 → 周二 12:00 截止",
          ),
          w(
            "Saturday 19:00 → nominal 22:00 outside hours → Monday 09:00",
            "Sabtu 19:00 → nominal 22:00 di luar jam kerja → Senin 09:00",
            "周六 19:00 → 原期限 22:00 不在工作时间 → 周一 09:00",
          ),
          w(
            "Sunday 10:00 → start Monday 09:00 → due Monday 12:00",
            "Minggu 10:00 → mulai Senin 09:00 → jatuh tempo Senin 12:00",
            "周日 10:00 → 周一 09:00 起算 → 周一 12:00",
          ),
        ],
      },
    ],
    technical: w(
      "These are examples, not live settings. Natural hours are not accumulated working hours. Handoff/booking/enrollment use the hot response duration. Existing overdue facts remain visible during waiting. Historical tasks with unverified times need review. Calendar and first-response durations are consumed by server task deadlines. Other saved cadence parameters are not proof that every legacy milestone has an automatic server scheduler.",
      "Ini contoh, bukan pengaturan aktif. Jam berlalu bukan akumulasi jam kerja. Bantuan manusia/pemesanan/pendaftaran memakai durasi respons prioritas tinggi. Keterlambatan tetap terlihat selama menunggu. Tugas historis dengan waktu belum terverifikasi perlu ditinjau. Kalender dan durasi respons pertama dipakai tenggat tugas server. Parameter ritme lain yang tersimpan tidak membuktikan semua tonggak lama memiliki penjadwal otomatis di server.",
      "上述为示例，不是当前配置。自然时长不等于累计工作小时。转人工／预约／报名采用高意向响应时长。等待期间逾期事实仍可见。历史时间未确认的任务须核实。服务端任务期限使用工作日历及首次响应时长。其他节奏参数已保存不等于每个旧里程碑都有服务端自动调度。",
    ),
    sources: ["server/portal/policy.ts", "server/portal/followup.ts"],
    related: "operations",
  },
  {
    key: "notification-system",
    title: w(
      "Notification execution and audit",
      "Eksekusi notifikasi dan audit",
      "通知执行与发送审计",
    ),
    intro: w(
      "Business data and its event are saved together. Notification delivery and staff follow-up are independent evidence.",
      "Data bisnis dan peristiwa disimpan bersama. Pengiriman notifikasi dan tindak lanjut staf merupakan bukti terpisah.",
      "业务数据与事件一起保存。通知发送与员工跟进是独立证据。",
    ),
    blocks: [
      {
        kind: "diagram",
        diagram: "notification",
        title: w("Execution pipeline", "Alur eksekusi", "执行链"),
        items: [
          w(
            "Business transaction → Outbox event",
            "Transaksi bisnis → peristiwa Outbox",
            "业务事务 → Outbox 事件",
          ),
          w(
            "Enabled policy + conditions + calendar → persistent jobs",
            "Kebijakan aktif + kondisi + kalender → pekerjaan tersimpan",
            "已启用策略＋条件＋日历 → 持久通知任务",
          ),
          w(
            "Valid Owner → Owner; unassigned / invalid → authorized CRM Managers",
            "Penanggung jawab valid → dirinya; kosong/tidak valid → Manajer CRM berizin",
            "有效负责人 → 负责人；未分配／无效 → 有权限的 CRM 管理者",
          ),
          w(
            "Task/owner/contact recheck → in-app or configured Lark group",
            "Periksa ulang tugas/penanggung jawab/kontak → aplikasi atau grup Lark",
            "发送前复查任务／归属／联系安排 → 站内或指定 Lark 群",
          ),
          w(
            "Receipt → audit; employee records outcome separately",
            "Hasil pengiriman → audit; staf mencatat hasil secara terpisah",
            "回执 → 审计；员工另外记录处理结果",
          ),
        ],
      },
      {
        kind: "table",
        title: w("Delivery evidence", "Bukti pengiriman", "发送证据"),
        items: [
          w(
            "Pending / sending: not yet confirmed",
            "Menunggu / mengirim: belum dikonfirmasi",
            "待发／发送中：尚未确认",
          ),
          w(
            "Simulated: explicitly simulated channel; no real receipt",
            "Simulasi: kanal dipilih simulasi; tidak ada penerimaan nyata",
            "模拟：渠道明确设为模拟，无真实实收",
          ),
          w(
            "Accepted: provider accepted; not proof of staff reading",
            "Diterima API: bukan bukti staf membaca",
            "接口接受：不代表员工已读",
          ),
          w(
            "Failed: definite failure; unknown: inspect before retry",
            "Gagal: kegagalan pasti; tidak diketahui: periksa sebelum mencoba ulang",
            "失败：明确失败；未知：先核查再重试",
          ),
          w(
            "Historical frozen failure: keep error; no automatic replay",
            "Kegagalan historis dibekukan: simpan kesalahan; tanpa pengiriman ulang otomatis",
            "历史冻结失败：保留原因，不自动重放",
          ),
        ],
      },
    ],
    technical: w(
      "Queued jobs retain the rule version. Activation affects new events. Missing channels fail, not simulate. Email/SMS senders are not connected. External delivery cannot be promised exactly once; uncertain timeouts are not blindly retried.",
      "Pekerjaan antrean mempertahankan versi aturan. Aktivasi berlaku untuk peristiwa baru. Kanal hilang berarti gagal, bukan simulasi. Pengirim email/SMS belum tersambung. Pengiriman eksternal tidak dijamin tepat sekali; timeout tidak pasti tidak diulang sembarangan.",
      "待发任务保留规则版本，启用影响新事件。缺失渠道为失败，不是模拟。Email／短信发送器未接通。外部发送不保证绝对一次；超时结果不明不盲目重试。",
    ),
    sources: [
      "server/portal/worker.ts",
      "server/portal/notificationDelivery.ts",
    ],
    related: "notifications",
  },
  {
    key: "measurement",
    title: w(
      "Metrics and evidence boundaries",
      "Metrik dan batas bukti",
      "指标与证据边界",
    ),
    intro: w(
      "A number needs a population, time definition and evidence. Missing evidence is unknown, not zero.",
      "Angka memerlukan populasi, definisi waktu, dan bukti. Bukti hilang berarti tidak diketahui, bukan nol.",
      "数字须有统计对象、时间定义和证据。证据缺失为未知，不是零。",
    ),
    blocks: [
      {
        kind: "table",
        title: w("Management measures", "Ukuran manajemen", "管理过程指标"),
        items: [
          w(
            "Unassigned wait: ownership timestamp → now",
            "Waktu belum ditugaskan: waktu kepemilikan → sekarang",
            "未分配时长：归属时间 → 当前",
          ),
          w(
            "First contact attempt: registration → first timed human record",
            "Upaya kontak pertama: registrasi → catatan manusia pertama dengan waktu",
            "首次联系尝试：登记 → 首条时间有效人工记录",
          ),
          w(
            "Successful communication: Connected records; separate from attempts",
            "Komunikasi berhasil: catatan tersambung/dibalas; terpisah dari upaya",
            "有效沟通：已接通记录，与尝试分别统计",
          ),
          w(
            "Overdue: unfinished task with reliable past deadline",
            "Terlambat: tugas belum selesai dengan tenggat lampau terpercaya",
            "当前逾期：有可靠过去期限的未完成任务",
          ),
          w(
            "Stage duration: reliable stage timestamp; exclude closed customers",
            "Durasi tahap: waktu tahap terpercaya; pelanggan tertutup dikecualikan",
            "阶段停留：可靠阶段时间，不含关闭客户",
          ),
        ],
      },
      {
        kind: "example",
        title: w("Denominators matter", "Penyebut penting", "分母决定意义"),
        items: [
          w('Organic traffic is a permanent, read-only system campaign with ID organic. /chat, /chat?c=home and /chat?c=organic are attributed to it for new registrations. Other campaign IDs remain separate; existing first-touch attribution is retained. Link opens are not unique visitors or confirmed attendance.',
          'Trafik organik adalah kampanye bawaan permanen yang hanya dapat dibaca dengan ID organic. /chat, /chat?c=home dan /chat?c=organic diatribusikan ke kampanye ini untuk registrasi baru. ID kampanye lain tetap terpisah; atribusi pertama yang sudah tersimpan dipertahankan. Pembukaan tautan bukan pengunjung unik atau kehadiran terkonfirmasi.',
          '自然流量使用永久只读的系统活动organic。新登记客户从/chat、/chat?c=home、/chat?c=organic进入时统一归入该活动；其他活动ID独立统计，已有首次归因保留。链接打开次数不等于独立访客或确认到场。'),
          w(
            "Two enrolled out of ten first-attributed registrations gives 20% enrollment share. This is not profit, payment confirmation or a causal marketing conversion claim.",
            "Dua pendaftaran kelas dari sepuluh registrasi atribusi pertama menghasilkan proporsi 20%. Ini bukan laba, konfirmasi pembayaran, atau bukti sebab-akibat pemasaran.",
            "10 位首次归因登记客户中 2 位已报名，报名占比为 20%。这不是利润、付款确认或因果意义的营销转化证明。",
          ),
        ],
      },
    ],
    technical: w(
      "Process overview follows authorized filtered customers. Campaign cards follow campaign filters and access scope, not worklist filters. Amounts are recorded amounts; planned budget is not actual spend.",
      "Ringkasan proses mengikuti pelanggan terfilter yang berizin. Kartu kampanye mengikuti filter kampanye dan izin, bukan filter daftar kerja. Nominal adalah catatan; anggaran rencana bukan pengeluaran aktual.",
      "过程概览使用权限内筛选客户。活动卡片使用活动筛选及权限范围，不继承工作列表筛选。金额仅为记录金额，预算不等于实际支出。",
    ),
    sources: [
      "src/utils/crmProcessMetrics.ts",
      "src/utils/crmCampaignMetrics.ts",
    ],
    related: "process-and-marketing-metrics",
  },
  {
    key: "ai-assessment",
    title: w(
      "AI and assessment evidence",
      "AI dan bukti asesmen",
      "AI 与测评依据",
    ),
    intro: w(
      "AI consultation, diagnostic assessment and teacher placement have different responsibilities. None automatically proves official certification or a sale.",
      "Konsultasi AI, asesmen diagnostik, dan penempatan guru memiliki tanggung jawab berbeda. Tidak otomatis membuktikan sertifikasi resmi atau penjualan.",
      "AI 咨询、诊断测评与教师定级职责不同，均不自动证明官方认证或成交。",
    ),
    blocks: [
      {
        kind: "flow",
        title: w("Persisted AI turn", "Giliran AI tersimpan", "AI 对话保存链"),
        items: [
          w(
            "Save user message → acknowledge persistence",
            "Simpan pesan pengguna → konfirmasi penyimpanan",
            "保存用户消息 → 确认入库",
          ),
          w(
            "OpenAI → success: save final reply",
            "OpenAI → berhasil: simpan balasan akhir",
            "OpenAI → 成功：保存最终回复",
          ),
          w(
            "OpenAI failure → save failed attempt → DeepSeek",
            "OpenAI gagal → simpan upaya gagal → DeepSeek",
            "OpenAI 失败 → 保存失败尝试 → DeepSeek",
          ),
          w(
            "Final saved answer or explicit failure; partial attempts do not mix",
            "Jawaban akhir tersimpan atau kegagalan eksplisit; upaya parsial tidak dicampur",
            "最终回复已保存或明确失败；失败半截文本不混入最终答案",
          ),
        ],
      },
      {
        kind: "table",
        title: w("Assessment sources", "Sumber asesmen", "测评依据类型"),
        items: [
          w(
            "Self-reported: customer claim, not a test result",
            "Dilaporkan sendiri: pernyataan pelanggan, bukan hasil tes",
            "自报：客户提供的基础，不是测评结果",
          ),
          w(
            "Quick: tentative learning starting point",
            "Cepat: titik awal belajar sementara",
            "快速测评：暂定学习起点",
          ),
          w(
            "Full: saved paper thresholds and sections, not a certificate",
            "Lengkap: ambang dan bagian tes tersimpan, bukan sertifikat",
            "完整测评：本卷门槛与分项结果，不是证书",
          ),
          w(
            "Teacher placement: separately recorded evidence; missing teacher/time remains missing",
            "Penempatan guru: bukti terpisah; guru/waktu hilang tetap kosong",
            "教师定级：独立依据；教师／时间未记录则明确缺失",
          ),
        ],
      },
      {
        kind: "table",
        title: w(
          "Available now and not implemented",
          "Tersedia dan belum diterapkan",
          "已实现与未实现边界",
        ),
        items: [
          w(
            "Available: persisted consultation, provider fallback, saved assessment evidence, tasks and notification audit.",
            "Tersedia: konsultasi tersimpan, pengalihan penyedia, bukti asesmen, tugas, audit notifikasi.",
            "已实现：咨询保存、模型切换、测评依据、任务及通知审计。",
          ),
          w(
            "Not implemented: live human-agent chat, automatic calls, automatic external WhatsApp replies, automatic class assignment. Do not promise these to customers.",
            "Belum diterapkan: chat langsung staf, panggilan otomatis, balasan WhatsApp otomatis, penempatan kelas otomatis. Jangan menjanjikannya.",
            "未实现：实时人工坐席、自动外呼、外部 WhatsApp 自动回复、自动分班。不得向客户承诺。",
          ),
        ],
      },
    ],
    technical: w(
      "Answers are scored server-side with their saved version. Audio failure limits listening evidence. Multiple-choice character recognition does not assess handwriting or speaking. Live human chat, automatic voice outreach and automated external WhatsApp replies are not implemented here.",
      "Jawaban dinilai di server dengan versi tersimpan. Kegagalan audio membatasi bukti mendengar. Pengenalan karakter pilihan ganda tidak menguji tulisan tangan atau berbicara. Chat manusia langsung, telepon otomatis, dan balasan WhatsApp eksternal otomatis belum diterapkan.",
      "答案由服务端按保存版本评分。音频失败限制听力证据，选择题识字不评价手写或口语。实时人工坐席、自动外呼、外部 WhatsApp 自动回复未实现。",
    ),
    sources: ["server/portal/chat.ts", "server/portal/assessments.ts"],
    related: "assessment",
  },
  {
    key: "data-implementation",
    title: w(
      "Data dictionary and implementation",
      "Kamus data dan implementasi",
      "数据字典与技术实现",
    ),
    intro: w(
      "Display fields, business contracts and database columns are different layers. Expand the CRM-scoped dictionary; fields belonging to other modules are excluded. Counts are derived, not fixed.",
      "Kolom tampilan, kontrak bisnis, dan kolom database adalah lapisan berbeda. Buka kamus khusus CRM; kolom modul lain tidak ditampilkan. Jumlah kolom dihitung, bukan tetap.",
      "显示字段、业务契约与数据库列属于不同层。展开字典查看 CRM 契约与存储字段；不展示其他模块的业务字段，数量按内容统计。",
    ),
    blocks: [
      {
        kind: "table",
        title: w("Write boundaries", "Batas penulisan", "写入边界"),
        items: [
          w(
            "Visitor-owned APIs: session, conversation, registration, assessment and chat",
            "API milik pengunjung: sesi, percakapan, registrasi, asesmen, chat",
            "访客所属接口：会话、登记、测评与聊天",
          ),
          w(
            "Staff-scoped APIs: list/detail, claim, profile patch and follow-up logs",
            "API sesuai izin staf: daftar/detail, ambil, ubah profil, catatan tindak lanjut",
            "员工范围接口：列表／详情、认领、资料编辑及跟进记录",
          ),
          w(
            "Manager-only configuration: operations, notification rules/channels/audit",
            "Konfigurasi khusus manajer: operasional, aturan/kanal/audit notifikasi",
            "管理者配置：销售运营、通知规则／渠道／审计",
          ),
        ],
      },
      {
        kind: "example",
        title: w(
          "Reliable write example",
          "Contoh penulisan andal",
          "可靠写入实例",
        ),
        items: [
          w(
            "Three open tasks: completing one selected ID changes that task and its queued notifications only. Reusing the same request ID returns the saved outcome without duplicate logs.",
            "Tiga tugas terbuka: menyelesaikan satu ID terpilih mengubah tugas dan notifikasi terkait saja. ID permintaan yang sama mengembalikan hasil tersimpan tanpa catatan ganda.",
            "三个开放任务：完成一个选定 ID，只改变该任务及关联待发通知。同一请求 ID 重试返回保存结果，不重复生成跟进记录。",
          ),
        ],
      },
    ],
    technical: w(
      "MySQL transactions couple business writes, task changes, audit and Outbox. Worker leases support restart recovery. Secrets stay in server environment references, not browser responses or documentation examples.",
      "Transaksi MySQL mengikat penulisan bisnis, perubahan tugas, audit, dan Outbox. Lease worker mendukung pemulihan setelah restart. Rahasia tetap pada referensi lingkungan server, bukan respons browser atau contoh dokumentasi.",
      "MySQL 事务统一业务写入、任务变更、审计和 Outbox。后台租约支持重启恢复。密钥保留为服务端环境引用，不进入浏览器响应或文档示例。",
    ),
    sources: [
      "cloud/mysql/schema.sql",
      "server/portal/runtime.ts",
      "server/portal/salesWorkflow.ts",
    ],
    related: "support",
  },
];
