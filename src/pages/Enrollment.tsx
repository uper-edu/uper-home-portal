import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, Minus, Plus } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeSiteLanguage } from '../utils/siteMetadata';
import { formatCurrency } from '../utils/currency';
import { enrollmentOpeningNotice,type PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { useEnrollmentOpeningClock } from '../utils/useEnrollmentOpeningClock';
import { PublicSingleSelect } from '../components/PublicSingleSelect';
import { EnrollmentSupport } from '../components/EnrollmentSupport';
import { oneToOneRate } from '../data/enrollmentOneToOne';
import { EnrollmentApplication, enrollmentCopy } from '../components/EnrollmentApplication';
import { EnrollmentAssistance } from '../components/EnrollmentAssistance';
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
  'one-on-one': ['One-to-one', 'Kelas privat', '一对一'],
  appointment: ['Arrange your lesson times with our team.', 'Atur jadwal bersama tim kami.', '上课时间与销售客服另行约定。'],
  appointmentAction: ['Contact us to schedule', 'Hubungi tim untuk atur jadwal', '联系销售客服约课'],
  opened: ['Class confirmed', 'Kelas dikonfirmasi', '已成班'],
  recruiting: ['Enrollment open', 'Pendaftaran dibuka', '报名中'],
  apply: ['Apply for this class', 'Daftar kelas ini', '申请这个班'],
  join: ['Join waitlist', 'Masuk daftar tunggu', '加入候补'],
  standardPrice: ['Standard price', 'Harga standar', '标准价'],
  courseIntro: ['About this course', 'Tentang kursus ini', '课程介绍'],
  rules: ['Class opening and refund policy', 'Ketentuan pembukaan kelas dan pengembalian dana', '查看开班与退款说明'],
  rulesTitle: ['Class opening and refund policy', 'Ketentuan pembukaan kelas dan pengembalian dana', '开班与退款说明'],
  backDetail: ['Back to class details', 'Kembali ke detail kelas', '返回班次详情'],
  backMatch: ['Back to matching results', 'Kembali ke hasil pencocokan', '返回匹配结果'],
  noMatchBody: ['Try changing the time or class type, or tell us what you want to study.', 'Coba ubah waktu atau jenis kelas, atau beri tahu kami kelas yang Anda inginkan.', '可以调整时段或班型，也可以告诉我们你的上课偏好。'],
  payment: ['Transfer & proof', 'Transfer dan bukti', '转账与凭证'],
  backMine: ['Back to my enrollments', 'Kembali ke pendaftaran saya', '返回我的报名'],
  noMatch: ['Need a different class?', 'Butuh kelas lain?', '没找到合适的班？'],
  details: ['Class details', 'Detail kelas', '班次详情'],
  back: ['Back to classes', 'Kembali ke daftar kelas', '返回课程报名'],
  unavailable: ['This class is unavailable.', 'Kelas ini tidak tersedia.', '此班次暂不可查看。'],
  mine: ['My enrollments', 'Pendaftaran saya', '我的报名'],
  waitlistDetail: ['Waitlist details', 'Detail daftar tunggu', '候补详情'],
  demandDetail: ['Course preference details', 'Detail preferensi kursus', '选课需求详情'],
  recordUnavailable: ['This record is not available.', 'Catatan ini tidak tersedia.', '这条记录无法查看。'],
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
  const { classId, recordKind, recordId, topic } = useParams();
  const pathname = useLocation().pathname.replace(/\/$/, '');
  const record = recordId && (recordKind === 'waitlist' || recordKind === 'demands') ? { kind:recordKind, id:recordId } as const : undefined;
  const mine = pathname === '/enrollment/mine' || !!recordId;
  const interest = pathname === '/enrollment/interest';
  const payment = pathname === '/enrollment/payment';
  const application = params.get('apply') === '1' || params.has('order');
  const rulesPage = !!classId && params.get('view')==='rules';
  useEffect(() => {
    if (classId && (application || rulesPage)) window.scrollTo(0, 0);
  }, [classId, application, rulesPage]);
  const [classes, setClasses] = useState<PublicEnrollmentClass[]>();
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [accepting, setAccepting] = useState<boolean>();
  const openingClock=useEnrollmentOpeningClock();
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
  catalogParams.delete('proof');
  catalogParams.delete('view');
  catalogParams.delete('target');
  const waitlistId = params.get('waitlist');
  const matchId = params.get('fromDemand');
  const publicParams = new URLSearchParams(catalogParams);
  for (const key of ['waitlist','fromDemand','join']) publicParams.delete(key);
  const listPath = '/enrollment?' + publicParams.toString();
  const waitlistPath = waitlistId ? '/enrollment/mine/waitlist/'+encodeURIComponent(waitlistId)+'?'+publicParams.toString() : undefined;
  const matchPath = matchId ? '/enrollment/mine/demands/'+encodeURIComponent(matchId)+'?'+publicParams.toString() : undefined;
  const minePath = '/enrollment/mine?' + catalogParams.toString();
  const interestPath = '/enrollment/interest?' + catalogParams.toString();
  const detailsPath = (id: string, apply = false) => {
    const query = new URLSearchParams(catalogParams);
    if (apply) query.set('apply', '1');
    return '/enrollment/' + encodeURIComponent(id) + '?' + query.toString();
  };
  const selected = classes?.find(row => row.id === classId);
  const privateLesson = format === 'one-on-one' || (!format && !period) ? oneToOneRate(level) : undefined;
  const appointmentParams = new URLSearchParams(publicParams);
  appointmentParams.set('lang', language);
  appointmentParams.set('level', level);
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
    const openingNotice=row.opened?'':enrollmentOpeningNotice(row.decisionAt,language,openingClock);
    const title = row.level + ' · ' + t(row.format) + ' · ' + dateLabel(row);
    return <article className="enrollment-class-card" key={row.id}>
      <h2>{inCatalog ? <Link to={detailsPath(row.id)}>{title}<ChevronRight size={15} aria-hidden="true"/></Link> : title}</h2>
      <p>{facts}</p>
      <p className="enrollment-schedule">{row.schedule}</p>
      <div className="enrollment-class-status">
        <span className="enrollment-status" data-state={row.availability === 'full' ? 'full' : row.opened ? 'confirmed' : 'pending'}>
          {t(row.opened ? 'opened' : 'recruiting')}{row.availability && ' · ' + t(row.availability)}
        </span>
        {openingNotice&&<small>{openingNotice}</small>}
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

  if (pathname==='/enrollment/assist') return <EnrollmentAssistance language={language}/>;
  if (topic) return <EnrollmentSupport topic={topic} language={language}
    level={params.has('level')&&oneToOneRate(level)?level:undefined} period={period} catalogPath={listPath}/>;

  if (rulesPage) return <section className="enrollment-screen enrollment-apply-screen enrollment-support">
    <Link className="enrollment-back" to={detailsPath(classId!)}><ArrowLeft size={15} aria-hidden="true"/>{t('backDetail')}</Link>
    <h1>{t('rulesTitle')}</h1>
    <div className="enrollment-result-body">
      <article className="enrollment-record"><h2>{enrollmentCopy(language,['原班无法如期开课','If the original class won’t open','Jika kelas asal tidak dibuka'])}</h2>
        <p>{enrollmentCopy(language,[
          '已核实足额到账的学员可以转班、等待合适班次，或联系销售或客服申请原路退款。',
          'After full payment is verified, you can transfer, wait for another class, or contact sales or support to request a refund to the original payment method.',
          'Setelah pembayaran lunas diverifikasi, Anda bisa pindah kelas, menunggu kelas lain, atau menghubungi tim penjualan atau layanan pelanggan untuk meminta pengembalian ke metode pembayaran awal.',
        ])}</p></article>
      <article className="enrollment-record"><h2>{enrollmentCopy(language,['学员自行退出','If you decide to withdraw','Jika Anda mengundurkan diri'])}</h2>
        <p>{enrollmentCopy(language,[
          '由销售或客服按报名前公示的政策核对适用条件和金额。已确认开班时，退款须按特殊情况审核。',
          'Sales or support checks eligibility and amounts against the policy shown before enrollment. Once a class is confirmed, refunds require special review.',
          'Tim penjualan atau layanan pelanggan memeriksa syarat dan jumlah sesuai kebijakan sebelum pendaftaran. Setelah kelas dikonfirmasi, pengembalian dana memerlukan peninjauan khusus.',
        ])}</p></article>
    </div>
  </section>;

  if (payment) return <section className="enrollment-screen enrollment-payment">
    <Link className="enrollment-back" to={minePath}><ArrowLeft size={15} aria-hidden="true"/>{t('backMine')}</Link>
    <h1>{t('payment')}</h1>
    {accepting === undefined ? <p role="status">{t('loading')}</p> : accepting && params.has('order')
      ? <EnrollmentApplication key={params.get('order')} language={language} paymentClasses={classes ?? []}/>
      : <p>{t('unavailable')}</p>}
  </section>;
  if (mine) return <section className="enrollment-screen enrollment-mine">
    <Link className="enrollment-back" to={recordId ? minePath : listPath}><ArrowLeft size={15} aria-hidden="true"/>{t(recordId ? 'backMine' : 'back')}</Link>
    <h1>{t(record?.kind === 'waitlist' ? 'waitlistDetail' : record?.kind === 'demands' ? 'demandDetail' : 'mine')}</h1>
    {recordId && !record ? <p>{t('recordUnavailable')}</p>
      : accepting === undefined ? <p role="status">{t('loading')}</p>
      : accepting ? <EnrollmentApplication key={pathname} language={language} mineClasses={classes ?? []} record={record}/>
      : <p>{t('unavailable')}</p>}
  </section>;
  if (interest) return <section className="enrollment-screen enrollment-apply-screen enrollment-intake">
    <Link className="enrollment-back" to={listPath}><ArrowLeft size={15} aria-hidden="true"/>{t('back')}</Link>
    <h1>{t('interest')}</h1>
    {accepting === undefined ? <p role="status">{t('loading')}</p> :
      accepting ? <EnrollmentApplication key={String(interest)} language={language} demandOnly={interest}/> : <p>{t('unavailable')}</p>}
  </section>;

  if (application && selected && (selected.availability === 'full' || params.get('join')==='1') && !params.has('order') && accepting) {
    return <section className="enrollment-screen enrollment-apply-screen enrollment-intake">
      <Link className="enrollment-back" to={listPath}><ArrowLeft size={15} aria-hidden="true"/>{t('back')}</Link>
      <h1>{t('join')}</h1>
      <EnrollmentApplication key={selected.id} classId={selected.id} language={language} full waitlistClass={selected}/>
    </section>;
  }

  if (application && selected && selected.availability !== 'full' && !params.has('order') && accepting) {
    return <section className="enrollment-screen enrollment-apply-screen">
      <EnrollmentApplication key={selected.id} classId={selected.id} language={language} applicationClass={{
        title: selected.level + ' · ' + t(selected.format) + ' · ' + dateLabel(selected),
        schedule: selected.schedule,
        price: selected.price,
        detailsPath: waitlistPath ?? detailsPath(selected.id),
        fromWaitlist: waitlistId ?? undefined,
        listPath,
      }}/>
    </section>;
  }

  if (classId) return <section className="enrollment-screen enrollment-detail">
    <Link className="enrollment-back" to={application ? detailsPath(classId) : matchPath ?? listPath}><ArrowLeft size={15} aria-hidden="true"/>{t(application ? 'backDetail' : matchPath ? 'backMatch' : 'back')}</Link>
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
            <Link className="enrollment-quiet" to={detailsPath(selected.id)+'&view=rules'}>{t('rules')}</Link>
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
          options={[{ value: '', label: t('allFormats') }, { value: 'standard', label: t('standard') }, { value: 'small', label: t('small') }, { value: 'one-on-one', label: t('one-on-one') }]}/>
      </div>
    </div>
    {format !== 'one-on-one' && (failed
      ? <p role="alert">{t('error')} <button className="enrollment-quiet" type="button" onClick={() => setReload(value => value + 1)}>{t('retry')}</button></p>
      : !classes && <p role="status">{t('loading')}</p>)}
    {rows?.length || privateLesson ? <div className="enrollment-class-grid">
      {rows?.map(row => classCard(row, true))}
      {privateLesson&&<article className="enrollment-class-card enrollment-appointment-card">
        <h2>HSK {level} · {t('one-on-one')}</h2>
        <p>{t('appointment')}</p>
        <div className="enrollment-class-bottom">
          <div className="enrollment-prices">
            <strong>{formatCurrency(privateLesson.lessonPrice,language)}<span className="enrollment-price-unit">{enrollmentCopy(language,[' / 次课',' / session',' / sesi'])}</span></strong>
            <small>{enrollmentCopy(language,[
              `${privateLesson.referenceLessons} 课次折算 ${formatCurrency(privateLesson.lessonPrice*privateLesson.referenceLessons,language)}`,
              `Reference total · ${privateLesson.referenceLessons} sessions · ${formatCurrency(privateLesson.lessonPrice*privateLesson.referenceLessons,language)}`,
              `Perkiraan total · ${privateLesson.referenceLessons} sesi · ${formatCurrency(privateLesson.lessonPrice*privateLesson.referenceLessons,language)}`,
            ])}</small>
          </div>
          <Link className="enrollment-primary" to={'/enrollment/help/one-on-one?'+appointmentParams.toString()}>{t('appointmentAction')}</Link>
        </div>
      </article>}
    </div>
      : classes&&!failed&&<div className="enrollment-class-card enrollment-empty"><CalendarDays size={20} aria-hidden="true"/><div><p><strong>{t('empty')}</strong></p><p>{t('noMatchBody')}</p></div><button className="enrollment-quiet" type="button" onClick={() => {
        const next = new URLSearchParams(params);
        next.delete('period'); next.delete('format');
        setParams(next, { replace: true, preventScrollReset: true });
      }}>{t('reset')}</button></div>}
    {accepting && <div className="enrollment-interest-link"><p>{t('noMatch')}</p><Link className="enrollment-quiet" to={interestPath}>{t('interest')}<ArrowUpRight size={15} aria-hidden="true"/></Link></div>}
  </section>;
}
