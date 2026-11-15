import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, Minus, Plus } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeSiteLanguage } from '../utils/siteMetadata';
import { formatCurrency } from '../utils/currency';
import type { PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { PublicSingleSelect } from '../components/PublicSingleSelect';
import { EnrollmentApplication, enrollmentCopy } from '../components/EnrollmentApplication';
import './enrollment.css';

const copy = {
  title: ['Course enrollment', 'Pendaftaran kelas', '课程报名'],
  online: ['Online classes · Find a class that fits', 'Kelas online · Pilih kelas yang sesuai', '在线学习 · 选择适合你的班次'],
  loading: ['Loading classes…', 'Memuat kelas…', '正在加载班次…'],
  error: ['Classes could not be loaded.', 'Kelas belum dapat dimuat.', '班次暂时无法加载。'],
  retry: ['Try again', 'Coba lagi', '重试'],
  empty: ['No classes match these filters.', 'Belum ada kelas yang cocok.', '暂无符合筛选条件的班次。'],
  reset: ['Clear filters', 'Hapus filter', '清除筛选'],
  period: ['Time slot', 'Waktu', '时段'],
  format: ['Class type', 'Jenis kelas', '班型'],
  level: ['Level', 'Level', '级别'],
  allPeriods: ['All times', 'Semua waktu', '全部时段'],
  allFormats: ['All class types', 'Semua jenis kelas', '全部班型'],
  weekend: ['Weekend', 'Akhir pekan', '周末'],
  'weekday-evening': ['Weekday evenings', 'Malam hari kerja', '工作日晚间'],
  standard: ['Standard class', 'Kelas standar', '标准班'],
  small: ['Small group', 'Kelas kecil', '小班'],
  opened: ['Class confirmed', 'Kelas dikonfirmasi', '已成班'],
  recruiting: ['Enrollment open', 'Pendaftaran dibuka', '报名中'],
  apply: ['Apply for this class', 'Daftar kelas ini', '申请这个班'],
  join: ['Join waitlist', 'Masuk daftar tunggu', '加入候补'],
  standardPrice: ['Standard price', 'Harga standar', '标准价'],
  courseIntro: ['About this course', 'Tentang kursus ini', '课程介绍'],
  rules: ['Class opening and refund policy', 'Ketentuan pembukaan kelas dan pengembalian dana', '查看开班与退款说明'],
  close: ['Close', 'Tutup', '关闭'],
  payment: ['Transfer & proof', 'Transfer dan bukti', '转账与凭证'],
  backMine: ['Back to my enrollments', 'Kembali ke pendaftaran saya', '返回我的报名'],
  noMatch: ['Need a different class?', 'Butuh kelas lain?', '没找到合适的班？'],
  details: ['Class details', 'Detail kelas', '班次详情'],
  back: ['Back to classes', 'Kembali ke daftar kelas', '返回课程报名'],
  unavailable: ['This class is unavailable.', 'Kelas ini tidak tersedia.', '此班次暂不可查看。'],
  mine: ['My enrollments', 'Pendaftaran saya', '我的报名'],
  interest: ['Tell us what you want to study', 'Sampaikan kursus yang Anda inginkan', '告诉我们你想上的课'],
  full: ['Full', 'Penuh', '满班'],
  limited: ['Few seats left', 'Kursi terbatas', '空位紧张'],
  available: ['Seats available', 'Kursi tersedia', '有空位'],
  outcomes: ['What you will learn', 'Yang akan Anda pelajari', '学完能做什么'],
  material: ['Course and materials', 'Kursus dan materi', '课程内容与教材'],
  resources: ['Practice and resources', 'Latihan dan sumber daya', '课后练习与资源'],
  teacher: ['Teacher', 'Pengajar', '授课教师'],
} as const;

export default function Enrollment() {
  const { i18n } = useTranslation();
  const language = normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language);
  const locale = language === 'zh' ? 'zh-CN' : language === 'id' ? 'id-ID' : 'en-GB';
  const t = (key: keyof typeof copy) => copy[key][language === 'zh' ? 2 : language === 'id' ? 1 : 0];
  const [params, setParams] = useSearchParams();
  const { classId } = useParams();
  const pathname = useLocation().pathname.replace(/\/$/, '');
  const mine = pathname === '/enrollment/mine';
  const interest = pathname === '/enrollment/interest';
  const payment = pathname === '/enrollment/payment';
  const application = params.get('apply') === '1' || params.has('order');
  const rules = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (classId && application) window.scrollTo(0, 0);
  }, [classId, application]);
  const [classes, setClasses] = useState<PublicEnrollmentClass[]>();
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [accepting, setAccepting] = useState<boolean>();
  const level = params.get('level') || '1';
  const period = params.get('period') || '';
  const format = params.get('format') || '';

  useEffect(() => {
    const abort = new AbortController();
    setFailed(false);
    fetch('/api/enrollment/classes', { signal: abort.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error();
      const data: { classes: PublicEnrollmentClass[] } = await response.json();
      setClasses(data.classes);
    }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [reload]);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/enrollment/availability', { signal: abort.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : {})
      .then((data: { accepting?: boolean }) => { if (!abort.signal.aborted) setAccepting(data.accepting === true); })
      .catch(() => { if (!abort.signal.aborted) setAccepting(false); });
    return () => abort.abort();
  }, []);

  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  const catalogParams = new URLSearchParams(params);
  catalogParams.delete('apply');
  catalogParams.delete('order');
  const listPath = '/enrollment?' + catalogParams.toString();
  const minePath = '/enrollment/mine?' + catalogParams.toString();
  const interestPath = '/enrollment/interest?' + catalogParams.toString();
  const detailsPath = (id: string, apply = false) => {
    const query = new URLSearchParams(catalogParams);
    if (apply) query.set('apply', '1');
    return '/enrollment/' + encodeURIComponent(id) + '?' + query.toString();
  };
  const selected = classes?.find(row => row.id === classId);
  const rows = classes?.filter(row => row.level.startsWith('HSK ' + level) &&
    (!period || row.period === period) && (!format || row.format === format));
  const formatDay = (value: string) => new Intl.DateTimeFormat(locale, {
    month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(value + ':00+07:00'));
  const dateLabel = (row: PublicEnrollmentClass) => {
    const date = formatDay(row.firstLesson).replaceAll(' ', '\u00a0');
    return enrollmentCopy(language, row.opened
      ? [date + '开课', 'Starts ' + date, 'Mulai ' + date]
      : ['预计 ' + date + '开课', 'Expected ' + date, 'Perkiraan ' + date]);
  };

  const classCard = (row: PublicEnrollmentClass, inCatalog: boolean) => {
    const groupSize = row.format === 'standard' ? '15–20' : '4–6';
    const facts = enrollmentCopy(language, [
      `${groupSize} 人 · ${row.sessions} 次课 · 每次 ${row.minutes} 分钟`,
      `${groupSize} learners · ${row.sessions} sessions · ${row.minutes} min each`,
      `${groupSize} siswa · ${row.sessions} sesi · ${row.minutes} menit per sesi`,
    ]);
    const decision = row.decisionAt ? formatDay(row.decisionAt) : '';
    const title = row.level + ' · ' + t(row.format) + ' · ' + dateLabel(row);
    return <article className="enrollment-class-card" key={row.id}>
      <h2>{inCatalog ? <Link to={detailsPath(row.id)}>{title}<ChevronRight size={15} aria-hidden="true"/></Link> : title}</h2>
      <p>{facts}</p>
      <p className="enrollment-schedule">{row.schedule}</p>
      <div className="enrollment-class-status">
        <span className="enrollment-status" data-state={row.availability === 'full' ? 'full' : row.opened ? 'confirmed' : 'pending'}>
          {t(row.opened ? 'opened' : 'recruiting')}{row.availability && ' · ' + t(row.availability)}
        </span>
        {!row.opened && decision && <small>{enrollmentCopy(language, [
          '预计 ' + decision + ' 通知开班结果',
          'Opening update expected ' + decision,
          'Kabar pembukaan diperkirakan ' + decision,
        ])}</small>}
      </div>
      <div className="enrollment-class-bottom">
        <div className="enrollment-prices">
          <strong>{formatCurrency(row.price, language)}</strong>
          {row.standardPrice && <small>{t('standardPrice')} <del>{formatCurrency(row.standardPrice, language)}</del></small>}
          <small>{formatCurrency(Math.round(row.price / row.sessions), language)}
            {enrollmentCopy(language, [' / 次课', ' / session', ' / sesi'])}</small>
        </div>
        {inCatalog && accepting && <Link className="enrollment-primary" to={detailsPath(row.id, true)}>{t(row.availability === 'full' ? 'join' : 'apply')}</Link>}
      </div>
    </article>;
  };

  if (payment) return <section className="enrollment-screen enrollment-payment">
    <Link className="enrollment-back" to={minePath}><ArrowLeft size={15} aria-hidden="true"/>{t('backMine')}</Link>
    <h1>{t('payment')}</h1>
    {accepting === undefined ? <p role="status">{t('loading')}</p> : accepting && params.has('order')
      ? <EnrollmentApplication key={params.get('order')} language={language} paymentClasses={classes ?? []}/>
      : <p>{t('unavailable')}</p>}
  </section>;
  if (mine || interest) return <section className="enrollment-page">
    <Link to={listPath}>{t('back')}</Link>
    <h1>{t(interest?'interest':'mine')}</h1>
    {accepting === undefined ? <p role="status">{t('loading')}</p> :
      accepting ? <EnrollmentApplication key={String(interest)} language={language} demandOnly={interest}/> : <p>{t('unavailable')}</p>}
  </section>;

  if (classId) return <section className="enrollment-screen enrollment-detail">
    <Link className="enrollment-back" to={application ? detailsPath(classId) : listPath}><ArrowLeft size={15} aria-hidden="true"/>{t(application ? 'details' : 'back')}</Link>
    <h1>{t(application && selected ? selected.availability === 'full' ? 'join' : 'apply' : 'details')}</h1>
    {failed ? <p role="alert">{t('error')} <button type="button" onClick={() => setReload(value => value + 1)}>{t('retry')}</button></p>
      : !classes ? <p role="status">{t('loading')}</p>
      : !selected ? <p>{t('unavailable')}</p>
      : application ? <div className="enrollment-apply-layout">
        {classCard(selected, false)}
        {accepting && <EnrollmentApplication key={selected.id} classId={selected.id} language={language} full={selected.availability==='full'}/>}
      </div> : <div className="enrollment-detail-layout">
        <aside className="enrollment-detail-aside">
          {classCard(selected, false)}
          <div className="enrollment-detail-actions">
            <button type="button" className="enrollment-quiet" onClick={() => rules.current?.showModal()}>{t('rules')}</button>
            {accepting && <Link className="enrollment-primary" to={detailsPath(selected.id, true)}>{t(selected.availability === 'full' ? 'join' : 'apply')}</Link>}
          </div>
        </aside>
        <section className="enrollment-course">
          <h2>{t('courseIntro')}</h2>
          {(['outcomes', 'material', 'resources', 'teacher'] as const).map(key => {
            const description = key === 'outcomes' ? selected.learningOutcomes : selected[key];
            return <details key={key} open={key === 'outcomes'}>
              <summary>
                <span>{t(key)}<small aria-hidden="true">{description}</small></span>
                <Plus size={16} aria-hidden="true"/><Minus size={16} aria-hidden="true"/>
              </summary>
              <p>{description}</p>
            </details>;
          })}
        </section>
        <dialog className="enrollment-rules-dialog" ref={rules} aria-labelledby="enrollment-rules-title">
          <h2 id="enrollment-rules-title">{t('rules')}</h2>
          <p>{enrollmentCopy(language, [
            'UPER 会通知开班结果。若原班确认不开班且已核实足额到账，可在「我的报名」查看后续安排，也可主动申请退款。若已确认开班，特殊情况请联系销售客服。',
            'UPER will share the opening decision. If your original class will not open and your full payment has been verified, check My enrollments for next steps or request a refund there. If the class is confirmed, contact support about exceptional circumstances.',
            'UPER akan mengabari keputusan pembukaan kelas. Jika kelas asal tidak dibuka dan pembayaran penuh sudah diverifikasi, lihat langkah berikutnya di Pendaftaran saya atau ajukan pengembalian dana. Jika kelas sudah dikonfirmasi, hubungi layanan pelanggan untuk keadaan khusus.',
          ])}</p>
          <form method="dialog"><button className="enrollment-primary">{t('close')}</button></form>
        </dialog>
      </div>}
  </section>;

  return <section className="enrollment-screen enrollment-catalog">
    <div className="enrollment-title-row">
      <h1>{t('title')}</h1>
      {accepting && <Link className="enrollment-outline" to={minePath}>{t('mine')}<ChevronRight size={16} aria-hidden="true"/></Link>}
    </div>
    <p className="enrollment-subtitle">{t('online')}</p>
    <div className="enrollment-catalog-controls">
      <div className="enrollment-levels" role="group" aria-label={t('level')}>
        {['1', '2', '3', '4'].map(value => <button key={value} type="button" aria-pressed={level === value} onClick={() => filter('level', value)}>HSK {value}</button>)}
      </div>
      <div className="enrollment-filters">
        <PublicSingleSelect label={t('period')} value={period} onChange={value => filter('period', value)}
          options={[{ value: '', label: t('allPeriods') }, { value: 'weekday-evening', label: t('weekday-evening') }, { value: 'weekend', label: t('weekend') }]}/>
        <PublicSingleSelect label={t('format')} value={format} onChange={value => filter('format', value)}
          options={[{ value: '', label: t('allFormats') }, { value: 'standard', label: t('standard') }, { value: 'small', label: t('small') }]}/>
      </div>
    </div>
    {failed ? <p role="alert">{t('error')} <button className="enrollment-quiet" type="button" onClick={() => setReload(value => value + 1)}>{t('retry')}</button></p>
      : !classes ? <p role="status">{t('loading')}</p>
      : rows?.length ? <div className="enrollment-class-grid">{rows.map(row => classCard(row, true))}</div>
      : <div className="enrollment-class-card enrollment-empty"><CalendarDays size={20} aria-hidden="true"/><p>{t('empty')}</p><button className="enrollment-quiet" type="button" onClick={() => {
        const next = new URLSearchParams(params);
        next.delete('period'); next.delete('format');
        setParams(next, { replace: true, preventScrollReset: true });
      }}>{t('reset')}</button></div>}
    {accepting && <div className="enrollment-interest-link"><p>{t('noMatch')}</p><Link className="enrollment-quiet" to={interestPath}>{t('interest')}<ArrowUpRight size={15} aria-hidden="true"/></Link></div>}
  </section>;
}
