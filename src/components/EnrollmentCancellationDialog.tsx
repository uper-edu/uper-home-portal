import {useEffect,useId,useRef,useState} from 'react';
import {enrollmentCopy} from '../utils/enrollmentCatalog';
import {
  enrollmentCancellationNoteLimit,enrollmentCancellationReasons,enrollmentWithdrawalReasons,parseEnrollmentCancellation,
  type EnrollmentCancellationFeedback,type EnrollmentCancellationReason,
} from '../utils/enrollmentCancellation';
import type {InterestLanguage} from '../utils/enrollmentInterestCopy';
import {useNativeModal} from './useNativeModal';

export type EnrollmentCancellationKind = 'order' | 'appointment' | 'demand';
type Copy = readonly [string,string,string];

const copy:Record<EnrollmentCancellationKind,{title:Copy;description:Copy;keep:Copy;confirm:Copy}>={
  order:{
    title:['取消报名','Cancel enrollment','Batalkan pendaftaran'],
    description:['取消后将关闭付款入口并释放席位。已转账的学员请先提交凭证。','Canceling closes the payment link and releases your seat. If you already paid, submit your proof first.','Pembatalan menutup akses pembayaran dan melepas kursi. Jika sudah transfer, kirim bukti terlebih dahulu.'],
    keep:['保留报名','Keep enrollment','Pertahankan pendaftaran'],
    confirm:['确认取消报名','Cancel enrollment','Batalkan pendaftaran'],
  },
  appointment:{
    title:['撤回约课','Withdraw lesson request','Tarik permintaan kelas'],
    description:['撤回后，这条一对一约课将停止安排。','This one-to-one lesson request will no longer be scheduled.','Permintaan kelas privat ini tidak akan dijadwalkan lagi.'],
    keep:['保留约课','Keep request','Pertahankan permintaan'],
    confirm:['确认撤回约课','Withdraw lesson request','Tarik permintaan kelas'],
  },
  demand:{
    title:['撤回选课需求','Withdraw course preferences','Tarik preferensi kursus'],
    description:['撤回后，我们将停止为这条需求匹配班次和发送匹配通知。','We’ll stop matching classes and sending match updates for this request.','Kami akan berhenti mencocokkan kelas dan mengirim kabar kecocokan untuk permintaan ini.'],
    keep:['保留需求','Keep preferences','Pertahankan preferensi'],
    confirm:['确认撤回需求','Withdraw preferences','Tarik preferensi'],
  },
};

const reasonCopy:Record<EnrollmentCancellationReason,Copy>={
  schedule_conflict:['上课时间不合适','The class time does not work for me','Jadwal kelas tidak cocok'],
  budget:['课程费用超出预算','The course is over my budget','Biaya kursus di luar anggaran saya'],
  different_class:['想选择其他班次或课程','I prefer a different class or course','Saya memilih kelas atau kursus lain'],
  payment_difficulty:['付款遇到困难','I had trouble paying','Saya mengalami kendala pembayaran'],
  plans_changed:['学习计划有变','My study plans changed','Rencana belajar saya berubah'],
  already_arranged:['已找到合适的课程','I’ve found a suitable course','Saya sudah menemukan kursus yang sesuai'],
};

export function EnrollmentCancellationDialog({kind,language,busy,error,onClose,onConfirm}:{
  kind:EnrollmentCancellationKind;language:InterestLanguage;busy:boolean;error?:string;
  onClose:()=>void;onConfirm:(feedback:EnrollmentCancellationFeedback)=>void;
}) {
  const id=useId();
  const keep=useRef<HTMLButtonElement>(null);
  const errorMessage=useRef<HTMLParagraphElement>(null);
  const dialog=useNativeModal({initialFocus:keep,focusAfterClose:'restore',lockBodyScroll:true});
  const [reasons,setReasons]=useState<EnrollmentCancellationReason[]>([]);
  const [note,setNote]=useState('');
  const text=copy[kind];
  const allowed=kind==='order'?enrollmentCancellationReasons:enrollmentWithdrawalReasons;
  const feedback=parseEnrollmentCancellation({reasons,note},allowed);
  const t=(value:Copy)=>enrollmentCopy(language,value);
  useEffect(()=>{
    if(error)errorMessage.current?.focus();
  },[error]);
  return <dialog ref={dialog} className="enrollment-cancel-dialog" aria-labelledby={id+'-title'} aria-describedby={id+'-effect'}
    aria-busy={busy||undefined} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <form className="enrollment-cancel-form" onSubmit={event=>{
      event.preventDefault();
      if(!busy&&feedback)onConfirm(feedback);
    }}>
      <header className="enrollment-cancel-heading">
        <h2 id={id+'-title'}>{t(text.title)}</h2>
        <p id={id+'-effect'}>{t(text.description)}</p>
      </header>
      <div className="enrollment-cancel-content">
        <fieldset className="enrollment-cancel-reasons" disabled={busy} aria-describedby={id+'-hint'}>
          <legend>{t(['原因','Reason','Alasan'])}</legend>
          <p id={id+'-hint'}>{t([
            '至少选择一项，或填写补充说明。',
            'Select at least one reason or add your own details.',
            'Pilih setidaknya satu alasan atau tambahkan keterangan.',
          ])}</p>
          <div className="enrollment-cancel-options">
            {allowed.map(reason=><label key={reason}>
              <input type="checkbox" checked={reasons.includes(reason)} onChange={event=>{
                const checked=event.currentTarget.checked;
                setReasons(previous=>checked?[...previous,reason]:previous.filter(value=>value!==reason));
              }}/>
              {t(reasonCopy[reason])}
            </label>)}
          </div>
        </fieldset>
        <label className="enrollment-field enrollment-cancel-note">
          {t(['补充说明','Additional details','Keterangan tambahan'])}
          <textarea rows={2} maxLength={enrollmentCancellationNoteLimit} disabled={busy}
            value={note} onChange={event=>setNote(event.currentTarget.value)}/>
        </label>
        {error&&<p ref={errorMessage} tabIndex={-1} className="enrollment-form-error" role="alert">{error}</p>}
      </div>
      <footer className="enrollment-cancel-actions">
        <button ref={keep} type="button" className="enrollment-outline" disabled={busy} onClick={onClose}>{t(text.keep)}</button>
        <button type="submit" className="enrollment-primary" disabled={busy||!feedback}>
          {t(busy?['正在提交…','Submitting…','Mengirim…']:text.confirm)}
        </button>
      </footer>
    </form>
  </dialog>;
}
