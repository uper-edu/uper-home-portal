import {useCrmUiText} from './CrmUiLanguage';
import {AdminField} from '../AdminForm';
import {CrmSingleSelect} from './CrmSingleSelect';
import {salesProgressStages} from '../../utils/crmSalesProgress';
import {crmStageValue} from '../../utils/crmLanguage';
export function CrmProgressStageFields({value,currentStage,lang,isLight,timezone,disabled,locked,onChange}:any){
 const ui=useCrmUiText(lang);

 const chosen=salesProgressStages.find(s=>s[0]===value.stage),t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 return <section className="crm-progress-stage-fields" aria-label={t('Sales stage selection','Pilihan tahap penjualan','销售阶段选择')}>
 <fieldset disabled={disabled} className="crm-progress-stage-options">
 <div className="crm-simple-two-fields crm-progress-stage-selection"><AdminField required={value.enabled===true}>{t('New sales stage','Tahap penjualan baru','新销售阶段')}<CrmSingleSelect required={value.enabled===true} label={t('New sales stage','Tahap penjualan baru','新销售阶段')} value={value.enabled?value.stage||'':''} disabled={disabled} lang={lang} isLight={isLight} options={[{value:'',label:t('Keep current stage','Pertahankan tahap saat ini','保持当前阶段'),disabled:locked},...salesProgressStages.filter(s=>s[0]!==currentStage).map(s=>({value:s[0],label:s[lang==='zh'?1:lang==='id'?3:2]}))]} onChange={stage=>onChange({...value,stage,enabled:!!stage,enrollmentConfirmed:false})}/></AdminField>
</div>
 {value.enabled&&value.stage==='progress:enrolled'&&<label className="crm-progress-stage-toggle"><input type="checkbox" required aria-required="true" checked={value.enrollmentConfirmed===true} onChange={e=>onChange({...value,enrollmentConfirmed:e.target.checked})}/><span>{ui("确认正式课程报名已成立（不含试听预约） *")}</span></label>}
 </fieldset>
 </section>;
}
