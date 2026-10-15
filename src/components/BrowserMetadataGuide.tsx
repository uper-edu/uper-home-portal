import { metadataWords, type SiteLanguage } from "../utils/siteMetadata";
export function BrowserMetadataGuide({ lang }: { lang: SiteLanguage }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">
        {metadataWords(
          [
            "Browser Titles & Search Visibility",
            "Judul Tab & Visibilitas Pencarian",
            "浏览器标题与搜索可见性",
          ],
          lang,
        )}
      </h3>
      <p>
        {metadataWords(
          [
            "Tab titles show the current module, workspace and UPER. Interface language changes titles and descriptions; names, customer messages and saved content stay original.",
            "Judul tab menampilkan modul aktif, ruang kerja, dan UPER. Bahasa antarmuka mengubah judul dan deskripsi; nama, pesan pelanggan, dan konten tersimpan tetap asli.",
            "标签页标题依次显示当前功能、工作区与UPER。界面语言同步切换标题和说明；姓名、客户消息和已保存内容保持原文。",
          ],
          lang,
        )}
      </p>
      <p>
        {metadataWords(
          [
            "CRM, CMS, system management and private consultation pages are not indexed. Search controls do not replace sign-in or authorization. Public content uses its own title and canonical URL; structured data describes published content, not sales results or guarantees.",
            "CRM, CMS, manajemen sistem, dan konsultasi pribadi tidak diindeks. Kontrol pencarian tidak menggantikan login atau izin. Konten publik memakai judul dan URL kanonis sendiri; data terstruktur menjelaskan konten yang dipublikasikan, bukan hasil penjualan atau jaminan.",
            "CRM、CMS、系统管理与个人咨询页面禁止索引。搜索控制不能代替登录和权限校验。公开内容使用独立标题和规范链接；结构化数据说明公开内容，不表示销售结果或效果承诺。",
          ],
          lang,
        )}
      </p>
    </section>
  );
}
