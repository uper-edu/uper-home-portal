import {useCrmUiText} from './CrmUiLanguage';
import {AdminField} from '../AdminForm';
import {CrmSingleSelect} from './CrmSingleSelect';
import {salesProgressStages} from '../../utils/crmSalesProgress';
import {crmStageValue} from '../../utils/crmLanguage';
export function CrmProgressStageFields({value,currentStage,lang,isLight,timezone,disabled,locked,onChange}:any){
 const ui=useCrmUiText(lang);

 const chosen=salesProgressStages.find(s=>s[0]===value.stage),t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 return <section className="crm-progress-stage-fields" aria-label={ui("同时更新销售阶段")}>
 <label className="crm-progress-stage-toggle"><input type="checkbox" checked={value.enabled===true} disabled={disabled||locked} onChange={e=>onChange({...value,enabled:e.target.checked})}/><span>{t('Also update sales stage','Perbarui tahap penjualan juga','同时更新销售阶段')}</span></label>
 {value.enabled&&<fieldset disabled={disabled} className="crm-progress-stage-options"><p className="crm-work-muted">{t('Current stage','Tahap saat ini','当前阶段')}：{crmStageValue(currentStage,lang)}</p>
 <div className="crm-simple-two-fields crm-progress-stage-selection"><AdminField>{t('New sales stage *','Tahap penjualan baru *','新销售阶段 *')}<CrmSingleSelect required label={t('New sales stage','Tahap penjualan baru','新销售阶段')} value={value.stage||''} disabled={disabled} lang={lang} isLight={isLight} options={[{value:'',label:t('Select a stage','Pilih tahap','选择新阶段')},...salesProgressStages.filter(s=>s[0]!==currentStage).map(s=>({value:s[0],label:s[lang==='zh'?1:lang==='id'?3:2]}))]} onChange={stage=>onChange({...value,stage,enrollmentConfirmed:false})}/></AdminField>
 <AdminField>{t('Stage effective time *','Waktu berlaku tahap *','阶段生效时间 *')}<CrmSingleSelect required label={t('Stage effective time','Waktu berlaku tahap','阶段生效时间')} value={value.effectiveMode||''} disabled={disabled} lang={lang} isLight={isLight} options={[{value:'',label:t('Select effective time','Pilih waktu berlaku','选择生效时间')},{value:'specified',label:t('Specific date and time','Tanggal dan waktu pasti','明确日期与时间')},{value:'unknown',label:t('Effective time cannot be confirmed','Waktu berlaku tidak dapat dipastikan','确实无法确认生效时间')}]} onChange={effectiveMode=>onChange({...value,effectiveMode})}/></AdminField></div>
 {chosen&&<p className="crm-work-muted">{chosen[4]}</p>}
 {value.effectiveMode==='specified'&&<><AdminField>{ui("生效日期与时间 *")}<input type="datetime-local" step="60" required aria-label={ui("阶段生效日期与时间")} value={value.effectiveLocal||''} onChange={e=>onChange({...value,effectiveLocal:e.target.value})}/></AdminField><p className="crm-work-muted">{ui("时区：")}{timezone}</p></>}
 {value.stage==='progress:enrolled'&&<label className="crm-progress-stage-toggle"><input type="checkbox" required aria-required="true" checked={value.enrollmentConfirmed===true} onChange={e=>onChange({...value,enrollmentConfirmed:e.target.checked})}/><span>{ui("确认正式课程报名已成立（不含试听预约） *")}</span></label>}
 </fieldset>}
 </section>;
}
