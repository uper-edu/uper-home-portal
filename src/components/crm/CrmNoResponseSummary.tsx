import {formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import type {NoResponseSequence} from '../../utils/crmNoResponse';
export function CrmNoResponseSummary({lead,lang,timezone}:any){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const s=lead.noResponseSequence as NoResponseSequence|undefined;
 if(!s || !(s.count>0||s.needsGroupReview||s.lastOutcome==='wrong_number'||['waiting','protected'].includes(s.status)))return null;
 return <details className="crm-recent-no-response" aria-label={t('Unanswered contact sequence','Urutan kontak tanpa balasan','连续未回复联系')}>
 <summary>{s.needsGroupReview?t('Group needs review','Kelompok perlu ditinjau','分组待复核'):s.lastOutcome==='wrong_number'?t('Verify contact details','Verifikasi kontak','联系方式待核实'):t('Consecutive unanswered attempts','Upaya berturut-turut tanpa balasan','连续有效未回复')} {s.count>0&&`${s.count}${s.policy?.threshold ? ' / '+s.policy.threshold : ''}`}</summary><div>
 {s.policy?.threshold===0 && <p>{t('Automatic nurture is disabled for this sequence.','Pembinaan otomatis dinonaktifkan untuk urutan ini.','本轮已关闭自动转培育。')}</p>}
 {s.status==='waiting'&&<p>{t('Waiting for a reply until','Menunggu balasan hingga','等待回复至')} {formatCrmOperatingTime(s.waitUntil!,timezone)} · {timezone}</p>}
 {s.status==='counting'&&s.nextEligibleAt&&<p>{t('Next eligible attempt no earlier than','Upaya berikutnya yang dihitung paling cepat','下次有效尝试不早于')} {formatCrmOperatingTime(s.nextEligibleAt,timezone)} · {timezone}</p>}
 {s.lastOutcome==='too_soon'&&<p>{t('Attempt recorded but not counted: retry interval not met.','Upaya tercatat tetapi tidak dihitung: jeda belum terpenuhi.','本次尝试已记录，间隔不足，未累计；下次间隔从本次真实尝试重新计算。')}</p>}
 {s.lastOutcome==='wrong_number'&&<p>{t('Verify contact details. An invalid number is not an unanswered attempt.','Verifikasi kontak. Nomor tidak valid bukan upaya tanpa balasan.','请核实联系方式，号码无效不累计未回复次数。')}</p>}
 {s.status==='nurtured'&&<p>{t('Moved to nurture after consecutive unanswered attempts and the reply window. This does not prove low purchase intent.','Masuk pembinaan setelah upaya tanpa balasan dan masa tunggu. Ini bukan bukti minat beli rendah.','连续未回复且等待窗口结束，已转入培育；不代表购买意愿低。')}</p>}
 {s.status==='protected'&&<p>{t('Threshold reached; sales-confirmed group preserved. Review manually.','Ambang tercapai; kelompok terkonfirmasi dipertahankan. Tinjau manual.','已达到阈值，人工确认分组保持不变，请人工复核。')}</p>}
 {s.status==='replied'&&<p>{t('Customer replied or connected; counter cleared. Check the latest message and respond.','Pelanggan membalas atau terhubung; penghitung direset. Periksa pesan terbaru dan tanggapi.','客户已回复或接通，连续计数已清零；请核对最新诉求并响应。')}</p>}
 {s.needsGroupReview&&<p>{t('Group needs review; history is insufficient or another decision superseded R6.','Kelompok perlu ditinjau; riwayat kurang atau keputusan lain menggantikan R6.','分组待复核：历史依据不足或已有其他分组决定，不自动猜测恢复。')}</p>}
 </div></details>;
}
