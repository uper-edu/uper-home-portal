import type { Words } from "./CrmSystemGuide";
const w = (en: string, id: string, zh: string): Words => [en, id, zh];
// Business descriptions supplement the generated declaration index; they contain no customer values.
const meanings: Record<string, Words> = {
  original_due_at:w("Original deadline retained across rescheduling","Tenggat awal dipertahankan saat jadwal ulang","改期后仍保留的原始截止时间"),
  scheduled_at:w("Revised execution appointment, not a rewritten SLA","Janji pelaksanaan baru, bukan SLA yang ditulis ulang","改约执行时间，不重写原 SLA"),
  timing_kind:w("Response deadline, appointment or internal review","Batas respons, janji, atau tinjauan internal","响应截止、约定执行或内部复查"),
  request_key:w("Stable request identity; task type alone does not deduplicate","Identitas permintaan tetap; jenis tugas saja bukan dasar deduplikasi","稳定请求标识，不单凭任务类型去重"),
  fingerprint:w("Submission digest detects changed retries","Ringkasan kiriman mendeteksi perubahan saat ulang","提交摘要，用于识别重试内容冲突"),

  maxretriesbeforenurture: w(
    "Configurable cadence/filter threshold; full classification separately uses its fixed threshold of 3",
    "Ambang ritme/filter yang dapat dikonfigurasi; klasifikasi lengkap memakai ambang tetap 3",
    "可配置节奏／筛选阈值，完整分类另外使用固定阈值 3",
  ),
  nextdaygracetime: w(
    "Legacy cadence parameter; not the server task deadline algorithm",
    "Parameter ritme lama; bukan algoritme tenggat tugas server",
    "旧节奏参数，不是服务端任务期限算法",
  ),
  reactivatedresponse: w(
    "Saved reactivation policy duration; inspect task implementation before assuming automatic scheduling",
    "Durasi kebijakan aktivasi kembali tersimpan; periksa implementasi tugas sebelum menganggap penjadwalan otomatis",
    "已保存复活响应时长，不能据此假定自动调度已实现",
  ),
  id: w(
    "Stable object identifier; not a customer name",
    "Identitas objek tetap; bukan nama pelanggan",
    "稳定对象标识，不是客户姓名",
  ),
  businessnumber: w(
    "Display number allocated in the operating timezone",
    "Nomor tampilan ditetapkan menurut zona waktu operasional",
    "按运营时区分配的显示编号",
  ),
  fullname: w(
    "Customer-entered name, preserved verbatim",
    "Nama pelanggan dipertahankan sesuai isian",
    "客户填写姓名，保留原文",
  ),
  whatsapp: w(
    "Contact number; opening a tool is not contact evidence",
    "Nomor kontak; membuka alat bukan bukti kontak",
    "联系号码，打开工具不构成联系证据",
  ),
  email: w(
    "Contact address; not identity verification",
    "Alamat kontak; bukan verifikasi identitas",
    "联系邮箱，不构成身份验证",
  ),
  owner: w(
    "Customer responsibility; separate from task responsibility",
    "Penanggung jawab pelanggan; terpisah dari tugas",
    "客户归属，与任务负责人区分",
  ),
  ownerid: w(
    "Responsible employee reference; null means unassigned",
    "Referensi staf penanggung jawab; null berarti belum ditugaskan",
    "责任员工引用，空值表示未分配",
  ),
  ownerchangedat: w(
    "Recorded ownership-change time; missing time stays unknown",
    "Waktu perubahan penanggung jawab; waktu kosong tetap tidak diketahui",
    "归属变化记录时间，缺失保持未知",
  ),
  currentstage: w(
    "Staff-recorded sales progress; no automatic payment proof",
    "Tahap penjualan tercatat; bukan bukti pembayaran otomatis",
    "人工记录销售进展，不自动证明付款",
  ),
  stageupdatedat: w(
    "Stage-change timestamp used for stage duration",
    "Waktu perubahan tahap untuk menghitung durasi",
    "阶段变化时间，用于阶段停留统计",
  ),
  tier: w(
    "Current effective customer group",
    "Kelompok pelanggan yang berlaku",
    "当前生效客户分组",
  ),
  tierpredicted: w(
    "Rule prediction retained as evidence",
    "Prediksi aturan disimpan sebagai bukti",
    "规则预测，作为依据保存",
  ),
  tierconfirmed: w(
    "Sales-confirmed classification; separate from prediction",
    "Klasifikasi terkonfirmasi staf; terpisah dari prediksi",
    "人工确认分组，独立于预测",
  ),
  tiersource: w(
    "Why the effective group was assigned",
    "Dasar penetapan kelompok berlaku",
    "生效分组的判定来源",
  ),
  tierupdatedat: w(
    "Classification update time",
    "Waktu pembaruan klasifikasi",
    "分组更新时间",
  ),
  goal: w(
    "Primary stated learning goal",
    "Tujuan belajar utama yang dinyatakan",
    "客户表达的主要学习目标",
  ),
  goals: w(
    "All recorded learning goals",
    "Semua tujuan belajar tercatat",
    "全部已记录学习目标",
  ),
  city: w(
    "Recorded city used in learning and classification",
    "Kota tercatat untuk kebutuhan dan klasifikasi",
    "学习需求及分类使用的城市",
  ),
  mode: w(
    "Learning format or context-specific execution mode",
    "Format belajar atau mode pelaksanaan sesuai objek",
    "授课方式或所属对象的执行模式",
  ),
  currentstatus: w(
    "Customer occupational / student identity",
    "Identitas pekerjaan atau pelajar",
    "客户职业／学员身份",
  ),
  reportedlevel: w(
    "Self-reported Chinese foundation",
    "Dasar Mandarin yang dilaporkan sendiri",
    "自报中文基础",
  ),
  levelstate: w(
    "Derived foundation state; not an exam certificate",
    "Status dasar turunan; bukan sertifikat ujian",
    "推导基础状态，不是考试证书",
  ),
  levelconfirmed: w(
    "Recorded placement conclusion; inspect its source",
    "Kesimpulan penempatan; periksa sumbernya",
    "已记录定级结论，须核查来源",
  ),
  levelsource: w(
    "Evidence source of the recorded level",
    "Sumber bukti tingkat tercatat",
    "水平结论的依据来源",
  ),
  flag: w(
    "Assessment routing flag, not task completion",
    "Penanda alur asesmen, bukan penyelesaian tugas",
    "测评路由标记，不是任务完成",
  ),
  buyingsignal: w(
    "Recorded buying evidence; no new signal does not erase history",
    "Bukti pembelian tercatat; tanpa sinyal baru tidak menghapus riwayat",
    "已记录购买依据，无新信号不清除历史",
  ),
  buyingsignals: w(
    "Retained buying evidence list",
    "Daftar bukti pembelian yang dipertahankan",
    "已保留购买依据列表",
  ),
  connectstatus: w(
    "Human contact result; historical intention is not successful contact",
    "Hasil kontak manusia; niat historis bukan kontak berhasil",
    "人工联系结果，历史意向不等于有效联系",
  ),
  touchcount: w(
    "Legacy attempt counter used by existing rules, not successful contacts",
    "Jumlah upaya lama untuk aturan; bukan kontak berhasil",
    "既有规则使用的触达计数，不等于接通次数",
  ),
  lastcontactedat: w(
    "Existing contact-attempt timestamp; see separate successful-contact evidence",
    "Waktu upaya kontak lama; bukti kontak berhasil terpisah",
    "既有联系尝试时间，有效沟通另计",
  ),
  communicationlanguage: w(
    "Confirmed customer language, independent of interface language",
    "Bahasa pelanggan terkonfirmasi, terpisah dari antarmuka",
    "客户沟通语言，独立于界面语言",
  ),
  contactarrangement: w(
    "Active, waiting, nurturing or stopped; retains existing task deadlines",
    "Aktif, menunggu, pembinaan, berhenti; tenggat tugas lama tetap",
    "正常、等待、培育、停止；已有任务期限保留",
  ),
  reviewat: w(
    "Explicit future internal review time",
    "Waktu tinjauan internal mendatang yang dipilih",
    "明确指定的未来内部复查时间",
  ),
  reason: w(
    "Original staff explanation or technical reason; context defines which",
    "Penjelasan asli staf atau alasan teknis menurut objek",
    "员工原始说明或技术原因，依所属对象区分",
  ),
  version: w(
    "Saved revision used for audit / conflict checking",
    "Revisi tersimpan untuk audit / pemeriksaan konflik",
    "保存版本，用于审计／冲突校验",
  ),
  summary: w(
    "Original human communication summary; not AI rewritten",
    "Ringkasan komunikasi asli staf; tidak ditulis ulang AI",
    "人工沟通摘要原文，不由 AI 改写",
  ),
  staffname: w(
    "Recorded employee name; server-authenticated actor controls new writes",
    "Nama staf tercatat; penulisan baru memakai identitas server",
    "记录员工姓名，新写入以服务端认证人为准",
  ),
  recordkind: w(
    "Contact versus non-contact processing; only contact contributes to attempts",
    "Kontak atau penanganan nonkontak; hanya kontak menambah upaya",
    "联系／非联系处理，只有联系进入尝试统计",
  ),
  completetaskids: w(
    "Explicitly selected tasks completed by this record",
    "Tugas yang dipilih eksplisit untuk diselesaikan",
    "本次明确选择完成的任务",
  ),
  requestid: w(
    "Idempotency key reused when retrying the same submission",
    "Kunci idempotensi untuk percobaan ulang kiriman yang sama",
    "同一提交重试复用的幂等键",
  ),
  nextaction: w(
    "Recorded next action; current task action has priority in the worklist",
    "Tindakan berikutnya; tindakan tugas saat ini diprioritaskan",
    "已记录下一步，工作列表优先使用当前任务动作",
  ),
  nextfollowupat: w(
    "Explicit follow-up arrangement time, not an inferred promise",
    "Waktu tindak lanjut eksplisit, bukan janji yang disimpulkan",
    "明确安排时间，不推断客户承诺",
  ),
  sladuetime: w(
    "Customer-level legacy SLA value; current task deadline is authoritative",
    "Nilai SLA lama pada pelanggan; tenggat tugas saat ini menjadi acuan",
    "客户级旧 SLA 值，当前任务期限为准",
  ),
  dueat: w(
    "Persisted task / job deadline; no silent recalculation",
    "Tenggat tugas / pengiriman tersimpan; tidak dihitung ulang diam-diam",
    "持久任务／发送期限，不静默重算",
  ),
  attendanceconfirmed: w(
    "Staff confirmation of participation; not inferred from registration",
    "Konfirmasi partisipasi staf; bukan dari registrasi",
    "员工确认参与，不从登记推断",
  ),
  attendancerecords: w(
    "Campaign-linked participation evidence and correction history",
    "Bukti partisipasi terkait kampanye serta riwayat koreksi",
    "活动参与依据及纠正历史",
  ),
  campaignid: w(
    "Linked campaign identifier; acquisition and participation differ",
    "Identitas kampanye terkait; akuisisi dan partisipasi berbeda",
    "关联活动标识，获客与参与分别记录",
  ),
  campaign: w(
    "Recorded campaign attribution",
    "Atribusi kampanye tercatat",
    "已记录活动归因",
  ),
  entrypoint: w(
    "Recorded acquisition entry",
    "Pintu akuisisi tercatat",
    "已记录获客入口",
  ),
  placement: w(
    "Entry placement / marketing position",
    "Penempatan tautan pemasaran",
    "入口投放位置",
  ),
  quizscore: w(
    "Recorded paper score; interpret with maximum and version",
    "Skor tes tercatat; baca bersama maksimum dan versi",
    "本卷分数，须结合满分与版本",
  ),
  quizmaxscore: w(
    "Maximum for this paper, not another exam",
    "Skor maksimum tes ini, bukan ujian lain",
    "本卷满分，不与其他考试混用",
  ),
  latestassessment: w(
    "Saved assessment result and provenance; scoring unchanged",
    "Hasil dan sumber asesmen tersimpan; penilaian tidak diubah",
    "已保存测评结果与依据，评分未改",
  ),
  assessmentprovenance: w(
    "Server-recomputed or legacy unverified evidence",
    "Bukti dihitung ulang server atau lama belum terverifikasi",
    "服务端重算或历史未核验依据",
  ),
  impressions: w(
    "Link opens including repeats; not unique people",
    "Pembukaan tautan termasuk berulang; bukan orang unik",
    "含重复的链接打开次数，不是独立访客",
  ),
  leadscount: w(
    "Saved first-attributed customer registrations",
    "Registrasi pelanggan tersimpan dengan atribusi pertama",
    "首次归因的已保存登记客户数",
  ),
  assessedcount: w(
    "Customers with saved server assessment evidence",
    "Pelanggan dengan bukti asesmen server tersimpan",
    "有已保存服务端测评依据的客户数",
  ),
  enrolledcount: w(
    "Recorded enrollments; not verified payments",
    "Pendaftaran kelas tercatat; bukan pembayaran terverifikasi",
    "已记录报名，不证明已核验缴费",
  ),
  conversionrate: w(
    "Enrollment share among attributed registrations; no denominator means unavailable",
    "Proporsi pendaftaran kelas dari registrasi terkait; tanpa penyebut tidak tersedia",
    "归因登记客户中的报名占比，无分母不可计算",
  ),
  revenue: w(
    "Recorded amount; not verified cash receipt",
    "Nominal tercatat; bukan penerimaan terverifikasi",
    "登记金额，不是已核验收款",
  ),
  totalrevenue: w(
    "Sum of recorded amounts only",
    "Jumlah nominal tercatat saja",
    "仅汇总登记金额",
  ),
  budgetcost: w(
    "Planned budget; not audited actual spend",
    "Anggaran rencana; bukan biaya aktual terverifikasi",
    "计划预算，不是已核验实际花费",
  ),
  roi: w(
    "Unavailable without verified cost and return; not a profit promise",
    "Tidak tersedia tanpa biaya/hasil terverifikasi; bukan janji laba",
    "未核验成本与收益时不可得，不承诺利润",
  ),
  status: w(
    "State of this object; task, message and campaign states are distinct",
    "Status objek ini; status tugas, pesan, kampanye berbeda",
    "所属对象状态，任务、消息与活动状态不同",
  ),
  state: w(
    "Saved processing state; inspect the relevant state definitions",
    "Status pemrosesan tersimpan; lihat definisi status terkait",
    "已保存处理状态，按所属对象定义理解",
  ),
  content: w(
    "Message text or stored content; preserve original evidence",
    "Teks pesan atau konten tersimpan; pertahankan bukti asli",
    "消息正文或存储内容，保留原始证据",
  ),
  timestamp: w(
    "Original / record time according to object; unknown times not invented",
    "Waktu asli / pencatatan sesuai objek; waktu hilang tidak dibuat",
    "依对象区分原始／记录时间，缺失不补造",
  ),
  timestampknown: w(
    "Whether original time is reliable; false forbids placeholder display",
    "Apakah waktu asli terpercaya; false melarang waktu pengganti",
    "原始时间是否可信，否时不显示占位日期",
  ),
  passwordhash: w(
    "One-way password hash; never a plaintext password or browser field",
    "Hash kata sandi satu arah; bukan kata sandi asli atau kolom browser",
    "单向密码哈希，不是明文密码或浏览器字段",
  ),
  tokenhash: w(
    "Session token hash; never return it as a usable credential",
    "Hash token sesi; jangan kembalikan sebagai kredensial",
    "会话令牌哈希，不返回为可用凭证",
  ),
  webhookenv: w(
    "Server environment variable name only; URL is not in this field",
    "Nama variabel lingkungan server saja; bukan URL",
    "仅服务端环境变量名称，此字段不是 URL",
  ),
  snapshot: w(
    "Immutable saved notification rule / context for delivery audit",
    "Snapshot aturan / konteks notifikasi untuk audit pengiriman",
    "保存的通知规则／上下文快照，供发送审计",
  ),
  leaseuntil: w(
    "Worker claim expiry for recovery after a stopped worker",
    "Batas sewa worker untuk pemulihan setelah terhenti",
    "后台领取租约到期时间，用于中断恢复",
  ),
  effectiveat: w(
    "New-rule activation boundary; not a historical replay instruction",
    "Batas aktivasi aturan baru; bukan perintah kirim ulang riwayat",
    "新规则生效边界，不代表重放历史",
  ),
};
export function dictionaryMeaning(row: {
  key: string;
  layer: string;
  object: string;
  source: string;
}): Words {
  const key = row.key.split(".").at(-1)!.replaceAll("_", "").toLowerCase();
  if (meanings[key]) return meanings[key];
  if (/at$|time$|date$/.test(key))
    return w(
      "Recorded time / calendar parameter; semantics depend on its owning object",
      "Waktu tercatat / parameter kalender; makna menurut objeknya",
      "记录时间／日历参数，须按所属对象理解",
    );
  if (/id$/.test(key))
    return w(
      "Identifier linking this object to the named entity",
      "Identitas yang menautkan objek ke entitas tersebut",
      "关联到所指对象的标识",
    );
  if (/count$|total$|correct$/.test(key))
    return w(
      "Count for the declared evidence; missing is not zero",
      "Jumlah bukti yang dideklarasikan; kosong bukan nol",
      "所属依据的计数，缺失不是零",
    );
  return w(
    "Declared property of this object; read with the owning contract, values and implementation reference below. It is not a new user input requirement.",
    "Properti objek ini; baca bersama kontrak, nilai, dan referensi implementasinya. Ini bukan kewajiban isian baru.",
    "所属对象的声明属性，须结合契约、取值和下方实现依据阅读；不代表新增的用户必填字段。",
  );
}
export function dictionaryWriter(row: {
  layer: string;
  object: string;
  source: string;
}): Words {
  const object = row.object;
  if (/Campaign|Utm|Assets|trial_campaigns/.test(object))
    return w(
      "Managers save campaign settings; statistics are server projections",
      "Manajer menyimpan kampanye; statistik dihitung server",
      "管理者保存活动配置，统计由服务端投影",
    );
  if (
    /Policy|Rule|Duration|notification_(rules|channels)|rule_versions|portal_settings/.test(
      object,
    )
  )
    return w(
      "Authorized configuration saves; worker uses saved versions, not live browser drafts",
      "Penyimpanan konfigurasi berizin; worker memakai versi tersimpan, bukan draf",
      "有权限的配置保存；后台使用保存版本，不使用浏览器草稿",
    );
  if (/Employee|Platform|crm_|trial_members/.test(object))
    return w(
      "Server authentication / authorized account management; browser role claims are not trusted",
      "Autentikasi server / pengelolaan akun berizin; klaim peran browser tidak dipercaya",
      "服务端认证／授权账号管理，不信任浏览器自报角色",
    );
  if (
    /notification_jobs|notification_inbox|outbox|portal_audit|migration|counter|versions/.test(
      object,
    )
  )
    return w(
      "Server transaction or worker transition; not editable customer facts",
      "Transaksi server atau transisi worker; bukan fakta pelanggan yang dapat diedit",
      "服务端事务或后台状态转换，不是可随意编辑的客户事实",
    );
  return w(
    "Owning server write / projection after visitor or authorized staff action; viewing documentation never updates it",
    "Penulisan / proyeksi server setelah aksi pengunjung atau staf berizin; membaca dokumentasi tidak memperbarui",
    "访客或授权员工操作后，由所属服务端写入／投影；阅读文档不更新该字段",
  );
}
