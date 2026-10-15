import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { adminText } from "./AdminHeader";
import type { CrmLanguage } from "../utils/crmLanguage";
import {testDirectoryText,type TestDirectory} from "../utils/testDirectory";
export function TestEnvironmentPanel({ lang }: { lang: CrmLanguage }) {
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  const [data, setData] = useState<TestDirectory | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(false),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false);
  async function load() {
    setLoading(true);
    setError(false);
    setCopied(false);
    try {
      const r = await fetch("/api/admin/access/test-directory", {
        cache: "no-store",
      });
      if (!r.ok) throw Error();
      setData(await r.json());
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    setCopied(false);
    setCopyError(false);
  }, [lang]);
  const text = data ? testDirectoryText(data, lang) : "";
  return (
    <section
      className="access-card test-directory"
      aria-labelledby="test-directory-title"
    >
      <div className="access-toolbar">
        <div>
          <h2 id="test-directory-title">
            {t(
              "Test environment & accounts",
              "Lingkungan uji & akun",
              "测试环境和账号",
            )}
          </h2>
          <p>
            {t(
              "Copy plain text for the authorized test team. User-created accounts are excluded.",
              "Salin teks biasa untuk tim penguji yang berwenang. Akun yang ditambahkan kemudian tidak disertakan.",
              "复制纯文本发送给授权测试团队；不列出管理员后来添加的账号。",
            )}
          </p>
        </div>
        <div className="access-actions">
          <button type="button" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden="true" />
            {t("Refresh", "Muat ulang", "刷新")}
          </button>
          <button
            type="button"
            disabled={!data || loading}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
                setCopied(false);
              }
            }}
          >
            <Copy size={16} aria-hidden="true" />
            {t("Copy all", "Salin semua", "复制全部")}
          </button>
        </div>
      </div>
      {loading && <p role="status">{t("Loading…", "Memuat…", "加载中…")}</p>}
      {error && (
        <p role="alert">
          {t(
            "Unable to load the test directory. Retry or check your permissions.",
            "Direktori uji tidak dapat dimuat. Coba lagi atau periksa izin Anda.",
            "无法载入测试信息，请重试或核对权限。",
          )}
        </p>
      )}
      {data && (
        <>
          <label htmlFor="test-directory-text">
            {t(
              "Shareable plain text",
              "Teks biasa untuk dibagikan",
              "可复制的纯文本",
            )}
            <textarea
              id="test-directory-text"
              readOnly
              value={text}
              rows={23}
              spellCheck={false}
            />
          </label>
          <p>
            {t(
              "Changed passwords cannot be recovered or displayed.",
              "Kata sandi yang diubah tidak dapat dipulihkan atau ditampilkan.",
              "不会找回或显示用户修改后的密码。",
            )}
          </p>
        </>
      )}
      {copied && <p role="status">{t("Copied.", "Disalin.", "已复制。")}</p>}
      {copyError && (
        <p role="alert">
          {t(
            "Copy was blocked. Select the text above and copy manually.",
            "Penyalinan diblokir. Pilih teks di atas dan salin secara manual.",
            "复制受阻，请选择上方文本手动复制。",
          )}
        </p>
      )}
    </section>
  );
}
