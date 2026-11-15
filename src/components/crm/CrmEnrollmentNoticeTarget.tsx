import { useEffect, useState } from 'react';
import { CrmPageIdentity } from './CrmPageIdentity';
import { crmLocale, type CrmLanguage } from '../../utils/crmLanguage';
import { useAdminTheme } from '../../utils/adminPreferences';
import { formatCurrency } from '../../utils/currency';
import { enrollmentCopy, enrollmentStatuses } from '../EnrollmentApplication';

type Summary={received:number;waiting:number;pending:number;pendingAmount:number|null;pendingUnknownCount?:number};
type Target =
  | ({type:'report';weekStart:string;endDate:string;enrolled:number;opened:number;refunded:number}&Summary)
  | ({type:'class';id:string;level:string;firstLesson:string;schedule:string;paid:number;minimumPaid:number;capacity:number}&Summary)
  | {type:'payment';id:string;level:string;price:number;received:number;state:string;proofAt:string};

export function CrmEnrollmentNoticeTarget({lang}:{lang:CrmLanguage}) {
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(lang,[zh,en,id]);
  const {isLight}=useAdminTheme();
  const params=new URLSearchParams(window.location.search);
  const type=params.get('view');
  const id=params.get(type==='class'?'classId':type==='payment'?'orderId':'weekStart');
  const [data,setData]=useState<Target>();
  const [error,setError]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    if(!id||!['class','payment','report'].includes(type??'')){setError(404);return;}
    fetch('/api/crm/enrollment/notification-target/'+type+'/'+encodeURIComponent(id),{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if(!response.ok){setError(response.status);return;}
        setData(await response.json());
      }).catch(()=>{if(!controller.signal.aborted)setError(503);});
    return ()=>controller.abort();
  },[type,id]);
  const title=type==='class'?t('已确认开班','Class confirmed','Kelas dikonfirmasi'):
    type==='payment'?t('报名核款记录','Enrollment payment verification','Verifikasi pembayaran pendaftaran'):
    t('课程报名经营周报','Enrollment weekly operations report','Laporan mingguan pendaftaran');
  const money=(value:number|null)=>value===null?t('金额未知','Amount unknown','Jumlah belum diketahui'):formatCurrency(value,lang);
  const pairs:(readonly [string,string|number])[]=[];
  if(data?.type==='class'){
    pairs.push([t('班次','Class','Kelas'),data.level],[t('课表','Schedule','Jadwal'),data.schedule],
      [t('首课','First session','Pertemuan pertama'),data.firstLesson.replace('T',' ')+' WIB'],
      [t('足额到账／开班门槛','Fully paid / minimum','Lunas / batas minimum'),data.paid+' / '+data.minimumPaid],
      [t('招生上限','Capacity','Kapasitas'),data.capacity]);
  } else if(data?.type==='report'){
    pairs.push([t('统计周','Reporting week','Minggu laporan'),data.weekStart+' – '+data.endDate+' WIB'],
      [t('新增足额到账报名','New fully paid enrollments','Pendaftaran lunas baru'),data.enrolled],
      [t('确认开班','Classes confirmed','Kelas dikonfirmasi'),data.opened],
      [t('已发出退款','Refunds sent','Pengembalian dikirim'),money(data.refunded)]);
  } else if(data?.type==='payment'){
    pairs.push([t('报名编号','Enrollment reference','Nomor pendaftaran'),data.id],
      [t('班次','Class','Kelas'),data.level],[t('应付学费','Amount due','Jumlah tagihan'),money(data.price)],
      [t('凭证提交时间','Proof submission time','Waktu pengiriman bukti'),new Intl.DateTimeFormat(crmLocale(lang),{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.proofAt))],
      [t('核款状态','Verification status','Status verifikasi'),enrollmentStatuses[data.state]?enrollmentCopy(lang,enrollmentStatuses[data.state]):data.state]);
  }
  if(data) pairs.push([t('核实实收','Verified receipts','Dana masuk yang terverifikasi'),money(data.received)]);
  if(data&&data.type!=='payment') pairs.push(
    [t('待付款人数','Awaiting payment','Menunggu pembayaran'),data.waiting],
    [data.type==='class'?t('待核实人数','Learners pending verification','Siswa menunggu verifikasi'):t('待核实笔数','Transfers pending verification','Transfer menunggu verifikasi'),data.pending],
    [t('待核实金额','Amount pending verification','Jumlah menunggu verifikasi'),money(data.pendingAmount)+
      (data.pendingAmount!==null&&data.pendingUnknownCount?t(` · 另有 ${data.pendingUnknownCount} 笔金额未知`,` · ${data.pendingUnknownCount} more of unknown amount`,` · ${data.pendingUnknownCount} transfer lain belum diketahui jumlahnya`):'')]);
  return <main data-admin-workspace="crm" data-theme={isLight?'light':'dark'} className="crm-enrollment-notice-target">
    <a className="crm-work-link" href="/crm">{t('返回 CRM','Back to CRM','Kembali ke CRM')}</a>
    <CrmPageIdentity title={title}/>
    {error?<p role="alert">{error===403||error===401?t('无权查看此记录。','You cannot access this record.','Anda tidak dapat mengakses catatan ini.'):
      error===404?t('记录不存在。','Record not found.','Catatan tidak ditemukan.'):t('暂时无法读取，请刷新后重试。','Unable to load. Refresh to try again.','Belum dapat dimuat. Muat ulang untuk mencoba lagi.')}</p>:
      !data?<p role="status">{t('正在加载…','Loading…','Memuat…')}</p>:<>
        {data.type==='report'&&<p>{t('统计周以 WIB 周一 00:00 为界，结束日期不计入。','Weeks are bounded by Monday 00:00 WIB. The end date is excluded.','Minggu dibatasi Senin pukul 00.00 WIB. Tanggal akhir tidak termasuk.')}</p>}
        <dl className="crm-opportunity-summary">{pairs.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {data.type==='payment'&&<a className="crm-work-link" href={'/crm?tab=payments&enrollmentOrder='+encodeURIComponent(data.id)}>
          {t('前往收款核验','Go to payment verification','Buka verifikasi pembayaran')}</a>}
      </>}
  </main>;
}
