# Automatic customer assignment / 自动分案 / Penugasan otomatis

## Behavior

Sales Operations → Automatic assignment uses the existing topic navigation, sticky Save header and topic-level conflict/draft protection. Default: off; strategy: round robin. Weighted round robin, rule matching and on-duty schedule are visible, disabled and labelled “Not yet supported”. Server validation rejects them, even if a client bypasses the disabled controls.

An authorized operations administrator with customer-assignment access explicitly selects participating salespeople and saves. The list order is the round-robin order. Only new verified, unassigned registrations and newly released identities enter the rotation. Existing owned customers and historical unassigned customers are not swept into assignment when enabled. Pending or merged identities remain excluded. No eligible recipient means leave unassigned for manager handling.

Assignment and cursor advancement share the original database transaction. Each operation rechecks current employee status, roles and actual record-level read/follow-up access under database locks. Existing owner history and audit retain the selected salesperson, strategy, time and trigger. Existing first-contact tasks only change owner: no new tasks, deadline reset, stage or Tier changes. Registration retries do not advance the cursor twice. A rollback restores owner, facts and cursor together. No new notification type or replay is introduced.

## 中文

在“销售运营 → 自动分案”开启，缺省策略为轮询，需选择参与销售后保存。加权轮询、条件匹配、按值班安排暂不支持，明确列出但不可选择。仅对新登记且已通过身份核实、无负责人的客户，以及本次身份核实后放行的客户生效。已有负责人和历史未分配客户不自动转交或补分。人员停用或权限失效时跳过，无人符合则保持未分配。关闭后停止后续分案，原负责人和首次联系期限不变。

## Bahasa Indonesia

Buka Operasional Penjualan → Penugasan otomatis. Standar nonaktif dengan strategi bergiliran; pilih sales peserta lalu simpan. Giliran berbobot, pencocokan kondisi dan jadwal piket ditampilkan tetapi belum dapat dipilih. Hanya pendaftaran baru terverifikasi tanpa penanggung jawab dan identitas yang baru lolos verifikasi yang masuk giliran. Pelanggan lama atau yang sudah memiliki penanggung jawab tidak ditugaskan ulang. Staf nonaktif atau tanpa izin dilewati; jika tidak ada peserta yang memenuhi syarat, pelanggan tetap belum ditugaskan. Penonaktifan tidak mengubah penanggung jawab atau tenggat kontak pertama sebelumnya.

## Existing unassigned customers / 历史补分 / Pelanggan belum ditugaskan

When enabling automatic assignment, “Also assign existing unassigned customers” is transient and unchecked by default. Saving applies the normal policy and opens a read-only preview; historical customers are assigned only after a separate confirmation. The independent “Assign existing unassigned customers” action remains in the rule section header. Unsaved participant choices may be previewed, but confirmation requires the saved settings to match.

Preview lists at most 100 eligible customers per batch and their exact proposed owners. It creates no database record and expires after ten minutes (a server restart also invalidates an unconfirmed preview). Confirmation rejects changed settings/rotation, rechecks current customer ownership, identity and employee access, skips changed/ineligible rows and never substitutes an unreviewed owner. Assignment, ownership history, cursor and an actor-scoped result receipt commit together. A lost response is queried without replaying the write. Existing first-contact deadlines, stages and Tier remain unchanged; no notification event is created by bulk assignment.

中文：开启时可勾选“同时分配现有未分配客户”，默认不勾选、不保存为长期规则。保存后先预览，再单独确认；亦可从分案规则右侧进入历史补分。预览不写入数据，执行时再次核对权限及归属，已被认领或不符合条件的客户跳过，不改原期限。结果未知时查询原操作，不重复提交。

Bahasa Indonesia: Opsi “Tugaskan juga pelanggan yang belum ditugaskan” tidak dicentang secara standar dan bukan pengaturan permanen. Setelah menyimpan, lihat pratinjau lalu konfirmasi secara terpisah. Tersedia pula aksi mandiri di bagian aturan. Pratinjau tidak menulis data; konfirmasi memeriksa ulang izin dan kepemilikan serta melewati pelanggan yang tidak lagi memenuhi syarat. Tenggat lama tetap. Jika hasil belum pasti, periksa operasi yang sama tanpa mengirim ulang.

Presentation: switch labels and their help form one group with 4px spacing and at least a 40px hit area. Backfill preview summarizes customer count, rotation and actual proposed recipient count. Preview and result retain the same two column widths; skipped rows do not present the proposed owner as the actual owner.

呈现：开关标题与说明同组，间隔4px，点击区域至少40px；补分摘要仅显示客户数、轮询和本次接收销售数。预览与结果保持两列宽度，跳过项不将预计负责人显示为实际负责人。

Tampilan: judul sakelar dan penjelasannya berjarak 4px dengan area klik minimal 40px. Ringkasan memuat jumlah pelanggan, giliran dan sales penerima pada pratinjau. Lebar dua kolom tetap sama pada pratinjau dan hasil; pelanggan yang dilewati tidak menampilkan calon pemilik sebagai pemilik aktual.
