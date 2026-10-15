import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  normalizeSiteLanguage,
  resolveMetadata,
  robotsFor,
  isPrivatePath,
  type SiteLanguage,
  type Metadata,
} from "../utils/siteMetadata";
import { readAdminLanguage } from "../utils/crmLanguage";
type Entry = { path: string; priority: number; meta: Metadata };
const Registry = createContext<
  ((id: string, entry: Entry) => () => void) | null
>(null);
/** React 19 hoists multiple <title>/<meta> nodes instead of applying Helmet's old last-writer rule.
 * This is the sole owner of document metadata, including removal of server-rendered seed tags. */
export function applyPageMetadata(doc: Document, m: Metadata) {
  const selector =
    'title,meta[name="description"],meta[name="robots"],meta[name="keywords"],meta[name="dateModified"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],link[rel="alternate"][hreflang],[data-uper-metadata],script[data-rh="true"][type="application/ld+json"]';
  doc.head.querySelectorAll(selector).forEach((e) => e.remove());
  doc.documentElement.lang = m.lang === "zh" ? "zh-CN" : m.lang;
  // Non-sensitive UI preference lets the next HTML response match the browser before JS starts.
  const admin = /^\/(crm|cms|system)(\/|$)/i.test(doc.location.pathname);
  if (admin || !isPrivatePath(doc.location.pathname)) {
    doc.cookie = `${admin ? "uper_admin_ui_lang" : "uper_public_ui_lang"}=${m.lang}; Path=/; Max-Age=31536000; SameSite=Lax${doc.location.protocol === "https:" ? "; Secure" : ""}`;
  }
  const node = (tag: string, attrs: Record<string, string>, text?: string) => {
    const n = doc.createElement(tag);
    n.setAttribute("data-uper-metadata", "true");
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text !== undefined) n.textContent = text;
    doc.head.appendChild(n);
  };
  const meta = (key: string, value: string, property = false) =>
    node("meta", { [property ? "property" : "name"]: key, content: value });
  node("title", {}, m.title);
  meta("description", m.description);
  meta("robots", robotsFor(m));
  meta("og:title", m.title, true);
  meta("og:description", m.description, true);
  meta("og:type", m.type, true);
  meta("og:site_name", "UPER", true);
  meta(
    "og:locale",
    m.lang === "zh" ? "zh_CN" : m.lang === "en" ? "en_US" : "id_ID",
    true,
  );
  meta("twitter:title", m.title);
  meta("twitter:description", m.description);
  meta("twitter:card", m.image ? "summary_large_image" : "summary");
  if (m.canonical) {
    node("link", { rel: "canonical", href: m.canonical });
    meta("og:url", m.canonical, true);
  }
  for (const a of m.alternates)
    node("link", { rel: "alternate", hreflang: a.lang, href: a.href });
  if (m.image) {
    meta("og:image", m.image, true);
    meta("twitter:image", m.image);
  }
  if (m.schema.length)
    node(
      "script",
      { type: "application/ld+json", id: "uper-page-schema" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@graph": m.schema,
      }).replace(/</g, "\\u003c"),
    );
}
export function MetadataProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation(),
    { i18n } = useTranslation(),
    current = useRef({
      path: location.pathname,
      lang: normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language),
    }),
    entries = useRef(new Map<string, Entry>());
  current.current = {
    path: location.pathname,
    lang: /^\/(crm|cms|system)(\/|$)/i.test(location.pathname)
      ? readAdminLanguage()
      : normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language),
  };
  const sync = useCallback(() => {
    const selected = [...entries.current.values()]
      .filter((e) => e.path === current.current.path)
      .sort((a, b) => a.priority - b.priority)
      .at(-1);
    applyPageMetadata(
      document,
      selected?.meta ||
        resolveMetadata(current.current.path, current.current.lang),
    );
  }, []);
  const register = useCallback(
    (id: string, e: Entry) => {
      entries.current.set(id, e);
      sync();
      return () => {
        entries.current.delete(id);
        sync();
      };
    },
    [sync],
  );
  useLayoutEffect(sync, [
    location.pathname,
    location.search,
    i18n.resolvedLanguage,
    sync,
  ]);
  return <Registry.Provider value={register}>{children}</Registry.Provider>;
}
type PageMetadataProps = {
  fallback?: boolean;
  lang?: SiteLanguage;
  options?: Parameters<typeof resolveMetadata>[2];
};
export function PageMetadata(props: PageMetadataProps) {
  const register = useContext(Registry);
  return register ? (
    <RegisteredMetadata {...props} register={register} />
  ) : null;
}
function RegisteredMetadata({
  lang,
  options = {},
  fallback = false,
  register,
}: PageMetadataProps & { register: (id: string, entry: Entry) => () => void }) {
  const location = useLocation(),
    { i18n } = useTranslation(),
    id = useId();
  const meta = resolveMetadata(
      location.pathname,
      lang || normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language),
      options,
    ),
    serialized = JSON.stringify(meta);
  useLayoutEffect(
    () =>
      register?.(id, {
        path: location.pathname,
        priority: fallback ? 0 : 10,
        meta,
      }),
    [register, id, location.pathname, fallback, serialized],
  );
  return null;
}
/** Metadata and valid language URLs are installed before lazy page content loads. */
export function RouteMetadata() {
  const location = useLocation(),
    navigate = useNavigate(),
    { i18n } = useTranslation();
  useEffect(() => {
    if (isPrivatePath(location.pathname)) return;
    const search = new URLSearchParams(location.search),
      explicit = search.get("lang");
    if (explicit && ["id", "en", "zh"].includes(explicit)) {
      if (
        normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language) !==
        explicit
      )
        void i18n.changeLanguage(explicit);
    } else {
      const lang = normalizeSiteLanguage(
        i18n.resolvedLanguage || i18n.language,
      );
      if (lang !== "id") {
        search.set("lang", lang);
        navigate(
          {
            pathname: location.pathname,
            search: search.toString(),
            hash: location.hash,
          },
          { replace: true },
        );
      }
    }
  }, [location.pathname, location.search]);
  return (
    <PageMetadata
      fallback
      lang={
        /^\/(crm|cms|system)(\/|$)/i.test(location.pathname)
          ? readAdminLanguage()
          : undefined
      }
    />
  );
}
