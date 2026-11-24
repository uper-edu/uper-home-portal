import {useEffect,type CSSProperties} from 'react';
import {AdminPageHeader} from './admin/AdminPageHeader';
import {AdminDisclosure} from './admin/AdminDisclosure';
import {AdminRowAction} from './admin/AdminListControl';
import {AdminFormGuide} from './AdminFormGuide';
import {BrowserMetadataGuide} from './BrowserMetadataGuide';
import {accessGuide} from '../utils/accessLanguage';
import {accessSafetyGuide} from '../utils/accessSafetyLanguage';
import type {CrmLanguage} from '../utils/crmLanguage';

const chapters=[
  {id:'accounts',title:['Accounts and roles','Akun dan peran','账号与角色'],steps:[
    ['Open Users & access → Users. Select a name to check the account, assigned roles and effective access.',
     'Buka Pengguna & akses → Pengguna. Pilih nama untuk memeriksa akun, peran yang ditetapkan, dan akses efektif.',
     '进入「用户与权限 → 用户」，点击姓名查看账号、已分配角色和生效权限。'],
    ['Authorized user administrators can edit accounts. Only staff with session management permission can reset credentials or revoke sessions.',
     'Administrator dengan izin pengelolaan pengguna dapat mengedit akun. Reset kredensial dan pencabutan sesi memerlukan izin pengelolaan sesi.',
     '有用户管理权限才能编辑账号；重置密码和撤销会话需要会话管理权限。'],
    ['To change role grants, open Roles, select a role, and preview the impact before saving. Change audit is available to authorized staff.',
     'Untuk mengubah izin, buka Peran, pilih peran, lalu pratinjau dampaknya sebelum menyimpan. Audit perubahan tersedia bagi staf berwenang.',
     '有角色管理权限时，从「角色」打开对应详情，修改授权后先预览影响再保存。有审计权限可查看「变更审计」。'],
  ]},
  {id:'notifications',title:['Notifications and Lark','Notifikasi dan Lark','通知与 Lark'],steps:[
    ['Open Notification settings from your account menu to manage your own Lark connection and notification settings.',
     'Buka Pengaturan notifikasi di menu akun untuk mengelola hubungan Lark dan pengaturan notifikasi pribadi.',
     '从账号菜单打开「通知设置」，管理本人的 Lark 绑定与通知设置。'],
    ['Authorize your company Lark account and confirm the identity displayed. Available optional notifications can be configured after connection.',
     'Otorisasi akun Lark perusahaan dan konfirmasi identitas yang ditampilkan. Notifikasi opsional yang tersedia dapat diatur setelah terhubung.',
     '授权公司 Lark 账号并核对显示的身份，确认绑定后可设置已开放的可选通知。'],
  ]},
  {id:'ai',title:['AI model services','Layanan model AI','AI 模型服务'],steps:[
    ['Open Integrations → AI model services to edit the active primary and fallback models and check provider credentials.',
     'Buka Integrasi → Layanan model AI untuk mengubah model utama dan cadangan aktif serta memeriksa kredensial penyedia.',
     '打开「集成配置 → AI 模型服务」，可调整生效的主备模型，并核对供应商凭证状态。'],
    ['Use Test & save to apply changes after both models pass. If the outcome is unclear, select Check result before trying again.',
     'Pilih Uji & simpan untuk menerapkan perubahan setelah kedua model lulus. Jika hasil belum jelas, pilih Periksa hasil sebelum mencoba lagi.',
     '修改后点「测试并保存」，主备都通过才生效。结果未确认时，先点「核对本次结果」。'],
  ]},
  {id:'environment',title:['Version and test environment','Versi dan lingkungan uji','版本与测试环境'],steps:[
    ['Open Version and environment from your account menu to check the build and source commit.',
     'Buka Versi dan lingkungan dari menu akun untuk memeriksa build dan commit sumber.',
     '从账号菜单打开「版本与环境」，核对当前构建和源码提交。'],
    ['In company test, authorized administrators can open Test environment & accounts to check the test directory.',
     'Di lingkungan uji perusahaan, administrator yang berwenang dapat membuka Lingkungan uji & akun untuk memeriksa direktori uji.',
     '在公司测试环境，有权管理员可打开「测试环境和账号」，核对测试入口与预置账号。'],
  ]},
  {id:'recovery',title:['Security and recovery','Keamanan dan pemulihan','安全与恢复'],steps:[
    ['If another authorized administrator can sign in, use the normal credential reset procedure first.',
     'Jika administrator berwenang lain masih dapat masuk, gunakan prosedur reset kredensial biasa terlebih dahulu.',
     '如果其他有权管理员还能登录，优先通过用户详情的账号管理操作重置密码。'],

    ['If business access is locked after a restore, follow the security review link at the top of System Management and complete the required account checks before release.',
     'Jika akses bisnis dikunci setelah pemulihan, buka tinjauan keamanan dari bagian atas Manajemen Sistem dan selesaikan pemeriksaan akun sebelum membuka akses.',
     '恢复后业务访问被锁定时，从系统管理顶部进入安全复核，完成账号核对并满足放行条件后再解除限制。'],
  ]},
] as const;

const [lark,ai,version,test,identity,admin,scope,sales,roleChange,deactivation,password,continuity,,oldTeams]=accessGuide;
const references=[
  [identity,admin,scope,sales,roleChange,deactivation,password,oldTeams],
  [lark],
  [ai],
  [version,test],
  [continuity],
];

export function SystemAccessGuide({lang,canAudit,canAi,canTest,shellHeight,onNavigate}:{
  lang:CrmLanguage;canAudit:boolean;canAi:boolean;canTest:boolean;shellHeight:number;onNavigate:(href:string)=>void;
}){
  useEffect(()=>{
    const id=window.location.hash.slice(1);
    if(!chapters.some(chapter=>'guide-'+chapter.id===id))return;
    document.getElementById(id)?.scrollIntoView({block:'start'});
  },[]);
  const col=lang==='zh'?2:lang==='id'?1:0;
  const link=(tab:string,label:readonly string[])=><AdminRowAction href={'/system?tab='+tab} onClick={event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    onNavigate(event.currentTarget.pathname+event.currentTarget.search);
  }}>{label[col]}</AdminRowAction>;
  const links=[
    <>{link('users',['Users','Pengguna','用户'])}{link('roles',['Roles','Peran','角色'])}{canAudit&&link('audit',['Change audit','Audit perubahan','变更审计'])}</>,
    null,canAi&&link('credentials&credentialTopic=llm',['AI model services','Layanan model AI','AI 模型服务']),
    canTest&&link('test',['Test environment & accounts','Lingkungan uji & akun','测试环境和账号']),
  ];
  return <><AdminPageHeader title={['System management guide','Panduan manajemen sistem','系统管理使用指南'][col]}
    subtitle={['Find the steps and permissions for account management, integrations and recovery.',
      'Temukan langkah dan izin untuk mengelola akun, integrasi, dan pemulihan.','按任务查找账号管理、集成配置和管理员恢复的步骤与所需权限。'][col]}/>
  <article className="system-access-guide" style={{"--system-guide-header":shellHeight+"px"} as CSSProperties}>
    <nav className="access-card system-guide-contents" aria-label={['On this page','Di halaman ini','本页目录'][col]}>
      <h2>{['On this page','Di halaman ini','本页目录'][col]}</h2>
      <ol>{chapters.map(chapter=><li key={chapter.id}>
        <AdminRowAction href={'#guide-'+chapter.id} onClick={event=>{
          if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
          const hash='#guide-'+chapter.id;
          const target=document.getElementById(hash.slice(1));
          if(!target)return;
          event.preventDefault();
          if(window.location.hash!==hash)window.history.pushState(window.history.state,'',hash);
          if(event.detail===0)target.focus({preventScroll:true});
          target.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        }}>{chapter.title[col]}</AdminRowAction>
      </li>)}</ol>
    </nav>
    <div className="system-guide-body">
    {chapters.map((chapter,index)=><section className="access-card system-guide-chapter" key={chapter.id}
      id={'guide-'+chapter.id} tabIndex={-1} aria-labelledby={'guide-title-'+chapter.id}>
      <h2 id={'guide-title-'+chapter.id}>{chapter.title[col]}</h2>
      <ol>{chapter.steps.map(step=><li key={step[0]}>{step[col]}</li>)}</ol>
      {links[index]&&<div className="system-guide-links">{links[index]}</div>}
      <AdminDisclosure density="compact" heading={['Detailed rules and notes','Aturan dan catatan terperinci','详细规则与说明'][col]}>
        <ul>{references[index].map(copy=><li key={copy[0]}>{copy[col]}</li>)}</ul>
        {chapter.id==='accounts'&&<AdminFormGuide lang={lang}/>}
        {chapter.id==='environment'&&<BrowserMetadataGuide lang={lang}/>}
      </AdminDisclosure>
      {chapter.id==='recovery'&&accessSafetyGuide.map(item=><AdminDisclosure density="compact" key={item.title[0]} heading={item.title[col]}>
        <p>{item.body[col]}</p>
      </AdminDisclosure>)}
    </section>)}
    </div>
  </article></>;
}
