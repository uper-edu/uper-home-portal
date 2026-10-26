import {accessSafetyErrors} from "./accessSafetyLanguage";
import type { CrmLanguage } from "./crmLanguage";
const accessErrors: Record<string, [string, string, string]> = {
  OWNER_MANAGER_REQUIRED: ["Only a CRM Manager with existing assignment permission can transfer Lead ownership under the current policy.","Kebijakan saat ini hanya mengizinkan CRM Manager dengan izin penugasan yang ada memindahkan Owner Lead.","当前配置仅允许具备原有分配权限的CRM Manager交接Lead归属。"],
  access_invalid_email: [
    "Enter a valid login email or leave it blank.",
    "Masukkan email login yang valid atau kosongkan.",
    "请填写有效的登录邮箱，或留空。",
  ],
  access_email_exists: [
    "This email is already assigned to another account.",
    "Email ini sudah digunakan akun lain.",
    "此邮箱已分配给其他账号。",
  ],
  access_delegation_denied: [
    "You cannot manage or grant access beyond your delegated authority.",
    "Anda tidak dapat mengelola atau memberikan akses di luar kewenangan yang didelegasikan.",
    "不能管理或授予超出本人委托范围的权限。",
  ],
  access_invalid_role: [
    "Enter valid role names and permissions.",
    "Masukkan nama peran dan izin yang valid.",
    "请填写有效的角色名称和权限。",
  ],
  access_invalid_permission: [
    "The selected permission or scope is invalid.",
    "Izin atau cakupan yang dipilih tidak valid.",
    "选择的权限或范围无效。",
  ],
  access_owner_requires_followup: [
    "Eligible owners require follow-up permission in the same role.",
    "Penanggung jawab yang memenuhi syarat memerlukan izin tindak lanjut pada peran yang sama.",
    "可担任负责人须在同一角色中启用处理跟进权限。",
  ],
  access_requires_access_read: [
    "System actions require permission to view users and effective access.",
    "Tindakan sistem memerlukan izin melihat pengguna dan akses efektif.",
    "系统操作须同时启用查看用户及最终权限。",
  ],
  access_requires_read: [
    "CRM actions require customer viewing permission in the same role.",
    "Tindakan CRM memerlukan izin melihat pelanggan pada peran yang sama.",
    "客户操作须在同一角色中启用查看客户权限。",
  ],
  access_claim_requires_owner: [
    "Claiming requires eligibility as a customer owner.",
    "Pengambilan pelanggan memerlukan kelayakan sebagai penanggung jawab.",
    "认领客户须启用可担任客户负责人。",
  ],
  access_requires_notification_read: [
    "Managing notifications requires viewing notifications.",
    "Pengelolaan notifikasi memerlukan izin melihat notifikasi.",
    "管理通知须同时启用查看通知。",
  ],
  access_reason_required: [
    "Explain the reason for this change.",
    "Jelaskan alasan perubahan ini.",
    "请填写本次变更原因。",
  ],
  access_invalid_user: [
    "Check the login ID, name, roles and password.",
    "Periksa ID login, nama, peran dan kata sandi.",
    "请检查登录ID、姓名、角色和密码。",
  ],
  access_conflict: [
    "The record changed. Reload before saving; your draft remains.",
    "Data telah berubah. Muat ulang sebelum menyimpan; draf tetap ada.",
    "记录已变化，请重新载入后保存；草稿仍保留。",
  ],
  access_last_administrator: [
    "At least one active administrator must retain all access-management permissions.",
    "Setidaknya satu administrator aktif harus memiliki seluruh izin pengelolaan akses.",
    "必须保留至少一位拥有完整权限管理能力的有效管理员。",
  ],
  access_login_exists: [
    "This login ID already exists.",
    "ID login sudah ada.",
    "该登录ID已存在。",
  ],
  access_invalid_password: [
    "Use a password of 8–200 characters.",
    "Gunakan kata sandi sepanjang 8–200 karakter.",
    "密码长度须为8–200个字符。",
  ],
  access_user_missing: [
    "User not found.",
    "Pengguna tidak ditemukan.",
    "用户不存在。",
  ],
  access_unavailable: [
    "Unable to confirm saving. Your draft remains; load and compare the current record before retrying.",
    "Hasil penyimpanan belum dapat dipastikan. Draf tetap ada; muat dan bandingkan data terbaru sebelum mencoba lagi.",
    "保存结果暂无法确认，草稿仍保留；请载入当前记录核对后再重试。",
  ],
  "Permission denied": [
    "You do not have permission for this action.",
    "Anda tidak memiliki izin untuk tindakan ini.",
    "你没有执行此操作的权限。",
  ],
  "Login required": [
    "Your session ended. Sign in again.",
    "Sesi berakhir. Login kembali.",
    "会话已结束，请重新登录。",
  ],
  access_origin_rejected: [
    "The request could not be verified. Refresh and retry.",
    "Permintaan tidak dapat diverifikasi. Muat ulang dan coba lagi.",
    "请求无法验证，请刷新后重试。",
  ],
};
export function accessError(value: string, lang: CrmLanguage) {
  return (
    (accessSafetyErrors[value] || accessErrors[value])?.[lang === "zh" ? 2 : lang === "id" ? 1 : 0] ||
    accessErrors.access_unavailable[lang === "zh" ? 2 : lang === "id" ? 1 : 0]
  );
}
export const accessGuide: [string, string, string][] = [
  ['The account menu shows the environment, the last four characters of the Build ID and build time. Open Version and environment for the complete Code (GitHub commit), commit time, Build ID, build time and copy buttons. Times use UTC; missing historical times are not inferred. The dialog also shows the environment and source state captured at build time (or startup in source mode), rather than live Git status. Matching Code with no uncommitted changes identifies the same commit; builds can differ between environments. If page and server versions differ, save your work before refreshing. Health reports the actual dataset. Retired name-password resets are unavailable; normal password rules apply without changing existing accounts.',
  'Menu akun menampilkan lingkungan, empat karakter terakhir ID Build dan waktu build. Buka Versi dan lingkungan untuk melihat Code (commit GitHub), waktu commit, ID Build lengkap, waktu build dan tombol salin. Waktu menggunakan UTC; waktu historis yang belum dicatat tidak diperkirakan. Lingkungan dan status kode saat build (atau saat mulai dalam mode sumber), bukan status Git secara langsung, juga ditampilkan. Code yang sama tanpa perubahan yang belum dikomit menunjukkan commit yang sama; Build dapat berbeda antarlingkungan. Jika versi halaman dan server berbeda, simpan pekerjaan sebelum memuat ulang. Pemeriksaan kesehatan melaporkan dataset sebenarnya. Reset berdasarkan nama tidak tersedia; aturan kata sandi biasa berlaku tanpa mengubah akun yang ada.',
  '账号菜单显示环境、Build末4位及构建时间；点击“版本与环境”查看完整Code（GitHub提交链接）、提交时间、完整Build、构建时间及复制按钮。时间统一使用UTC，历史缺失时间不推测补齐。弹窗同时显示环境与构建时（源码模式为启动时）的源码状态，而非实时Git状态。Code相同且均无未提交改动表示提交一致，不同环境的Build可以不同。页面与服务版本不同时，先保存工作再刷新。健康接口显示实际数据集。已取消姓名密码重置例外，恢复常规密码规则，不改变现有账号。'],
  ['In the company test environment, full system administrators can open Test environment & accounts and copy links and preset accounts as plain text. Roles are current; only a verified initial password is displayed. Later-created accounts and changed passwords are excluded. This page does not reset accounts or grant access.',
  'Di lingkungan uji perusahaan, administrator sistem dengan izin lengkap dapat membuka Lingkungan uji & akun dan menyalin tautan serta akun bawaan sebagai teks biasa. Peran mengikuti konfigurasi terkini; hanya kata sandi awal yang terverifikasi ditampilkan. Akun tambahan dan kata sandi yang telah diubah tidak disertakan. Halaman ini tidak mereset akun atau memberikan akses.',
  '在公司测试环境中，拥有完整系统管理权限的管理员可进入“测试环境和账号”，复制入口和预置账号的纯文本。角色读取当前配置，仅显示核实仍有效的初始密码；不列出后来新增的账号，不显示已修改的密码。此页面不会重置账号或授予权限。'],
  [
    "Users identify people; roles describe duties; permissions authorize actions; scopes limit each action to own or all customers. Eligible sales use a shared unassigned pool; teams do not control access.",
    "Pengguna mengidentifikasi orang; peran menjelaskan tugas; izin mengatur tindakan; cakupan membatasi tindakan pada pelanggan sendiri atau semua pelanggan. Sales yang berwenang memakai kumpulan pelanggan tanpa penanggung jawab bersama; tim tidak mengatur akses.",
    "用户标识人员，角色定义职责，权限授权操作，数据范围限制每项操作处理本人或全部客户；有认领权限的销售使用共享未分配客户池，团队不参与授权。",
  ],
  [
    "System Administrator does not automatically gain customer or CMS access. Grant separate business roles when needed. Existing account IDs, passwords, ownership and deadlines are retained. HR Recruiter currently permits viewing recruitment applications only; the title does not grant recruitment management or editing.",
    "Administrator Sistem tidak otomatis memperoleh akses pelanggan atau CMS. Tetapkan peran bisnis secara terpisah. ID akun, kata sandi, kepemilikan, dan tenggat lama dipertahankan. Staf Rekrutmen saat ini hanya dapat melihat lamaran; nama peran tidak memberikan izin mengelola rekrutmen atau mengedit data.",
    "系统管理员不会自动获得客户或CMS访问权，需要时另行授予业务角色。已有账号ID、密码、客户归属和截止时间保留。HR招聘专员目前仅可查看招聘申请，角色名称不代表拥有招聘管理或编辑权限。",
  ],
  [
    "Roles combine permissions per action, not through a single largest scope. Unknown permissions are denied. The server checks access on each request.",
    "Peran menggabungkan izin per tindakan, bukan satu cakupan terluas. Izin yang tidak dikenal ditolak. Server memeriksa akses setiap permintaan.",
    "多个角色按具体操作合并权限，不使用一个全局最大范围。未知权限默认拒绝，服务端逐请求检查。",
  ],
  [
    "Sales can view eligible unassigned customers and claim only for themselves. Viewing does not grant editing or assignment to other staff. Owner lists use active ownership eligibility. Eligibility does not grant permission to view, edit or export other customers.",
    "Sales dapat melihat pelanggan tanpa penanggung jawab yang memenuhi cakupan dan mengambilnya untuk diri sendiri. Melihat tidak memberi izin mengedit atau menugaskan ke staf lain. Daftar pemilik menggunakan kelayakan aktif. Kelayakan ini tidak memberi izin melihat, mengedit, atau mengekspor pelanggan lain.",
    "销售可查看符合范围的未分配客户，并只能认领自己。查看不代表可以编辑或分配给他人。负责人候选按有效任职资格生成，任职资格不授予查看、编辑或导出他人客户的权限。",
  ],
  [
    "Preview role changes before saving. A delegated operator cannot grant or manage privileges beyond their authority. A reason and current record version are required. Permission changes revoke affected sessions; sign in again. Restart does not restore revoked roles.",
    "Pratinjau perubahan peran sebelum menyimpan. Operator yang didelegasikan tidak dapat memberi atau mengelola akses di luar kewenangannya. Alasan dan versi terbaru diperlukan. Perubahan izin mencabut sesi terkait; login kembali. Mulai ulang tidak memulihkan peran yang dicabut.",
    "角色修改先预览影响，委托操作员不能授予或管理超出本人授权范围的权限。保存须填写原因并校验当前版本。授权变化撤销受影响会话，需重新登录；重启不会补回已撤销角色。",
  ],
  [
    "Disabling a user keeps historical attribution and customer ownership. Review the affected customer and task counts, then ask a CRM Manager to reassign business work explicitly. Invalid owners use manager notification fallback.",
    "Menonaktifkan pengguna mempertahankan riwayat dan kepemilikan pelanggan. Tinjau jumlah pelanggan dan tugas terkait, lalu minta Manajer CRM melakukan penugasan ulang. Pemilik tidak valid memakai notifikasi cadangan manajer.",
    "停用用户保留历史署名和客户归属。检查受影响客户与任务数量，再由CRM管理者明确重新分配；无效负责人通知转管理者兜底。",
  ],
  [
    "Existing passwords are never displayed. Credential reset uses a new password chosen by the administrator and revokes sessions; deliver it securely. The user can then change it. Passwords are not recorded in the audit.",
    "Kata sandi lama tidak ditampilkan. Reset memakai kata sandi baru yang dipilih administrator dan mencabut sesi; sampaikan secara aman. Pengguna kemudian dapat mengubahnya. Kata sandi tidak dicatat dalam audit.",
    "已有密码不可查看。重置使用管理员指定的新密码并撤销会话，请安全交付，用户随后可自行修改；审计不记录密码。",
  ],
  [
    "The last-complete-administrator protection remains active. Keep two complete System Administrators for continuity; restore release requires two. Audit identifies the operator, reason and before/after changes. Changes do not replay historical notifications.",
    "Perlindungan administrator lengkap terakhir tetap berlaku. Pertahankan dua Administrator Sistem lengkap; pembukaan akses setelah pemulihan memerlukan dua. Audit mencatat pelaksana, alasan, dan perubahan sebelum/sesudah. Perubahan tidak mengirim ulang notifikasi lama.",
    "最后一位完整系统管理员保护仍生效；日常应安排两位完整系统管理员，恢复放行必须有两位。审计记录操作者、原因和修改前后内容；权限变更不重放历史通知。",
  ],
  [
    "User cards separate account status, Login ID, email and roles. Select “+N more” to see additional roles; the control supports keyboard and touch. Login email is an optional, unique alias maintained by a system administrator. Use Login ID or email with the same password; no second account is created. Email changes revoke sessions and retain customer ownership. Confirm the real address before assigning it; existing accounts are not given invented addresses.",
    "Kartu pengguna memisahkan status akun, ID login, email, dan peran. Pilih “+N lainnya” untuk melihat peran tambahan melalui papan ketik atau sentuhan. Email login adalah alias opsional dan unik yang dikelola administrator sistem. Gunakan ID login atau email dengan kata sandi yang sama; tidak ada akun kedua. Perubahan email mencabut sesi dan mempertahankan kepemilikan pelanggan. Periksa alamat asli sebelum menetapkannya; akun lama tidak diberi alamat rekaan.",
    "用户卡片分别展示账号状态、登录ID、邮箱和角色；点击“另外N个角色”可查看其余角色，也支持键盘和触屏操作。登录邮箱由系统管理员维护，是可选且唯一的登录别名。登录ID或邮箱使用同一密码，不创建第二个账号。修改邮箱会撤销会话，保留客户归属。填写前应核对真实地址，不会给现有账号编造邮箱。",
  ],
  [
    "Retired custom team grants are removed conservatively and retained in audit for review; they never become all-customer access. Team-filtered policies and old team summaries stay inactive until an authorized operator explicitly confirms removing the historical restriction. Original policy snapshots and delivery history remain unchanged.",
    "Izin tim khusus lama dicabut secara konservatif dan disimpan dalam audit untuk ditinjau; bukan diubah menjadi akses semua pelanggan. Kebijakan berfilter tim dan ringkasan tim lama tetap nonaktif sampai operator berwenang mengonfirmasi penghapusan batasan lama. Versi kebijakan asli dan riwayat pengiriman tetap dipertahankan.",
    "历史自定义团队授权保留审计并撤去相应能力，供明确复核，不自动转为全部客户权限。有团队过滤或按团队汇总的策略保持停用，须有权操作员明确确认移除历史限制后启用；原始策略快照及发送历史保留。",
  ],
];
