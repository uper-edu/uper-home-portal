import {simplifiedFollowupRows} from './CrmGuideContent';
import { panoramaChapter } from "./CrmPanoramaContent";
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
  panoramaChapter,
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
            "Use customer facts, original evidence and recorded actions. Information creates no tasks and has no reading or completion checklist.",
            "Gunakan fakta pelanggan, bukti asli, dan catatan tindakan. Informasi tidak membuat tugas dan tidak memiliki konfirmasi membaca atau daftar penyelesaian.",
            "依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。",
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
    title: [
      "Acquisition flow and source attribution",
      "Alur akuisisi dan atribusi sumber",
      "获客流程与来源归因",
    ],
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
            "Staff: optionally record evidenced event participation [participation count]; record enrollment separately [enrollment count]",
            "Staf: bila perlu catat partisipasi acara berbukti [jumlah partisipasi]; catat pendaftaran kelas terpisah [jumlah pendaftaran kelas]",
            "员工：按需记录有依据的活动参与【参与数】；另记报名【报名数】",
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
  {"key": "classification", "title": ["Customer classification and confirmation boundaries", "Klasifikasi pelanggan dan batas konfirmasi", "客户分组与确认边界"], "intro": ["Only first registration calculates Tier from its saved inputs. Later facts do not automatically recalculate it.", "Hanya registrasi pertama menghitung Tier dari masukan tersimpan. Fakta berikutnya tidak menghitung ulang secara otomatis.", "仅首次登记按当时输入自动分类；后续测评、诉求和阶段变化不自动重算Tier。"], "blocks": [{"kind": "diagram", "diagram": "classification", "title": ["Facts, interests and decisions", "Fakta, minat dan keputusan", "事实、诉求与决策"], "items": [["Only first registration calculates Tier from its saved inputs. Later facts do not automatically recalculate it.", "Hanya registrasi pertama menghitung Tier dari masukan tersimpan. Fakta berikutnya tidak menghitung ulang secara otomatis.", "仅首次登记按当时输入自动分类；后续测评、诉求和阶段变化不自动重算Tier。"], ["Saved assessment completions and explicitly confirmed enrollment retain event time and evidence. Repeated events keep separate records.", "Asesmen tersimpan dan konfirmasi pendaftaran menyimpan waktu serta bukti. Kejadian berulang tetap terpisah.", "真实测评完成与明确确认报名成立保留实际时间和依据，同类事件可重复；AI描述不能证明事件成立。"], ["A price question, advisor request or assessment interest is an expression, not completed purchase. Questionnaire topics remain separate.", "Pertanyaan harga, permintaan konsultan atau minat asesmen adalah pernyataan, bukan pembelian. Topik kuesioner terpisah.", "询价、请求顾问联系、测评意向是具体表达，不等于购买承诺；问卷关注另行标明。"], ["Staff confirm the current sales stage with evidence and effective time. Tier requires its own explicit confirmation. No automatic downgrade.", "Staf mengonfirmasi tahap dengan bukti dan waktu berlaku. Tier memerlukan konfirmasi tersendiri. Tanpa penurunan otomatis.", "销售按依据和生效时间明确确认当前阶段；Tier另行人工确认，R6自动降级已停用。"]]}], "technical": ["Viewing facts does not change Tier, stage, tasks or notifications.", "Melihat fakta tidak mengubah Tier, tahap, tugas atau notifikasi.", "查看记录不修改Tier、阶段、任务或通知；旧规则计算值是历史信息，不是新的自动决策。"], "sources": ["server/portal/tierProvenance.ts", "server/portal/salesProgress.ts", "src/utils/crmBuyingEvidence.ts"], "related": "buying-evidence-sources"},
  {"key": "lifecycle", "title": ["Sales stages and fact milestones", "Tahap penjualan dan tonggak fakta", "销售阶段与事实里程碑"], "intro": ["Staff explicitly confirm the current stage with evidence and effective time; it is not the latest event.", "Staf mengonfirmasi tahap dengan bukti dan waktu berlaku; bukan kejadian terbaru.", "销售明确确认当前推进位置，关联依据及生效时间；不以最近事件自动替换。"], "blocks": [{"kind": "flow", "title": ["Seven stages", "Tujuh tahap", "七阶段口径"], "items": [["Awaiting conversation → Understanding needs → Confirming proposal → Registration in progress → Enrolled; On hold and Opportunity closed are separate decisions.", "Menunggu komunikasi → Menggali kebutuhan → Konfirmasi program → Proses pendaftaran → Terdaftar; Ditunda dan Ditutup adalah keputusan tersendiri.", "待建立沟通 → 需求沟通中 → 方案确认中 → 报名办理中 → 已报名；暂缓推进、结束推进按实际情况明确选择。"]]}, {"kind": "table", "title": ["Facts and decisions", "Fakta dan keputusan", "事实与决策"], "items": [["Staff explicitly confirm the current stage with evidence and effective time; it is not the latest event.", "Staf mengonfirmasi tahap dengan bukti dan waktu berlaku; bukan kejadian terbaru.", "销售明确确认当前推进位置，关联依据及生效时间；不以最近事件自动替换。"], ["A completed assessment or confirmed enrollment remains in history even when the opportunity is paused.", "Asesmen selesai atau pendaftaran terkonfirmasi tetap tercatat saat peluang ditunda.", "测评完成或明确确认报名成立独立留存；当前暂缓推进不抹除已发生事件。"], ["Open Update stage in Follow-up. A saved progress record can supply evidence; the stage is saved separately. Profile is read-only for stages.", "Buka Perbarui tahap di Tindak lanjut. Catatan perkembangan dapat menjadi bukti; tahap disimpan terpisah.", "在跟进页打开“更新阶段”；记录进展后可带入本次依据，阶段独立保存。资料页不重复编辑。"], ["Requests, milestones and stage changes do not create tasks, change Tier or prove payment. Contact permission remains separate.", "Permintaan, tonggak dan perubahan tahap tidak membuat tugas, mengubah Tier atau membuktikan pembayaran.", "诉求、里程碑及阶段调整不新增任务、不自动改变Tier，不证明已付款；停止／恢复联系单独处理。"]]}], "technical": ["Old stages retain their original values and need explicit confirmation; no ambiguous mapping.", "Tahap lama tetap asli dan perlu konfirmasi; tanpa pemetaan ambigu.", "旧阶段保留原值并标为阶段待确认，不做歧义映射。阶段历史保留前后值、原因、操作人、实际生效时间和原始依据。"], "sources": ["src/utils/crmSalesProgress.ts", "server/portal/salesProgress.ts"], "related": "followup"},
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
          "Follow-up workspace",
          "Ruang kerja tindak lanjut",
          "跟进工作区",
        ),
        items: [
          w(
            "Communication overview: contact arrangement, human communication and newer customer messages",
            "Ringkasan komunikasi: pengaturan kontak, komunikasi staf dan pesan pelanggan setelahnya",
            "沟通概况：联系安排、最近人工沟通与此后客户新消息",
          ),
          w(
            "Tasks: saved action, deadlines and one processing entry",
            "Tugas: tindakan, tenggat, dan satu pintu pemrosesan",
            "跟进任务：已保存动作、期限与统一处理入口",
          ),
          w(
            "On-demand form: contact, information or task operation; protect the draft",
            "Formulir sesuai kebutuhan: kontak, informasi, atau tindakan tugas; lindungi draf",
            "按需处理区：联系、信息或任务操作；保护草稿",
          ),
          w(
            "Timeline: operating date and time to seconds; identify customer, sales and system sources",
            "Linimasa: tanggal operasional dan waktu hingga detik; bedakan sumber pelanggan, sales dan sistem",
            "跟进时间轴：运营日期与时分秒；区分客户、销售及系统来源",
          ),
        ],
      },
      {
        kind: "flow",
        title: w("Facts to handling", "Dari fakta ke penanganan", "事实到处理"),
        items: [
          w(
            "Customer message / assessment / questionnaire → preserve source",
            "Pesan / asesmen / kuesioner → simpan sumber",
            "客户消息／测评／问卷 → 保留来源",
          ),
          w(
            "Known visitor → continue; conflicting identity → separate safely",
            "Pengunjung dikenal → lanjut; identitas bentrok → pisahkan aman",
            "已知访客 → 自动续记；身份冲突 → 安全分开",
          ),
          w(
            "Sales records freely → optionally links evidence to a task",
            "Sales bebas mencatat → boleh menautkan bukti ke tugas",
            "销售随时记录 → 按需关联任务",
          ),
          w(
            "Same request → supplement; independent request → independent task",
            "Permintaan sama → tambah bukti; permintaan mandiri → tugas mandiri",
            "同一事项 → 补充；独立事项 → 新任务",
          ),
          w(
            "Reschedule retains original deadline; replace retains old task",
            "Jadwal ulang mempertahankan tenggat awal; penggantian menyimpan tugas lama",
            "改期保留原期限；替代保留原任务",
          ),
          w(
            "Explicit completion → only selected tasks and their queued notices",
            "Penyelesaian eksplisit → hanya tugas terpilih dan notifikasi antreannya",
            "明确完成 → 仅选定任务及其待发通知",
          ),
        ],
      },

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
    title: [
      "Notification routing, delivery and audit",
      "Perutean, pengiriman, dan audit notifikasi",
      "通知路由、发送与审计",
    ],
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
            "依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。",
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
    title: [
      "Sales and marketing metric definitions",
      "Definisi metrik penjualan dan pemasaran",
      "销售与营销指标口径",
    ],
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
            "Customer overview: current filtered permission-scoped cohort",
            "Ringkasan pelanggan: kelompok terfilter sesuai izin",
            "客户概况：权限内的当前筛选客户",
          ),
          w(
            "First sales outreach: registration → actual occurrence",
            "Kontak aktif pertama: pendaftaran → waktu kejadian",
            "首次销售主动联系：登记 → 实际发生时间",
          ),
          w(
            "Successful communication: Connected records; separate from attempts",
            "Komunikasi berhasil: catatan tersambung/dibalas; terpisah dari upaya",
            "有效沟通：已接通记录，与尝试分别统计",
          ),
          w(
            "Overdue: pending first-contact requirement with known past deadline",
            "Terlambat: kontak pertama belum selesai dengan tenggat lampau",
            "首次联系逾期：有已知过去期限的未完成首次要求",
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
          w(
            "Non-campaign source is a permanent, read-only system source with internal ID organic. It means no specific campaign was recorded at first registration, not verified organic search or unpaid traffic. UTM parameters without a campaign code do not change this default. /chat, /chat?c=home and /chat?c=organic are attributed to it for new registrations. Other campaign IDs remain separate; existing first-touch attribution is retained. Link opens are not unique visitors or confirmed attendance.",
            "Sumber non-kampanye adalah kelompok atribusi sistem permanen dan hanya-baca dengan ID organic. Registrasi baru dari /chat, /chat?c=home, dan /chat?c=organic masuk ke kelompok ini. Ini tidak membuktikan pencarian organik atau lalu lintas tanpa biaya; iklan tanpa c juga dapat masuk. Kode kampanye lain tetap terpisah dan atribusi pertama dipertahankan. Pembukaan tautan bukan pengunjung unik atau kehadiran terkonfirmasi.",
            "非活动来源是永久只读的系统归因分组，内部ID仍为organic。新客户从/chat、/chat?c=home、/chat?c=organic登记时统一归入；它不证明自然搜索或免费流量，缺少c的广告也可能归入。其他活动码独立统计，已有首次归因保留。链接打开不等于独立访客或确认到场。",
          ),
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
    title: [
      "AI consultation and assessment evidence",
      "Konsultasi AI dan bukti asesmen",
      "AI咨询与测评依据",
    ],
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
            "Self-reported: customer evidence under Assessment evidence and history, not a test result; do not assume it predates the test",
            "Laporan pelanggan: bukti di Bukti dan riwayat asesmen, bukan hasil asesmen; jangan menganggapnya mendahului tes",
            "自报：收在测评依据与历史记录，不是测评结果；不假定早于测评",
          ),
          w(
            "Quick: tentative learning starting point",
            "Cepat: titik awal belajar sementara",
            "快速测评：暂定学习起点",
          ),
          w(
            "Full: saved HSK criteria met on this assessment, not a complete proficiency claim or official certificate",
            "Lengkap: kriteria HSK tersimpan pada asesmen terpenuhi, bukan klaim kemampuan lengkap atau sertifikat resmi",
            "完整测评：本卷已保存 HSK 标准的达成情况，不代表完整能力或官方证书",
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
        title: w(
          "Storage and access boundaries",
          "Batas penyimpanan dan akses",
          "存储与权限边界",
        ),
        items: [
          w(
            "MySQL stores CRM business records: customers, messages, tasks, contact records and notification audit.",
            "MySQL menyimpan catatan bisnis CRM: pelanggan, pesan, tugas, catatan kontak, dan audit notifikasi.",
            "MySQL保存CRM业务记录，包括客户、消息、任务、联系记录与通知审计。",
          ),
          w(
            "Static JSON stores questions and translations. Updating explanatory copy does not change assessment scoring rules or historical results.",
            "JSON statis menyimpan soal dan terjemahan. Pembaruan penjelasan tidak mengubah aturan skor asesmen atau hasil historis.",
            "静态JSON保存题库与三语文案；修改解释文案不改变测评评分规则或历史结果。",
          ),
          w(
            "The server enforces permissions and data scopes. Interface controls and documentation do not grant access.",
            "Server menerapkan izin dan cakupan data. Kontrol antarmuka dan dokumentasi tidak memberikan akses.",
            "权限和数据范围由服务端执行；界面控件与文档说明本身不授予权限。",
          ),
        ],
      },
      {
        kind: "example",
        title: w(
          "System request receipts",
          "Konfirmasi permintaan sistem",
          "系统请求回执",
        ),
        items: [
          w(
            "Request acknowledgements are stored in MySQL messages, linked by conversation_id to conversations. content keeps the original response; metadata.followupAction identifies handoff, booking or enrollment and metadata.taskId links the follow-up task. Older acknowledgements can have assistant as the stored role; request metadata distinguishes them from AI answers. Conversations shows a compact reference to the single Follow-up task workbench and keeps original confirmations together in an expandable history. metadata.taskOperation records created or supplemented for new requests; older operations use saved source identifiers when sufficient, otherwise remain unknown. Current status comes from followup_tasks, never from the historical response text. Presentation changes do not relocate or rewrite these records.",
            "Konfirmasi permintaan tersimpan di messages pada MySQL, ditautkan ke conversations melalui conversation_id. content menyimpan respons asli; metadata.followupAction menandai handoff, booking, atau enrollment dan metadata.taskId menautkan tugas. Konfirmasi lama dapat memiliki peran assistant; metadata permintaan membedakannya dari jawaban AI. Percakapan menampilkan referensi ringkas ke daftar tugas tunggal di Tindak lanjut dan menyimpan konfirmasi asli bersama dalam riwayat yang dapat dibuka. metadata.taskOperation mencatat created atau supplemented untuk permintaan baru; operasi lama memakai referensi sumber jika cukup, atau tetap tidak diketahui. Status saat ini berasal dari followup_tasks, bukan teks respons historis. Perubahan tampilan tidak memindahkan atau menulis ulang catatan.",
            "请求回执保存在MySQL的messages中，通过conversation_id关联conversations。content保留原始回复，metadata.followupAction标识转人工、预约或报名请求，metadata.taskId关联跟进任务。部分旧回执的存储角色是assistant，界面依据请求元信息将其区分为系统事件，而非AI回答。对话页仅展示指向跟进页统一任务列表的引用，原始确认集中收在可展开历史中。新请求的metadata.taskOperation记录新建或补充；旧记录只在来源标识足够时判断，否则不猜测。当前状态读取followup_tasks，不从历史回复文字推断。展示调整不会搬移或改写这些记录。",
          ),
          w(
            "Explicit request → saved source message and system acknowledgement → create or reuse a follow-up task → sales handles the task. An acknowledgement proves receipt only. Each new same-kind request adds task.request_evidence in crm_facts; an unfinished task keeps its deadline. Only a newly created request task emits handoff.requested, booking.requested or enrollment.requested in outbox for notification policy evaluation. Viewing messages does not complete tasks. Ordinary course questions stay in AI consultation and may become information for review, without an automatic booking or enrollment task.",
            "Gunakan fakta pelanggan, bukti asli, dan catatan tindakan. Informasi tidak membuat tugas dan tidak memiliki konfirmasi membaca atau daftar penyelesaian.",
            "明确请求 → 保存客户原话和系统确认 → 新建或复用跟进任务 → 销售处理。确认消息只证明请求已收到。同类补充请求在crm_facts中追加task.request_evidence，未完成任务保留截止时间；只有新建请求任务才在outbox写入handoff.requested、booking.requested或enrollment.requested，供通知策略判断。查看消息不完成任务。普通课程咨询继续由AI回答，可形成待核实信息，不自动成为预约或报名任务。",
          ),
        ],
      },
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

for(const chapter of systemChapters){const mapping:Record<string,number[]>={entities:[0,2,4,6],"tasks-sla":[0,2,6],"notification-system":[4,8]};const indexes=mapping[chapter.key];if(indexes){chapter.intro=simplifiedFollowupRows[indexes[0]+1] as unknown as Words;chapter.blocks=indexes.map(i=>({kind:'flow',title:simplifiedFollowupRows[i] as unknown as Words,items:[simplifiedFollowupRows[i+1] as unknown as Words]}));}}

for(const c of systemChapters){if(c.key==="entities")c.blocks.push({kind:"table",title:["Data and responsibility","Data dan tanggung jawab","数据与职责"],items:[simplifiedFollowupRows[1],simplifiedFollowupRows[5],simplifiedFollowupRows[7]] as unknown as Words[]});}

for(const c of systemChapters){if(c.key==="tasks-sla")c.title=["First follow-up, information and agreements","Tindak lanjut pertama, informasi dan kesepakatan","首次跟进、重要提示与客户约定"];}

// Current persistence explanation: request evidence never manufactures a task.
for(const chapter of systemChapters){if(chapter.key!=='data-implementation')continue;const rewrite=(value:any):any=>{if(Array.isArray(value)&&value.length===3&&value.every(v=>typeof v==='string')){if(value[0].startsWith('Request acknowledgements are stored'))return ['MySQL messages preserve original request text and system acknowledgement. crm_engagements stores the pending/handled request and source identifiers; crm_facts stores human updates. metadata.taskOperation is recorded and taskId is null for new requests. Do not infer business completion from acknowledgement text.','Pesan MySQL menyimpan permintaan asli dan konfirmasi sistem. crm_engagements menyimpan status pending/handled dan referensi sumber; crm_facts menyimpan pembaruan staf. Permintaan baru memakai metadata.taskOperation recorded dan taskId null. Konfirmasi bukan bukti urusan selesai.','MySQL messages保留客户请求原文及系统回执；crm_engagements保存待回应／已回应状态和来源标识，crm_facts保存人工更新。新请求的metadata.taskOperation为recorded，taskId为空；系统回执不证明业务完成。'];if(value[0].startsWith('Explicit request →'))return ['Explicit request → preserve original evidence and acknowledge receipt → show important information → staff record what actually happened and explicitly confirm a real response. Reading does not answer a request. Only registration creates the first-contact requirement; later requests never create another task.',"Gunakan fakta pelanggan, bukti asli, dan catatan tindakan. Informasi tidak membuat tugas dan tidak memiliki konfirmasi membaca atau daftar penyelesaian.",'明确请求→保存原文并确认收到→展示重要提示→销售记录实际事实，并明确确认真实回应。阅读不等于回应；只有首次登记创建首次联系要求，后续请求不再创建任务。'];if(value[0].startsWith('Three open tasks:'))return ['One first-contact requirement: actual contact processes it once. Date-only and exact-time agreements coexist as optional facts, never extra tasks. Retrying the same request returns the saved outcome without duplicate records.','Satu kewajiban kontak pertama diproses sekali lewat kontak nyata. Kesepakatan bertanggal atau berjam dapat berdampingan sebagai fakta opsional, bukan tugas tambahan. ID permintaan yang sama mengembalikan hasil tersimpan tanpa duplikasi.','只有一个首次联系要求，真实联系后处理一次。日期约定和明确时刻约定作为选填事实并存，不生成额外任务；相同请求重试返回原保存结果，不重复记录。'];}if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));return value;};chapter.blocks=chapter.blocks.map(rewrite);}

for(const chapter of systemChapters){
 if(chapter.key==='tasks-sla')chapter.blocks.push({kind:'example',title:w('Viewed, replied and first follow-up are separate',"Gunakan fakta pelanggan, bukti asli, dan catatan tindakan. Informasi tidak membuat tugas dan tidak memiliki konfirmasi membaca atau daftar penyelesaian.","依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。"),items:[w("Use customer facts, original evidence and recorded actions. Information creates no tasks and has no reading or completion checklist.","Gunakan fakta pelanggan, bukti asli, dan catatan tindakan. Informasi tidak membuat tugas dan tidak memiliki konfirmasi membaca atau daftar penyelesaian.","依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。")]});
 if(chapter.key==='data-implementation')chapter.technical=chapter.technical.map((v,i)=>v+' '+["Use customer facts, original evidence and recorded actions. Information creates no tasks and has no reading or completion checklist.","Use customer facts, original evidence and recorded actions. Information creates no tasks and has no reading or completion checklist.","依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。"][i]) as unknown as Words;
}
