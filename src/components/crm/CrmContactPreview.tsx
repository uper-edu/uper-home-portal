import {CrmContactReference} from './CrmContactReference';
import {copyPreparedContact} from '../../utils/crmContactPreparation';
import {AdminField,AdminRequiredNote,AdminFieldLabel} from '../AdminForm';
import {contactRestriction} from '../../utils/crmContact';
import {outreachPolicy,outreachText,isCrmManager,canClaimForContact} from '../../utils/crmOutreach';
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
  onRequestClose,
  onUpdated,
  inLayer=false,
  onDirty,
  onBusy,
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const [language, setLanguage] = useState(
    ["id", "en", "zh"].includes(lead.communicationLanguage)
      ? lead.communicationLanguage
      : "id",
  );
  const textFor = (l: string) =>
    greeting(l, lead.fullName || "", employee.displayName || employee.id);
  const [text, setText] = useState(textFor(language));
  const [template, setTemplate] = useState(
    "introduction",
  );
  const [edited, setEdited] = useState(false);
  const [closePending,setClosePending]=useState(false);
  const [pending, setPending] = useState<{
    language: string;
    template: string;
  } | null>(null);
  const messageId = useId(),languageId=useId(),intentId=useId();
  const [save, setSave] = useState(false);
  const [error, setError] = useState("");
  const [reason,setReason]=useState("");
  const [purpose,setPurpose]=useState<'sales_followup'|'identity_verification'|'customer_reply'>('sales_followup');
  const [evidence,setEvidence]=useState<any>({candidates:[],messages:[]});
  const [evidenceId,setEvidenceId]=useState('');
  const [unanswered,setUnanswered]=useState(false);
  const initialLanguage=useRef(language);
  const dirty=edited||template!=='introduction'||language!==initialLanguage.current||save||!!reason.trim()||!!evidenceId||unanswered||purpose!=='sales_followup';
  useEffect(()=>{onDirty?.(dirty);return()=>onDirty?.(false);},[dirty]);
  useEffect(()=>{setEvidenceId('');setUnanswered(false);if(purpose==='sales_followup')return;let alive=true;fetch(`/api/crm/leads/${lead.id}/contact-evidence`,{signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Error('CONTACT_EVIDENCE_REQUIRED');return r.json();}).then(v=>{if(alive)setEvidence(v);}).catch(()=>{if(alive)setError(outreachText('CONTACT_EVIDENCE_REQUIRED',lang));});return()=>{alive=false;};},[lead.id,purpose]);
  const [working,setWorking]=useState(false);
  useEffect(()=>{onBusy?.(working);return()=>onBusy?.(false);},[working]);
  const operationKey=useRef<{body:string;id:string}|null>(null);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLElement>(null);
  const message = useRef<HTMLTextAreaElement>(null);
  const confirmation=useRef<HTMLDivElement>(null);
  const hadPending = useRef(false);
  useEffect(() => {
    if (hadPending.current && !pending) message.current?.focus();
    if(pending)confirmation.current?.focus();
    hadPending.current = Boolean(pending);
  }, [pending]);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLElement>("h3")?.focus({preventScroll:true});
  }, []);
  const finishClose = () => {
    onClose();
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
    else document.querySelector<HTMLElement>("#crm-customer-panel h2")?.focus();
  };
  const close = () => {if(working)return;if(inLayer&&onRequestClose){onRequestClose();return;}if(dirty)setClosePending(true);else finishClose();};
  const stopped = lead.contactArrangement?.state === "stopped";
  const denied=outreachPolicy(employee,lead,purpose);
  const exceptional=purpose==='identity_verification'||(purpose==='customer_reply'&&Boolean(contactRestriction(lead)));
  const contactError=(e:unknown)=>{const message=(e as Error).message;return message.startsWith('CONTACT_')||message==='SELF_CLAIM_DISABLED'||message==='CLAIM_BEFORE_CONTACT'||message==='IDENTITY_REVIEW_REQUIRED'?outreachText(message,lang):crmError(message,lang);};
  const purposeDrafts=useRef<Record<string,string>>({});
  const purposeMessage=(value:string,l:string)=>value==='identity_verification'?(l==='zh'?`您好，${lead.fullName||''}！我是 UPER Education 的 ${employee.displayName||employee.id}。为避免重复登记，想核实此联系方式是否由您本人使用。`:l==='id'?`Halo ${lead.fullName||''}! Saya ${employee.displayName||employee.id} dari UPER Education. Untuk menghindari pendaftaran ganda, boleh saya memastikan apakah kontak ini Anda gunakan sendiri?`:l==='en'?`Hello ${lead.fullName||''}! I'm ${employee.displayName||employee.id} from UPER Education. To avoid duplicate records, may I confirm whether you use this contact yourself?`:''):value==='customer_reply'?'':textFor(l);
  const changePurpose=(value:typeof purpose)=>{purposeDrafts.current[purpose+':'+language]=text;setPurpose(value);setText(purposeDrafts.current[value+':'+language]??purposeMessage(value,language));setEdited(true);setCopied(false);setPending(null);};
  const replaceDraft = (next: { language: string; template: string }) => {
    setLanguage(next.language);
    setTemplate(next.template);
    setText(
      purpose!=='sales_followup'?purposeMessage(purpose,next.language):communicationTemplate(
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
  const prepare = async (action: string) => {
    if(denied)throw Error(denied);
    if(exceptional&&!reason.trim())throw Error("CONTACT_REASON_REQUIRED");
    if ((action!=="phone"&&(!language || !text.trim())) || stopped)
      throw Error(
        t(
          "Choose language and review the message",
          "Pilih bahasa dan tinjau pesan",
          "请选择语言并核对话术",
        ),
      );
    if(purpose!=='sales_followup'&&(!evidenceId||(purpose==='customer_reply'&&!unanswered)))throw Error('CONTACT_EVIDENCE_REQUIRED');
    const body={action,purpose,expectedOwner:lead.owner||null,expectedArrangementVersion:lead.contactArrangement?.version||0,reason:exceptional?reason.trim():undefined,candidateId:purpose==='identity_verification'?evidenceId:undefined,sourceMessageId:purpose==='customer_reply'?evidenceId:undefined,replyConfirmedUnanswered:purpose==='customer_reply'?unanswered:undefined};
    const key=JSON.stringify(body);
    if(operationKey.current?.body!==key)operationKey.current={body:key,id:crypto.randomUUID()};
    const response=await fetch(`/api/crm/leads/${lead.id}/contact-authorization`,{signal:AbortSignal.timeout(10000),method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestId:operationKey.current.id})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||String(response.status));
    if(!result.authorized||result.leadId!==lead.id)throw Error('CONTACT_PERMISSION_DENIED');
    if (save) {
      const r = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationLanguage: language }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      onUpdated({...lead,...d.lead});
    }
  };
  return (
    <section
      ref={root}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !inLayer) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
      className="crm-customer-context crm-contact-preview"
      role={inLayer?undefined:"dialog"}
      aria-label={t("Prepare contact", "Siapkan kontak", "准备联系")}
    >
      <div className="crm-contact-preparation-body"><div className="crm-editor-scroll"><AdminRequiredNote lang={lang}/>
        {!inLayer&&<h3 tabIndex={-1}>
          {t(
            "Prepare contact",
            "Siapkan kontak",
            "准备联系",
          )}
        </h3>}
        <p>
          {!inLayer&&<>{lead.fullName} · </>}{t('Phone','Nomor telepon','号码')}：{lead.whatsapp||t('Not recorded','Belum tercatat','未记录')}
        </p>
        {(lead.identityReview?.pending||contactRestriction(lead))&&<CrmSingleSelect disabled={working} label={t('Contact scope','Cakupan kontak','联系范围')} value={purpose} onChange={(v)=>changePurpose(v as typeof purpose)} lang={lang} isLight={isLight} options={[
          {value:'sales_followup',label:t('Sales follow-up','Tindak lanjut penjualan','销售跟进')},
          ...(isCrmManager(employee)&&lead.identityReview?.pending?[{value:'identity_verification',label:t('Verify identity only','Verifikasi identitas saja','仅核实身份')}]:[]),
          ...(!lead.identityReview?.pending?[{value:'customer_reply',label:t('Reply to a new customer question','Jawab pertanyaan baru pelanggan','回复客户新问题')}]:[]),
        ]}/>}
        {purpose!=='sales_followup'&&!denied&&<>
          <CrmSingleSelect disabled={working} label={purpose==='identity_verification'?t('Matching record','Catatan terkait','需核实的另一条记录'):t('Customer message','Pesan pelanggan','客户原文')} value={evidenceId} onChange={v=>{setEvidenceId(v);setEdited(true);}} lang={lang} isLight={isLight} options={[{value:'',label:t('Select evidence','Pilih bukti','请选择依据')},...(purpose==='identity_verification'?evidence.candidates:evidence.messages).map((v:any)=>({value:v.id,label:v.name||v.content}))]}/>
          {purpose==='customer_reply'&&<AdminField><input type="checkbox" checked={unanswered} onChange={e=>{setUnanswered(e.target.checked);setEdited(true);}}/>{t('I checked that this question has not been answered. Opening a tool does not record a reply.','Saya telah memeriksa bahwa pertanyaan ini belum dijawab. Membuka alat tidak mencatat balasan.','我已核对该问题尚未答复；打开工具不会记为已回复。')}</AdminField>}
        </>}
        {denied&&<div role="status"><p>{outreachText(denied,lang)}</p>{denied==='CLAIM_BEFORE_CONTACT'&&canClaimForContact(employee,lead)&&<button type="button" className="crm-work-button" disabled={working} onClick={async()=>{setWorking(true);try{const r=await fetch(`/api/crm/leads/${lead.id}/claim`,{method:'POST',headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(d.error);onUpdated({...lead,...d.lead});setError('');}catch(e){setError(contactError(e));}finally{setWorking(false);}}}>{t('Claim for myself, then contact','Ambil untuk saya, lalu hubungi','自己认领，再联系')}</button>}</div>}
        {exceptional&&!denied&&<AdminField>{t('Reason and contact scope (required)','Alasan dan cakupan kontak (wajib)','本次联系的原因与范围（必填）')}<textarea value={reason} onChange={e=>{setReason(e.target.value);setEdited(true);}}/></AdminField>}
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
          {purpose==='sales_followup'&&<div><label htmlFor={intentId} className="crm-template-label">{t('Purpose of this contact','Tujuan komunikasi ini','本次沟通目的')}</label><CrmSingleSelect controlId={intentId} label={t('Purpose of this contact','Tujuan komunikasi ini','本次沟通目的')} value={template} disabled={working} onChange={v=>choose({language,template:v})} options={[...communicationTemplates.map(item=>({value:item.id,label:templateLabel(item,lang)})),{value:'custom',label:t('Write your own','Tulis sendiri','自由编写')}]} lang={lang} isLight={isLight}/></div>}
          <div><label htmlFor={languageId} className="crm-template-label"><AdminFieldLabel required>{t('Customer communication language','Bahasa komunikasi pelanggan','客户沟通语言')}</AdminFieldLabel></label><CrmSingleSelect controlId={languageId} label={t('Customer communication language','Bahasa komunikasi pelanggan','客户沟通语言')} value={language} required disabled={working} onChange={v=>choose({language:v,template})} options={[{value:'',label:t('Choose language','Pilih bahasa','请选择语言')},{value:'en',label:'English'},{value:'id',label:'Bahasa Indonesia'},{value:'zh',label:'中文'}]} lang={lang} isLight={isLight}/></div>
        </div>
        {purpose==='sales_followup'&&(
        <p className="crm-work-muted">
          {t(
            "Editable starting points, not confirmed offers. Review course, fee and availability details before sending.",
            "Templat dapat diedit dan bukan penawaran terkonfirmasi. Periksa informasi kursus, biaya, dan ketersediaan sebelum mengirim.",
            "模板可自由编辑，不代表已确认的优惠或安排。发送前请核实课程、费用及可用时间。",
          )}
        </p>
        )}
        {pending && (
          <div
            ref={confirmation}
            tabIndex={-1}
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
        <CrmContactReference lang={lang} disabled={working||purpose!=='sales_followup'} onPrepare={v=>{const confirm=edited&&!!text.trim();choose({language,template:v});if(!confirm)requestAnimationFrame(()=>message.current?.focus());}}/>
        <AdminField required htmlFor={messageId}>
          {t("Message", "Pesan", "消息内容")}
        </AdminField>
        <textarea
          ref={message}
          id={messageId}
          className="w-full border rounded-xl p-3"
          aria-label={t("Message", "Pesan", "消息内容")}
          rows={7}
          required
          aria-required="true"
          disabled={working}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setEdited(true);
            setCopied(false);
          }}
        />
        <AdminField>
          <input
            type="checkbox"
            checked={save}
            disabled={working}
            onChange={(e) => setSave(e.target.checked)}
          />{" "}
          {t(
            "Save as customer language",
            "Simpan sebagai bahasa pelanggan",
            "保存为客户沟通语言",
          )}
        </AdminField>

        {error && <p role="alert">{error}</p>}
        <p className="crm-work-muted">
          {t(
            "Opening or copying does not record contact or complete a task.",
            "Membuka atau menyalin tidak mencatat kontak atau menyelesaikan tugas.",
            "打开或复制不会登记联系或完成任务。",
          )}
        </p>
        </div><div className="crm-contact-actions">
          <div className="crm-contact-call-actions">
          {lead.whatsapp&&<button type="button" className="crm-work-button" disabled={Boolean(denied)||working||Boolean(pending)||(exceptional&&!reason.trim())} onClick={async()=>{setWorking(true);try{await prepare('phone');window.location.assign(`tel:${lead.whatsapp.replace(/[^+0-9]/g,'')}`);operationKey.current=null;setError('');}catch(e){setError(contactError(e));}finally{setWorking(false);}}}>{t('Phone call','Telepon','拨打电话')}</button>}
          </div>
          <div className="crm-contact-message-actions">
          <button type="button"
            className="crm-work-button"
            disabled={!language || Boolean(denied) || working || (exceptional&&!reason.trim()) || !text.trim() || Boolean(pending)}
            onClick={async () => {
              try {
                setCopied(false);setError('');setWorking(true);
                await copyPreparedContact(text,()=>prepare("copy"),async value=>{try{await navigator.clipboard.writeText(value);}catch{throw Error('clipboard_copy_failed');}});
                operationKey.current=null;
                setCopied(true);
                setError("");
              } catch (e) {
                setError((e as Error).message==='clipboard_copy_failed'?t('Could not copy. Message retained; try again.','Tidak dapat menyalin. Pesan tetap tersimpan; coba lagi.','复制未成功，消息草稿已保留，请重试。'):contactError(e));
              } finally {setWorking(false);}
            }}
          >
            {copied
              ? t("Message copied", "Pesan disalin", "消息已复制")
              : t("Copy message", "Salin pesan", "复制消息")}
          </button>
          <button type="button"
            className="crm-work-button crm-editor-primary"
            disabled={!language || Boolean(denied) || working || (exceptional&&!reason.trim()) || !text.trim() || Boolean(pending)}
            onClick={async () => {
              try {
                setWorking(true);
                await prepare("whatsapp");
                window.open(
                  `https://wa.me/${(lead.whatsapp || "").replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(text)}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              } catch (e) {
                setError(contactError(e));
              } finally {setWorking(false);}
            }}
          >
            {t("Open WhatsApp", "Buka WhatsApp", "打开 WhatsApp")}
          </button>

          {!inLayer&&<button type="button" className="crm-work-button" disabled={working} onClick={close}>
            {t("Close", "Tutup", "关闭")}
          </button>}
          </div>
        </div>
        {copied&&<p role="status" className="sr-only">{t("Message copied","Pesan disalin","消息已复制")}</p>}

      </div>
    </section>
  );
}
