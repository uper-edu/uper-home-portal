import {viewerTimeZone} from '../../utils/crmOperatingTime';
import {useEffect,useState} from 'react';
import type {CrmLeadRecord} from '../../types/crmLead';
import {crmAssessmentSummary} from '../../utils/crmAssessment';
import {assessmentDifferences,assessmentHistory,crossTypeConclusionDifference,type AssessmentHistoryEntry} from '../../utils/crmAssessmentHistory';
import {crmValue,type CrmLanguage} from '../../utils/crmLanguage';
import {formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import {CrmDisclosure} from './CrmDisclosure';
import {CrmAssessmentEvidence} from './CrmAssessmentEvidence';
type Data={leadId:string;attempts:AssessmentHistoryEntry[];current:Partial<CrmLeadRecord>};
export function CrmCustomerAssessment({lead,lang,timezone}:{lead:CrmLeadRecord;lang:CrmLanguage;timezone:string}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 timezone=viewerTimeZone();
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 useEffect(()=>{const controller=new AbortController();setData(null);setError(false);
 fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/assessments`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(d.leadId!==lead.id||!Array.isArray(d.attempts))throw Error();if(!controller.signal.aborted)setData(d);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[lead.id,lead.latestAssessment?.attempt?.attemptId,retry]);
 const current=data?.leadId===lead.id?{...lead,...data.current}:lead;
 const rows=data?.leadId===lead.id?assessmentHistory(data.attempts,current.latestAssessment):[];
 const differences=assessmentDifferences(rows);const flagged=new Set(differences.flatMap(d=>[d.newerId,d.olderId]));
 const crossType=crossTypeConclusionDifference(rows);
 const time=(v?:string)=>v&&Number.isFinite(Date.parse(v))?formatCrmOperatingTime(v,viewerTimeZone()):t('Not recorded','Belum dicatat','未记录');
 return <div className="crm-assessment-history-view">
 <CrmAssessmentEvidence lead={current} lang={lang} timezone={timezone} summaryOnly />
 <p className="crm-assessment-meta">{t('The current conclusion follows the existing saved reference. History does not replace it with the highest score or an average.','Kesimpulan saat ini mengikuti acuan tersimpan yang sudah digunakan. Riwayat tidak menggantinya dengan skor tertinggi atau rata-rata.','当前结论沿用现有保存依据；历史记录不会自动取最高分或平均分来替换它。')}</p>
 {differences.length>0&&<aside className="crm-assessment-review" role="note"><h3>{t('Different results · manual review needed','Hasil berbeda · perlu tinjauan manual','结果差异明显 · 请人工复核')}</h3><p>{t('Highlighted records differ materially. Check test conditions, unanswered items and dates with the learner. No progress, regression or final placement is inferred.','Catatan yang ditandai berbeda secara nyata. Periksa kondisi tes, soal yang belum dijawab, dan tanggal bersama peserta. Tidak disimpulkan kemajuan, penurunan, atau penempatan akhir.','标记的记录存在明显差异，请与客户核实作答条件、未答题及测评时间；不据此判定进步、退步或最终等级。')}</p></aside>}
 {crossType&&<aside className="crm-assessment-review" role="note"><h3>{t('Different evidence types · verify conclusions','Jenis bukti berbeda · periksa kesimpulan','依据类型不同 · 请核实结论')}</h3><p>{t('The latest quick starting-point suggestion and full-paper conclusion are far apart. Their coverage differs: compare the saved evidence with the learner; do not compare raw points or select a final level automatically.','Saran titik awal cepat terbaru dan kesimpulan tes lengkap berbeda jauh. Cakupannya berbeda: periksa bukti bersama peserta; jangan membandingkan skor mentah atau memilih level akhir secara otomatis.','最近快速测评的起点建议与完整测评的本卷结论差异较大。两者覆盖范围不同，请结合原始依据向客户核实；不直接比较原始分数，也不自动确定最终等级。')}</p></aside>}
 {(current.reportedLevel||current.quizResultSummary)&&<CrmDisclosure heading={t('Self-report and original customer-level evidence','Keterangan pelanggan dan bukti asli pada profil','客户自报与客户级原始依据')}><dl className="crm-assessment-facts"><div><dt>{t('Self-reported level','Level menurut pelanggan','客户自报水平')}</dt><dd>{current.reportedLevel?crmValue(current.reportedLevel,lang):t('Not recorded','Belum dicatat','未记录')}</dd></div></dl><p className="crm-assessment-meta">{t('Self-report is not a test result. Original customer-level text may not belong to the latest attempt.','Keterangan pelanggan bukan hasil tes. Teks asli pada profil belum tentu berasal dari upaya terbaru.','客户自报不是测评结果；客户级原文未必对应最近一次测评。')}</p>{current.quizResultSummary&&<p className="crm-assessment-raw">{current.quizResultSummary}</p>}</CrmDisclosure>}
 <section className="crm-assessment-history" aria-label={t('Assessment history','Riwayat asesmen','历次测评记录')}>
 <div className="crm-assessment-heading"><h3>{t('Assessment history','Riwayat asesmen','历次测评记录')}</h3>{data&&<span>{rows.length} {t('records','catatan','条记录')}</span>}</div>
 <p className="crm-assessment-meta">{t('Quick assessments suggest a starting point; full assessments report their own paper thresholds. Their raw scores are not directly comparable.','Asesmen cepat menyarankan titik awal; asesmen lengkap melaporkan ambang tesnya sendiri. Skor mentah keduanya tidak dapat dibandingkan langsung.','快速测评建议学习起点，完整测评展示本卷门槛结果；两者原始分数不能直接比较。')}</p>
 {error?<p role="alert">{t('Assessment history unavailable. Existing summary is shown above.','Riwayat asesmen tidak tersedia. Ringkasan yang ada ditampilkan di atas.','历次记录暂不可用，上方保留现有摘要。')} <button type="button" className="crm-work-link" onClick={()=>setRetry(v=>v+1)}>{t('Retry','Coba lagi','重试')}</button></p>:!data?<p role="status">{t('Loading assessment history…','Memuat riwayat asesmen…','正在加载历次测评记录…')}</p>:!rows.length?<p>{t('No saved test attempts. Self-reported information is not a test result.','Belum ada upaya tes tersimpan. Informasi dari pelanggan bukan hasil tes.','尚无已保存的测评记录；客户自报信息不是测评结果。')}</p>:rows.map(row=>{
 const result=row.result;const entry={...current,latestAssessment:result,levelSource:'assessment',levelConfirmed:undefined,reportedLevel:undefined,quizResultSummary:undefined} as CrmLeadRecord;
 const summary=crmAssessmentSummary(entry,lang);const mode=result?.attempt?.mode;
 const source=mode==='express'?t('Quick assessment','Asesmen cepat','快速测评'):mode==='full'?t('Full assessment','Asesmen lengkap','完整测评'):t('Historical assessment','Asesmen historis','历史测评');
 return <CrmDisclosure key={`${lead.id}:${row.id}`} className="crm-assessment-history-entry" heading={<span><strong>{source}</strong><span className="crm-assessment-history-date">{t('Completed','Selesai','完成时间')} · {time(result?.attempt?.completedAt)}</span><span className="crm-assessment-history-conclusion">{summary.conclusion}</span><span className="crm-assessment-meta">{summary.detail}</span>{flagged.has(row.id)&&<span className="crm-assessment-review-tag">{t('Compare · review needed','Bandingkan · perlu ditinjau','对比记录 · 待复核')}</span>}</span>}>
 <p className="crm-assessment-meta">{t('Recorded','Dicatat','记录时间')} · {time(row.recordedAt)} · {timezone}</p>
 <CrmAssessmentEvidence lead={entry} lang={lang} timezone={timezone}/>
 </CrmDisclosure>;
 })}
 <CrmDisclosure heading={t('How differences are flagged','Cara perbedaan ditandai','差异提示如何判断')}><p>{t('Review cues compare consecutive records of the same assessment type. Complete attempts on the same paper and scoring version are flagged at a score difference of at least 30 percentage points, or saved conclusions differ by at least two levels/stages. Incomplete or already uncertain results retain their own review notices. This is a display rule, not a scoring or placement rule.','Petunjuk membandingkan catatan berurutan dari jenis asesmen yang sama. Upaya lengkap dengan versi tes dan penilaian yang sama ditandai jika selisih skor minimal 30 poin persentase, atau kesimpulan tersimpan berbeda minimal dua level/tahap. Hasil tidak lengkap atau belum pasti tetap memakai peringatan buktinya sendiri. Ini aturan tampilan, bukan aturan penilaian atau penempatan.','提示比较同类测评前后相邻记录：完整作答且试卷、评分版本相同时，分数占满分比例相差至少30个百分点，或保存结论相差至少两级／阶段，会提示复核。未完整作答或本身不确定的结果沿用其依据核实提示。这是展示提示规则，不是评分或定级规则。')}</p></CrmDisclosure>
 </section></div>;
}
