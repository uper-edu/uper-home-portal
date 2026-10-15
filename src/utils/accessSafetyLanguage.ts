export const accessSafetyErrors: Record<string, [string, string, string]> = {
  access_recovery_authorization_invalid: [
    "Recovery authorization is missing, invalid or for another environment.",
    "Izin pemulihan hilang, tidak valid, atau untuk lingkungan lain.",
    "恢复授权缺失、无效或不属于当前环境。",
  ],
  access_recovery_authorization_expired: [
    "Recovery authorization expired. Request a new approval.",
    "Izin pemulihan kedaluwarsa. Minta persetujuan baru.",
    "恢复授权已过期，请重新申请授权。",
  ],
  access_recovery_backup_required: [
    "Specify the exact backup checksum for a restored target.",
    "Tentukan checksum cadangan yang tepat untuk tujuan hasil pemulihan.",
    "请为恢复目标指定准确的备份校验值。",
  ],
  access_restore_stale: [
    "Account authorization changed. Reload and verify it again.",
    "Izin akun berubah. Muat ulang dan verifikasi kembali.",
    "账号授权已变化，请刷新后重新核对。",
  ],
  access_restore_two_administrators: [
    "Two active complete System Administrators are required before release.",
    "Dua Administrator Sistem aktif dengan izin lengkap diperlukan sebelum akses dibuka.",
    "放行前须有两位有效且拥有完整权限的系统管理员。",
  ],
  access_operation_cancelled: [
    "This operation was closed before committing. Reload the current record before starting a new operation.",
    "Operasi ini ditutup sebelum tersimpan. Muat ulang data terbaru sebelum memulai operasi baru.",
    "此操作已在提交前关闭；请载入当前记录，再开始新操作。",
  ],
  access_operation_required: [
    "Refresh and use a management operation ID.",
    "Muat ulang dan gunakan ID operasi pengelolaan.",
    "请刷新并使用带操作ID的管理表单。",
  ],
  access_operation_conflict: [
    "Operation ID reused with different content; check the saved result.",
    "ID operasi dipakai dengan isi berbeda; periksa hasil tersimpan.",
    "该操作ID已用于不同内容，请先核对结果。",
  ],
  access_operation_pending: [
    "Check the previous operation before changing its draft.",
    "Periksa operasi sebelumnya sebelum mengubah draf.",
    "请先查询上次操作结果，再修改草稿。",
  ],
  access_outcome_unknown: [
    "Outcome unconfirmed. Keep the operation ID and check before retrying.",
    "Hasil belum pasti. Simpan ID operasi dan periksa sebelum mencoba lagi.",
    "结果未确认，请保留操作ID并先查询，再重试。",
  ],
  access_operation_key_missing: [
    "Management operation protection is not configured; contact the administrator.",
    "Perlindungan operasi belum dikonfigurasi; hubungi administrator.",
    "管理操作保护尚未配置，请联系系统管理员。",
  ],
  access_restore_required: [
    "Business access is locked for restore security review.",
    "Akses bisnis dikunci untuk tinjauan keamanan pemulihan.",
    "恢复安全复核未完成，业务访问保持锁定。",
  ],
  access_restore_confirm: [
    "Confirm the independently verified authorization.",
    "Konfirmasikan izin yang diverifikasi secara independen.",
    "请确认已独立核对授权。",
  ],
  access_restore_password: [
    "Reset the active account password before authorization approval.",
    "Reset kata sandi akun aktif sebelum persetujuan izin.",
    "请先重置启用账号的密码，再确认授权。",
  ],
  access_restore_remaining: [
    "Some accounts still require authorization review.",
    "Beberapa akun masih memerlukan tinjauan izin.",
    "仍有账号未完成授权复核。",
  ],
  access_handover_missing: [
    "Handover not found.",
    "Serah terima tidak ditemukan.",
    "交接记录不存在。",
  ],
  access_handover_remaining: [
    "Unresolved work remains; transfer or review it before closing.",
    "Masih ada pekerjaan; alihkan atau tinjau sebelum menyelesaikan.",
    "仍有事项未处理，请交接或复核后再确认完成。",
  ],
  access_handover_selection: [
    "Select work to transfer.",
    "Pilih pekerjaan untuk dialihkan.",
    "请选择要交接的事项。",
  ],
  access_handover_target: [
    "The recipient cannot access and process the selected work.",
    "Penerima tidak dapat mengakses dan menangani pekerjaan terpilih.",
    "接收人无法在权限范围内访问及处理所选事项。",
  ],
  access_proxy_rejected: [
    "The proxy request could not be verified.",
    "Permintaan proksi tidak dapat diverifikasi.",
    "代理请求无法验证。",
  ],
  access_origin_rejected: [
    "The request origin or content type could not be verified. Reload this workspace.",
    "Asal atau jenis isi permintaan tidak dapat diverifikasi. Muat ulang ruang kerja ini.",
    "请求来源或内容类型无法验证，请重新载入工作区。",
  ],
};
export const accessSafetyGuide = [
  {
    title: ["Administrator recovery", "Pemulihan administrator", "管理员恢复"],
    body: [
      "Another authorized administrator can reset a password without changing roles. If none can sign in, use the offline tool: preview the exact existing account and environment, confirm the change, privately enter a strong password, and retain an independent recovery record. There is no unauthenticated password-recovery endpoint or universal password. Recovery adds no new CRM or CMS roles. Explicitly re-enabling an account reactivates its retained roles; verify them in the preview. Offline execution requires a private signed one-hour authorization for the exact account, target and permitted re-enabling/system-access restoration. A trusted host operator uses the same operation ID to preview, apply and query; a missing receipt is unconfirmed. The authorization does not execute recovery. Real maintenance additionally requires an explicit private maintenance configuration. Keep two complete System Administrators; Ethan is the selected second administrator, with the live assignment applied only during an approved cutover.",
      "Administrator lain yang berwenang dapat mereset kata sandi tanpa mengubah peran. Jika semua tidak dapat login, gunakan alat luring: pratinjau akun dan lingkungan yang tepat, konfirmasi, masukkan kata sandi kuat secara privat, lalu simpan catatan pemulihan terpisah. Tidak ada endpoint pemulihan tanpa autentikasi atau kata sandi universal. Pemulihan tidak menambah peran CRM atau CMS baru. Mengaktifkan akun kembali memulihkan peran yang dipertahankan; verifikasi dalam pratinjau. Eksekusi luring memerlukan izin bertanda tangan privat yang berlaku satu jam untuk akun, tujuan, dan pengaktifan atau pemulihan akses sistem yang diizinkan. Operator host tepercaya memakai ID operasi yang sama untuk pratinjau, pelaksanaan, dan pemeriksaan; bukti yang belum ditemukan berarti belum pasti. Izin tidak menjalankan pemulihan. Pemeliharaan nyata juga memerlukan konfigurasi pemeliharaan privat eksplisit. Pertahankan dua Administrator Sistem lengkap; Ethan dipilih sebagai administrator kedua dan penetapan nyata hanya dilakukan saat peralihan disetujui.",
      "其他有权管理员可重置密码，角色不变。全部管理员无法登录时，使用离线工具：预览已有账号与环境、确认差异、隐藏输入强密码并保留独立恢复记录。没有网页绕过登录入口或通用密码；恢复不新增CRM或CMS角色；明确重新启用账号会恢复其保留角色，须在预览中核对。离线执行须有一小时有效的私密签名授权，绑定账号、目标环境及允许的重新启用／恢复系统管理权限。可信主机操作员沿用同一操作ID预览、执行和查询；未找到凭证不代表未提交。授权文件本身不执行恢复。实际维护还须使用明确的私密维护配置。应保留两位完整系统管理员；第二管理员指定为Ethan，真实账号授权仅在获批切换时执行。",
    ],
  },
  {
    title: [
      "Restore security review",
      "Tinjauan keamanan pemulihan",
      "备份恢复安全复核",
    ],
    body: [
      "Restored databases remain locked for business use. Old staff sessions are cleared and historical notifications are held. Compare the latest trusted authorization checkpoint; without one, explicitly review every account. Active accounts require fresh passwords. Release only after every account is reviewed. Release also requires two active complete System Administrators and a fresh authorization snapshot for every account. Releasing access does not replay held notifications.",
      "Basis data hasil pemulihan tetap dikunci untuk bisnis. Sesi staf lama dihapus dan notifikasi historis ditahan. Bandingkan checkpoint izin terpercaya terbaru; bila tidak ada, tinjau setiap akun. Akun aktif memerlukan kata sandi baru. Buka akses setelah semua akun ditinjau. Pembukaan akses juga memerlukan dua Administrator Sistem aktif lengkap dan snapshot izin terbaru tiap akun. Pembukaan akses tidak mengirim ulang notifikasi tertahan.",
      "数据库恢复后业务访问保持锁定，清除旧员工会话，暂停历史通知。核对最新可信授权清单；没有可信清单时逐人明确复核。启用账号须重置凭据，全部账号复核通过后才能解除限制；放行还要求两位有效完整系统管理员及逐人最新授权快照；解除限制不重放历史通知。",
    ],
  },
  {
    title: [
      "Unconfirmed saves and retries",
      "Penyimpanan belum pasti dan percobaan ulang",
      "保存结果未确认与重试",
    ],
    body: [
      "Each management submission has an operation ID. Retry unchanged input with the same ID; do not issue a new operation while the old outcome is unknown. Query after reconnecting or signing in again. A missing receipt is unconfirmed, not proof that nothing was saved. Passwords are not stored in browser drafts or receipts. If the original input is lost, check the result and explicitly close the uncommitted operation before creating a new one; already committed changes are never undone. Confirmed results clear obsolete errors and reload the saved record; remaining draft edits are not automatically applied.",
      "Setiap pengiriman pengelolaan memiliki ID operasi. Ulangi isi yang sama dengan ID yang sama; jangan buat operasi baru ketika hasil lama belum pasti. Periksa setelah tersambung atau login kembali. Bukti yang belum ditemukan berarti belum pasti, bukan bukti tidak tersimpan. Kata sandi tidak disimpan dalam draf peramban atau bukti operasi. Jika isi awal hilang, periksa hasil lalu tutup operasi yang belum tersimpan sebelum membuat yang baru; perubahan tersimpan tidak dibatalkan. Hasil terkonfirmasi menghapus pesan kesalahan lama dan memuat data tersimpan; perubahan draf lainnya tidak diterapkan otomatis.",
      "每次管理提交都有操作ID。原内容重试沿用同一ID；旧结果未知时不换ID重做。恢复连接或重新登录后查询。未找到凭证表示尚未确认，不能认定没有保存。密码不进入浏览器草稿或操作凭证。原输入丢失时先查询，再明确关闭未提交操作，防止迟到请求执行后才新建；已提交的改动不会被撤销。确认结果后清除过时错误并载入已保存记录，其余草稿修改不会自动覆盖。",
    ],
  },
  {
    title: [
      "Initial credentials and HTTPS",
      "Kredensial awal dan HTTPS",
      "初始凭据与HTTPS",
    ],
    body: [
      "Name-based passwords are allowed only in an explicitly isolated synthetic test environment. A new database otherwise requires a private initial-password file. Existing accounts are not overwritten. HTTPS must use a configured canonical origin and explicitly trusted loopback proxy; the proxy must overwrite forwarded headers. Secure cookies and rate limits still require verification on the actual server before release.",
      "Kata sandi berbasis nama hanya diizinkan pada lingkungan uji sintetis yang terisolasi secara eksplisit. Basis data baru lainnya memerlukan berkas kata sandi awal privat. Akun yang ada tidak ditimpa. HTTPS memakai origin kanonis dan proksi loopback terpercaya yang dikonfigurasi; proksi harus menimpa header penerusan. Cookie aman dan batas login tetap harus diverifikasi di server sebenarnya sebelum rilis.",
      "姓名密码仅允许在明确隔离的模拟测试环境启用；其他新库初始化须使用私密初始密码文件，不覆盖已有账号。HTTPS须配置规范来源和明确可信的本机代理，代理必须覆盖转发头。安全Cookie及登录限流仍须在实际服务器发布前验证。",
    ],
  },
  {
    title: [
      "Deactivation and handover",
      "Penonaktifan dan serah terima",
      "停用与业务交接",
    ],
    body: [
      "Access is disabled immediately. Customers and tasks keep original ownership and deadlines until an authorized CRM Manager explicitly transfers selected work. System administration alone does not grant customer access. Partial transfers show remaining work; confirm completion after a fresh check. Re-enabling staff does not reclaim transferred customers. Each handover keeps its own recipient, selections and reason; saving one does not clear another draft.",
      "Akses dinonaktifkan segera. Kepemilikan pelanggan dan tugas serta tenggat tetap sampai Manajer CRM berwenang mengalihkan pekerjaan terpilih. Administrasi sistem saja tidak memberi akses pelanggan. Pengalihan sebagian menampilkan pekerjaan tersisa; konfirmasi setelah pemeriksaan baru. Mengaktifkan staf kembali tidak mengambil pelanggan yang sudah dialihkan. Setiap serah terima memiliki penerima, pilihan dan alasan tersendiri; menyimpan satu tidak menghapus draf lainnya.",
      "停用立即撤销访问。客户、任务原归属和截止时间保留，由有权CRM管理者明确交接所选事项。系统管理权限本身不授予客户访问权。部分交接显示剩余事项，重新核对后确认完成；重新启用员工不会取回已交出的客户。每份交接的接收人、勾选及原因分别保存，提交一份不清除其他草稿。",
    ],
  },
  {
    title: [
      "Emergency recovery without pre-issued authorization",
      "Pemulihan darurat tanpa izin sebelumnya",
      "未预先准备授权的应急恢复",
    ],
    body: [
      "If no administrator can sign in and no valid pre-issued file exists, a trusted host operator must use an independently trusted authorization checkpoint and its separately retained hash, an external approval reference, named approver, and exact-state confirmation. Only an existing complete administrator from that checkpoint can be selected. Missing or untrusted evidence fails closed. The tool records approval evidence; it does not verify the human approver's identity or provide dual approval. Signing a file does not reset a password; use its operation ID for execution and result queries.",
      "Jika semua administrator tidak dapat login dan tidak ada berkas izin yang masih berlaku, operator host tepercaya memerlukan checkpoint izin independen beserta hash yang disimpan terpisah, referensi persetujuan eksternal, nama pemberi persetujuan, dan konfirmasi keadaan yang tepat. Hanya akun administrator lengkap yang ada dalam checkpoint dapat dipilih. Bukti yang hilang atau tidak tepercaya ditolak. Alat mencatat bukti persetujuan, bukan memverifikasi identitas manusia atau menyediakan persetujuan dua orang. Penerbitan izin tidak mereset kata sandi; gunakan ID operasinya untuk pelaksanaan dan pemeriksaan hasil.",
      "全部管理员无法登录且没有有效预授权文件时，可信主机操作员须提供独立可信授权清单及分开保管的校验值、外部审批编号、审批人和精确状态确认。只能选择该清单中已有的完整系统管理员；证据缺失或不可信时拒绝执行。工具记录审批依据，不代替人工身份核验或双人审批。签发授权不会重置密码，后续执行和查询继续使用同一操作ID。",
    ],
  },
];
