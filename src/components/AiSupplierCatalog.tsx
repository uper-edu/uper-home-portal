import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Plus} from 'lucide-react';
import {aiSupplierIds, aiSupplierTemplates, isAiSupplierId, type AiSupplierId, type AiSupplierView} from '../utils/aiSupplier';
import type {CrmLanguage} from '../utils/crmLanguage';
import type {AiServiceData} from './AiServicePanel';
import {AdminField} from './AdminForm';
import {AdminFormFeedback, AdminFormSection, AdminFormSummary} from './AdminFormLayout';
import {AdminConfirmation} from './admin/AdminConfirmation';
import {AdminDiscardDialog} from './admin/AdminDiscardDialog';
import {AdminEditor} from './admin/AdminEditor';
import {AdminListTable} from './admin/AdminList';
import {AdminRowAction} from './admin/AdminListControl';
import {AdminPageAction} from './admin/AdminPageAction';
import {AdminSingleSelect} from './admin/AdminSingleSelect';

type Action = 'add'|'enable'|'disable';
type Operation = {id: AiSupplierId; action: Action; name?: string; models?: readonly string[]};
const defaultModels=(id:AiSupplierId)=>aiSupplierTemplates[id].models.length===1?aiSupplierTemplates[id].models[0]:'all';
const modelNames=(models:readonly string[])=><small>{models.join(' · ')}</small>;

export function AiSupplierCatalog({data, refresh, lang, isLight, onDraftChange, onBusyChange, disabled, renderCredential}: {
  data?: AiServiceData; refresh: () => Promise<AiServiceData|undefined>; lang: CrmLanguage; isLight: boolean;
  onDraftChange: (dirty:boolean) => void; onBusyChange: (busy:boolean) => void; disabled: boolean;
  renderCredential: (id:string, label:string, info?:ReactNode, actions?:ReactNode) => ReactNode;
}) {
  const t = (en:string,id:string,zh:string) => lang==='zh'?zh:lang==='id'?id:en;
  const [adding,setAdding] = useState(false);
  const [templateId,setTemplateId] = useState<AiSupplierId>('anthropic');
  const [name,setName] = useState<string>(aiSupplierTemplates.anthropic.name);
  const [choice,setChoice] = useState<string>(defaultModels('anthropic'));
  const [discard,setDiscard] = useState(false);
  const [confirm,setConfirm] = useState<AiSupplierId>();
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [pending,setPending] = useState<Operation>();
  const running = useRef(false);
  const initialTemplate = useRef<AiSupplierId>('anthropic');
  const suppliers = data?.suppliers ?? [];
  const availableTemplates=aiSupplierIds.filter(id=>!suppliers.some(row=>row.id===id));
  const template=aiSupplierTemplates[templateId];
  const dirty = adding&&(templateId!==initialTemplate.current||name!==template.name||choice!==defaultModels(templateId));
  useEffect(()=>{onDraftChange(dirty);return ()=>onDraftChange(false);},[dirty,onDraftChange]);
  useEffect(()=>{onBusyChange(busy);return ()=>onBusyChange(false);},[busy,onBusyChange]);

  const title=t('Provider credentials','Kredensial penyedia','供应商凭证');
  const add=t('Add provider','Tambah penyedia','新增供应商');
  const enable=t('Enable provider','Aktifkan penyedia','启用供应商');
  const disable=t('Disable provider','Nonaktifkan penyedia','停用供应商');
  const cancel=t('Cancel','Batal','取消');
  const closeForm=()=>{
    if(dirty)setDiscard(true);
    else {setAdding(false);setNotice('');}
  };
  const matches=(operation:Operation,row?:AiSupplierView)=>row?.registered&&
    (operation.action==='add'?row.name===operation.name&&JSON.stringify(row.models)===JSON.stringify(operation.models):
      row.enabled===(operation.action==='enable'));

  const reload=async(operation?:Operation)=>{
    const updated=await refresh();
    if(!updated)return false;
    setPending(undefined);
    if(operation&&matches(operation,updated.suppliers?.find(row=>row.id===operation.id))){
      setAdding(false);setNotice('saved');
    }else if(operation)setNotice('conflict');
    else setNotice('');
    return true;
  };
  const reconcile=async()=>{
    if(running.current)return;
    running.current=true;setBusy(true);
    try{await reload(pending);}
    finally{running.current=false;setBusy(false);}
  };
  const save=async(operation:Operation)=>{
    if(!data||running.current||pending||disabled)return;
    running.current=true;setBusy(true);setNotice('');setConfirm(undefined);
    try {
      const response=await fetch('/api/admin/ai-service/supplier',{
        method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
        body:JSON.stringify({...operation,revision:data.revision}),
      });
      if(!response.ok){
        if(response.status>=500)throw Error();
        const result=await response.json();
        setNotice(result.error??'error');
        return;
      }
      if(await reload(operation))return;
    }catch{/* The write may have succeeded. Read the catalog before allowing a retry. */}
    finally{running.current=false;setBusy(false);}
    setPending(operation);setNotice('unknown');
  };

  const messages:Record<string,string>={
    conflict:t('Settings changed. Reload before continuing.','Pengaturan berubah. Muat ulang sebelum melanjutkan.','配置有变更，请重新读取后继续。'),
    supplier_exists:t('This provider is already configured or in use.','Penyedia ini sudah dikonfigurasi atau sedang digunakan.','此供应商已配置或正在使用。'),
    supplier_invalid:t('Check the provider name and models.','Periksa nama penyedia dan model.','请核对供应商名称和模型。'),
    supplier_in_use:t('Choose different primary and fallback models before disabling this provider.','Pilih model utama dan cadangan lain sebelum menonaktifkan penyedia ini.','请先切换主备配置中正在使用的模型，再停用此供应商。'),
    supplier_credential_required:t('Verify and save a credential first.','Verifikasi dan simpan kredensial terlebih dahulu.','请先核验并保存凭证。'),
    saved:t('Provider saved.','Penyedia disimpan.','供应商设置已保存。'),
  };
  const feedback=notice&&<AdminFormFeedback lang={lang} state={notice==='saved'?'saved':notice==='unknown'?'unknown':'error'}>{messages[notice]}</AdminFormFeedback>;
  const reloadAction=(pending||notice==='conflict'||notice==='supplier_exists')&&<button type="button" disabled={busy} onClick={()=>void reconcile()}>
    {t('Reload provider settings','Muat ulang pengaturan penyedia','重新读取供应商设置')}</button>;
  const status=(row:AiSupplierView)=><small>{row.inUse?t('Used by the current model configuration','Dipakai konfigurasi model saat ini','当前主备配置正在使用'):
    row.enabled?t('Enabled','Aktif','已启用'):
    row.credentialReady?t('Ready to enable','Siap diaktifkan','可启用'):t('Credential required','Perlu kredensial','待配置凭证')}</small>;
  const rowActions=(row:AiSupplierView)=>row.registered&&<AdminRowAction disabled={disabled||busy||!!pending||(row.enabled?row.inUse:!row.credentialReady)}
    title={row.enabled&&row.inUse?messages.supplier_in_use:!row.credentialReady?messages.supplier_credential_required:undefined}
    onClick={()=>row.enabled?setConfirm(row.id):void save({id:row.id,action:'enable'})}>{row.enabled?disable:enable}</AdminRowAction>;
  const chooseTemplate=(id:string)=>{
    if(!isAiSupplierId(id)||!availableTemplates.includes(id))return;
    setTemplateId(id);setName(aiSupplierTemplates[id].name);setChoice(defaultModels(id));
  };
  const openTemplate=(id:AiSupplierId)=>{
    initialTemplate.current=id;chooseTemplate(id);setNotice('');setAdding(true);
  };
  const addBlocked=disabled||busy||!!pending;
  const modelOptions=template.models.map(model=>({value:model,label:model}));
  const modelsLabel=t('Models','Model','模型');
  const templateLabel=t('Provider template','Templat penyedia','供应商模板');
  return <AdminFormSection title={title} variant="card" actions={data&&availableTemplates.length>0&&<AdminPageAction label={add} icon={Plus}
    aria-haspopup="dialog" disabled={addBlocked} onClick={()=>openTemplate(availableTemplates[0])}/>}>
    <AdminListTable className="llm-credentials-table" label={title}
      headers={[t('Provider','Penyedia','供应商'),t('Credential status','Status kredensial','凭证状态'),t('Actions','Tindakan','操作')]}>
      {renderCredential('openai','OpenAI')}
      {renderCredential('deepseek','DeepSeek')}
      {data&&aiSupplierIds.map(id=>{
        const row=suppliers.find(item=>item.id===id);
        if(row?.id==='minimax'&&!row.registered)return <tr key={id}>
          <td><strong>{row.name}</strong><div>{modelNames(row.models)}</div></td>
          <td colSpan={2}>{t('Legacy gateway is in use. Switch models before adding a direct credential.',
            'Gateway lama sedang digunakan. Ganti model sebelum menambahkan kredensial langsung.','旧网关正在使用中。请先切换模型，再添加 MiniMax 直连。')}</td>
        </tr>;
        if(row)return renderCredential(id,row.name,<>
          <div>{modelNames(row.models)}</div>{row.registered&&<div>{status(row)}</div>}
        </>,rowActions(row));
        const item=aiSupplierTemplates[id];
        return <tr key={id}>
          <td><strong>{item.name}</strong><div>{modelNames(item.models)}</div></td>
          <td>{t('Not added','Belum ditambahkan','未添加')}</td>
          <td><AdminRowAction aria-haspopup="dialog" aria-label={t(`Add ${item.name}`,`Tambah ${item.name}`,`添加 ${item.name}`)}
            disabled={addBlocked} onClick={()=>openTemplate(id)}>{t('Add','Tambah','添加')}</AdminRowAction></td>
        </tr>;
      })}
    </AdminListTable>
    {!adding&&<>{feedback}{reloadAction}</>}
    {adding&&<AdminEditor title={add} lang={lang} light={isLight} required busy={busy} responsiveForm onClose={closeForm}
      onSubmit={event=>{event.preventDefault();if(name.trim())void save({id:templateId,action:'add',name:name.trim(),models:choice==='all'?template.models:[choice]});}}
      footer={<>{reloadAction}<button type="button" disabled={busy} onClick={closeForm}>{cancel}</button>
        <button type="submit" data-primary disabled={busy||!name.trim()||!!pending}>{t('Save','Simpan','保存')}</button></>}>
      <AdminField as="div" required><label htmlFor="ai-supplier-template">{templateLabel}</label>
        <AdminSingleSelect controlId="ai-supplier-template" label={templateLabel} value={templateId} onChange={chooseTemplate}
          options={availableTemplates.map(id=>({value:id,label:aiSupplierTemplates[id].name}))} lang={lang} isLight={isLight} required disabled={busy}/></AdminField>
      <AdminFormSummary fields={[[t('Service endpoint','Endpoint layanan','服务地址'),template.endpoint,'wide']]}/>
      <AdminField as="div" required><label htmlFor="ai-supplier-name">{t('Display name','Nama tampilan','显示名称')}</label>
        <input id="ai-supplier-name" className="admin-text-input" value={name} required maxLength={80} disabled={busy}
          onChange={event=>setName(event.target.value)}/></AdminField>
      <AdminField as="div" required><label htmlFor="ai-supplier-models">{modelsLabel}</label>
        <AdminSingleSelect controlId="ai-supplier-models" label={modelsLabel} value={choice} onChange={setChoice}
          options={modelOptions.length===1?modelOptions:[{value:'all',label:t('All template models','Semua model templat','模板内全部模型')},...modelOptions]}
          lang={lang} isLight={isLight} required disabled={busy}/>
        {choice==='all'&&modelNames(template.models)}
      </AdminField>
      {feedback}
    </AdminEditor>}
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)}
      onDiscard={()=>{setDiscard(false);setAdding(false);setNotice('');}}/>}
    {confirm&&<AdminConfirmation light={isLight} title={disable}
      description={t('The models will be removed from the selection list. You can enable the provider again later.',
        'Model akan dihapus dari daftar pilihan. Penyedia dapat diaktifkan kembali nanti.',
        '该供应商的模型将从可选列表移除，之后可重新启用。')}
      cancelLabel={cancel} confirmLabel={disable} onCancel={()=>setConfirm(undefined)} onConfirm={()=>void save({id:confirm,action:'disable'})}/>}
  </AdminFormSection>;
}
