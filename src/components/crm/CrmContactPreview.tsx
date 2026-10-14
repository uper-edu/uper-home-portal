import { useState, useEffect, useRef } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmError } from "../../utils/crmLanguage";
import { greeting } from "../../utils/crmContact";
export function CrmContactPreview({
  lead,
  employee,
  lang,
  isLight,
  onClose,
  onUpdated,
  scripts,
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const [language, setLanguage] = useState(
    lead.communicationLanguage === "unknown"
      ? ""
      : lead.communicationLanguage || "",
  );
  const textFor = (l: string) =>
    scripts?.[l] ??
    greeting(l, lead.fullName || "", employee.displayName || employee.id);
  const [text, setText] = useState(textFor(language));
  const [save, setSave] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLElement>("h3")?.focus();
  }, []);
  const close = () => {
    onClose();
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
    else document.querySelector<HTMLElement>("#crm-customer-panel h2")?.focus();
  };
  const stopped = lead.contactArrangement?.state === "stopped";
  const prepare = async () => {
    if (!language || !text.trim() || stopped)
      throw Error(
        t(
          "Choose language and review the message",
          "Pilih bahasa dan tinjau pesan",
          "请选择语言并核对话术",
        ),
      );
    if (save) {
      const r = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationLanguage: language }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      onUpdated(d.lead);
    }
  };
  return (
    <section
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
      className="crm-customer-context crm-contact-preview"
      role="dialog"
      aria-label={t("Contact preview", "Pratinjau kontak", "联系预览")}
    >
      <div className="space-y-3 w-full">
        <h3 tabIndex={-1}>
          {t(
            "Review before contacting",
            "Tinjau sebelum menghubungi",
            "联系前预览",
          )}
        </h3>
        <p>
          {lead.fullName} · {lead.whatsapp}
        </p>
        {stopped && (
          <p role="alert">
            {t(
              "Proactive contact stopped. Restore with a reason first.",
              "Kontak proaktif dihentikan. Pulihkan dengan alasan terlebih dahulu.",
              "已停止主动联系，请先说明原因并恢复。",
            )}
          </p>
        )}
        <CrmSingleSelect
          label={t(
            "Customer communication language",
            "Bahasa komunikasi pelanggan",
            "客户沟通语言",
          )}
          value={language}
          onChange={(v) => {
            setLanguage(v);
            setText(textFor(v));
            setCopied(false);
          }}
          options={[
            {
              value: "",
              label: t("Choose language", "Pilih bahasa", "请选择语言"),
            },
            { value: "en", label: "English" },
            { value: "id", label: "Bahasa Indonesia" },
            { value: "zh", label: "中文" },
          ]}
          lang={lang}
          isLight={isLight}
        />
        <textarea
          className="w-full border rounded-xl p-3"
          aria-label={t("Message", "Pesan", "话术")}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => setSave(e.target.checked)}
          />{" "}
          {t(
            "Save as customer language",
            "Simpan sebagai bahasa pelanggan",
            "保存为客户沟通语言",
          )}
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="flex gap-2 flex-wrap">
          <button
            className="crm-work-button"
            disabled={!language || stopped}
            onClick={async () => {
              try {
                await prepare();
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setError("");
              } catch (e) {
                setError(crmError((e as Error).message, lang));
              }
            }}
          >
            {copied
              ? t("Copied", "Disalin", "已复制")
              : t("Copy", "Salin", "复制")}
          </button>
          <button
            className="crm-work-button"
            disabled={!language || stopped}
            onClick={async () => {
              try {
                await prepare();
                window.open(
                  `https://wa.me/${(lead.whatsapp || "").replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(text)}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              } catch (e) {
                setError(crmError((e as Error).message, lang));
              }
            }}
          >
            WhatsApp
          </button>
          <button className="crm-work-button" onClick={close}>
            {t("Close", "Tutup", "关闭")}
          </button>
        </div>
        <p>
          {t(
            "Opening or copying does not record contact or complete a task.",
            "Membuka atau menyalin tidak mencatat kontak atau menyelesaikan tugas.",
            "打开或复制不会登记联系或完成任务。",
          )}
        </p>
      </div>
    </section>
  );
}
