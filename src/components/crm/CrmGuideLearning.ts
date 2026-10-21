import { panoramaLesson } from "./CrmPanoramaContent";
import type { Words } from "./CrmSystemGuide";

export type LearningNode = { label: Words; detail: Words };
export type GuideLesson = {
  title: Words;
  answer: Words;
  value: Words;
  nodes: LearningNode[];
  caption: Words;
  example: Words;
  boundary: Words;
  shape: "flow" | "relationship" | "comparison" | "procedure";
};
const w = (en: string, id: string, zh: string): Words => [en, id, zh];
const n = (label: Words, detail: Words): LearningNode => ({ label, detail });
const lesson = (
  title: Words,
  answer: Words,
  value: Words,
  nodes: LearningNode[],
  caption: Words,
  example: Words,
  boundary: Words,
  shape: GuideLesson["shape"] = "flow",
): GuideLesson => ({
  title,
  answer,
  value,
  nodes,
  caption,
  example,
  boundary,
  shape,
});

export const guideLessons: Record<string, GuideLesson> = {
  panorama: panoramaLesson,
  entities: lesson(
    w(
      "One customer, several kinds of evidence",
      "Satu pelanggan, beberapa jenis bukti",
      "一个客户，关联多种独立记录",
    ),
    w(
      "A lead is a saved potential-customer record, not proof of enrollment. Conversations, tasks and contact records answer different questions.",
      "Lead adalah catatan calon pelanggan tersimpan, bukan bukti pendaftaran kelas. Percakapan, tugas, dan catatan kontak menjawab pertanyaan berbeda.",
      "客户记录代表已保存的潜在客户，不等于已报名学员。会话、任务和联系记录分别回答不同的问题。",
    ),
    w(
      "Keep these objects separate to avoid counting a message as a completed task or treating similar contact details as proven identity.",
      "Pisahkan objek ini agar pesan tidak dianggap sebagai tugas selesai dan kontak serupa tidak dianggap membuktikan identitas.",
      "把对象分清，才能避免“看过消息就算处理”和“同一电话就自动合并”等误判。",
    ),
    [
      n(
        w("Conversations → messages", "Percakapan → pesan", "会话 → 消息"),
        w(
          "What was said, in which entry session, and at what recorded time? One customer can have multiple conversations.",
          "Apa yang dikatakan, melalui sesi mana, dan kapan dicatat? Satu pelanggan dapat memiliki beberapa percakapan.",
          "回答说了什么、来自哪个入口会话、何时记录；同一客户可有多个会话。",
        ),
      ),
      n(
        w("Tasks → outcomes", "Tugas → hasil", "任务 → 处理结果"),
        w(
          "What action, who, and which deadline? Each task has its own state and evidence.",
          "Tindakan apa, oleh siapa, dengan tenggat kapan? Tiap tugas memiliki status dan bukti sendiri.",
          "回答做什么、由谁做、何时完成；每项任务分别保存状态和依据。",
        ),
      ),
      n(
        w(
          "Contact records → facts",
          "Catatan kontak → fakta",
          "联系记录 → 实际事实",
        ),
        w(
          "What did staff try or confirm? A contact record can reference a task, but does not complete it implicitly.",
          "Apa yang dicoba atau dikonfirmasi staf? Catatan kontak dapat merujuk tugas, tetapi tidak menyelesaikannya otomatis.",
          "回答员工尝试了什么、确认了什么；可以关联任务，但记录联系不会隐式完成任务。",
        ),
      ),
    ],
    w(
      "All three connect to the customer without becoming the same record.",
      "Ketiganya terhubung ke pelanggan tanpa menjadi catatan yang sama.",
      "三类记录都属于客户，但不能互相替代。",
    ),
    w(
      "Two sessions contain the same sentence. Different message IDs keep both originals. A same-kind open request may still reuse one task.",
      "Dua sesi berisi kalimat sama. ID pesan berbeda mempertahankan kedua teks. Permintaan terbuka sejenis dapat memakai satu tugas.",
      "两个会话出现相同句子，不同消息 ID 保留各自原文；同类型开放请求仍可能关联同一任务。",
    ),
    w(
      "A known session continues automatically. Phone or email matches create identity candidates. Confirmation links records without merging history or changing owners.",
      "Sesi yang dikenal berlanjut otomatis. Kecocokan telepon atau email menghasilkan kandidat identitas. Konfirmasi menautkan catatan tanpa menggabungkan riwayat atau mengubah penanggung jawab.",
      "已知会话自动续记；电话或邮箱匹配仅产生身份候选。核实建立关系，不合并历史或改变归属。",
    ),
    "relationship",
  ),
  acquisition: lesson(
    w(
      "Acquisition records a path, not a guaranteed funnel",
      "Akuisisi mencatat jalur, bukan corong yang pasti",
      "获客记录来源与行为，不保证逐级转化",
    ),
    w(
      "A campaign identifies the entry source. Registration, assessment, participation and enrollment each need their own evidence.",
      "Kampanye menandai sumber masuk. Registrasi, asesmen, partisipasi, dan pendaftaran kelas membutuhkan bukti masing-masing.",
      "活动标识入口来源；登记、测评、确认参与和报名分别需要自己的证据。",
    ),
    w(
      "You can tell which audience entered and what happened next without falsely calling an online registration an onsite visit.",
      "Anda dapat melihat audiens yang masuk dan hasil berikutnya tanpa menganggap registrasi daring sebagai kunjungan langsung.",
      "这样才能看清获客后发生了什么，而不会把线上登记误当成现场到访。",
    ),
    [
      n(
        w("Campaign entry", "Pintu kampanye", "活动入口"),
        w(
          "A campaign is the marketing initiative, not a single channel. Its c code groups several saved promotion entries. Each p belongs to that campaign and retains its source, medium and customer language. UTM fields are distribution labels, not proof of the actual referrer. Repeated opens are not unique people.",
          "Kampanye adalah inisiatif pemasaran, bukan satu kanal. Kode c mengelompokkan beberapa entri promosi tersimpan. Setiap p terkait dengan kampanye itu dan menyimpan sumber, media, serta bahasa pelanggan. UTM adalah label distribusi, bukan bukti perujuk sebenarnya. Pembukaan berulang bukan orang unik.",
          "活动是营销项目，不是单一渠道。c活动码下可有多个已保存推广入口，每个p属于该活动，并保留来源、推广方式和客户页面语言。UTM是投放标签，不证明真实来源；重复访问不等于独立人数。",
        ),
      ),
      n(
        w("Saved customer", "Pelanggan tersimpan", "保存客户"),
        w(
          "Registration creates the saved lead. First attribution stays separate from each conversation source.",
          "Registrasi menyimpan calon pelanggan. Atribusi pertama terpisah dari sumber tiap percakapan.",
          "登记成功形成客户记录；首次归因与每次会话来源分开保留。",
        ),
      ),
      n(
        w("Independent outcomes", "Hasil terpisah", "分别确认结果"),
        w(
          "Assessment needs server evidence. Participation needs staff confirmation. Enrollment reflects recorded business status.",
          "Asesmen perlu bukti server. Partisipasi perlu konfirmasi staf. Pendaftaran kelas mengikuti status bisnis tercatat.",
          "测评须有服务端依据；参与须由员工确认；报名统计依据已记录业务状态。",
        ),
      ),
    ],
    w(
      "A customer may skip assessment or participate in a different campaign.",
      "Pelanggan dapat melewati asesmen atau mengikuti kampanye lain.",
      "客户可以跳过测评，也可以参加并非首次获客来源的其他活动。",
    ),
    w(
      "Amelia registers through campaign A and completes an assessment: registrations 1, assessed 1, confirmed participation 0.",
      "Amelia mendaftar melalui kampanye A dan menyelesaikan asesmen: registrasi 1, asesmen 1, partisipasi terkonfirmasi 0.",
      "Amelia 经活动 A 登记并完成测评：登记 1、测评 1、确认参与 0。只有另存参与依据后，参与数才会变化。",
    ),
    w(
      "Non-campaign source groups first registrations without a specific campaign code under the system ID organic. It does not prove organic search or unpaid traffic; an ad link missing its campaign code can also enter this group. Existing first attribution remains. Customer messages and campaign names are not automatically translated.",
      "Sumber non-kampanye mengelompokkan registrasi pertama tanpa kode kampanye tertentu dengan ID sistem organic. Ini bukan bukti pencarian organik atau lalu lintas tanpa biaya; iklan tanpa c juga dapat masuk. Atribusi pertama, pesan pelanggan, dan nama asli dipertahankan.",
      "首次登记无具体活动码的客户归入“非活动来源”，内部ID仍为organic。这不证明自然搜索或免费流量，缺少c的广告也可能归入。已有首次归因、客户消息和活动名称原文保留。",
    ),
  ),
  classification: lesson(
    w(
      "Customer group is a rule result, not a promise",
      "Kelompok pelanggan adalah hasil aturan",
      "客户分组是规则结果，不是成交承诺",
    ),
    w(
      "The current group describes a sales segment. It can change when supported inputs change and classification runs.",
      "Kelompok saat ini menggambarkan segmen penjualan. Nilainya dapat berubah saat input berubah dan klasifikasi dijalankan.",
      "生效分组描述客户所属销售类别；输入发生变化且触发分类计算时，分组可能改变。",
    ),
    w(
      "Use the group to understand the customer. Use current tasks and deadlines to decide immediate work.",
      "Gunakan kelompok untuk memahami pelanggan. Gunakan tugas dan tenggat saat ini untuk memilih pekerjaan segera.",
      "分组帮助理解客户特征，当前任务与期限帮助决定先做什么；高意向不自动表示逾期或需要立即联系。",
    ),
    [
      n(
        w("Registration baseline", "Dasar saat registrasi", "登记基础分类"),
        w(
          "Goal, self-reported foundation, city and format determine a baseline. A near-term HSK plan also affects registration rules.",
          "Tujuan, dasar yang dilaporkan, kota, dan format menentukan dasar. Rencana HSK dekat juga memengaruhi aturan registrasi.",
          "目标、自报基础、城市及授课方式构成基础输入；近期考证计划也影响登记规则。",
        ),
      ),
      n(
        w("Follow-up evaluation", "Evaluasi tindak lanjut", "跟进时重新计算"),
        w(
          "A qualifying contact save runs the full chain: R6 → R1 → R2 → R3 → R4 → R5. Earlier stopping rules take precedence.",
          "Penyimpanan kontak yang memenuhi syarat menjalankan R6 → R1 → R2 → R3 → R4 → R5. Aturan penghenti lebih awal didahulukan.",
          "符合条件的联系保存执行 R6 → R1 → R2 → R3 → R4 → R5；前面的终止规则先命中，后面的就不再决定结果。",
        ),
      ),
      n(
        w(
          "Effective group and basis",
          "Kelompok berlaku dan dasar",
          "生效值与依据",
        ),
        w(
          "An existing sales-confirmed group can remain effective. Rule calculations and saved sources must not be described as AI predictions.",
          "Kelompok yang telah dikonfirmasi sales dapat tetap berlaku. Hasil aturan dan sumber tersimpan bukan prediksi AI.",
          "已有人工确认分组可继续生效；规则计算与已有来源不应称为 AI 预测。",
        ),
      ),
    ],
    w(
      "Rule IDs identify rules. Their numeric order is not their execution priority.",
      "ID menandai aturan. Urutan nomor bukan urutan pelaksanaan.",
      "R1～R6 是规则编号，编号顺序不等于执行优先级。",
    ),
    w(
      "Asked price + No Response + touchCount 3 gives Nurture in the full chain because R6 precedes R1. This does not prove three consecutive unanswered calls.",
      "Tanya harga + No Response + touchCount 3 menghasilkan Pembinaan karena R6 mendahului R1. Ini bukan bukti tiga panggilan berturut-turut tanpa jawaban.",
      "询价＋未回复＋触达计数为 3，在完整规则链中得到培育池，因为 R6 优先于 R1。不能据此声称连续三次电话未接通。",
    ),
    w(
      "The full rule threshold is currently fixed at 3. The configurable retry filter is a different calculation. Viewing or changing language does not reclassify customers.",
      "Ambang aturan penuh saat ini tetap 3. Filter percobaan ulang yang dapat dikonfigurasi adalah perhitungan berbeda. Membaca atau mengganti bahasa tidak menghitung ulang.",
      "完整分类阈值目前固定为 3，可配置重试筛选是另一套计算。查看页面和切换语言不会重算分组；本手册不调整优先级。",
    ),
  ),
  lifecycle: lesson(
    w(
      "Separate progress, contact permission and work",
      "Pisahkan kemajuan, pengaturan kontak, dan tugas",
      "销售进展、联系安排和任务状态分别管理",
    ),
    w(
      "A sales stage says how far the recorded business process has progressed. A contact arrangement controls proactive outreach and review.",
      "Tahap penjualan menunjukkan kemajuan bisnis tercatat. Pengaturan kontak mengatur kontak proaktif dan tinjauan.",
      "销售阶段描述已记录进展；联系安排决定是否主动外联以及何时复查；任务状态描述具体事项是否处理。",
    ),
    w(
      "Waiting should respect the customer without erasing commitments. A closed customer can still have unfinished internal work.",
      "Menunggu menghormati pelanggan tanpa menghapus janji. Pelanggan tertutup tetap dapat memiliki pekerjaan internal.",
      "等待客户时仍保留承诺和追踪依据；客户已成交或关闭，也可能还有未完成的内部事项。",
    ),
    [
      n(
        w("Sales stage", "Tahap penjualan", "销售阶段"),
        w(
          "New, Contacted, assessment or trial stages, Enrolled or Lost. Record a change with evidence, not merely a button click.",
          "Baru, Dihubungi, tahap asesmen atau uji coba, Terdaftar atau Ditutup. Catat perubahan berdasarkan bukti.",
          "待初访、已联系、测评／试听阶段、已报名或关闭；阶段变化须有依据，不能只凭一个动作按钮推断。",
        ),
      ),
      n(
        w("Contact arrangement", "Pengaturan kontak", "联系安排"),
        w(
          "Normal, waiting, nurturing or stopped. Waiting and nurturing need a future review time. Stopping blocks proactive outreach.",
          "Normal, menunggu, pembinaan, atau berhenti. Menunggu dan pembinaan perlu waktu tinjauan. Berhenti memblokir kontak proaktif.",
          "正常、等待、培育或停止；等待和培育需要未来复查时间；停止限制主动外联。",
        ),
      ),
      n(
        w("Task state", "Status tugas", "任务状态"),
        w(
          "Open, completed, cancelled or awaiting historical review. A contact pause does not complete or reschedule business tasks.",
          "Terbuka, selesai, dibatalkan, atau perlu tinjauan historis. Jeda kontak tidak menyelesaikan atau menjadwal ulang tugas bisnis.",
          "开放、完成、取消或历史待确认；暂停联系不会自动完成或改期业务任务。",
        ),
      ),
    ],
    w(
      "One customer can be Contacted, waiting for a reply, and still have an overdue task.",
      "Pelanggan dapat sudah Dihubungi, menunggu balasan, dan tetap memiliki tugas terlambat.",
      "一个客户可以同时是“已联系”“等待回复”且仍有“逾期任务”。",
    ),
    w(
      "Amelia asks for contact next week. Save a reason and review time. The review becoming due asks staff to decide; it does not restore outreach automatically.",
      "Amelia meminta dihubungi minggu depan. Simpan alasan dan waktu tinjauan. Saat jatuh tempo, staf memutuskan, bukan memulihkan kontak otomatis.",
      "Amelia 希望下周再联系：保存原因与复查时间。复查到期只提醒员工决策，不自动恢复主动联系。",
    ),
    w(
      "A new inbound request during waiting needs review. It does not automatically lift a stop-contact instruction. Existing deadlines remain visible.",
      "Permintaan masuk saat menunggu perlu ditinjau. Ini tidak otomatis membatalkan penghentian kontak. Tenggat lama tetap terlihat.",
      "等待期间的新咨询需要核实，但不会自动解除停止联系；既有期限及逾期事实继续保留。",
    ),
    "comparison",
  ),
  "tasks-sla": lesson(
    w(
      "Each task keeps its action, time and outcome",
      "Tiap tugas menyimpan tindakan, waktu, dan hasil",
      "每项任务分别保存动作、期限与结果",
    ),
    w(
      "Service Level Agreement (SLA) settings calculate response deadlines. A task stores a specific action and its time commitment.",
      "Service Level Agreement (SLA) menghitung tenggat respons. Tugas menyimpan tindakan dan komitmen waktunya.",
      "SLA（服务水平协议）配置计算响应期限，任务保存具体动作及其时间承诺。",
    ),
    w(
      "Multiple requests can coexist without losing an earlier promise. Staff can explain exactly what they completed and what remains.",
      "Beberapa permintaan dapat berjalan bersamaan tanpa kehilangan janji sebelumnya. Staf dapat menjelaskan apa yang selesai dan tersisa.",
      "多个事项可以同时推进，旧承诺不会因新消息消失；员工能明确说出完成了哪一项、还剩哪些。",
    ),
    [
      n(
        w(
          "Request or explicit action",
          "Permintaan atau tindakan eksplisit",
          "明确请求或人工安排",
        ),
        w(
          "A structured request creates a task or supplements an open same-kind request. Staff can create a separate action.",
          "Permintaan terstruktur membuat tugas atau melengkapi permintaan terbuka sejenis. Staf dapat membuat tindakan terpisah.",
          "结构化请求可新建或补充同类型开放请求；销售也可明确新增独立事项。",
        ),
      ),
      n(
        w("Stored deadline", "Tenggat tersimpan", "保存期限"),
        w(
          "New response tasks use the configured calendar. A policy change does not rewrite existing deadlines.",
          "Tugas respons baru memakai kalender terkonfigurasi. Perubahan kebijakan tidak menulis ulang tenggat lama.",
          "新响应任务使用运营日历；配置改动不会重写已有任务期限。",
        ),
      ),
      n(
        w("Explicit outcome", "Hasil eksplisit", "逐项确认结果"),
        w(
          "Complete only the selected task. Its pending reminders can be cancelled. Other tasks and deadlines remain.",
          "Selesaikan hanya tugas terpilih. Pengingat tertundanya dapat dibatalkan. Tugas dan tenggat lain tetap.",
          "只完成明确选中的任务，并取消其关联待发提醒；其他任务和期限保留。",
        ),
      ),
    ],
    w(
      "A task is the unit of work. A contact record is evidence of an attempt or result.",
      "Tugas adalah unit pekerjaan. Catatan kontak adalah bukti upaya atau hasil.",
      "任务是独立事项，联系记录是尝试或结果的证据；两者不是同一件事。",
    ),
    w(
      "T1 confirms needs, T2 confirms a trial appointment, T3 checks enrollment documents. Completing T1 leaves T2 and T3 open.",
      "T1 mengonfirmasi kebutuhan, T2 janji uji coba, T3 dokumen pendaftaran. Menyelesaikan T1 membiarkan T2 dan T3 terbuka.",
      "T1 确认需求、T2 确认试听预约、T3 核对报名资料。完成 T1 后，T2 与 T3 仍开放。",
    ),
    w(
      "Rescheduling stores a revised execution time and preserves the original deadline. Replacement cancels and links the old task, rather than completing it. Unknown times require review.",
      "Jadwal ulang menyimpan waktu pelaksanaan baru dan tenggat awal. Penggantian membatalkan serta menautkan tugas lama, bukan menyelesaikannya. Waktu tidak diketahui perlu ditinjau.",
      "改期保存新执行时间并保留原截止时间；替代取消旧任务并关联新任务，不计为完成。未知时间须核实，不能猜造期限。",
    ),
  ),
  "notification-system": lesson(
    w(
      "A reminder reports work; it does not finish it",
      "Pengingat melaporkan tugas, bukan menyelesaikannya",
      "通知提示待办，不代表已处理",
    ),
    w(
      "Saved events pass through policy, recipient routing and delivery. Each stage has a separate result.",
      "Peristiwa tersimpan melalui kebijakan, penerima, dan pengiriman. Tiap tahap memiliki hasil berbeda.",
      "已保存事件依次经过策略判断、接收人路由和发送处理；各环节分别记录结果。",
    ),
    w(
      "You can locate whether a problem is missing work, a policy condition, recipient eligibility or external delivery.",
      "Anda dapat membedakan masalah tugas, syarat kebijakan, kelayakan penerima, dan pengiriman eksternal.",
      "排查时能分清是业务事项未产生、策略未命中、接收人无效，还是外部发送故障。",
    ),
    [
      n(
        w("Saved event", "Peristiwa tersimpan", "保存业务事件"),
        w(
          "The transaction saves business facts and an Outbox event. Not every message creates an actionable event.",
          "Transaksi menyimpan fakta bisnis dan peristiwa Outbox. Tidak semua pesan membuat peristiwa tindakan.",
          "业务事务保存事实与 待处理业务 事件；并非每条普通消息都会产生可通知的业务请求。",
        ),
      ),
      n(
        w("Policy and recipient", "Kebijakan dan penerima", "匹配策略与接收人"),
        w(
          "Enabled conditions, timing and limits apply. Route to an eligible Owner, otherwise eligible CRM Managers.",
          "Syarat aktif, waktu, dan batas berlaku. Kirim ke penanggung jawab yang memenuhi izin, atau Pengelola CRM yang memenuhi izin.",
          "匹配启用条件、时间与频控；路由至有效 负责人，否则转给有相应权限的 CRM 管理者。",
        ),
      ),
      n(
        w("Recheck and send", "Periksa dan kirim", "复查后发送"),
        w(
          "Before delivery, recheck task, ownership and contact arrangement. Save the actual receipt state.",
          "Sebelum mengirim, periksa tugas, kepemilikan, dan pengaturan kontak. Simpan status tanda terima sebenarnya.",
          "发送前复查任务、归属与联系安排，随后保存实际回执状态。",
        ),
      ),
    ],
    w(
      "Delivery evidence and sales handling evidence must be read separately.",
      "Bukti pengiriman dan penanganan sales harus dibaca terpisah.",
      "发送证据与销售处理证据分别判断。",
    ),
    w(
      "Lark accepts T1's reminder. This proves API acceptance, not that Fadhil read it. A later task completion cannot recall an accepted message.",
      "Lark menerima pengingat T1. Ini membuktikan penerimaan API, bukan bahwa Fadhil membacanya. Penyelesaian berikutnya tidak menarik pesan yang diterima.",
      "Lark 接受 T1 提醒，只能证明接口接受，不能证明 Fadhil 已读。之后完成任务也无法撤回已被外部接受的消息。",
    ),
    w(
      "Missing channels are configuration failures, not simulation. An unknown delivery result needs investigation before retry. Frozen historical failures are not automatically replayed.",
      "Kanal hilang adalah kegagalan konfigurasi, bukan simulasi. Hasil tidak diketahui perlu diperiksa sebelum mengulang. Kegagalan historis yang dibekukan tidak dikirim ulang otomatis.",
      "缺失渠道是配置失败，不是模拟。发送结果未知须先核查再重试；冻结的历史失败不会自动重放。",
    ),
  ),
  measurement: lesson(
    w(
      "Read the denominator and evidence before the number",
      "Periksa penyebut dan bukti sebelum angka",
      "先看统计对象与证据，再解释数字",
    ),
    w(
      "Process metrics explain follow-up quality. Campaign metrics describe recorded acquisition and outcomes. Their populations differ.",
      "Metrik proses menjelaskan mutu tindak lanjut. Metrik kampanye menunjukkan akuisisi dan hasil tercatat. Populasinya berbeda.",
      "过程指标反映跟进质量，活动指标反映已记录获客与结果；两者的统计客户范围不同。",
    ),
    w(
      "A clear definition prevents activity counts from being mistaken for customer progress or financial return.",
      "Definisi jelas mencegah jumlah aktivitas dianggap sebagai kemajuan pelanggan atau keuntungan keuangan.",
      "明确口径后，才不会把拨打次数当成推进效果，或把报名占比解释成已实现的投资回报。",
    ),
    [
      n(
        w("Process population", "Populasi proses", "过程统计范围"),
        w(
          "Customers in the current authorized filter. Check unassigned age, first human contact, open work and successful conversations.",
          "Pelanggan dalam filter yang diizinkan. Periksa durasi tanpa penanggung jawab, kontak staf pertama, tugas terbuka, dan percakapan berhasil.",
          "使用权限内当前筛选客户；关注未分配时长、首次人工联系、未完成事项与有效沟通。",
        ),
      ),
      n(
        w("Campaign population", "Populasi kampanye", "活动统计范围"),
        w(
          "First-attributed customers for registration, assessment and enrollment. Participation counts campaign-customer evidence separately.",
          "Pelanggan beratribusi pertama untuk registrasi, asesmen, dan pendaftaran kelas. Partisipasi memakai bukti pasangan kampanye-pelanggan.",
          "登记、测评、报名基于首次归因客户；确认参与另按活动—客户的证据统计。",
        ),
      ),
      n(
        w("Evidence quality", "Mutu bukti", "证据质量"),
        w(
          "Missing times stay unknown. Recorded revenue is not verified collection. Current overdue excludes completed tasks.",
          "Waktu hilang tetap tidak diketahui. Pendapatan tercatat bukan penerimaan terverifikasi. Keterlambatan saat ini mengecualikan tugas selesai.",
          "时间缺失保持未知，登记收入不等于已核验收款，当前逾期不包含已完成任务。",
        ),
      ),
    ],
    w(
      "The same number can mean different things when its population or evidence changes.",
      "Angka sama dapat bermakna berbeda jika populasi atau buktinya berubah.",
      "统计范围或依据不同，相同数字也可能代表不同含义。",
    ),
    w(
      "Of 10 first-attributed customers, 2 are recorded as enrolled: enrollment share is 20%. This alone proves neither payment nor campaign causality.",
      "Dari 10 pelanggan beratribusi pertama, 2 tercatat mendaftar kelas: proporsinya 20%. Ini belum membuktikan pembayaran atau sebab-akibat kampanye.",
      "首次归因登记客户 10 位，其中 2 位已记录报名，报名占比为 20%；这不能单独证明付款或活动导致成交。",
    ),
    w(
      "These are customer-cohort snapshots, not daily employee rankings. Contact intervals use recorded natural time, not working-hour SLA duration.",
      "Ini cuplikan kelompok pelanggan, bukan peringkat harian staf. Selang kontak memakai waktu tercatat alami, bukan durasi SLA jam kerja.",
      "这些是客户群快照，不是员工每日排名。联系间隔按记录自然时长计算，不等于工作日历 SLA 时长。",
    ),
    "comparison",
  ),
  "ai-assessment": lesson(
    w(
      "A result needs its source and limits",
      "Hasil membutuhkan sumber dan batasan",
      "测评结论必须连同来源与适用范围阅读",
    ),
    w(
      "Self-report, a quick assessment, a full paper and a teacher judgment are different kinds of evidence.",
      "Laporan diri, asesmen singkat, soal lengkap, dan penilaian guru adalah bukti berbeda.",
      "自报、快速测评、完整试卷和教师定级，是四种不同依据。",
    ),
    w(
      "Sales can discuss the learner's next step without promising certification, complete ability or a class placement that has not been confirmed.",
      "Sales dapat membahas langkah belajar tanpa menjanjikan sertifikasi, kemampuan menyeluruh, atau penempatan kelas yang belum dikonfirmasi.",
      "销售能够据此讨论后续学习，而不把暂定结果说成官方认证、完整能力证明或已确认分班。",
    ),
    [
      n(
        w("Self-report", "Laporan diri", "客户自报"),
        w(
          "The customer's own level statement. Preserve it as history, not an assessment score.",
          "Pernyataan tingkat oleh pelanggan. Simpan sebagai riwayat, bukan nilai asesmen.",
          "客户自行描述的基础，作为历史依据保留，不等于测评分数。",
        ),
      ),
      n(
        w("Quick assessment", "Asesmen singkat", "快速测评"),
        w(
          "A provisional starting point from a short test. Verify the fit before discussing a class.",
          "Titik awal sementara dari tes singkat. Periksa kesesuaiannya sebelum membahas kelas.",
          "短测给出暂定学习起点；讨论班级前仍须核实适配情况。",
        ),
      ),
      n(
        w("Full assessment", "Asesmen lengkap", "完整测评"),
        w(
          "Attainment on the saved paper and scoring version. Missing audio limits listening evidence; this is not an official certificate.",
          "Capaian pada soal dan versi skor tersimpan. Audio hilang membatasi bukti menyimak; ini bukan sertifikat resmi.",
          "说明本卷与已保存评分版本的达成情况；音频缺失限制听力依据，不代表官方认证。",
        ),
      ),
      n(
        w("Teacher judgment", "Penilaian guru", "教师定级"),
        w(
          "An independent recorded judgment. Show teacher and time if available. Missing provenance remains unrecorded.",
          "Penilaian tersendiri yang tercatat. Tampilkan guru dan waktu jika tersedia. Sumber yang hilang tetap belum tercatat.",
          "独立保存的教师判断；有教师与时间则展示，没有则明确未记录。",
        ),
      ),
    ],
    w(
      "Read conclusion → source → time → limitations before discussing a course.",
      "Baca kesimpulan → sumber → waktu → batasan sebelum membahas kursus.",
      "先读结论、来源、时间和限制，再讨论课程安排。",
    ),
    w(
      "Amelia has a provisional quick result. Fadhil can explain a suggested learning start, then verify course suitability. No official certificate is implied.",
      "Amelia memiliki hasil singkat sementara. Fadhil menjelaskan awal belajar yang disarankan, lalu memeriksa kesesuaian kursus. Ini bukan sertifikat resmi.",
      "Amelia 获得快速测评暂定结果。Fadhil 可解释建议起点，再核实课程适配；不能据此承诺官方证书。",
    ),
    w(
      "AI consultation saves replies and failure evidence. OpenAI failure can fall back to DeepSeek. AI replies are neither human contact nor verified enrollment facts.",
      "Konsultasi AI menyimpan balasan dan bukti kegagalan. Kegagalan OpenAI dapat beralih ke DeepSeek. Balasan AI bukan kontak staf atau bukti pendaftaran terverifikasi.",
      "AI 咨询保存回复与失败依据，OpenAI 失败可切换 DeepSeek；AI 回复不计为人工联系，也不证明报名等业务事实。",
    ),
    "comparison",
  ),
  "data-implementation": lesson(
    w(
      "Read current state from records, not old wording",
      "Baca status dari data, bukan kalimat lama",
      "当前状态看记录，不从历史文字猜测",
    ),
    w(
      "The interface reads structured records. Historical messages explain what happened then; they do not determine the current task state.",
      "Antarmuka membaca catatan terstruktur. Pesan historis menjelaskan kejadian dahulu, bukan status tugas saat ini.",
      "界面读取结构化记录；历史消息说明当时发生了什么，不能决定当前任务是否仍待处理。",
    ),
    w(
      "This keeps failures, retries and later changes traceable without rewriting the customer's original text.",
      "Ini menjaga kegagalan, pengulangan, dan perubahan berikutnya tetap terlacak tanpa mengubah teks asli pelanggan.",
      "这样既能追溯失败、重试和后续变化，也无需改写客户原文。",
    ),
    [
      n(
        w("Evidence", "Bukti", "原始依据"),
        w(
          "Messages preserve original content and known times. Request metadata links the conversation and task.",
          "Pesan menyimpan isi asli dan waktu yang diketahui. Metadata permintaan menautkan percakapan dan tugas.",
          "消息保存原文与可靠时间；请求元信息连接会话和任务。",
        ),
      ),
      n(
        w("Current records", "Catatan saat ini", "当前记录"),
        w(
          "MySQL holds customer ownership, tasks and contact records. The current task record determines its state.",
          "MySQL menyimpan kepemilikan, tugas, dan catatan kontak. Catatan tugas saat ini menentukan statusnya.",
          "MySQL 保存客户归属、任务及联系记录；任务当前记录决定其状态。",
        ),
      ),
      n(
        w(
          "Transaction and receipt",
          "Transaksi dan tanda terima",
          "事务与回执",
        ),
        w(
          "A save can commit contact, selected task changes and audit together. A request ID lets the client query the result safely.",
          "Penyimpanan dapat menyatukan kontak, perubahan tugas terpilih, dan audit. ID permintaan memungkinkan pemeriksaan hasil.",
          "一次保存可在事务中同时提交联系、指定任务变更和审计；请求 ID 用于安全查询保存结果。",
        ),
      ),
    ],
    w(
      "Separate original evidence, current state and delivery history when investigating a discrepancy.",
      "Pisahkan bukti asli, status saat ini, dan riwayat pengiriman saat memeriksa perbedaan.",
      "排查差异时，分别核对原始依据、当前状态与发送历史。",
    ),
    w(
      "An old message says a request was received. After T1 completes, show its completed state while preserving that original receipt.",
      "Pesan lama menyatakan permintaan diterima. Setelah T1 selesai, tampilkan status selesai dan pertahankan tanda terima asli.",
      "旧消息写着请求已收到。T1 完成后显示当前已完成状态，同时保留当时的原始回执。",
    ),
    w(
      "Static JSON holds questions and translations. MySQL holds business records. Secrets stay server-side. Optional schema fields do not waive required business steps.",
      "JSON statis menyimpan soal dan terjemahan. MySQL menyimpan data bisnis. Rahasia tetap di server. Kolom opsional tidak menghapus langkah bisnis wajib.",
      "静态 JSON 保存题库与文案，MySQL 保存业务记录，密钥留在服务端。字段声明可选，不等于业务步骤可以省略。",
    ),
  ),
};
const how = (
  title: Words,
  answer: Words,
  nodes: LearningNode[],
  check: Words,
  example: Words,
  boundary: Words,
) => lesson(title, answer, check, nodes, check, example, boundary, "procedure");
Object.assign(guideLessons, {
  access: how(
    w(
      "Sign in and confirm your working scope",
      "Masuk dan periksa lingkup kerja",
      "登录后先确认自己的工作范围",
    ),
    w(
      "Use your Login ID or saved email. The server applies your current permissions to every action.",
      "Gunakan ID login atau email tersimpan. Server menerapkan izin saat ini pada setiap tindakan.",
      "使用登录账号或已保存邮箱登录；每次业务操作都由服务端校验当前权限。",
    ),
    [
      n(
        w("Sign in", "Masuk", "登录"),
        w(
          "Enter your own account and password. Do not use a colleague's session to bypass missing access.",
          "Masukkan akun dan sandi sendiri. Jangan memakai sesi rekan untuk melewati izin.",
          "使用自己的账号密码；不要借用同事会话绕过权限限制。",
        ),
      ),
      n(
        w("Check workspace", "Periksa ruang kerja", "确认工作区"),
        w(
          "Open Sales management. The account menu shows roles and version information. Other workspaces appear only with access.",
          "Buka Manajemen penjualan. Menu akun menunjukkan peran dan versi. Ruang lain memerlukan izin.",
          "进入销售管理；账号菜单显示角色与版本信息，其他工作区按权限提供入口。",
        ),
      ),
      n(
        w(
          "Check customer scope",
          "Periksa lingkup pelanggan",
          "确认可处理客户",
        ),
        w(
          "Sales defaults to owned customers needing handling. CRM Managers default to all accessible customers. Custom permissions still apply.",
          "Sales mulai dari pelanggan miliknya yang perlu ditangani. Pengelola CRM mulai dari semua pelanggan yang dapat diakses. Izin khusus tetap berlaku.",
          "销售默认进入本人需处理客户，CRM 管理者默认查看全部可访问客户；自定义权限仍然生效。",
        ),
      ),
    ],
    w(
      "You can see only the records and actions your permissions allow.",
      "Anda hanya dapat melihat data dan tindakan sesuai izin.",
      "看到的客户及可用操作必须符合当前权限。",
    ),
    w(
      "Fadhil can claim an eligible unassigned customer for himself. This does not grant permission to transfer his own customers to another salesperson.",
      "Fadhil dapat mengambil pelanggan belum ditugaskan yang memenuhi syarat. Ini tidak memberi izin memindahkan pelanggannya ke sales lain.",
      "Fadhil 可把符合条件的未分配客户认领给自己，但这不赋予他把自己客户转给其他销售的权限。",
    ),
    w(
      "Users, roles and Owner determine access. There is no team-based routing or claim rule. Ask the System Administrator to review account permissions.",
      "Pengguna, peran, dan penanggung jawab menentukan akses. Tidak ada aturan tim untuk penerima atau pengambilan pelanggan. Hubungi Administrator Sistem untuk izin.",
      "权限基于用户、角色和 负责人，不依赖团队。账号权限问题由 系统管理员 核对。",
    ),
  ),
  workspace: how(
    w(
      "Read four zones, then open the right tab",
      "Baca empat zona, lalu pilih tab",
      "先读四区摘要，再进入对应页签",
    ),
    w(
      "Start with the next action and deadline. Use the other zones to understand the customer before contact.",
      "Mulai dari tindakan berikutnya dan tenggat. Gunakan zona lain untuk memahami pelanggan sebelum kontak.",
      "先看下一步与期限，再结合客户、学习需求和销售进展判断处理方式。",
    ),
    [
      n(
        w("Customer", "Pelanggan", "客户"),
        w(
          "Check name, Owner and latest activity. An unread mark means new information, not an unfinished task.",
          "Periksa nama, penanggung jawab, dan aktivitas terbaru. Tanda belum dibaca berarti informasi baru, bukan tugas belum selesai.",
          "确认姓名、负责人和最近动态；未读表示有新信息，不等于存在未完成任务。",
        ),
      ),
      n(
        w("Learning needs", "Kebutuhan belajar", "学习需求"),
        w(
          "Read goals, city and learning format. Open Assessment to understand the conclusion and its evidence.",
          "Baca tujuan, kota, dan format belajar. Buka Asesmen untuk memahami kesimpulan dan buktinya.",
          "查看目标、城市和授课方式；在测评页签核对结论及依据。",
        ),
      ),
      n(
        w("Sales progress", "Kemajuan penjualan", "销售进展"),
        w(
          "Read the stage and customer group. Open buying-signal evidence in Profile; use Conversations to check the original request.",
          "Baca tahap dan kelompok pelanggan. Buka bukti sinyal di Profil; gunakan Percakapan untuk memeriksa permintaan asli.",
          "查看阶段与客户分组；在资料页签查购买信号依据，在对话页签核对原始诉求。",
        ),
      ),
      n(
        w("Next action", "Tindakan berikutnya", "下一步"),
        w(
          "Read the action, actual deadline and task owner. Record result opens Follow-up for that specific task.",
          "Baca tindakan, tenggat nyata, dan pemilik tugas. Catat hasil membuka Tindak lanjut untuk tugas tersebut.",
          "查看动作、真实期限及任务负责人；“记录结果”进入跟进页签处理该项任务。",
        ),
      ),
    ],
    w(
      "Identify the next action and its reason without treating a group label as an instruction.",
      "Kenali tindakan berikutnya dan alasannya tanpa menganggap label kelompok sebagai instruksi.",
      "能说清下一步及其依据，而不是把分组标签直接当成操作指令。",
    ),
    w(
      "A High interest customer has a future appointment. Another has an overdue request. The overdue request needs attention first.",
      "Pelanggan minat tinggi memiliki janji mendatang. Pelanggan lain memiliki permintaan terlambat. Permintaan terlambat perlu ditangani lebih dahulu.",
      "一位高意向客户有未来预约，另一位客户有当前逾期请求。处理顺序应优先考虑逾期事项。",
    ),
    w(
      "Open or close sections without changing records. Profile retains original names and notes. Do not infer facts from empty fields.",
      "Membuka bagian tidak mengubah catatan. Profil mempertahankan nama dan catatan asli. Jangan menebak dari kolom kosong.",
      "展开区块不会写入记录；姓名和备注保持原文，空字段不能被推断成已确认事实。",
    ),
  ),
  followup: how(
    w(
      "Example: record an unanswered attempt and decide what remains",
      "Contoh: catat upaya tanpa jawaban dan langkah berikutnya",
      "案例：未接通后，分别记录事实、任务结果与后续安排",
    ),
    w(
      "Use a contact record for an actual attempt. Use an information note for facts that are not contact attempts.",
      "Gunakan catatan kontak untuk upaya nyata. Gunakan catatan informasi untuk fakta yang bukan upaya kontak.",
      "真实联系尝试使用联系记录；非联系事实使用随手记录，不混入联系次数。",
    ),
    [
      n(
        w("Record the attempt", "Catat upaya", "记录实际尝试"),
        w(
          "Choose the channel and No answer / no reply. Enter a short factual note. No result is preselected.",
          "Pilih saluran dan Tidak dijawab / belum dibalas. Isi catatan faktual singkat. Hasil tidak dipilih otomatis.",
          "主动选择沟通方式与未接通／未回复，填写简短真实记录；联系结果没有默认值。",
        ),
      ),
      n(
        w("Confirm task outcome", "Konfirmasi hasil tugas", "明确任务结果"),
        w(
          "From a task, choose whether it remains open or is complete. An unanswered call does not prove that needs were confirmed.",
          "Dari tugas, pilih tetap terbuka atau selesai. Panggilan tanpa jawaban tidak membuktikan kebutuhan sudah dikonfirmasi.",
          "从任务进入时选择保持待处理或明确完成；电话未接通不能证明“确认需求”已经完成。",
        ),
      ),
      n(
        w(
          "Choose next arrangement",
          "Pilih langkah berikutnya",
          "确定后续安排",
        ),
        w(
          "Keep a valid task, create a specific future action, or explicitly keep arrangements unchanged with Record only. Pauses need reasons.",
          "Pertahankan tugas valid, buat tindakan mendatang, atau pilih Catat saja untuk mempertahankan pengaturan. Jeda perlu alasan.",
          "保留有效任务、安排具体未来行动，或选择仅记录保留原安排；需要等待或停止时另填原因。",
        ),
      ),
      n(
        w(
          "Save and inspect result",
          "Simpan dan periksa hasil",
          "保存并核对结果",
        ),
        w(
          "Check the saved record, completed task IDs and next action. Save and next advances only after confirmation.",
          "Periksa catatan tersimpan, ID tugas selesai, dan tindakan berikutnya. Simpan dan lanjut hanya berpindah setelah konfirmasi.",
          "核对保存记录、实际完成任务及下一步；“保存并下一位”只在服务端确认成功后切换。",
        ),
      ),
    ],
    w(
      "An unanswered record adds an attempt, not a successful two-way conversation. Only explicitly selected tasks can complete.",
      "Catatan tanpa jawaban menambah upaya, bukan percakapan dua arah berhasil. Hanya tugas terpilih yang dapat selesai.",
      "未接通增加尝试记录，不增加有效双向沟通；只有明确选中的任务才可完成。",
    ),
    w(
      "Fadhil calls Amelia but receives no answer. He keeps T1 open and schedules a callback. The new task coexists with T1.",
      "Fadhil menelepon Amelia tanpa jawaban. Ia mempertahankan T1 dan menjadwalkan telepon berikutnya. Tugas baru berjalan bersama T1.",
      "Fadhil 致电 Amelia 未获回应：T1 保持待处理，另安排回访任务，新任务与 T1 并存。",
    ),
    w(
      "Record only can leave a customer without a next step. Check the queue after saving. No new signal preserves earlier buying signals; unchanged stage fields are not overwritten.",
      "Catat saja dapat meninggalkan pelanggan tanpa langkah berikutnya. Periksa antrean setelah menyimpan. Tanpa sinyal baru mempertahankan sinyal lama dan tahap yang tidak diubah.",
      "仅记录可能让客户继续处于未安排下一步，应回看队列确认。无新信号保留既有信号，未修改的阶段不覆盖。",
    ),
  ),
  chat: how(
    w(
      "Read the customer's words and follow the linked task",
      "Baca pesan pelanggan dan ikuti tugas terkait",
      "从客户原文找到当前关联任务",
    ),
    w(
      "Conversations preserves the source. Follow-up is the common place to process the work.",
      "Percakapan menyimpan sumber. Tindak lanjut adalah tempat bersama untuk menangani pekerjaan.",
      "对话保留来源，跟进页统一处理事项；无需在多个页签重复操作同一任务。",
    ),
    [
      n(
        w("Find the conversation", "Temukan percakapan", "定位会话"),
        w(
          "Use entry source, time and message count. Open the latest customer message when you need the current request.",
          "Gunakan sumber, waktu, dan jumlah pesan. Buka pesan pelanggan terbaru untuk permintaan terkini.",
          "按入口、时间和消息数选择会话，需要时跳到最新客户消息。",
        ),
      ),
      n(
        w("Read roles and evidence", "Baca peran dan bukti", "区分角色与依据"),
        w(
          "Customer text, AI replies and system receipts are separate. Unknown time stays unknown. Failed AI output is not a saved successful answer.",
          "Teks pelanggan, balasan AI, dan tanda terima sistem dipisahkan. Waktu hilang tetap tidak diketahui. Kegagalan AI bukan jawaban berhasil.",
          "区分客户原文、AI 回复与系统回执；未知时间保持未知，AI 失败不冒充成功回答。",
        ),
      ),
      n(
        w("Open linked work", "Buka tugas terkait", "打开关联事项"),
        w(
          "Use the linked task to enter Follow-up. Its current record shows whether the request is open, complete or unavailable.",
          "Gunakan tugas terkait untuk membuka Tindak lanjut. Data saat ini menunjukkan terbuka, selesai, atau tidak tersedia.",
          "通过关联任务进入跟进页，读取当前开放、完成或信息不可用状态。",
        ),
      ),
      n(
        w("Return to the source", "Kembali ke sumber", "返回原文"),
        w(
          "Return to the original message after processing. Preserve conversation and message IDs when you link evidence.",
          "Kembali ke pesan asli setelah memproses. Pertahankan ID percakapan dan pesan saat menautkan bukti.",
          "处理后可返回原会话与消息位置；引用依据时保留会话和消息 ID。",
        ),
      ),
    ],
    w(
      "Reading, copying or opening a contact tool does not record contact or complete tasks.",
      "Membaca, menyalin, atau membuka alat kontak tidak mencatat kontak atau menyelesaikan tugas.",
      "查看、复制或打开沟通工具不会自动保存联系或完成任务。",
    ),
    w(
      "A receipt says the advisor request was recorded. T1 later completes. Keep the receipt as history and use T1 for the current state.",
      "Tanda terima mencatat permintaan konsultan. T1 kemudian selesai. Pertahankan tanda terima sebagai riwayat dan baca status kini dari T1.",
      "系统回执记录收到顾问请求，之后 T1 已完成；回执作为历史保留，当前状态以 T1 为准。",
    ),
    w(
      "This is not a live agent inbox. Similar text in different messages remains separate. Matching contact details alone does not merge customers.",
      "Ini bukan kotak chat staf langsung. Teks serupa pada pesan berbeda tetap terpisah. Kontak cocok saja tidak menggabungkan pelanggan.",
      "这里不是在线人工坐席。不同消息 ID 的相同文字分别保留，联系方式相同也不会自动合并客户。",
    ),
  ),
  assessment: how(
    w(
      "Explain an assessment without overstating it",
      "Jelaskan asesmen sesuai bukti",
      "准确解释测评结果及其限制",
    ),
    w(
      "Read the conclusion together with its source and date before recommending a learning step.",
      "Baca kesimpulan, sumber, dan tanggal sebelum menyarankan langkah belajar.",
      "向客户解释学习起点前，连同来源和时间一起阅读结论。",
    ),
    [
      n(
        w("Identify the basis", "Kenali dasar", "确认依据类型"),
        w(
          "Distinguish self-report, quick assessment, full paper and teacher judgment.",
          "Bedakan laporan diri, asesmen singkat, soal lengkap, dan penilaian guru.",
          "区分自报、快速测评、完整试卷与教师定级。",
        ),
      ),
      n(
        w("Read the conclusion", "Baca kesimpulan", "阅读结论"),
        w(
          "Keep provisional labels and missing teacher or time information visible. Do not combine unrelated scores.",
          "Pertahankan label sementara dan informasi guru atau waktu yang hilang. Jangan menggabungkan nilai tak terkait.",
          "保留暂定标记及教师、时间缺失说明，不把不同依据的分数混成一个结果。",
        ),
      ),
      n(
        w("Inspect supporting detail", "Periksa rincian", "按需查看成绩依据"),
        w(
          "Expand section scores and question statistics. Use paper and scoring versions only when checking a discrepancy.",
          "Buka skor bagian dan statistik soal. Gunakan versi soal dan skor saat memeriksa perbedaan.",
          "展开分项成绩和答题统计；只有核对差异时才需要查试卷与评分版本。",
        ),
      ),
      n(
        w(
          "Record the next action",
          "Catat tindakan berikutnya",
          "记录可执行下一步",
        ),
        w(
          "Verify course fit or arrange teacher review as needed. Save a task if follow-up is required.",
          "Periksa kesesuaian kursus atau atur tinjauan guru jika perlu. Simpan tugas bila perlu tindak lanjut.",
          "核实课程适配，必要时安排教师复核；需要后续处理就明确保存任务。",
        ),
      ),
    ],
    w(
      "The customer understands what the result supports and what it cannot prove.",
      "Pelanggan memahami cakupan hasil dan hal yang belum terbukti.",
      "客户能理解结果支持什么判断，又不能证明什么。",
    ),
    w(
      "A full-paper threshold is reached. Describe achievement on that paper, not an official HSK certificate or proven speaking ability.",
      "Ambang pada soal lengkap tercapai. Jelaskan capaian pada soal itu, bukan sertifikat HSK resmi atau kemampuan berbicara terbukti.",
      "完整试卷达到阈值，只说明本卷标准达成，不等于官方 HSK 证书或已验证口语能力。",
    ),
    w(
      "No rescoring, course assignment or official certification is performed by reading this page.",
      "Membaca halaman tidak menghitung ulang skor, menetapkan kelas, atau memberi sertifikasi resmi.",
      "阅读结果不会重评分、自动分班或生成官方认证。",
    ),
  ),
  campaigns: how(
    w(
      "Create a campaign and distribute attributable links",
      "Buat kampanye dan bagikan tautan terlacak",
      "创建活动并分发可归因链接",
    ),
    w(
      "Save the campaign first. Configure and save each promotion link before copying its URL or QR code.",
      "Simpan kampanye terlebih dahulu. Atur dan simpan setiap tautan promosi sebelum menyalin URL atau kode QR.",
      "先保存活动，再逐条配置并保存推广链接，然后复制链接或下载二维码。",
    ),
    [
      n(
        w("Create campaign", "Buat kampanye", "创建活动"),
        w(
          "Create a campaign, then add promotion links. Step 1 requires only one campaign name. Type and delivery format are optional internal context; neither defines all the campaign’s sources. Saving creates one Planning campaign with a new immutable camp- code. Existing codes remain unchanged. No dates, times, location or budget are invented. If the result is unknown, retry the original request rather than creating again.",
          "Buat kampanye, lalu tambahkan tautan promosi. Langkah 1 hanya mewajibkan satu nama kampanye. Jenis dan bentuk penyelenggaraan adalah konteks internal opsional; keduanya tidak membatasi sumber kampanye. Penyimpanan membuat satu kampanye Perencanaan dengan kode camp- baru yang tetap. Kode lama tidak berubah. Tanggal, waktu, lokasi, dan anggaran tidak direka. Jika hasil belum diketahui, ulangi permintaan awal, bukan membuat lagi.",
          "先创建活动，再添加推广链接。第1步仅要求一个活动名称，活动类型和开展形式是选填的内部说明，不代表活动只有一种推广来源。保存后生成筹备中的活动及不可修改的新camp-活动码，旧活动码保持不变。日期、时间、地点、预算不自动补造。保存结果未知时重试原请求，不要重复创建。",
        ),
      ),
      n(
        w("Add promotion link", "Tambahkan tautan promosi", "添加推广链接"),
        w(
          "Step 2 creates one saved promotion entry per placement you need to distinguish. Choose a source, medium and customer page language; the supported entry experience is questionnaire → assessment when applicable → AI consultation. Link name is optional. A campaign can have several entries. The system gives each entry a stable p ID belonging to that campaign’s c code. Copy the displayed link or download its matching QR code after saving. The URL uses the current environment and includes c, p, lang, utm_campaign, utm_source and utm_medium. These values have different purposes: c identifies the campaign, p selects its saved entry, and UTM fields label distribution for analysis. They do not prove the actual referring platform. Saved entries retain their settings; create another link for a different placement. Existing campaign-only links remain supported.",
          "Langkah 2 membuat satu entri promosi tersimpan untuk setiap penempatan yang ingin dibedakan. Pilih sumber, media, dan bahasa halaman pelanggan; alur yang didukung adalah kuesioner → asesmen bila diperlukan → konsultasi AI. Nama tautan opsional. Satu kampanye dapat memiliki beberapa entri. Sistem memberi setiap entri ID p tetap yang terkait dengan kode c kampanye itu. Setelah disimpan, salin tautan atau unduh kode QR yang sesuai. URL menggunakan lingkungan saat ini dan memuat c, p, lang, utm_campaign, utm_source, serta utm_medium. c mengenali kampanye, p memilih entri tersimpan, dan UTM memberi label distribusi untuk analisis. Parameter bukan bukti platform asal sebenarnya. Pengaturan entri tersimpan tetap; buat tautan lain untuk penempatan berbeda. Tautan lama dengan kode kampanye saja tetap didukung.",
          "第2步为需要区分的每个投放位置创建独立推广入口。选择来源、推广方式和客户页面语言；当前入口体验为“问卷→按规则测评→AI咨询”，链接名称选填。一个活动可有多条链接，每个入口有稳定的p ID，且必须属于对应的c活动。保存后复制展示链接或下载对应二维码。链接使用当前环境，包含c、p、lang、utm_campaign、utm_source和utm_medium：c识别活动，p识别该活动下已保存入口，UTM用于投放标签和分析，不证明真实来源平台。已保存入口配置保持固定，不同投放位置请另建链接。原有只含活动码的链接继续兼容。",
        ),
      ),
      n(
        w(
          "Review campaign information",
          "Periksa informasi kampanye",
          "核对活动信息",
        ),
        w(
          "In Campaign information, Start and End each use one date-and-time control. Times are Asia/Jakarta (WIB, UTC+7). The end cannot precede the start. Existing date-only facts remain recorded until explicitly replaced or cleared; a missing time never becomes midnight. Budget is optional planned IDR spending: blank means unrecorded, 0 means an explicit zero. It is not verified actual spend or ROI. Organizer, audience, venue and notes are optional facts, preserved as entered; organizer does not assign customer ownership.",
          "Di Informasi kampanye, Mulai dan Selesai masing-masing memakai satu kontrol tanggal-waktu. Waktu menggunakan Asia/Jakarta (WIB, UTC+7); selesai tidak boleh mendahului mulai. Catatan lama yang hanya memiliki tanggal tetap dipertahankan sampai diganti atau dikosongkan; waktu kosong bukan tengah malam. Anggaran adalah rencana pengeluaran opsional dalam IDR: kosong berarti belum tercatat, 0 berarti anggaran nol. Ini bukan biaya aktual terverifikasi atau ROI. Penyelenggara, audiens, tempat, dan catatan opsional serta tetap sesuai input; penyelenggara tidak menetapkan penanggung jawab pelanggan.",
          "活动信息中的开始、结束各使用一个日期时间控件，时间采用Asia/Jakarta（WIB，UTC+7），结束不得早于开始。历史仅有日期的记录在明确替换或清除前保留，不把缺失时间自动补成午夜。预算是选填的IDR计划金额，空值表示未填写，0表示明确零预算，不证明实际成本或投资回报。主办方、受众、场地及备注均为选填，按输入原文保存；主办方不决定客户Owner。",
        ),
      ),
      n(
        w(
          "Prepare optional materials",
          "Siapkan materi opsional",
          "按需准备物料",
        ),
        w(
          "There is one campaign name, displayed verbatim in every interface language. Materials provides separate English, Indonesian and Chinese template drafts. Choose a saved promotion link, material language and content type, then prepare, review and save a template. Templates assemble saved facts without an AI call or automatic translation of names and notes. Confirm before replacing existing text. Earlier materials retain their original text and unverified language labels. Preparing or saving a welcome draft neither activates it in chat nor sends a message. Campaign or link changes do not silently update stored drafts; recheck them before sharing. Unsaved changes are protected when switching tabs or leaving.",
          "Hanya ada satu nama kampanye, ditampilkan persis sesuai input dalam semua bahasa antarmuka. Materi menyediakan draf templat Inggris, Indonesia, dan Mandarin secara terpisah. Pilih tautan promosi tersimpan, bahasa materi, dan jenis konten; siapkan, periksa, lalu simpan templat. Templat menyusun fakta tersimpan tanpa panggilan AI atau terjemahan otomatis nama dan catatan. Konfirmasikan sebelum mengganti teks. Materi lama mempertahankan teks asli dan label bahasa belum terverifikasi. Draf sambutan tidak diaktifkan di chat atau dikirim saat disiapkan maupun disimpan. Perubahan kampanye atau tautan tidak memperbarui draf lama secara diam-diam; periksa sebelum membagikan. Perubahan belum tersimpan dilindungi saat berpindah tab atau keluar.",
          "活动只有一个名称，切换界面语言时保持原文。推广物料提供独立的英文、印尼文和中文模板草稿：选择已保存推广链接、物料语言和内容类型，再准备、核对并保存。模板拼装已保存事实，不调用AI，也不自动翻译名称及备注。替换已有内容须确认；历史物料保留原文并标明语言未核实。准备或保存欢迎语草稿不会启用聊天欢迎语或发送消息。活动或链接变动不自动改写已有草稿，分享前须重查；切换页签或离开时保护未保存内容。",
        ),
      ),
      n(
        w(
          "Check records and results",
          "Periksa catatan dan hasil",
          "核对客户及结果",
        ),
        w(
          "Results & customers shows customers within your access scope. Registrations count saved customers by first attribution; assessments require saved server evidence. Confirmed participation needs staff-recorded mode and evidence; online registration is not onsite attendance. Enrollment is recorded separately from payment. These are independent measures, not a mandatory funnel. Enrollment share uses the first-attributed customer cohort, not all link visitors; it does not prove causal campaign conversion. Link opens include repeat visits and are not unique visitors or QR scans. Non-campaign source is a read-only bucket with internal ID organic, for first registrations without a specific campaign code. It does not prove unpaid traffic; an ad missing c may enter this group.",
          "Hasil & pelanggan menampilkan pelanggan dalam cakupan akses Anda. Registrasi menghitung pelanggan tersimpan berdasarkan atribusi pertama; asesmen memerlukan bukti server tersimpan. Partisipasi terkonfirmasi memerlukan mode dan bukti yang dicatat staf; registrasi daring bukan kehadiran di lokasi. Pendaftaran kelas dicatat terpisah dari pembayaran. Ini ukuran independen, bukan corong wajib. Proporsi pendaftaran kelas memakai kelompok pelanggan atribusi pertama, bukan semua pengunjung tautan; tidak membuktikan konversi kausal kampanye. Pembukaan tautan termasuk kunjungan berulang, bukan pengunjung unik atau pemindaian QR. Sumber non-kampanye adalah kelompok hanya-baca dengan ID internal organic untuk registrasi pertama tanpa kode kampanye tertentu. Ini bukan bukti lalu lintas tanpa biaya; iklan yang kehilangan c juga dapat masuk.",
          "结果与客户仅展示权限内客户。登记按首次归因统计已保存客户，测评须有已保存服务端依据；确认参与须由员工记录方式及证据，线上登记不证明现场到访。报名与付款分别记录。这些是独立指标，不是必须逐级经过的漏斗。报名占比的分母是首次归因客户群，不是全部链接访问者，也不能证明活动的因果转化效果。链接访问包含重复打开，不等于独立访客或扫码次数。“非活动来源”是内部ID为organic的只读分组，用于首次登记无具体活动码的客户；它不证明免费流量，缺少c的广告也可能归入。",
        ),
      ),
      n(
        w(
          "If flagged: unknown c",
          "Jika ditandai: c tidak dikenal",
          "有待核实项：未知c",
        ),
        w(
          "Source review separates unknown campaign codes from promotion link issues. Only codes with saved leads appear; visits alone do not create a review item. For an unknown c, a CRM Manager can link an existing campaign, create a Planning campaign with a new camp- code and link it, or mark invalid with a reason. Linking or creating retains the original code as a working alias and audit evidence. Existing and future registrations using that alias use the verified campaign association, counting each customer once. Invalid does not delete customers or move them to Non-campaign source. Saving rechecks current codes and review state; refresh after a conflict. Historical visits are not reconstructed.",
          "Verifikasi sumber memisahkan kode kampanye tidak dikenal dari masalah tautan promosi. Hanya kode dengan pelanggan tersimpan yang muncul; kunjungan saja tidak membuat item. Untuk c tidak dikenal, CRM Manager dapat menautkan kampanye yang ada, membuat kampanye Perencanaan dengan kode camp- baru lalu menautkannya, atau menandai tidak valid dengan alasan. Penautan atau pembuatan mempertahankan kode asli sebagai alias yang berfungsi dan bukti audit. Registrasi lama dan baru dengan alias tersebut memakai asosiasi terverifikasi; tiap pelanggan dihitung sekali. Penandaan tidak valid tidak menghapus pelanggan atau memindahkannya ke Sumber non-kampanye. Penyimpanan memeriksa ulang kode dan status verifikasi; muat ulang jika terjadi konflik. Kunjungan historis tidak direkonstruksi.",
          "来源核实分为“未知活动码”和“推广链接问题”。仅收录已生成客户的代码，只有访问不生成核实项。未知c可由CRM管理者关联已有活动、创建使用新camp-码的筹备中活动并关联，或填写依据后标记无效。关联或创建均保留原始代码为可用别名及审计证据；该别名的已有和后续登记使用已核实活动关联，每位客户计一次。无效不会删除客户或归入非活动来源。保存时重新校验代码和核实状态，冲突后需刷新核对，不补造历史访问。",
        ),
      ),
      n(
        w(
          "If flagged: mismatched p",
          "Jika ditandai: p tidak cocok",
          "有待核实项：不匹配的p",
        ),
        w(
          "For a known c with an invalid or mismatched p, review the individual customer. Link an existing entry from that campaign, create an evidence-based entry and link it, leave unconfirmed, or mark the promotion attribution invalid. Each decision needs a reason. Original c/p and first-touch evidence remain. A new entry receives a new p; distribute its new link afterward. This review does not accept future incorrect p values, move the customer’s campaign, change owners, complete tasks or replay notifications. Deferral stays in Needs review; invalidation retains the customer and campaign attribution. Missing p on a legacy campaign-only link is not an error. Saved-result lookup and history show the recorded decision.",
          "Untuk c yang dikenali tetapi p tidak valid atau tidak cocok, tinjau per pelanggan. Tautkan entri yang ada pada kampanye itu, buat entri berdasarkan bukti lalu tautkan, biarkan belum dikonfirmasi, atau tandai atribusi promosi tidak valid. Setiap keputusan memerlukan alasan. c/p asli dan bukti atribusi pertama tetap. Entri baru mendapat p baru; gunakan tautan barunya untuk distribusi berikutnya. Verifikasi tidak menerima p salah pada masa berikutnya, memindahkan kampanye pelanggan, mengubah pemilik, menyelesaikan tugas, atau mengirim ulang notifikasi. Penundaan tetap perlu ditinjau; penandaan tidak valid mempertahankan pelanggan dan atribusi kampanye. p yang tidak ada pada tautan lama bukan kesalahan. Pencarian hasil dan riwayat menunjukkan keputusan tersimpan.",
          "已知c但p无效或不匹配时，按单个客户核实：关联本活动已有入口、依据真实投放创建入口并关联、暂不确认，或标记该推广归因无效。每次须填写依据，原始c/p和首次来源证据保留。新入口产生新p，后续应分发新链接；不会认可未来的错误p，也不会转移客户活动、改变Owner、完成任务或重放通知。暂不确认仍在待核实中；无效保留客户及活动归因。原有只含活动码的链接缺少p不算错误。保存结果查询及历史记录展示实际决定。",
        ),
      ),
    ],
    w(
      "One campaign can have several promotion links; each QR code encodes its displayed link.",
      "Satu kampanye dapat memiliki beberapa tautan promosi; setiap kode QR memuat tautan yang ditampilkan.",
      "一个活动可以有多条推广链接；每个二维码对应其展示的完整链接。",
    ),
    w(
      "Illustration: campaign camp-demo has an Instagram paid_social link p_ad and a campus poster link p_poster. Both use c=camp-demo but different p values. Amelia registers from p_ad: one customer is first-attributed to that campaign and entry. This does not confirm attendance or enrollment.",
      "Ilustrasi: camp-demo memiliki tautan Instagram paid_social p_ad dan poster kampus p_poster. Keduanya memakai c=camp-demo dengan p berbeda. Amelia mendaftar dari p_ad: satu pelanggan diatribusikan pertama ke kampanye dan entri itu. Ini tidak memastikan kehadiran atau pendaftaran kelas.",
      "示例：camp-demo活动有Instagram paid_social链接p_ad及校园poster链接p_poster；c相同，p不同。Amelia经p_ad登记，形成一位首次归因到该活动及入口的客户，不代表已到场或报名。",
    ),
    w(
      "Example IDs are illustrative, not working links. Use the saved URL in the current environment. Template preparation, source review and opening an attendance link do not complete sales tasks or send messages.",
      "ID contoh hanya ilustrasi, bukan tautan aktif. Gunakan URL tersimpan pada lingkungan saat ini. Menyiapkan templat, memverifikasi sumber, atau membuka tautan kehadiran tidak menyelesaikan tugas atau mengirim pesan.",
      "示例ID仅用于说明，不能直接作为有效链接。请使用当前环境已保存链接；准备模板、核实来源或打开参会链接都不完成销售任务，也不发送消息。",
    ),
  ),
  operations: how(
    w(
      "Change timing without rewriting earlier commitments",
      "Ubah pengaturan tanpa menulis ulang janji lama",
      "修改运营规则，不重写已有承诺",
    ),
    w(
      "Sales Operations stores the calendar, response policies and related cadence settings. Only authorized users can edit them.",
      "Operasional penjualan menyimpan kalender, kebijakan respons, dan pengaturan ritme. Hanya pengguna berizin dapat mengubahnya.",
      "销售运营保存工作日历、响应策略及节奏设置，只有具备相应权限的用户可修改。",
    ),
    [
      n(
        w("Check calendar", "Periksa kalender", "先核对工作日历"),
        w(
          "Confirm timezone, working days and working hours before changing response durations.",
          "Pastikan zona waktu, hari, dan jam kerja sebelum mengubah durasi respons.",
          "调整响应时长前，先确认时区、工作日和工作时间。",
        ),
      ),
      n(
        w("Review affected settings", "Tinjau pengaturan", "查看设置用途"),
        w(
          "Read the module's purpose and units. Distinguish response deadlines from retry and milestone parameters.",
          "Baca tujuan dan satuan modul. Bedakan tenggat respons dari parameter percobaan ulang dan tonggak.",
          "阅读模块目的及单位，分清响应期限、重试和里程碑参数。",
        ),
      ),
      n(
        w("Save the right area", "Simpan area yang tepat", "使用对应保存按钮"),
        w(
          "Save Policies saves operational policies. Notification policies and channels use their own save buttons.",
          "Simpan Kebijakan menyimpan kebijakan operasional. Kebijakan notifikasi dan kanal memakai tombol sendiri.",
          "“保存策略”保存运营策略；通知策略与渠道使用各自区域的保存按钮。",
        ),
      ),
      n(
        w("Verify a new case", "Periksa kasus baru", "用新事项验证"),
        w(
          "Check the deadline of a newly generated task. Existing task deadlines should stay as recorded.",
          "Periksa tenggat tugas baru. Tenggat lama tetap seperti catatan sebelumnya.",
          "核对新生成任务的期限；已有任务继续保留原记录。",
        ),
      ),
    ],
    w(
      "A saved policy is not proof that every historical milestone is automatically scheduled.",
      "Kebijakan tersimpan bukan bukti semua tonggak historis dijadwalkan otomatis.",
      "配置已保存，不代表所有历史里程碑均已有服务端自动调度。",
    ),
    w(
      "In the sample calendar, a 3-hour response starts Tuesday at 09:00 for a late Monday request and ends at 12:00.",
      "Dalam kalender contoh, respons 3 jam untuk permintaan Senin malam mulai Selasa 09.00 dan berakhir 12.00.",
      "示例日历中，周一深夜的请求顺延至周二 09:00 起算，3 小时响应期限为 12:00。",
    ),
    w(
      "This is an example calendar, not the current configuration. The deadline method uses natural duration with calendar adjustment, not accumulated working hours.",
      "Ini kalender contoh, bukan konfigurasi saat ini. Metode memakai durasi alami dengan penyesuaian kalender, bukan akumulasi jam kerja.",
      "这是示例日历，不是当前配置。算法采用自然时长加日历调整，并非逐小时累计工作时间。",
    ),
  ),
  notifications: how(
    w(
      "Configure a reminder and inspect its delivery evidence",
      "Atur pengingat dan periksa bukti kirim",
      "配置提醒，并按回执核对发送结果",
    ),
    w(
      "Choose what event matters, when to send and through which channel. Check the resulting delivery record independently.",
      "Pilih peristiwa, waktu, dan kanal. Periksa catatan pengiriman secara terpisah.",
      "先决定关注什么事件、何时发、通过哪个渠道，再独立核对发送记录。",
    ),
    [
      n(
        w(
          "Choose event and conditions",
          "Pilih peristiwa dan syarat",
          "选择事件与条件",
        ),
        w(
          "Use the searchable multi-selects. Check enabled state, conditions and recipient routing before saving.",
          "Gunakan pilihan jamak dengan pencarian. Periksa status aktif, syarat, dan penerima sebelum menyimpan.",
          "通过可搜索多选填写条件，保存前核对启停状态、条件和接收人路由。",
        ),
      ),
      n(
        w("Choose timing", "Pilih waktu", "确认发送时间"),
        w(
          "Use the global calendar by default. Set a digest or custom window only when that mode requires it.",
          "Gunakan kalender global secara bawaan. Atur ringkasan atau waktu khusus hanya jika mode memerlukannya.",
          "默认继承全局日历；仅在相应模式需要时填写汇总时间或自定义窗口。",
        ),
      ),
      n(
        w("Check the channel", "Periksa kanal", "核对渠道"),
        w(
          "Simulation makes no external delivery. Real Lark uses a server environment variable. Group limits belong to the channel.",
          "Simulasi tidak mengirim keluar. Lark nyata memakai variabel lingkungan server. Batas grup berada pada kanal.",
          "模拟不外发；真实 Lark 引用服务端环境变量，群级限流属于渠道配置。",
        ),
      ),
      n(
        w("Read the receipt", "Baca tanda terima", "检查发送回执"),
        w(
          "Distinguish pending, sending, simulated, API accepted, failed, unknown and cancelled. Inspect the cause before another send.",
          "Bedakan tertunda, mengirim, simulasi, diterima API, gagal, tidak diketahui, dan dibatalkan. Periksa sebab sebelum mengirim lagi.",
          "区分待发、发送中、模拟、接口接受、失败、未知和取消；查清原因再考虑重发。",
        ),
      ),
    ],
    w(
      "Verify both policy save and channel save. A selected option alone does not activate a draft.",
      "Periksa penyimpanan kebijakan dan kanal. Memilih opsi saja tidak mengaktifkan draf.",
      "分别确认策略和渠道保存成功，选中选项本身不会启用草稿。",
    ),
    w(
      "A missing channel yields configuration failure. Setting simulation explicitly yields a simulated result. These must never be presented as the same outcome.",
      "Kanal hilang menghasilkan kegagalan konfigurasi. Mode simulasi eksplisit menghasilkan simulasi. Keduanya bukan hasil yang sama.",
      "渠道缺失应显示配置失败；明确选择模拟模式才是模拟发送，两者不可混淆。",
    ),
    w(
      "New policy versions affect new events. Pending jobs retain snapshots. Do not replay historical failures blindly. Email and SMS delivery are not connected.",
      "Versi baru berlaku untuk peristiwa baru. Tugas tertunda menyimpan snapshot. Jangan mengulang kegagalan lama tanpa pemeriksaan. Email dan SMS belum tersambung.",
      "新版本影响新事件，待发任务保留快照。不要盲目重放历史失败；Email 与短信发送器尚未接通。",
    ),
  ),
  support: how(
    w(
      "Recover safely when a result is uncertain",
      "Pulihkan dengan aman saat hasil belum pasti",
      "结果不确定时，先核查再继续",
    ),
    w(
      "A failed response does not prove that the server failed to save. Keep the original draft and check the result.",
      "Respons gagal tidak membuktikan server gagal menyimpan. Pertahankan draf asli dan periksa hasil.",
      "没有收到成功响应，不等于服务端没有保存；先保留原草稿并查询结果。",
    ),
    [
      n(
        w("Identify the failure", "Kenali kegagalan", "辨别问题类型"),
        w(
          "Separate unavailable task data, failed saves, changed access and notification delivery problems.",
          "Bedakan data tugas tak tersedia, simpan gagal, izin berubah, dan masalah pengiriman.",
          "分清任务加载失败、保存失败、权限变化与通知发送问题。",
        ),
      ),
      n(
        w("Preserve the draft", "Pertahankan draf", "保留草稿"),
        w(
          "Do not refresh or close the page before resolving an unsaved draft. A temporary connection failure does not require sign-out.",
          "Jangan muat ulang atau tutup halaman sebelum menangani draf. Gangguan sementara tidak memerlukan keluar akun.",
          "未保存草稿处理完之前不要刷新或关闭页面；临时断线不需要主动退出登录。",
        ),
      ),
      n(
        w(
          "Query or retry the same request",
          "Periksa atau ulangi permintaan sama",
          "查询或重试原请求",
        ),
        w(
          "Use the result query or retry unchanged. Do not create a second contact to compensate for an uncertain response.",
          "Gunakan pemeriksaan hasil atau ulangi tanpa perubahan. Jangan buat kontak kedua untuk respons belum pasti.",
          "查询保存结果或保持原内容重试，不要为补偿不确定响应而新建第二条联系。",
        ),
      ),
      n(
        w("Escalate with evidence", "Laporkan dengan bukti", "携带依据求助"),
        w(
          "Provide customer/task ID, time, visible error and version. Do not send passwords or Webhook values.",
          "Sertakan ID pelanggan/tugas, waktu, kesalahan, dan versi. Jangan kirim sandi atau nilai Webhook.",
          "提供客户／任务 ID、时间、错误提示及版本信息，不发送密码或 Webhook 值。",
        ),
      ),
    ],
    w(
      "Continue only after the saved outcome and your current permissions are clear.",
      "Lanjutkan setelah hasil tersimpan dan izin saat ini jelas.",
      "确认实际保存结果和当前权限后，再继续下一步。",
    ),
    w(
      "The server commits a note but the reply is lost. Querying the original request returns that saved result without a second record.",
      "Server menyimpan catatan tetapi balasan hilang. Memeriksa permintaan asli mengembalikan hasil tanpa catatan kedua.",
      "服务端已保存记录但响应丢失，查询原请求返回已保存结果，不再生成第二条记录。",
    ),
    w(
      "Unsaved drafts live in this page memory. Closing, refreshing or signing out can clear them. Unknown task data is not zero pending work.",
      "Draf belum tersimpan berada di memori halaman. Menutup, memuat ulang, atau keluar dapat menghapusnya. Data tugas tak diketahui bukan nol pekerjaan.",
      "未保存草稿位于当前页内存，关闭、刷新或退出可能清除。任务信息不可用不能显示或理解为没有待办。",
    ),
  ),
});
Object.assign(guideLessons, {
  "efficient-followup": how(
    w(
      "Choose the next customer",
      "Pilih pelanggan berikutnya",
      "选择下一位需要处理的客户",
    ),
    w(
      "Use the work queue to prioritize actual work, not unread counts alone.",
      "Gunakan antrean untuk memprioritaskan pekerjaan, bukan hanya jumlah belum dibaca.",
      "工作队列优先呈现实际待办，不只看未读数量。",
    ),
    [
      n(
        w(
          "Start from role defaults",
          "Mulai dari bawaan peran",
          "从角色默认视图开始",
        ),
        w(
          "Sales: own Needs handling. Manager: all accessible customers. Reset returns to these defaults.",
          "Sales: milik sendiri yang Perlu ditangani. Pengelola: semua yang dapat diakses. Reset kembali ke bawaan ini.",
          "销售：本人需处理；管理者：全部可访问客户。重置恢复角色默认。",
        ),
      ),
      n(
        w("Read priority", "Baca prioritas", "查看处理优先级"),
        w(
          "Overdue, due today, explicit requests or first contact, then other work needing review. Waiting or stopped customers may need internal handling.",
          "Terlambat, jatuh tempo hari ini, permintaan jelas atau kontak pertama, lalu hal lain yang perlu ditinjau. Pelanggan menunggu atau berhenti mungkin perlu penanganan internal.",
          "依次关注逾期、今天到期、明确请求／首次联系和其他待核实事项；等待或停止客户可能只需内部处理。",
        ),
      ),
      n(
        w("Read before contact", "Baca sebelum kontak", "联系前先读结论"),
        w(
          "Read the latest attempt and the latest successful conversation separately. Staff notes remain original.",
          "Baca upaya terbaru dan percakapan berhasil terbaru secara terpisah. Catatan staf tetap asli.",
          "分别查看最近尝试与最近成功沟通；人工摘要保留原文。",
        ),
      ),
    ],
    w(
      "Know why this customer needs handling now.",
      "Ketahui alasan pelanggan perlu ditangani sekarang.",
      "能说明这位客户为什么现在需要处理。",
    ),
    w(
      "A future ordinary task may remain only in All. A new explicit request can make the same customer need handling now.",
      "Tugas biasa di masa depan dapat hanya terlihat di Semua. Permintaan baru dapat membuat pelanggan perlu ditangani sekarang.",
      "仅有未来普通任务的客户可能只在“全部”中出现；新的明确请求可使其需要现在处理。",
    ),
    w(
      "Reading messages does not clear business work. Unavailable task information needs retry, not exclusion as no work.",
      "Membaca pesan tidak menyelesaikan pekerjaan. Data tugas tidak tersedia perlu dicoba ulang, bukan dianggap tanpa tugas.",
      "已读不会清掉业务事项；任务信息不可用须重试，不能按无待办排除。",
    ),
  ),
  filters: how(
    w(
      "Narrow the list without changing access",
      "Persempit daftar tanpa mengubah izin",
      "筛选缩小列表，不改变权限",
    ),
    w(
      "Combine work scope, Owner and task filters with the six optional categories.",
      "Gabungkan lingkup, penanggung jawab, dan tugas dengan enam kategori opsional.",
      "组合工作范围、负责人、任务筛选与六个可选分类。",
    ),
    [
      n(
        w("Find the customer", "Cari pelanggan", "查找客户"),
        w(
          "Search name, phone, email or lead number. The Owner selector supports search.",
          "Cari nama, telepon, email, atau nomor pelanggan. Pilihan penanggung jawab mendukung pencarian.",
          "按姓名、电话、邮箱或业务编号搜索；负责人下拉支持搜索。",
        ),
      ),
      n(
        w("Select work", "Pilih pekerjaan", "选择待办范围"),
        w(
          "Use task status and unread filters independently. Today and overdue use reliable task times in the operating timezone.",
          "Gunakan filter tugas dan belum dibaca secara terpisah. Hari ini dan terlambat memakai waktu tugas tepercaya di zona operasional.",
          "任务与未读独立筛选；今日到期及逾期使用运营时区和可信任务时间。",
        ),
      ),
      n(
        w(
          "Add categories if needed",
          "Tambah kategori jika perlu",
          "按需展开更多条件",
        ),
        w(
          "Customer group, sales stage, contact status, follow-up situation, learning format and buying signal refine the result.",
          "Kelompok, tahap, status kontak, situasi tindak lanjut, format belajar, dan sinyal pembelian menyaring hasil.",
          "客户分组、销售阶段、联系状态、跟进情形、授课方式、购买信号进一步缩小结果。",
        ),
      ),
    ],
    w(
      "The list and its count reflect the same filters and permissions.",
      "Daftar dan jumlah memakai filter serta izin yang sama.",
      "列表与计数使用相同筛选和权限范围。",
    ),
    w(
      "A historical task with an unknown date belongs in review, not automatically in overdue.",
      "Tugas historis tanpa tanggal masuk tinjauan, bukan otomatis terlambat.",
      "历史任务没有可靠日期，应待核实，不能自动判为逾期。",
    ),
    w(
      "Long unattempted contact uses existing contact timestamps and configured duration. It is not the same as no successful reply.",
      "Lama tanpa upaya kontak memakai waktu kontak dan durasi konfigurasi. Ini berbeda dari tidak ada balasan berhasil.",
      "长期未尝试联系依据既有联系时间与配置时长，不等于长期没有成功回复。",
    ),
  ),
  "visual-status": lesson(
    w(
      "Color points to a state, not customer worth",
      "Warna menunjukkan status, bukan nilai pelanggan",
      "颜色表达状态，不代表客户价值高低",
    ),
    w(
      "Read the text beside the color. Customer group remains a neutral category.",
      "Baca teks di samping warna. Kelompok pelanggan tetap kategori netral.",
      "颜色必须与状态文字一起阅读，客户分组保持中性分类样式。",
    ),
    w(
      "One urgent signal stays visible without competing with every label.",
      "Sinyal mendesak tetap terlihat tanpa bersaing dengan semua label.",
      "减少颜色竞争，让真正需要处理的事项更容易识别。",
    ),
    [
      n(
        w("Action / information", "Tindakan / informasi", "操作／信息"),
        w(
          "Teal: main action or selection. Blue: unread or new information.",
          "Hijau kebiruan: tindakan utama atau pilihan. Biru: informasi baru atau belum dibaca.",
          "青绿色：主操作或选中；蓝色：未读或新信息。",
        ),
      ),
      n(
        w("Timing / review", "Waktu / tinjauan", "期限／核实"),
        w(
          "Red: current overdue or failure. Amber: due today or requires review; the words distinguish them.",
          "Merah: terlambat atau gagal. Kuning: jatuh tempo hari ini atau perlu ditinjau; teks membedakannya.",
          "红色：当前逾期或失败；琥珀色：今天到期或待核实，由文字进一步区分。",
        ),
      ),
      n(
        w("Outcome / context", "Hasil / konteks", "结果／背景"),
        w(
          "Green: completed or confirmed. Neutral: categories, history and supporting information.",
          "Hijau: selesai atau terkonfirmasi. Netral: kategori, riwayat, dan informasi pendukung.",
          "绿色：完成或确认；中性：分类、历史与辅助信息。",
        ),
      ),
    ],
    w(
      "High interest does not use the alarm meaning of red.",
      "Minat tinggi tidak memakai makna peringatan merah.",
      "高意向不能借用红色警报语义。",
    ),
    w(
      "A blue unread mark can coexist with an amber task due today. Reading removes the first, not the second.",
      "Tanda biru belum dibaca dapat muncul bersama tugas kuning hari ini. Membaca menghapus yang pertama, bukan yang kedua.",
      "蓝色未读与琥珀色今日到期可以并存；阅读只改变前者。",
    ),
    w(
      "A buying-signal link opens evidence. It is not a command to contact immediately.",
      "Tautan sinyal pembelian membuka bukti, bukan perintah menghubungi segera.",
      "购买信号链接打开依据，不是立即联系的命令。",
    ),
    "comparison",
  ),
  "buying-evidence-sources": lesson(
    w(
      "Interest, intent and historical labels differ",
      "Minat, niat, dan label lama berbeda",
      "关注内容、购买意向与历史标签不同",
    ),
    w(
      "Read the saved source before treating a label as buying intent.",
      "Baca sumber tersimpan sebelum menganggap label sebagai niat membeli.",
      "先看保存来源，再判断标签是否代表购买意向。",
    ),
    w(
      "This prevents a questionnaire choice from becoming an invented customer conversation.",
      "Ini mencegah pilihan kuesioner dianggap sebagai percakapan yang tidak terjadi.",
      "避免把问卷选项改说成客户实际询问或承诺。",
    ),
    [
      n(
        w("Questionnaire interest", "Minat kuesioner", "问卷关注"),
        w(
          "A selected topic records interest. It does not prove that the customer asked about price during a conversation.",
          "Topik terpilih mencatat minat. Ini tidak membuktikan pelanggan menanyakan harga dalam percakapan.",
          "选中主题表示关注，不证明客户在沟通中实际询价。",
        ),
      ),
      n(
        w("Supported intent", "Niat berbukti", "有依据意向"),
        w(
          "Saved staff evidence or structured Chat requests link to original notes, messages or tasks.",
          "Bukti staf atau permintaan Chat terstruktur menautkan catatan, pesan, atau tugas asli.",
          "员工记录或 咨询对话 结构化请求关联原始备注、消息或任务。",
        ),
      ),
      n(
        w("Historical label", "Label historis", "历史标签"),
        w(
          "A label without evidence stays historical. Do not manufacture its source from the current profile.",
          "Label tanpa bukti tetap historis. Jangan membuat sumber dari profil saat ini.",
          "无依据标签作为历史信息保留，不从当前资料反推来源。",
        ),
      ),
    ],
    w(
      "Use supported intent in buying-signal filters; questionnaire interests remain separate.",
      "Gunakan niat berbukti dalam filter sinyal pembelian; minat kuesioner tetap terpisah.",
      "购买信号筛选使用有依据意向，问卷关注另行展示。",
    ),
    w(
      "Amelia selects fees as an interest. Later she explicitly requests enrollment. Only the latter is a structured request with a task link.",
      "Amelia memilih biaya sebagai minat. Kemudian ia meminta pendaftaran kelas. Yang terakhir adalah permintaan terstruktur dengan tautan tugas.",
      "Amelia 在问卷勾选学费，后来明确提出报名请求；后者才是关联任务的结构化请求。",
    ),
    w(
      "Ordinary Chat text does not automatically extract buying signals. A request is not confirmed payment or enrollment.",
      "Teks Chat biasa tidak otomatis mengekstrak sinyal pembelian. Permintaan bukan konfirmasi pembayaran atau pendaftaran.",
      "普通 咨询对话 文本不会自动提取购买信号，请求不等于已付款或已报名。",
    ),
    "comparison",
  ),
  "failure-and-accessibility": how(
    w(
      "Use the guide and forms with a keyboard",
      "Gunakan panduan dan formulir dengan keyboard",
      "通过键盘与目录完成查找",
    ),
    w(
      "Navigation and status text remain usable without relying on color or a mouse.",
      "Navigasi dan teks status dapat dipakai tanpa bergantung pada warna atau mouse.",
      "通过导航、焦点和状态文字使用页面，不必只依赖鼠标或颜色。",
    ),
    [
      n(
        w("Move focus", "Pindahkan fokus", "移动焦点"),
        w(
          "Use Tab and Shift+Tab between controls. Use Enter or Space to activate the focused button.",
          "Gunakan Tab dan Shift+Tab antar kontrol. Gunakan Enter atau Spasi untuk tombol yang difokuskan.",
          "Tab／Shift+Tab 切换控件，Enter 或空格触发聚焦按钮。",
        ),
      ),
      n(
        w("Choose and close", "Pilih dan tutup", "选择与收起"),
        w(
          "Use supported arrow-key navigation in choices and tabs. Escape closes dropdowns or the narrow-screen chapter directory.",
          "Gunakan panah pada pilihan dan tab yang mendukungnya. Escape menutup pilihan atau daftar bab layar kecil.",
          "支持方向键的选项和页签可用方向键切换；Escape 关闭下拉或窄屏章节目录。",
        ),
      ),
      n(
        w("Locate a chapter", "Temukan bab", "定位章节"),
        w(
          "Search terms in either part. Select a result to open the chapter. Browser Back and Forward restore chapter navigation.",
          "Cari istilah pada kedua bagian. Pilih hasil untuk membuka bab. Tombol Kembali dan Maju memulihkan navigasi bab.",
          "搜索两部分的术语，选择结果打开章节；浏览器前进／后退恢复章节导航。",
        ),
      ),
    ],
    w(
      "Focus should remain on the selected control or move to the relevant error or chapter.",
      "Fokus tetap pada pilihan atau berpindah ke kesalahan atau bab terkait.",
      "焦点应保留在所选控件，或移动至相关错误与章节。",
    ),
    w(
      "On a phone, open Chapters and search, choose a chapter and read after the directory closes.",
      "Di ponsel, buka Bab dan pencarian, pilih bab, lalu baca setelah daftar tertutup.",
      "手机上打开章节目录与搜索，选章后目录收起，再阅读正文。",
    ),
    w(
      "Keyboard access does not bypass permissions. Preserve unsaved input before refreshing or signing out.",
      "Keyboard tidak melewati izin. Pertahankan input sebelum memuat ulang atau keluar.",
      "键盘操作不会绕过权限；刷新或退出前先处理未保存输入。",
    ),
  ),
  "process-and-marketing-metrics": how(
    w(
      "Use metrics to find a process problem",
      "Gunakan metrik untuk menemukan masalah proses",
      "用指标定位过程问题",
    ),
    w(
      "Start with customers awaiting ownership or action, then inspect communication quality and campaign evidence.",
      "Mulai dari pelanggan tanpa penanggung jawab atau tindakan, lalu periksa komunikasi dan bukti kampanye.",
      "先看无人负责或无后续安排的客户，再看沟通质量与活动结果依据。",
    ),
    [
      n(
        w("Set the population", "Tentukan populasi", "确定统计范围"),
        w(
          "Check worklist filters and permissions for process metrics. Campaign cards use campaign filters instead.",
          "Periksa filter daftar dan izin untuk metrik proses. Kartu kampanye memakai filter kampanye.",
          "过程概览看工作列表筛选及权限；活动卡片使用活动筛选。",
        ),
      ),
      n(
        w("Read quality signals", "Baca indikator mutu", "查看质量指标"),
        w(
          "Compare contact attempts with successful conversations. Inspect overdue work, no next step and missing-time counts.",
          "Bandingkan upaya dengan percakapan berhasil. Periksa tugas terlambat, tanpa langkah lanjut, dan waktu hilang.",
          "分别看尝试与成功沟通，核查逾期、未安排下一步和时间缺失数量。",
        ),
      ),
      n(
        w("Trace the evidence", "Telusuri bukti", "追溯记录"),
        w(
          "Open the customer to inspect contact records, task deadlines and participation or enrollment evidence.",
          "Buka pelanggan untuk memeriksa kontak, tenggat, serta bukti partisipasi atau pendaftaran.",
          "打开客户核对联系记录、任务期限、参与或报名依据。",
        ),
      ),
    ],
    w(
      "Explain the count with its population and evidence before using it to guide action.",
      "Jelaskan jumlah beserta populasi dan bukti sebelum menentukan tindakan.",
      "先解释数字的范围与依据，再据此采取行动。",
    ),
    w(
      "Three contact attempts and one two-way conversation are different measures. A missing timestamp does not become a zero-minute response.",
      "Tiga upaya dan satu percakapan dua arah adalah ukuran berbeda. Waktu hilang bukan respons nol menit.",
      "三次联系尝试与一次双向沟通是不同指标；缺失时间不能记为零分钟响应。",
    ),
    w(
      "No denominator means no ratio. Recorded revenue and planned budget do not establish profit or ROI.",
      "Tanpa penyebut, rasio tidak tersedia. Pendapatan tercatat dan anggaran rencana tidak membuktikan laba atau ROI.",
      "没有分母时不计算比例；登记收入与计划预算不能证明利润或投资回报。",
    ),
  ),
});

// Scope statements describe the whole chapter; lesson titles describe the diagram.
export const guideChapterScopes: Record<string, Words> = {
  followup: w(
    "Record actual contact, keep a separate note, or handle a specific task. Completion, rescheduling, replacement, cancellation and added information have different effects. The example below follows an unanswered attempt; other outcomes remain available.",
    "Catat kontak nyata, simpan catatan terpisah, atau tangani tugas tertentu. Penyelesaian, penjadwalan ulang, penggantian, pembatalan, dan tambahan informasi memiliki dampak berbeda. Contoh berikut memakai upaya tanpa jawaban; hasil lain tetap tersedia.",
    "本章涵盖记录联系、记笔记，以及任务完成、改期、替代、取消和补充信息。不同操作的影响分别确认；下方用未接通案例演示，其他联系结果仍按实际情况选择。",
  ),
  access: w(
    "Sign in, check your permissions, use the account menu and inspect the current environment and version.",
    "Masuk, periksa izin, gunakan menu akun, dan periksa lingkungan serta versi saat ini.",
    "登录后确认权限范围，使用账号菜单，并核对当前环境与版本。",
  ),
  assessment: w(
    "Review saved results, performance and supporting evidence. Learning goals belong in Profile; contact-message previews are covered in the follow-up chapter.",
    "Tinjau hasil tersimpan, performa, dan bukti pendukung. Tujuan belajar ada di Profil; pratinjau pesan kontak dibahas pada bab tindak lanjut.",
    "查看已保存的测评结果、作答表现及依据。学习目标在客户资料中查看；联系预览在跟进操作章节说明。",
  ),
  "data-implementation": w(
    "Look up CRM storage, server access boundaries, transaction behavior and field definitions. The diagram below explains how evidence differs from current state.",
    "Cari penyimpanan CRM, batas akses server, perilaku transaksi, dan definisi kolom. Diagram berikut membedakan bukti dari status saat ini.",
    "本章提供CRM存储方式、服务端权限边界、事务处理与字段字典；下方图解先说明原始依据与当前状态的区别。",
  ),
};
