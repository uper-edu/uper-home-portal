import {CrmFormSection} from './CrmFormLayout';
import {AdminFormActions} from '../AdminFormLayout';
import {AdminField,AdminRequiredNote} from '../AdminForm';
import {identityComparisonFields,identityComparisonFieldPresent} from '../../utils/crmIdentityComparison';
import {useEffect,useRef,useState} from 'react';
import {CrmOperationLayer} from './CrmOperationLayer';
import {CrmSingleSelect} from './CrmSingleSelect';
import {crmValue,crmError,type CrmLanguage} from '../../utils/crmLanguage';
import {trustError} from '../../utils/crmTrustLanguage';
import {workspaceAssessment} from '../../utils/crmWorkspace';
import {contactStatistics} from '../../utils/crmContact';
import {canClaimForContact} from '../../utils/crmOutreach';
import {formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import {confirmCrmOperation} from '../../utils/crmOperationResult';
export function CrmIdentityComparison({leadId,candidateId,employee,employees,lang,isLight,timezone,onClose,onDirty,onBusy,onChanged,onCandidate}:any){
  const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const [data,setData]=useState<any>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[choice,setChoice]=useState(''),[reason,setReason]=useState(''),[saved,setSaved]=useState(false),[retry,setRetry]=useState(0);
  const pending=useRef<any>(null),flight=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onDirty(false);onBusy(false);};},[]);
  useEffect(()=>{onDirty(Boolean(reason.trim()||choice||unknown));},[reason,choice,unknown]);
  const endpoint=`/api/crm/leads/${encodeURIComponent(leadId)}/identity-comparison${candidateId?'?candidateId='+encodeURIComponent(candidateId):''}`;
  const read=async(signal?:AbortSignal)=>{const r=await fetch(endpoint,{signal:signal||AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok)throw Error(d.error||String(r.status));return d;};
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');void read(controller.signal).then(d=>{setData(d);if(!candidateId)onCandidate(d.candidateId);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[leadId,candidateId,retry]);
  const finish=async(result:any)=>{
    confirmCrmOperation(result,leadId,'identity-actions');pending.current=null;setUnknown(false);setSaved(!result.remainingCandidates);setChoice('');setReason('');setError('');onDirty(false);
    try{setData(await read());await onChanged(result);if(result.remainingCandidates&&result.nextCandidateId)onCandidate(result.nextCandidateId);}catch(e){setError((e as Error).message);}
  };
  const save=async(query=false)=>{
    if(flight.current)return;flight.current=true;setBusy(true);onBusy(true);setError('');
    try{
      if(!pending.current){if(!choice||!reason.trim())throw Error('Identity decision and reason required');pending.current={requestId:crypto.randomUUID(),candidateId:data.candidateId,decision:choice,reason:reason.trim(),expectedComparisonRevision:data.revision};}
      const p=pending.current;
      const url=`/api/crm/leads/${encodeURIComponent(leadId)}/${query?'operations/'+encodeURIComponent(p.requestId):'identity-actions'}`;
      const r=await fetch(url,{method:query?'GET':'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},...(query?{}:{body:JSON.stringify(p)})});const result=await r.json();
      if(!r.ok){if(!query)pending.current=null;throw Error(result.error||String(r.status));}
      await finish(result);
    }catch(e){setError((e as Error).message);setUnknown(Boolean(pending.current));}finally{flight.current=false;if(mounted.current){setBusy(false);onBusy(false);}}
  };
  const missing=t('Not recorded','Belum dicatat','未记录');
  const messageRole=(role:string)=>({user:t('Customer','Pelanggan','客户'),assistant:t('AI adviser','Konsultan AI','AI顾问'),system:t('System','Sistem','系统')}[role]||role);
  const value=(v:any)=>v===undefined||v===null||v===''?missing:Array.isArray(v)?v.map(x=>String(x)).join(' · '):String(v);
  const language=(v:any)=>({en:t('English','Inggris','英文'),id:t('Indonesian','Indonesia','印尼文'),zh:t('Chinese','Mandarin','中文'),unknown:t('Unconfirmed','Belum dikonfirmasi','未确认')}[v]||missing);
  const time=(v:any)=>v?formatCrmOperatingTime(v,timezone):missing;
  const owner=(p:any)=>employees.find((e:any)=>e.id===p.owner)?.displayName||p.owner||t('Unassigned','Belum ditugaskan','未分配');
  const taskText=(s:any)=>s.tasks.filter((v:any)=>['open','overdue','migration_hold'].includes(v.status)).map((v:any)=>`${v.details?.action||crmValue(v.kind,lang)} · ${time(v.due_at)} · ${crmValue(v.status,lang)}`).join('\n')||t('No open tasks','Tidak ada tugas terbuka','无未完成任务');
  const contact=(p:any)=>{const log=contactStatistics(p).lastAttempt;return log?`${crmValue(log.connectStatus,lang)} · ${crmValue(log.channel,lang)} · ${log.staffName||log.actor||missing} · ${time(log.timestamp||log.at)}\n${log.summary||missing}`:t('No human contact record','Belum ada catatan kontak staf','暂无人工联系记录');};
  const assessment=(p:any)=>{const a=workspaceAssessment(p,lang as CrmLanguage);return `${a.source} · ${a.conclusion}\n${time(p.latestAssessment?.completedAt)}`;};
  const decisionLabel=(v:string)=>({same:t('Same customer · consolidate into existing Lead','Pelanggan yang sama · gabungkan ke Lead lama','同一客户 · 归入已有Lead'),different:t('Different people · release independently','Orang berbeda · loloskan secara terpisah','不同客户 · 独立放行'),shared:t('Shared contact, different people','Kontak bersama, orang berbeda','共用联系方式，属于不同人'),pending:t('Identity review required','Identitas perlu diverifikasi','身份待核实')}[v]||t('No valid pending match','Tidak ada kecocokan tertunda yang valid','无有效待核实匹配'));
  const recordLabel=(side:any)=>side.recordRole==='review_subject'?(data.pending?t('Record under review','Catatan yang perlu diverifikasi','本次待核实记录'):t('Reviewed record','Catatan yang ditinjau','本次核实记录')):side.recordRole==='existing_match'?t('Matching existing record','Catatan lama yang cocok','匹配到的已有记录'):t('Record under review · direction uncertain','Catatan ditinjau · arah tidak pasti','核实记录 · 方向不唯一');
  const rows=data?[
    [t('Name','Nama','姓名'),data.left.profile.fullName||data.left.profile.name,data.right.profile.fullName||data.right.profile.name],
    [t('Phone · original format','Telepon · format asli','电话 · 原始格式'),data.left.profile.whatsapp,data.right.profile.whatsapp,'phone'],
    [t('Email','Email','邮箱'),data.left.profile.email,data.right.profile.email,'email'],
    [t('Owner','Penanggung jawab','负责人'),owner(data.left.profile),owner(data.right.profile)],
    [t('Registered','Terdaftar','登记时间'),time(data.left.profile.submittedAt),time(data.right.profile.submittedAt)],
    [t('Source / campaign','Sumber / kampanye','来源／活动'),[data.left.profile.entryPoint,data.left.profile.campaign].filter(Boolean).join(' · '),[data.right.profile.entryPoint,data.right.profile.campaign].filter(Boolean).join(' · ')],
    [t('Customer background','Latar belakang pelanggan','客户背景'),crmValue(data.left.profile.currentStatus||'',lang),crmValue(data.right.profile.currentStatus||'',lang)],
    [t('Communication language','Bahasa komunikasi','沟通语言'),language(data.left.profile.communicationLanguage),language(data.right.profile.communicationLanguage)],
    [t('Learning goals','Tujuan belajar','学习目标'),[data.left.profile.goals||data.left.profile.goal].flat().filter(Boolean).map(v=>crmValue(v,lang)).join(' · '),[data.right.profile.goals||data.right.profile.goal].flat().filter(Boolean).map(v=>crmValue(v,lang)).join(' · ')],
    [t('City / format','Kota / format','城市／授课方式'),[data.left.profile.city,data.left.profile.mode].map(v=>crmValue(v||missing,lang)).join(' · '),[data.right.profile.city,data.right.profile.mode].map(v=>crmValue(v||missing,lang)).join(' · ')],
    [t('Sales stage / group','Tahap / kelompok','销售阶段／分组'),[data.left.profile.currentStage,data.left.profile.tier].map(v=>crmValue(v||missing,lang)).join(' · '),[data.right.profile.currentStage,data.right.profile.tier].map(v=>crmValue(v||missing,lang)).join(' · ')],
    [t('Assessment evidence','Bukti asesmen','测评依据'),assessment(data.left.profile),assessment(data.right.profile)],
    [t('Open tasks · original deadline','Tugas terbuka · tenggat awal','未完成任务 · 原期限'),taskText(data.left),taskText(data.right)],
    [t('Latest human contact','Kontak staf terakhir','最近人工联系'),contact(data.left.profile),contact(data.right.profile)],
  ].map((row,index)=>[row[0],row[1],row[2],row[3],identityComparisonFields[index]]):[];
  const rowState=(row:any[])=>{const [,a,b,basis,field]=row;if(!identityComparisonFieldPresent(data.left,field)||!identityComparisonFieldPresent(data.right,field)||!a||!b||a===missing||b===missing)return 'missing';return (basis?data.basis.includes(basis):a===b)?'same':'different';};
  const table=(items:any[],heading:string,primary=false)=><section data-admin-form="" className="crm-identity-section"><h3>{heading}</h3><table className="crm-identity-table"><thead><tr><th>{t('Field','Bidang','项目')}</th>{[data.left,data.right].map((side:any)=><th key={side.profile.id}><span className="crm-identity-record-role">{recordLabel(side)}</span>{primary&&<>{side.profile.fullName}<small className="crm-identity-field-status">{side.profile.businessNumber||side.profile.id}</small></>}</th>)}</tr></thead><tbody>{items.map((row:any[])=>{const [label,a,b,basis]=row,state=rowState(row);return <tr key={label} data-comparison={state}><th scope="row">{label}<small className="crm-identity-field-status">{state==='missing'?t('Incomplete','Belum lengkap','信息不全'):state==='different'?t('Different','Berbeda','不同'):basis?t('Matching contact','Kontak cocok','联系方式匹配'):t('Same value','Nilai sama','显示相同')}</small></th>{[a,b].map((v,i)=><td key={i}>{value(v)}</td>)}</tr>;})}</tbody></table></section>;
  const secondary=rows.slice(3),differences=secondary.filter(r=>rowState(r)==='different'),common=secondary.filter(r=>rowState(r)==='same'),incomplete=secondary.filter(r=>rowState(r)==='missing');
  return <CrmOperationLayer wide title={t('Review customer identity','Verifikasi identitas pelanggan','核实客户身份')} lang={lang} isLight={isLight} busy={busy} onClose={onClose}>
    <div data-admin-form="" className="crm-identity-page-body">
      <div className="crm-identity-intro"><p>{t('Compare the records, then record your decision. Matching details are clues, not identity proof.','Bandingkan catatan, lalu catat keputusan. Detail sama adalah petunjuk, bukan bukti identitas.','比较双方资料后记录判断。共同信息仅是线索，不代表身份已确认。')}</p>
      </div>
      {loading&&<p role="status">{t('Loading…','Memuat…','加载中…')}</p>}
      {error&&<div role="alert" className="crm-identity-status">{error.startsWith('Identity ')?trustError(error,lang):crmError(error,lang)} {!unknown&&<button type="button" disabled={busy} onClick={()=>{setChoice('');setSaved(false);setRetry(n=>n+1);}}>{t('Refresh comparison','Muat ulang perbandingan','刷新对比')}</button>}</div>}
      {data&&<>
        <p className="crm-identity-status">{decisionLabel(data.decision)} · {t('Matching fields','Bidang cocok','匹配线索')}：{data.basis.map((v:string)=>v==='email'?t('Email','Email','邮箱'):t('Phone after normalization','Telepon setelah normalisasi','规范化电话')).join(' · ')||missing}{!data.pending&&data.decidedBy&&` · ${data.decidedBy} · ${time(data.decidedAt)}`}</p>
        {data.candidates?.length>1&&<CrmSingleSelect label={t('Compare with existing customer','Bandingkan dengan pelanggan lama','比较已有客户')} lang={lang} isLight={isLight} value={data.candidateId} disabled={busy||unknown} options={data.candidates.map((c:any)=>({value:c.id,label:`${c.name} · ${c.businessNumber||c.id}${c.owner?' · '+(employees?.find((e:any)=>e.id===c.owner)?.displayName||c.owner):''}`}))} onChange={id=>{setChoice('');setSaved(false);onCandidate(id);}}/>}
        {data.knownRelations?.length>0&&<details><summary>{t('Previously confirmed different people','Orang berbeda yang telah dikonfirmasi','此前已确认属于不同人')}</summary>{data.knownRelations.map((r:any,i:number)=><p key={i}>{r.decided_by} · {r.reason}</p>)}</details>}
        {data.candidates?.length>1&&!data.crossConflict&&<p>{t('This contact matches several customers. Exclude each different person before releasing this record. Names alone do not prove identity.','Kontak ini cocok dengan beberapa pelanggan. Singkirkan setiap orang yang berbeda sebelum melepas catatan. Nama saja bukan bukti identitas.','该联系方式匹配多位客户。逐项排除不同人后才能独立放行；姓名相同不代表同一人。')}</p>}
        <div className="crm-identity-review-layout"><div className="crm-identity-comparisons">
        {table(rows.slice(1,3),t('Identity & contact clues','Identitas & petunjuk kontak','身份与联系方式线索'),true)}
        {differences.length>0&&table(differences,t('Differences to review','Perbedaan yang perlu ditinjau','重点差异'))}
        {common.length>0&&<details className="crm-identity-group" open><summary>{t('Common information','Informasi yang sama','共同信息')} · {common.length}</summary>{table(common,t('Same display values · not proof','Nilai tampilan sama · bukan bukti','相同显示值 · 不作为身份结论'))}</details>}
        {incomplete.length>0&&<details className="crm-identity-group"><summary>{t('Incomplete information','Informasi belum lengkap','信息不全')} · {incomplete.length}</summary>{table(incomplete,t('Missing values are not matches','Nilai kosong bukan kecocokan','缺失信息不算匹配'))}</details>}
        </div>
        <CrmFormSection className="crm-identity-decision" name="decision" lang={lang}><AdminRequiredNote lang={lang}/><p className="crm-work-muted">{t('Same person: keep the existing Lead and retain all original evidence. Different people: release the new Lead for assignment and follow-up.','Orang yang sama: pertahankan Lead lama dan semua bukti asli. Orang berbeda: loloskan Lead baru untuk penugasan dan tindak lanjut.','同一人：保留已有Lead，汇集原始记录；不同人：新Lead独立放行后再分配和跟进。')}</p>
          {saved&&<p role="status">{t('Decision saved. See the resulting customer record below.','Keputusan disimpan. Lihat catatan pelanggan hasilnya di bawah.','身份结论已保存，请查看下方处理结果。')}</p>}
          {[data.left,data.right].some((s:any)=>s.profile.contactArrangement?.state==='stopped')&&<p className="crm-identity-existing-stop">{t('Existing proactive-contact stop remains in force. Consolidation does not restore contact.','Penghentian kontak proaktif yang ada tetap berlaku. Penggabungan tidak mengaktifkan kontak kembali.','已有停止主动联系限制继续生效，归入不会恢复联系。')}</p>}
          {Boolean(data.aliasMatches?.length)&&<p>{t('Matching details were found in earlier registrations consolidated into this customer:','Detail cocok ditemukan pada pendaftaran sebelumnya yang digabungkan ke pelanggan ini:','匹配线索来自此前已归入该客户的登记记录：')} {data.aliasMatches.map((s:any)=>s.name||s.id).join(' · ')}</p>}
          {data.crossConflict&&<p role="alert">{t('Phone and email point to different customers. This record stays pending; do not choose an arbitrary merge target.','Telepon dan email mengarah ke pelanggan berbeda. Catatan tetap menunggu; jangan memilih target secara sembarang.','电话和邮箱指向不同客户，暂保留待核实，不能任意选择归入对象。')}</p>}
          {[data.left,data.right].some((s:any)=>s.profile.identityStopRequest)&&<p role="alert">{t('A customer requested no further contact. The request must remain effective when confirming the same person.','Pelanggan meminta agar tidak dihubungi lagi. Permintaan harus tetap berlaku bila dikonfirmasi sebagai orang yang sama.','客户已提出停止联系要求；确认同一人时，该要求将落实到保留客户。')} {[data.left,data.right].map((s:any)=>s.profile.identityStopRequest?.text).filter(Boolean).join(' · ')}</p>}
          {[data.left,data.right].some((s:any)=>s.profile.identityMergedInto)&&<p role="status">{t('Consolidated into the existing customer. Original evidence is retained.','Telah digabungkan ke pelanggan lama. Bukti asli tetap disimpan.','已归入已有客户，原始记录完整保留。')} <a className="crm-work-link" href={'/crm?tab=leads&lead='+encodeURIComponent(data.left.profile.identityMergedInto||data.right.profile.identityMergedInto)+'&leadView=activities'}>{t('Open retained customer','Buka pelanggan yang dipertahankan','查看保留客户')}</a></p>}
          {data.canConfirm?<><div className="crm-identity-decision-fields"><CrmSingleSelect label={t('Decision','Keputusan','判断')} value={choice} onChange={setChoice} disabled={busy||unknown} lang={lang} isLight={isLight} options={[{value:'',label:t('Choose a decision','Pilih keputusan','请选择判断')},...['same','different','shared'].map(value=>({value,label:value==='different'&&data.candidates?.length>1?t('Different person · review remaining matches','Orang berbeda · tinjau kecocokan lainnya','不同人 · 继续核对其余候选'):decisionLabel(value)}))]}/><AdminField>{t('Reason / evidence (required)','Alasan / bukti (wajib)','原因／依据（必填）')}<textarea value={reason} disabled={busy||unknown} onChange={e=>setReason(e.target.value)}/></AdminField></div><p>{t('Insufficient evidence? Close without saving; the case remains pending.','Bukti belum cukup? Tutup tanpa menyimpan; kasus tetap tertunda.','证据不足时可关闭并保留待核实状态，不要用“不同人”代替暂缓。')}</p></>:<p>{data.reason||t('No decision can be submitted for this case.','Keputusan tidak dapat dikirim untuk kasus ini.','此组当前不可提交新结论。')}</p>}
          <AdminFormActions className="crm-identity-actions">{unknown?<><button type="button" className="crm-work-button" disabled={busy} onClick={()=>void save(true)}>{t('Check save result','Periksa hasil simpan','查询保存结果')}</button><button type="button" className="crm-work-button" disabled={busy} onClick={()=>void save(false)}>{t('Retry original save','Ulangi simpan awal','重试原保存')}</button></>:data.canConfirm?<button type="button" className="crm-work-button" data-primary="true" disabled={busy||!choice||!reason.trim()} onClick={()=>void save()}>{busy?t('Saving…','Menyimpan…','保存中…'):t('Confirm and save','Konfirmasi dan simpan','确认保存')}</button>:null}
          {!data.pending&&!data.left.profile.identityMergedInto&&canClaimForContact(employee,data.left.profile)&&<button type="button" className="crm-work-button" disabled={busy} onClick={async()=>{setBusy(true);onBusy(true);try{const r=await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}/claim`,{method:'POST',headers:{'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(d.error);setData(await read());await onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);onBusy(false);}}}>{t('Claim this record for myself','Klaim catatan ini untuk saya','认领当前记录给自己')}</button>}
          <button type="button" className="crm-work-button" disabled={busy} onClick={onClose}>{t('Return to workspace','Kembali ke ruang kerja','返回工作区')}</button></AdminFormActions>
        </CrmFormSection>
        </div>
        <div className="crm-identity-evidence">{[data.left,data.right].map((side:any)=><details key={side.profile.id}><summary>{recordLabel(side)} · {side.profile.fullName} · {t('Original notes and conversation','Catatan dan percakapan asli','原始备注与对话')}</summary>
          <article>{value(side.profile.manualNotes||side.profile.notes||side.profile.nextAction)}<small>{t('Customer-level note; not identity proof','Catatan pelanggan; bukan bukti identitas','客户级备注，不作为身份结论')}</small></article>
          {(side.profile.followUpLogs||[]).slice(-10).reverse().map((v:any)=><article key={v.id}>{v.summary}<small>{v.staffName||v.actor} · {time(v.timestamp||v.at)}</small></article>)}
          {side.facts.filter((v:any)=>v.kind==='information.recorded'||v.kind.startsWith('identity.')).slice(0,10).map((v:any)=><article key={v.id}>{v.data.summary||v.data.reason}<small>{v.actor} · {time(v.created_at)}</small></article>)}
          {side.messages.map((v:any)=><article key={v.id}>{v.content}<small>{messageRole(v.role)} · {v.source==='website'?t('Website','Situs web','\u5b98\u7f51'):crmValue(v.source,lang)} · {time(v.created_at)}</small></article>)}
          <small>{t('Up to 50 recent original messages; contact records and notes remain separate.','Maksimal 50 pesan asli terbaru; catatan kontak dan informasi tetap terpisah.','最多展示最近50条原始消息；联系记录与备注独立保留。')}</small>
        </details>)}</div>

      </>}
    </div>
  </CrmOperationLayer>;
}
