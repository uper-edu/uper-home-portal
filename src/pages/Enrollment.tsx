import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeSiteLanguage } from '../utils/siteMetadata';
import { formatCurrency } from '../utils/currency';
import type { PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { PublicSingleSelect } from '../components/PublicSingleSelect';
import { EnrollmentApplication } from '../components/EnrollmentApplication';
import './enrollment.css';

const copy = {
  title: ['Course enrollment', 'Pendaftaran kelas', '课程报名'],
  online: ['Online classes', 'Kelas online', '线上课程'],
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
  estimated: ['Estimated start', 'Perkiraan mulai', '预计开课'],
  opened: ['Class confirmed', 'Kelas dikonfirmasi', '已确认开班'],
  details: ['Class details', 'Detail kelas', '班次详情'],
  back: ['Back to classes', 'Kembali ke daftar kelas', '返回课程报名'],
  unavailable: ['This class is unavailable.', 'Kelas ini tidak tersedia.', '此班次暂不可查看。'],
  mine: ['My enrollments', 'Pendaftaran saya', '我的报名'],
  outcomes: ['Learning outcomes', 'Hasil belajar', '学习成果'],
  material: ['Course and materials', 'Kursus dan materi', '课程内容与教材'],
  resources: ['Practice and resources', 'Latihan dan sumber daya', '练习与资源'],
  teacher: ['Teacher', 'Pengajar', '授课教师'],
} as const;

export default function Enrollment() {
  const { i18n } = useTranslation();
  const language = normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language);
  const locale = language === 'zh' ? 'zh-CN' : language === 'id' ? 'id-ID' : 'en';
  const t = (key: keyof typeof copy) => copy[key][language === 'zh' ? 2 : language === 'id' ? 1 : 0];
  const [params, setParams] = useSearchParams();
  const { classId } = useParams();
  const mine = useLocation().pathname.replace(/\/$/, '') === '/enrollment/mine';
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
  const detailsPath = (id: string) => '/enrollment/' + encodeURIComponent(id) + '?' + params.toString();
  const listPath = '/enrollment?' + params.toString();
  const mineParams = new URLSearchParams(params);
  mineParams.delete('order');
  const minePath = '/enrollment/mine?' + mineParams.toString();
  const selected = classes?.find(row => row.id === classId);
  const rows = classes?.filter(row => row.level.startsWith('HSK ' + level) &&
    (!period || row.period === period) && (!format || row.format === format));

  const classCard = (row: PublicEnrollmentClass, showLink: boolean) => {
    const day = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' })
      .format(new Date(row.firstLesson + ':00+07:00'));
    return <article className="enrollment-card" key={row.id}>
      <h2>{row.level} · {t(row.format)} · {day}</h2>
      <p>{t(row.opened ? 'opened' : 'estimated')} · {row.schedule}</p>
      <p>{language === 'zh' ? row.sessions + ' 课次 · 每课次 ' + row.minutes + ' 分钟'
        : language === 'id' ? row.sessions + ' pertemuan · ' + row.minutes + ' menit tiap pertemuan'
        : row.sessions + ' sessions · ' + row.minutes + ' minutes each'}</p>
      <div className="enrollment-card-footer">
        <div>
          {row.standardPrice && <del>{formatCurrency(row.standardPrice, language)}</del>}
          <strong>{formatCurrency(row.price, language)}</strong>
          <small>{formatCurrency(Math.round(row.price / row.sessions), language)}
            {language === 'zh' ? ' / 课次' : language === 'id' ? ' / pertemuan' : ' / session'}</small>
        </div>
        {showLink && <Link to={detailsPath(row.id)}>{t('details')}</Link>}
      </div>
    </article>;
  };
  if (mine) return <section className="enrollment-page">
    <Link to={'/enrollment?' + mineParams.toString()}>{t('back')}</Link>
    <h1>{t('mine')}</h1>
    {accepting === undefined ? <p role="status">{t('loading')}</p> :
      accepting ? <EnrollmentApplication language={language}/> : <p>{t('unavailable')}</p>}
  </section>;
  return <section className="enrollment-page">
    {classId && <Link to={listPath}>{t('back')}</Link>}
    <h1>{classId ? t('details') : t('title')}</h1>
    {!classId && <>
      <div className="enrollment-page-intro"><p>{t('online')}</p>{accepting && <Link to={minePath}>{t('mine')}</Link>}</div>
      <div className="enrollment-levels" role="group" aria-label={t('level')}>
        {['1', '2', '3', '4'].map(value => <button key={value} type="button" aria-pressed={level === value} onClick={() => filter('level', value)}>HSK {value}</button>)}
      </div>
      <div className="enrollment-filters">
        <PublicSingleSelect label={t('period')} value={period} onChange={value => filter('period', value)}
          options={[{ value: '', label: t('allPeriods') }, { value: 'weekday-evening', label: t('weekday-evening') }, { value: 'weekend', label: t('weekend') }]}/>
        <PublicSingleSelect label={t('format')} value={format} onChange={value => filter('format', value)}
          options={[{ value: '', label: t('allFormats') }, { value: 'standard', label: t('standard') }, { value: 'small', label: t('small') }]}/>
      </div>
    </>}
    {failed ? <p role="alert">{t('error')} <button type="button" onClick={() => setReload(value => value + 1)}>{t('retry')}</button></p>
      : !classes ? <p role="status">{t('loading')}</p>
      : classId ? selected ? <>{classCard(selected, false)}
        {(['outcomes', 'material', 'resources', 'teacher'] as const).map(key =>
          <details key={key} open={key === 'outcomes'}><summary>{t(key)}</summary>
            <p>{key === 'outcomes' ? selected.learningOutcomes : selected[key]}</p>
          </details>)}
        {accepting && <EnrollmentApplication key={selected.id} classId={selected.id} language={language}/>}
        </> : <p>{t('unavailable')}</p>
      : rows?.length ? rows.map(row => classCard(row, true)) : <p>{t('empty')} <button type="button" onClick={() => {
          const next = new URLSearchParams(params);
          next.delete('period'); next.delete('format');
          setParams(next, { replace: true, preventScrollReset: true });
        }}>{t('reset')}</button></p>}
  </section>;
}
