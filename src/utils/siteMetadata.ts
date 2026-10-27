/** Shared browser/server metadata contract. No customer or employee data belongs here. */
export type SiteLanguage = "en" | "id" | "zh";
type Words = [string, string, string];
export const SITE_ORIGIN = "https://uperedu.com";
export const languageCodes = ["id", "en", "zh"] as const;
export const metadataWords = (words: Words, lang: SiteLanguage) =>
  words[lang === "zh" ? 2 : lang === "id" ? 1 : 0];
export const normalizeSiteLanguage = (value?: string | null): SiteLanguage =>
  /^zh(?:-|$)/i.test(value || "")
    ? "zh"
    : /^en(?:-|$)/i.test(value || "")
      ? "en"
      : "id";
export const publicPages: Record<string, { title: Words; description: Words }> =
  {
    "/": {
      title: [
        "Study in China & Chinese Language Learning",
        "Studi di Tiongkok & Pembelajaran Bahasa Mandarin",
        "中国留学与中文学习",
      ],
      description: [
        "Explore UPER university application support, scholarship guidance, Chinese language courses and study tours.",
        "Jelajahi layanan UPER untuk pendaftaran universitas, panduan beasiswa, kursus Mandarin, dan tur studi.",
        "了解UPER的大学申请支持、奖学金咨询、中文课程与研学服务。",
      ],
    },
    "/about": {
      title: ["About Us", "Tentang Kami", "关于我们"],
      description: [
        "Learn about UPER and our education services connecting Indonesia and China.",
        "Kenali UPER dan layanan pendidikan kami yang menghubungkan Indonesia dan Tiongkok.",
        "了解UPER及连接印度尼西亚与中国的教育服务。",
      ],
    },
    "/faq": {
      title: ["Frequently Asked Questions", "Pertanyaan Umum", "常见问题"],
      description: [
        "Find answers about university applications, scholarships, Chinese learning and UPER services.",
        "Temukan jawaban tentang pendaftaran universitas, beasiswa, pembelajaran Mandarin, dan layanan UPER.",
        "查阅大学申请、奖学金、中文学习与UPER服务的常见问题。",
      ],
    },
    "/careers": {
      title: ["Careers", "Karier", "招聘职位"],
      description: [
        "Explore open roles at UPER, role requirements and how to apply.",
        "Lihat lowongan di UPER, persyaratan posisi, dan cara melamar.",
        "查看UPER招聘岗位、任职要求与申请方式。",
      ],
    },
    "/partners": {
      title: [
        "Partner Universities & Schools",
        "Universitas & Sekolah Mitra",
        "合作院校",
      ],
      description: [
        "Explore universities, schools and education partners featured by UPER.",
        "Jelajahi universitas, sekolah, dan mitra pendidikan yang ditampilkan UPER.",
        "了解UPER展示的大学、学校及教育合作伙伴。",
      ],
    },
    "/tours": {
      title: ["China Study Tours", "Tur Studi ke Tiongkok", "中国研学"],
      description: [
        "Explore UPER study tours, university visits and cultural learning activities in China.",
        "Jelajahi tur studi UPER, kunjungan universitas, dan kegiatan belajar budaya di Tiongkok.",
        "了解UPER中国研学、大学参访与文化学习活动。",
      ],
    },
    "/hsk": {
      title: ["HSK Chinese Courses", "Kursus Mandarin HSK", "HSK中文课程"],
      description: [
        "Explore UPER Chinese language courses, HSK preparation and learning support.",
        "Jelajahi kursus Mandarin UPER, persiapan HSK, dan dukungan belajar.",
        "了解UPER中文课程、HSK备考与学习支持。",
      ],
    },
    "/csca": {
      title: ["CSCA Preparation", "Persiapan CSCA", "CSCA备考"],
      description: [
        "Learn about UPER CSCA preparation and support for Chinese university applications.",
        "Pelajari persiapan CSCA UPER dan dukungan pendaftaran universitas di Tiongkok.",
        "了解UPER的CSCA备考及中国大学申请支持。",
      ],
    },
    "/consultancy": {
      title: [
        "China University & Scholarship Guidance",
        "Panduan Universitas & Beasiswa Tiongkok",
        "中国大学与奖学金咨询",
      ],
      description: [
        "Explore support for choosing universities, preparing applications and understanding scholarship options.",
        "Jelajahi dukungan untuk memilih universitas, menyiapkan pendaftaran, dan memahami pilihan beasiswa.",
        "了解院校选择、申请准备与奖学金方案咨询服务。",
      ],
    },
    "/contact": {
      title: ["Contact Us", "Hubungi Kami", "联系我们"],
      description: [
        "Find UPER contact details and ways to discuss your education needs with our advisors.",
        "Temukan kontak UPER dan cara mendiskusikan kebutuhan pendidikan Anda dengan konsultan kami.",
        "查找UPER联系方式，与顾问沟通教育需求。",
      ],
    },
    "/news": {
      title: [
        "News & Education Insights",
        "Berita & Wawasan Pendidikan",
        "新闻与教育资讯",
      ],
      description: [
        "Read UPER news, education articles and updates about learning and studying in China.",
        "Baca berita UPER, artikel pendidikan, serta kabar pembelajaran dan studi di Tiongkok.",
        "阅读UPER新闻、教育文章与中文学习及中国留学资讯。",
      ],
    },
  };
export const workspaceNames: Record<string, Words> = {
  crm: ["Sales Management", "Manajemen Penjualan", "销售管理"],
  cms: ["Content Management", "Manajemen Konten", "内容管理"],
  system: ["System Management", "Manajemen Sistem", "系统管理"],
};
export const moduleNames: Record<string, Record<string, Words>> = {
  crm: {
    leads: ["Customer Worklist", "Daftar Kerja Pelanggan", "客户工作列表"],
    analysis: ["Customer statistics and analysis", "Statistik dan analisis pelanggan", "客户统计与分析"],
    campaigns: ["Marketing Campaigns", "Kampanye Pemasaran", "营销活动"],
    policy: [
      "Sales Operations Settings",
      "Pengaturan Operasional Penjualan",
      "销售运营设置",
    ],
    docs: [
      "System Documentation & Guide",
      "Dokumentasi & Panduan Sistem",
      "系统说明与操作指南",
    ],
  },
  system: {
    users: ["Users", "Pengguna", "用户管理"],
    roles: ["Roles & Permissions", "Peran & Izin", "角色权限"],
    preview: ["Access Preview", "Pratinjau Akses", "权限预览"],
    audit: ["Change Audit", "Audit Perubahan", "变更审计"],
    test: ["Test Environment & Accounts", "Lingkungan Uji & Akun", "测试环境和账号"],
    guide: ["Guide", "Panduan", "使用指南"],
  },
  cms: {
    partners: [
      "Partner Universities & Schools",
      "Universitas & Sekolah Mitra",
      "合作院校",
    ],
    news: ["News & Articles", "Berita & Artikel", "新闻与文章"],
    trendingPrograms: ["Programs", "Program", "课程与项目"],
    studentStories: ["Student Stories", "Kisah Siswa", "学员故事"],
    admissionsList: ["Admissions Honors", "Pencapaian Penerimaan", "录取荣誉"],
    campaigns: ["Special Campaigns", "Kampanye Khusus", "专题活动"],
    newsPage: ["News Channels", "Kanal Berita", "新闻频道"],
  },
};
export function workspaceMetadata(
  workspace: string,
  module: string,
  lang: SiteLanguage,
  state?: "login" | "checking" | "denied",
) {
  const name = metadataWords(
    workspaceNames[workspace] || workspaceNames.system,
    lang,
  );
  const item = state
    ? metadataWords(
        state === "login"
          ? ["Sign In", "Login", "登录"]
          : state === "checking"
            ? ["Checking Access", "Memeriksa Akses", "正在验证访问"]
            : ["Access Denied", "Akses Ditolak", "访问受限"],
        lang,
      )
    : metadataWords(
        moduleNames[workspace]?.[module] || [
          "Workspace",
          "Ruang Kerja",
          "工作区",
        ],
        lang,
      );
  return {
    title: `${item} | ${name} | UPER`,
    description: metadataWords(
      [
        "Staff workspace. Sign in with an authorized account to access permitted features.",
        "Ruang kerja staf. Login dengan akun yang berwenang untuk mengakses fitur sesuai izin.",
        "员工工作区。请使用已授权账号登录，访问权限范围内的功能。",
      ],
      lang,
    ),
  };
}
export function isPrivatePath(pathname: string) {
  return /^\/(?:crm|cms|system|studio|chat|consult|style-guide|api)(?:\/|$)/i.test(
    pathname,
  );
}
export function cleanPath(pathname: string) {
  const p = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return p.startsWith("/") ? p : "/";
}
export interface Metadata {
  title: string;
  description: string;
  lang: SiteLanguage;
  indexable: boolean;
  canonical?: string;
  alternates: { lang: string; href: string }[];
  image?: string;
  type: string;
  schema: object[];
  status?: number;
  modified?: string;
}
export function publicUrl(path: string, lang: SiteLanguage, translated = true) {
  const u = new URL(cleanPath(path), SITE_ORIGIN);
  if (translated && lang !== "id") u.searchParams.set("lang", lang);
  return u.href;
}
export function safeMetadataText(value: unknown, max = 250) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";
}
export function publicContentMetadata(item: any) {
  // Only explicit public CMS fields, never arbitrary profile objects or raw HTML.
  const image =
    typeof item?.image === "string"
      ? item.image
      : item?.image?.url || item?.image?.asset?.url;
  return {
    title: safeMetadataText(item?.title, 180),
    description: safeMetadataText(
      item?.summary || item?.subtitle || item?.title,
    ),
    image:
      typeof image === "string" && /^https?:\/\//i.test(image)
        ? image
        : undefined,
    modified: validMetadataDate(item?._updatedAt),
  };
}
export function validMetadataDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))
    return undefined;
  return Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}
export function resolveMetadata(
  pathname: string,
  lang: SiteLanguage,
  options: {
    workspace?: string;
    module?: string;
    state?: "login" | "checking" | "denied";
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    modified?: string;
    notFound?: boolean;
    unavailable?: boolean;
    schema?: object[];
  } = {},
): Metadata {
  const normalizedPath = cleanPath(pathname),
    path = publicPages[normalizedPath.toLowerCase()]
      ? normalizedPath.toLowerCase()
      : normalizedPath,
    workspace = path.split("/")[1].toLowerCase(),
    privatePage = isPrivatePath(path),
    page = publicPages[path],
    dynamic = /^\/(news|campaign)\/[^/]+$/.test(path),
    known =
      !!page ||
      dynamic ||
      /^\/(crm|cms|system|studio|chat|consult|style-guide)$/i.test(path);
  let title: string, description: string;
  if (workspaceNames[workspace])
    ({ title, description } = workspaceMetadata(
      workspace,
      options.module ||
        (workspace === "crm"
          ? "leads"
          : workspace === "system"
            ? "users"
            : "partners"),
      lang,
      options.state,
    ));
  else if (page) {
    title = `${metadataWords(page.title, lang)} | UPER`;
    description = metadataWords(page.description, lang);
  } else if (path === "/studio" || path === "/style-guide") {
    title =
      metadataWords(
        path === "/studio"
          ? ["Content Studio", "Studio Konten", "内容工作室"]
          : ["Design Reference", "Referensi Desain", "设计参考"],
        lang,
      ) + " | UPER";
    description = metadataWords(
      [
        "Internal workspace reference.",
        "Referensi ruang kerja internal.",
        "内部工作区参考。",
      ],
      lang,
    );
  } else if (/^\/(chat|consult)$/i.test(path)) {
    title = metadataWords(
      [
        "Learning Consultation | UPER",
        "Konsultasi Belajar | UPER",
        "学习咨询 | UPER",
      ],
      lang,
    );
    description = metadataWords(
      [
        "Private learning consultation and assessment.",
        "Konsultasi dan tes belajar pribadi.",
        "个人学习咨询与测评。",
      ],
      lang,
    );
  } else {
    title =
      metadataWords(
        dynamic
          ? [
              "Article & Event Details",
              "Detail Artikel & Acara",
              "文章与活动详情",
            ]
          : ["Page Not Found", "Halaman Tidak Ditemukan", "页面未找到"],
        lang,
      ) + " | UPER";
    description = metadataWords(
      [
        "Explore UPER education services and information.",
        "Jelajahi layanan dan informasi pendidikan UPER.",
        "了解UPER教育服务与资讯。",
      ],
      lang,
    );
  }
  if (dynamic && options.title) {
    title = `${safeMetadataText(options.title, 180).replace(/\s*\|\s*UPER(?: Education)?$/i, "")} | UPER`;
    description = safeMetadataText(options.description || options.title);
  }
  if (options.notFound || !known) {
    title =
      metadataWords(
        ["Page Not Found", "Halaman Tidak Ditemukan", "页面未找到"],
        lang,
      ) + " | UPER";
  }
  if (options.unavailable) {
    title =
      metadataWords(
        [
          "Content Temporarily Unavailable",
          "Konten Sementara Tidak Tersedia",
          "内容暂不可用",
        ],
        lang,
      ) + " | UPER";
  }
  const trial = typeof window !== 'undefined' && window.location.hostname === 'home.prototype.uperedu.com';
  const indexable =
    !trial && !privatePage && known && !options.notFound && !options.unavailable;
  const canonical = indexable ? publicUrl(path, lang, !dynamic) : undefined;
  const alternates =
    indexable && !dynamic
      ? [
          ...languageCodes.map((l) => ({ lang: l, href: publicUrl(path, l) })),
          { lang: "x-default", href: publicUrl(path, "id") },
        ]
      : [];
  const schema: object[] = indexable
    ? [
        {
          "@type": "Organization",
          "@id": SITE_ORIGIN + "/#organization",
          name: "UPER",
          url: SITE_ORIGIN + "/",
          logo: SITE_ORIGIN + "/Logo.png",
        },
        {
          "@type": "WebSite",
          "@id": SITE_ORIGIN + "/#website",
          name: "UPER",
          url: SITE_ORIGIN + "/",
          publisher: { "@id": SITE_ORIGIN + "/#organization" },
        },
        {
          "@type": options.type === "article" ? "Article" : "WebPage",
          "@id": canonical + "#page",
          url: canonical,
          name: title,
          description,
          ...(!dynamic ? { inLanguage: lang } : {}),
          isPartOf: { "@id": SITE_ORIGIN + "/#website" },
          ...(options.type === "article"
            ? { headline: safeMetadataText(options.title, 180) }
            : {}),
          ...(validMetadataDate(options.modified)
            ? { dateModified: validMetadataDate(options.modified) }
            : {}),
        },
        ...(options.schema || []),
      ]
    : [];
  return {
    title,
    description,
    lang,
    indexable,
    canonical,
    alternates,
    image: indexable ? options.image || SITE_ORIGIN + "/Logo.png" : undefined,
    type: options.type || "website",
    schema,
    status: options.unavailable ? 503 : !known || options.notFound ? 404 : 200,
    modified: validMetadataDate(options.modified),
  };
}
export const robotsFor = (meta: Metadata) =>
  meta.indexable
    ? "index, follow, max-image-preview:large"
    : "noindex, nofollow, noarchive";
