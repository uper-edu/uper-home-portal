import {AdminField,AdminFieldLabel} from '../AdminForm';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {progressLabel,salesProgressStages} from '../../utils/crmSalesProgress';
import type {CrmLanguage} from '../../utils/crmLanguage';

export type ProgressOpportunity = {id:string;level:string;state:string;salesStage:string;revision:number};

export function CrmOpportunityProgressFields({lang,isLight,anchorId,linked,disabled,fixed,options,loadError,selection,stage,onLink,onSelect,onStage,onReload}:{
  lang:CrmLanguage;isLight:boolean;anchorId:string;linked:boolean;disabled:boolean;fixed?:ProgressOpportunity;
  options?:ProgressOpportunity[];loadError:boolean;selection?:ProgressOpportunity;stage:string;
  onLink:(linked:boolean)=>void;onSelect:(opportunity?:ProgressOpportunity)=>void;onStage:(stage:string)=>void;onReload:()=>void;
}) {
  const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const describe=(op:ProgressOpportunity)=>`${op.level} · ${op.id.slice(-8)} · ${progressLabel(op.salesStage,lang)}`;
  const opportunityLabel=t('商机','Opportunity','Peluang');
  const stageLabel=t('商机阶段','Opportunity stage','Tahap peluang');
  const latest=options?.find(op=>op.id===selection?.id);
  const changed=!!selection&&!!options&&latest?.revision!==selection.revision;
  return <div id={anchorId} className="crm-progress-field-stack">
    {!fixed&&<AdminField className="crm-simple-check">
      <input type="checkbox" checked={linked} disabled={disabled} onChange={event=>onLink(event.currentTarget.checked)}/>
      <span>{t('同时推进一笔商机','Also update an opportunity','Perbarui satu peluang juga')}</span>
    </AdminField>}
    {linked&&<>
      {fixed&&<p className="crm-simple-help">{describe(selection??fixed)}</p>}
      {loadError?<div>
        <p role="alert">{t('暂时无法读取商机，草稿已保留。','Could not load opportunities. Draft retained.','Peluang belum dapat dimuat. Draf disimpan.')}</p>
        <button type="button" disabled={disabled} onClick={onReload}>{t('重新加载商机','Reload opportunities','Muat ulang peluang')}</button>
      </div>:!options?<p role="status">{t('正在读取商机…','Loading opportunities…','Memuat peluang…')}</p>:!options.length||fixed&&!options.some(op=>op.id===fixed.id)?
        <p role="status">{t('当前没有可推进的商机。','No opportunity is available to update.','Tidak ada peluang yang dapat diperbarui.')}</p>:
        <>
          {!fixed&&<div className="crm-simple-select-field">
            <p><AdminFieldLabel required>{opportunityLabel}</AdminFieldLabel></p>
            <AdminSingleSelect required label={opportunityLabel} lang={lang} isLight={isLight} disabled={disabled}
              value={latest?.id??''} options={[{value:'',label:t('选择要推进的商机','Select an opportunity','Pilih peluang')},
                ...options.map(op=>({value:op.id,label:describe(op)}))]} onChange={id=>onSelect(options.find(op=>op.id===id))}/>
          </div>}
          {changed&&<div>
            <p role="status">{t('商机已变化，请核对后继续。','Review the latest opportunity before continuing.','Periksa peluang terbaru sebelum melanjutkan.')}</p>
            {latest&&<button type="button" disabled={disabled} onClick={()=>onSelect(latest)}>{t('使用已核对的商机','Use the reviewed opportunity','Gunakan peluang yang telah diperiksa')}</button>}
          </div>}
          {selection&&!changed&&selection.state!=='aftercare'&&<div className="crm-simple-select-field">
            <p><AdminFieldLabel>{stageLabel}</AdminFieldLabel></p>
            <AdminSingleSelect label={stageLabel} lang={lang} isLight={isLight} disabled={disabled} value={stage}
              options={[{value:'',label:t('保持现有阶段','Keep the current stage','Pertahankan tahap saat ini')},
                ...salesProgressStages.filter(([value])=>value!=='progress:enrolled'&&value!==selection.salesStage)
                  .map(([value])=>({value,label:progressLabel(value,lang)}))]} onChange={onStage}/>
          </div>}
        </>}
      <p className="crm-simple-help">{t('客户保留这条原始记录，所选商机可查看同一条记录。','The selected opportunity will link to the original customer record.','Peluang yang dipilih merujuk ke catatan asli pelanggan.')}</p>
    </>}
  </div>;
}
