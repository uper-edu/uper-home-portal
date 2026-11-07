import {formatCurrency} from '../../utils/currency';
import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {AdminField} from '../AdminForm';
import {CrmSingleSelect} from './CrmSingleSelect';
import {courseDiscount,courseError,type CoursePrice} from '../../utils/crmCoursePricing';
export function CrmEnrollmentFields({value,onChange,lang,isLight,disabled,request=fetch}:any){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const [courses,setCourses]=useState<CoursePrice[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const r=await request('/api/crm/courses');if(!r.ok)throw Error();setCourses((await r.json()).courses);setError('');}catch{setError(t('Unable to load courses.','Kursus belum dapat dimuat.','课程暂时无法加载。'));}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const q=value||{discountMode:'none',discountValue:'',confirmed:false};const course=courses.find(c=>c.id===q.courseId);
 let price:any=null,priceError='';if(course)try{price=courseDiscount(course,q.discountMode,q.discountValue);}catch(e:any){priceError=courseError(e.message,lang);}
 const stale=course&&course.revision!==q.courseRevision;
 const change=(p:any)=>onChange({...q,...p,confirmed:false});
 const money=(v:number)=>formatCurrency(v,lang);
 return <section className="crm-enrollment-fields" aria-label={t('Course and amount due','Kursus dan tagihan','课程与应收')}>
 {error&&<p role="alert">{error}</p>}{loading&&<p role="status">{t('Loading courses…','Memuat kursus…','正在加载课程…')}</p>}
 <AdminField required as="div" className="crm-enrollment-course"><div className="crm-enrollment-field-heading"><label>{t('Course','Kursus','课程')}</label><button type="button" className="crm-work-link crm-enrollment-refresh" aria-label={t('Refresh courses','Segarkan kursus','刷新课程')} title={t('Refresh courses','Segarkan kursus','刷新课程')} disabled={disabled||loading} onClick={()=>{onChange({...q,confirmed:false});void load();}}><RefreshCw size={16} aria-hidden="true"/></button></div><CrmSingleSelect label={t('Course','Kursus','课程')} required value={q.courseId||''} lang={lang} isLight={isLight} disabled={disabled||loading} options={[{value:'',label:t('Select a published course','Pilih kursus diterbitkan','选择已发布课程')},...courses.filter(c=>c.active||c.id===q.courseId).map(c=>({value:c.id,label:`${c.name} · ${c.sessions}${t(' sessions',' pertemuan','课时')} · ${money(c.price)}`,disabled:!c.active}))]} onChange={id=>{const c=courses.find(c=>c.id===id);change({courseId:id,courseRevision:c?.revision,discountMode:'none',discountValue:''});}}/></AdminField>
 {!loading&&!courses.some(c=>c.active)&&<p>{t('No published courses. Ask the operations administrator to publish one.','Belum ada kursus diterbitkan. Hubungi pengelola operasional.','暂无已发布课程，请联系销售运营管理员维护。')}</p>}
 {course&&<>
 <div className="crm-enrollment-discount"><div className="crm-enrollment-discount-fields"><AdminField>{t('Discount','Diskon','优惠')}<CrmSingleSelect label={t('Discount','Diskon','优惠')} lang={lang} isLight={isLight} value={q.discountMode} disabled={disabled} options={[{value:'none',label:t('No discount','Tanpa diskon','无优惠')},{value:'percent',label:t('Discount (%)','Diskon (%)','优惠比例（%）')},{value:'amount',label:t('Discount amount (Rp)','Nominal diskon (Rp)','优惠金额（Rp）')}]} onChange={v=>change({discountMode:v,discountValue:''})}/></AdminField>
 {q.discountMode!=='none'&&<AdminField required>{q.discountMode==='percent'?t('Discount (%)','Diskon (%)','优惠比例（%）'):t('Discount amount (Rp)','Nominal diskon (Rp)','优惠金额（Rp）')}<input type="number" min="0" step={q.discountMode==='percent'?'0.01':'1'} disabled={disabled} value={q.discountValue} onChange={e=>change({discountValue:e.target.value})}/></AdminField>}
 </div><p className="crm-work-muted">{t('Discount allowance','Batas diskon','优惠上限')}：{course.maxDiscountBps/100}%{course.maxDiscountAmount!==null?' / '+money(course.maxDiscountAmount):''}</p></div>
 {stale&&<p role="alert">{courseError('course_changed',lang)}<button type="button" className="crm-work-button" disabled={disabled} onClick={()=>change({courseRevision:course.revision})}>{t('Use reviewed price','Gunakan harga ditinjau','采用已核对价格')}</button></p>}
 {priceError&&<p role="alert">{priceError}</p>}
 <label className="admin-field admin-field--choice crm-enrollment-confirmation"><input type="checkbox" required aria-required="true" disabled={disabled||!price||!!stale||!course.active} checked={q.confirmed===true} onChange={e=>onChange({...q,confirmed:e.target.checked})}/><span>{t('Confirm formal enrollment. Final amount due','Konfirmasi pendaftaran kursus. Tagihan akhir','确认正式课程报名，最终应收')}{price&&<>：<strong>{money(price.finalAmount)}</strong></>} *</span></label></>}
 </section>;
}
