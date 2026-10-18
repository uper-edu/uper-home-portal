import { useState, useEffect, useRef, useId } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { crmError } from "../../utils/crmLanguage";
import { greeting } from "../../utils/crmContact";
import {
  communicationTemplates,
  communicationTemplate,
  templateLabel,
} from "../../utils/crmCommunicationTemplates";
export function CrmContactPreview({
  lead,
  employee,
  lang,
  isLight,
  onClose,
  onUpdated,
  scripts,
  onDirty,
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
  const [template, setTemplate] = useState(
    scripts ? "provided" : "introduction",
  );
  const [edited, setEdited] = useState(false);
  const [closePending,setClosePending]=useState(false);
  useEffect(()=>{onDirty?.(edited);return ()=>onDirty?.(false);},[edited]);
  const [pending, setPending] = useState<{
    language: string;
    template: string;
  } | null>(null);
  const messageId = useId();
  const [save, setSave] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLElement>(null);
  const message = useRef<HTMLTextAreaElement>(null);
  const hadPending = useRef(false);
  useEffect(() => {
    if (hadPending.current && !pending) message.current?.focus();
    hadPending.current = Boolean(pending);
  }, [pending]);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLElement>("h3")?.focus();
  }, []);
  const finishClose = () => {
    onClose();
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
    else document.querySelector<HTMLElement>("#crm-customer-panel h2")?.focus();
  };
  const close = () => {if(edited)setClosePending(true);else finishClose();};
  const stopped = lead.contactArrangement?.state === "stopped";
  const replaceDraft = (next: { language: string; template: string }) => {
    setLanguage(next.language);
    setTemplate(next.template);
    setText(
      next.template === "provided"
        ? textFor(next.language)
        : communicationTemplate(
            next.template,
            next.language,
            lead.fullName || "",
            employee.displayName || employee.id,
          ),
    );
    setEdited(false);
    setPending(null);
    setCopied(false);
    setError("");
  };
  const choose = (next: { language: string; template: string }) => {
    if (edited && text.trim()) setPending(next);
    else replaceDraft(next);
  };
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
        {closePending&&<div role="alert" className="crm-template-confirm"><p>{t("Discard the edited message?","Buang pesan yang telah diedit?","放弃已编辑的话术？")}</p><button type="button" onClick={()=>{setClosePending(false);message.current?.focus();}}>{t("Keep editing","Lanjutkan mengedit","继续编辑")}</button><button type="button" onClick={finishClose}>{t("Discard and close","Buang dan tutup","放弃并关闭")}</button></div>}
        {stopped && (
          <p role="alert">
            {t(
              "Proactive contact stopped. Restore with a reason first.",
              "Kontak proaktif dihentikan. Pulihkan dengan alasan terlebih dahulu.",
              "已停止主动联系，请先说明原因并恢复。",
            )}
          </p>
        )}
        <div className="crm-template-selectors">
          <div>
            <p className="crm-template-label">
              {t(
                "Customer communication language",
                "Bahasa komunikasi pelanggan",
                "客户沟通语言",
              )}
            </p>
            <CrmSingleSelect
              label={t(
                "Customer communication language",
                "Bahasa komunikasi pelanggan",
                "客户沟通语言",
              )}
              value={language}
              onChange={(v) => choose({ language: v, template })}
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
          </div>
          <div>
            <p className="crm-template-label">
              {t("Message template", "Templat pesan", "常用沟通模板")}
            </p>
            <CrmSingleSelect
              label={t("Message template", "Templat pesan", "常用沟通模板")}
              value={template}
              onChange={(v) => choose({ language, template: v })}
              options={[
                ...(scripts
                  ? [
                      {
                        value: "provided",
                        label: t(
                          "Selected sales guidance",
                          "Panduan penjualan terpilih",
                          "已选销售指导",
                        ),
                      },
                    ]
                  : []),
                ...communicationTemplates.map((item) => ({
                  value: item.id,
                  label: templateLabel(item, lang),
                })),
                {
                  value: "custom",
                  label: t("Write your own", "Tulis sendiri", "自由编写"),
                },
              ]}
              lang={lang}
              isLight={isLight}
            />
          </div>
        </div>
        <p className="crm-work-muted">
          {t(
            "Editable starting points, not confirmed offers. Review course, fee and availability details before sending.",
            "Templat dapat diedit dan bukan penawaran terkonfirmasi. Periksa informasi kursus, biaya, dan ketersediaan sebelum mengirim.",
            "模板可自由编辑，不代表已确认的优惠或安排。发送前请核实课程、费用及可用时间。",
          )}
        </p>
        {pending && (
          <div
            className="crm-template-confirm"
            role="group"
            aria-label={t(
              "Keep or replace draft",
              "Simpan atau ganti draf",
              "保留或替换草稿",
            )}
          >
            <p role="status">
              {t(
                "You edited this message. Replace it with the new selection?",
                "Anda telah mengedit pesan ini. Ganti dengan pilihan baru?",
                "您已编辑话术，是否用新选择替换当前草稿？",
              )}
            </p>
            <button
              className="crm-work-button"
              type="button"
              onClick={() => replaceDraft(pending)}
            >
              {t("Replace draft", "Ganti draf", "替换草稿")}
            </button>{" "}
            <button
              className="crm-work-button"
              type="button"
              onClick={() => setPending(null)}
            >
              {t("Keep editing", "Lanjutkan mengedit", "保留并继续编辑")}
            </button>
          </div>
        )}
        {!language && (
          <p role="status">
            {t(
              "Choose the customer's communication language to prepare a message.",
              "Pilih bahasa komunikasi pelanggan untuk menyiapkan pesan.",
              "请先选择客户沟通语言，再准备话术。",
            )}
          </p>
        )}
        <label htmlFor={messageId}>
          {t("Message · editable", "Pesan · dapat diedit", "话术 · 可编辑")}
        </label>
        <textarea
          ref={message}
          id={messageId}
          className="w-full border rounded-xl p-3"
          aria-label={t("Message", "Pesan", "话术")}
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setEdited(true);
            setCopied(false);
          }}
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
            disabled={!language || stopped || !text.trim() || Boolean(pending)}
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
            disabled={!language || stopped || !text.trim() || Boolean(pending)}
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
