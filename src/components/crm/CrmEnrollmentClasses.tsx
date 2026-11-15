import { enrollmentClassManagementPath } from '../../utils/crmEnrollmentManagement';
import { useEffect, useState } from 'react';
import { AdminField, AdminForm, AdminRequiredNote } from '../AdminForm';
import { AdminFormActions } from '../AdminFormLayout';
import { CrmOperationLayer } from './CrmOperationLayer';
import { CrmDiscardDialog, CrmSaveFeedback } from './CrmDetailWorkspace';
import { CrmSingleSelect } from './CrmSingleSelect';
import { enrollmentFormats, enrollmentLevels, enrollmentPeriods,enrollmentScheduleDefaults } from '../../utils/enrollmentCatalog';
import type { EnrollmentClassAdmin, EnrollmentClassConfig } from '../../utils/enrollmentCatalog';
import type { CrmLanguage } from '../../utils/crmLanguage';
import { formatCurrency } from '../../utils/currency';
import { enrollmentPost } from '../EnrollmentApplication';

type Copy = readonly [string, string, string];
type Catalog = { classes: EnrollmentClassAdmin[]; courses: { name: string; id: string; active: boolean }[] };
type Draft = { id: string; revision: number; state: 'draft' | 'published'; config: EnrollmentClassConfig };
const initial: EnrollmentClassConfig = {
  courseId: '', level: 'HSK 1', format: 'standard', period: 'weekend',
  firstLesson: '', enrollmentCloses: '', decisionAt: '', schedule: '',
  sessions: 23, minutes: 45, minimumPaid: 13, capacity: 20, price: 0, standardPrice: null,
  learningOutcomes: '', material: '', resources: '', teacher: '',
};
const fields: { name: keyof EnrollmentClassConfig; type: 'text' | 'number' | 'datetime-local' | 'textarea'; label: Copy }[] = [
  { name: 'firstLesson', type: 'datetime-local', label: ['First class (WIB)', 'Kelas pertama (WIB)', '首课（WIB）'] },
  { name: 'decisionAt', type: 'datetime-local', label: ['Expected decision (WIB)', 'Perkiraan keputusan (WIB)', '预计通知开班结果（WIB）'] },
  { name: 'enrollmentCloses', type: 'datetime-local', label: ['Self-service deadline (WIB)', 'Batas daftar mandiri (WIB)', '自助报名截止（WIB）'] },
  { name: 'schedule', type: 'text', label: ['Weekly schedule (WIB)', 'Jadwal mingguan (WIB)', '每周课表（WIB）'] },
  { name: 'sessions', type: 'number', label: ['Sessions', 'Pertemuan', '课次'] },
  { name: 'minutes', type: 'number', label: ['Minutes per session', 'Menit per pertemuan', '每课次分钟数'] },
  { name: 'minimumPaid', type: 'number', label: ['Minimum fully paid', 'Minimum peserta lunas', '开班最低足额到账人数'] },
  { name: 'capacity', type: 'number', label: ['Capacity', 'Kapasitas', '招生上限'] },
  { name: 'price', type: 'number', label: ['Payable tuition (Rp)', 'Biaya yang harus dibayar (Rp)', '应付学费（Rp）'] },
  { name: 'standardPrice', type: 'number', label: ['Standard comparison price (Rp)', 'Harga standar pembanding (Rp)', '对比标准价（Rp）'] },
  { name: 'learningOutcomes', type: 'textarea', label: ['Learning outcomes', 'Hasil belajar', '学习成果'] },
  { name: 'material', type: 'textarea', label: ['Course and materials', 'Kursus dan materi', '课程内容与教材'] },
  { name: 'resources', type: 'textarea', label: ['Practice and resources', 'Latihan dan sumber daya', '练习与资源'] },
  { name: 'teacher', type: 'text', label: ['Teacher', 'Pengajar', '授课教师'] },
];

export function CrmEnrollmentClasses({ lang, isLight }: { lang: CrmLanguage; isLight: boolean }) {
  const t = ([en, id, zh]: Copy) => lang === 'zh' ? zh : lang === 'id' ? id : en;
  const [catalog, setCatalog] = useState<Catalog>();
  const [draft, setDraft] = useState<Draft>();
  const [insertion, setInsertion] = useState<{row:EnrollmentClassAdmin;requestId:string}>();
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [closing, setClosing] = useState<{id:string;requestId:string}>();
  const [pending, setPending] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const endpoint = '/api/crm/enrollment/classes';

  async function load() {
    const result = await fetch(endpoint, { cache: 'no-store' });
    if (!result.ok) throw Error();
    setCatalog(await result.json());
  }
  function loadFailure() { setError(t(['Class list unavailable.', 'Daftar kelas belum dapat dimuat.', '班次列表暂时无法加载。'])); }
  useEffect(() => { void load().catch(loadFailure); }, []);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);
  function edit(row?: EnrollmentClassAdmin) {
    if (row?.state==='cancelled') return;
    setSaved(false);
    setError('');
    setDirty(false);
    if (row) {
      const { id, revision, state, opened, canInsert, ...config } = row;
      setDraft({ id, revision, state, config });
    } else {
      setDraft({ id: crypto.randomUUID(), revision: 0, state: 'draft', config: { ...initial } });
    }
  }
  function change(name: keyof EnrollmentClassConfig, value: string | number | null) {
    setDraft(current=>{
      if(!current)return current;
      const config={...current.config,[name]:value};
      if(name==='firstLesson'&&current.revision===0&&typeof value==='string'){
        const defaults=enrollmentScheduleDefaults(value);
        const previous=enrollmentScheduleDefaults(current.config.firstLesson);
        if(defaults){
          if(!config.decisionAt||config.decisionAt===previous?.decisionAt)config.decisionAt=defaults.decisionAt;
          if(!config.enrollmentCloses||config.enrollmentCloses===previous?.enrollmentCloses)config.enrollmentCloses=defaults.enrollmentCloses;
        }
      }
      return {...current,config};
    });
    setDirty(true);
  }
  function close() {
    if (busy || pending) return;
    if (dirty) setDiscard(true);
    else setDraft(undefined);
  }
  async function complete() {
    setPending(undefined);
    setDirty(false);
    setDraft(undefined);
    setSaved(true);
    await load().catch(loadFailure);
  }
  async function save() {
    if (!draft || busy || pending || !draft.config.courseId) return;
    const requestId = crypto.randomUUID();
    setError('');
    setBusy(true);
    try {
      const result = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, requestId }),
      });
      if (result.status >= 500) throw Error();
      if (!result.ok) {
        setError(result.status === 409
          ? t(['Refresh to review the latest class and course.', 'Segarkan untuk memeriksa data kelas dan kursus terbaru.', '请刷新核对最新的班次及课程状态。'])
          : t(['Check the class dates, capacity and tuition.', 'Periksa jadwal, kapasitas, dan biaya kelas.', '请核对班次日期、人数和学费。']));
        return;
      }
      const receipt = await result.json();
      if (receipt.classId !== draft.id) throw Error();
      await complete();
    } catch {
      setPending(requestId);
    } finally { setBusy(false); }
  }
  async function check() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const result = await fetch(endpoint + '/results/' + encodeURIComponent(pending), { cache: 'no-store' });
      if (result.ok && (await result.json()).classId === draft?.id) await complete();
    } finally { setBusy(false); }
  }
  async function completeInsertion() {
    setPending(undefined);
    setDirty(false);
    setInsertion(undefined);
    setSaved(true);
    await load().catch(loadFailure);
  }
  async function saveInsertion(form:FormData) {
    if(!insertion||busy||pending) return;
    setBusy(true);setError('');
    try{
      const response=await fetch(endpoint+'/'+encodeURIComponent(insertion.row.id)+'/insertions',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestId:insertion.requestId,name:form.get('name'),email:form.get('email'),
          phone:form.get('phone'),price:Number(form.get('price')),confirmed:form.get('confirmed')==='on'}),
      });
      if(response.status>=500) throw Error();
      const result=await response.json();
      if(!response.ok){
        setError(result.error==='enrollment_class_full'
          ? t(['This class is full.','Kelas ini penuh.','本班已满。'])
          : result.error==='enrollment_already_has_seat'
            ? t(['This learner already has a seat.','Siswa ini sudah mendapat kursi.','该学员已在本班占有席位。'])
            : t(['Check learner details, tuition and class availability.','Periksa data siswa, biaya, dan ketersediaan kelas.','请核对学员信息、学费和班次状态。']));
        return;
      }
      if(result.classId!==insertion.row.id||!result.id) throw Error();
      await completeInsertion();
    }catch{setPending(insertion.requestId);}
    finally{setBusy(false);}
  }
  async function checkInsertion() {
    if(!insertion||!pending||busy) return;
    setBusy(true);
    try{
      const response=await fetch(endpoint+'/results/'+encodeURIComponent(pending),{cache:'no-store'});
      if(response.ok){
        const result=await response.json();
        if(result.operationKind==='enrollment.order.insert'&&result.classId===insertion.row.id&&result.id) await completeInsertion();
      }
    }finally{setBusy(false);}
  }
  const published = t(['Published', 'Diterbitkan', '已发布']);
  const unpublished = t(['Draft', 'Draf', '草稿']);
  const title = t(['Enrollment classes', 'Kelas pendaftaran', '报名班次']);
  const target = new URLSearchParams(window.location.search).get('enrollmentClass');
  const visibleClasses = catalog?.classes.filter(row=>!target||row.id===target);
  return <section className="crm-course-catalog">
    <header className="admin-edit-header">
      <h2>{title}</h2>
      {target&&<a className="crm-work-link" href="/crm?tab=policy&policyTopic=enrollment-classes">{t(['View all classes','Lihat semua kelas','查看全部班次'])}</a>}
      <div className="crm-ops-actions">
        <button type="button" className="crm-work-button" onClick={() => void load().catch(loadFailure)}>{t(['Refresh', 'Segarkan', '刷新'])}</button>
        <button type="button" className="crm-work-button" data-primary disabled={!catalog} onClick={() => edit()}>{t(['Create class', 'Buat kelas', '创建班次'])}</button>
      </div>
    </header>
    {!catalog && !error && <p role="status">{t(['Loading…', 'Memuat…', '正在加载…'])}</p>}
    {!!error && !draft && !insertion && <p role="alert">{error}</p>}
    {saved && <CrmSaveFeedback state="saved" lang={lang}/>}
    {visibleClasses?.length === 0 && <p>{target?t(['Class not found.','Kelas tidak ditemukan.','班次不存在。']):t(['No enrollment classes yet.', 'Belum ada kelas.', '暂无报名班次。'])}</p>}
    {!!visibleClasses?.length && <div className="crm-course-table"><table>
      <thead><tr><th>{t(['Level', 'Level', '级别'])}</th><th>{t(['Schedule', 'Jadwal', '课表'])}</th><th>{t(['Tuition', 'Biaya', '学费'])}</th><th>{t(['Status', 'Status', '状态'])}</th><th>{t(['Actions', 'Tindakan', '操作'])}</th></tr></thead>
      <tbody>{visibleClasses.map(row => <tr key={row.id}>
        <td>{row.level}</td><td>{row.firstLesson.replace('T', ' ')} WIB<br/>{row.schedule}</td>
        <td>{formatCurrency(row.price, lang)}</td><td>{row.opened?t(['Class confirmed','Kelas dikonfirmasi','已确认开班']):row.state === 'cancelled'
          ? t(['Class will not open','Kelas tidak dibuka','已确认不开班']) : row.state === 'published' ? published : unpublished}</td>
        <td>{row.state!=='draft'&&<a className="crm-work-link" href={enrollmentClassManagementPath(row.id)}>{t(['View enrollments','Lihat pendaftaran','查看报名'])}</a>}
          {row.state!=='cancelled' && <button type="button" className="crm-work-button" onClick={() => edit(row)}>{t(['Edit', 'Edit', '编辑'])}</button>}
          {row.canInsert&&<button type="button" className="crm-work-button" onClick={()=>{
            setInsertion({row,requestId:crypto.randomUUID()});setDirty(false);setError('');setSaved(false);
          }}>{t(['Add to class','Tambah siswa ke kelas','办理插班'])}</button>}
          {row.state==='published'&&!row.opened&&<button type="button" className="crm-work-button" onClick={()=>setClosing({id:row.id,requestId:crypto.randomUUID()})}>
            {t(['Class will not open','Kelas tidak dibuka','确认不开班'])}</button>}</td>
      </tr>)}</tbody>
    </table></div>}
    {draft && <CrmOperationLayer compose title={<>{title}<AdminRequiredNote inline lang={lang}/></>} lang={lang} isLight={isLight} busy={busy} customerContext={false} onClose={close}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
        <div className="crm-editor-scroll">
          {error && <p role="alert">{error}</p>}
          {pending && <CrmSaveFeedback state="unknown" lang={lang}/>}
          <AdminField required>{t(['Course', 'Kursus', '关联课程'])}<CrmSingleSelect lang={lang} isLight={isLight}
            label={t(['Course', 'Kursus', '关联课程'])} value={draft.config.courseId} disabled={busy || !!pending}
            options={(catalog?.courses || []).map(course => ({ value: course.id, label: course.name, disabled: draft.state === 'published' && !course.active }))}
            onChange={value => change('courseId', value)}/></AdminField>
          {([
            ['level', ['Level', 'Level', '级别'], enrollmentLevels.map(value => ({ value, label: value }))],
            ['format', ['Class type', 'Jenis kelas', '班型'], enrollmentFormats.map(value => ({ value, label: value === 'standard' ? t(['Standard', 'Standar', '标准班']) : t(['Small group', 'Kelompok kecil', '小班']) }))],
            ['period', ['Time slot', 'Waktu', '时段'], enrollmentPeriods.map(value => ({ value, label: value === 'weekend' ? t(['Weekend', 'Akhir pekan', '周末']) : t(['Weekday evening', 'Malam hari kerja', '工作日晚间']) }))],
          ] as const).map(([name, label, options]) => <AdminField required key={name}>{t(label)}
            <CrmSingleSelect label={t(label)} value={draft.config[name]} options={options} lang={lang} isLight={isLight} disabled={busy || !!pending}
              onChange={value => change(name, value)}/>
          </AdminField>)}
          {fields.map(({ name, type, label }) => <AdminField required={name !== 'standardPrice'} key={name}>{t(label)}
            {type === 'textarea'
              ? <textarea required value={draft.config[name] ?? ''} disabled={busy || !!pending} onChange={event => change(name, event.target.value)}/>
              : <input required={name !== 'standardPrice'} type={type} min={type === 'number' ? 1 : undefined}
                value={draft.config[name] ?? ''} disabled={busy || !!pending}
                onChange={event => change(name, type === 'number' ? event.target.value ? Number(event.target.value) : null : event.target.value)}/>}
          </AdminField>)}
          <label className="admin-field admin-field--choice"><input type="checkbox" checked={draft.state === 'published'} disabled={busy || !!pending}
            onChange={event => { setDraft({ ...draft, state: event.target.checked ? 'published' : 'draft' }); setDirty(true); }}/>
            <span>{t(['Publish class', 'Terbitkan kelas', '发布班次'])}</span></label>
        </div>
        <AdminFormActions className="crm-editor-actions">
          {pending ? <button type="button" className="crm-work-button" disabled={busy} onClick={() => void check().catch(() => {})}>{t(['Check save result', 'Periksa hasil simpan', '查询保存结果'])}</button>
            : <><button type="button" className="crm-work-button" disabled={busy} onClick={close}>{t(['Cancel', 'Batal', '取消'])}</button>
              <button type="submit" data-primary className="crm-work-button" disabled={busy || !draft.config.courseId}>{t(['Save', 'Simpan', '保存'])}</button></>}
        </AdminFormActions>
      </AdminForm>
    </CrmOperationLayer>}
    {insertion&&<CrmOperationLayer compose title={<>{t(['Add to class','Tambah siswa ke kelas','办理插班'])}<AdminRequiredNote inline lang={lang}/></>}
      lang={lang} isLight={isLight} customerContext={false} busy={busy} onClose={()=>{
        if(busy||pending)return;
        if(dirty)setDiscard(true);else setInsertion(undefined);
      }}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={event=>{
        event.preventDefault();void saveInsertion(new FormData(event.currentTarget));
      }}>
        <div className="crm-editor-scroll">
          <p>{insertion.row.level} · {insertion.row.schedule}</p>
          <p>{t(['Confirm tuition with the learner before reserving a seat. The payment deadline uses the enrollment rules in effect when you save.',
            'Konfirmasikan biaya dengan siswa sebelum memesan kursi. Batas pembayaran mengikuti aturan pendaftaran saat Anda menyimpan.',
            '分配席位前请先与学员确认应付金额。付款和提交凭证的截止时间按保存时生效的报名规则计算。'])}</p>
          {error&&<p role="alert">{error}</p>}
          {pending&&<CrmSaveFeedback state="unknown" lang={lang}/>}
          <AdminField required>{t(['Learner name','Nama siswa','学员姓名'])}<input name="name" required maxLength={120} disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Email','Email','电子邮箱'])}<input name="email" type="email" required maxLength={254} disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Phone with country code','Nomor telepon dengan kode negara','手机号（含国家区号）'])}
            <input name="phone" type="tel" required disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Agreed tuition (Rp)','Biaya yang disepakati (Rp)','已确认应付金额（Rp）'])}
            <input name="price" type="number" min="1" max="1000000000" step="1" required defaultValue={insertion.row.price} disabled={busy||!!pending}/></AdminField>
          <label className="admin-field admin-field--choice"><input type="checkbox" name="confirmed" required disabled={busy||!!pending}/>
            <span>{t(['The learner agreed to join at this amount','Siswa menyetujui pendaftaran dengan biaya ini','学员已确认加入并同意应付金额'])} *</span></label>
        </div>
        <AdminFormActions className="crm-editor-actions">
          {pending?<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void checkInsertion().catch(()=>{})}>
            {t(['Check save result','Periksa hasil simpan','查询保存结果'])}</button>:<>
            <button type="button" className="crm-work-button" disabled={busy} onClick={()=>{if(dirty)setDiscard(true);else setInsertion(undefined);}}>
              {t(['Cancel','Batal','取消'])}</button>
            <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t(['Confirm and reserve seat','Konfirmasi dan pesan kursi','确认并分配席位'])}</button>
          </>}
        </AdminFormActions>
      </AdminForm>
    </CrmOperationLayer>}
    {discard && <CrmDiscardDialog lang={lang} isLight={isLight} onKeep={() => setDiscard(false)} onDiscard={() => {
      setDiscard(false); setDirty(false); setDraft(undefined); setInsertion(undefined); setError('');
    }}/>}
    {closing&&<CrmDiscardDialog lang={lang} isLight={isLight}
      title={t(['Confirm the class will not open?','Konfirmasi kelas tidak dibuka?','确认这个班不开班？'])}
      description={t(['New applications and transfers stop. Existing payment records remain available.','Pendaftaran dan transfer baru dihentikan. Riwayat pembayaran tetap tersedia.','关闭新报名和转账入口，保留已有付款记录。'])}
      keepLabel={t(['Go back','Kembali','返回'])} discardLabel={t(['Confirm','Konfirmasi','确认不开班'])}
      onKeep={()=>{if(!busy)setClosing(undefined);}} onDiscard={()=>{
        if(busy)return;
        setBusy(true);setError('');
        void enrollmentPost(endpoint+'/'+closing.id+'/cancel',{requestId:closing.requestId})
          .then(async()=>{setClosing(undefined);setSaved(true);await load();})
          .catch(()=>{setClosing(undefined);setError(t(['Check the current class state.','Periksa status kelas terbaru.','请刷新核对当前班次状态。']));})
          .finally(()=>setBusy(false));
      }}/>}
  </section>;
}
