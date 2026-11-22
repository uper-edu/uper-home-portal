import {useEffect,useId,useRef,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight,ChevronRight,ClipboardCheck,ClipboardList,Maximize2,Minimize2,X,type LucideIcon} from 'lucide-react';
import {chooseText,type HskLanguage,type HskResult} from '../data/hskAssessment';
import {learnerAssessmentGuidance} from '../data/hskLearnerGuidance';
import {isPlainLinkClick} from '../utils/chatJourneyNavigation';
import {PublicPageLinkActions} from './PublicLinkActions';
import {SocialProfileIcon, socialProfileOrder, socialProfiles} from './SocialProfileIcon';
import {PublicHeaderBrand, PublicHeaderLanguage, PublicHeaderMenu} from './PublicHeaderMenu';

export type ChatPresentation = 'page' | 'panel' | 'mobile' | 'expanded';

type Translate = (zh:string,en:string,id:string)=>string;
type HeaderAction = {label:string; onClick:()=>void; disabled?:boolean} | {label:string; href:string};

export function StandaloneChatHeader({lang,onLanguageChange,actions,name,assessment=false,inactive,presentation='page',enrollmentReturn,linkHubReturn,bookmarkParams,onDismiss,onExpand}:{
  lang:HskLanguage;onLanguageChange:(language:HskLanguage)=>void;actions:HeaderAction[];name?:string;assessment?:boolean;inactive?:boolean;
  presentation?:ChatPresentation;enrollmentReturn?:{href:string;label:string;onReturn:()=>void};onDismiss?:()=>void;onExpand?:()=>void;
  linkHubReturn?:string;
  bookmarkParams?:URLSearchParams;
}){
  const t:Translate=(zh,en,id)=>chooseText(lang,zh,en,id);
  const hubReturnLabel = t('全部入口','All links','Semua tautan');
  const dismissLabel = presentation === 'expanded' ? t('收起咨询','Minimize consultation','Perkecil konsultasi') :
    t('关闭咨询','Close consultation','Tutup konsultasi');
  return <header className="public-page-header standalone-chat-header" inert={inactive}>
    <div className="chat-header-brand">
      {presentation==='page'&&!assessment&&(enrollmentReturn?
        <Link className="chat-header-back chat-enrollment-back" to={enrollmentReturn.href} aria-label={enrollmentReturn.label} onClick={event=>{
          if (!isPlainLinkClick(event)) return;
          event.preventDefault();
          enrollmentReturn.onReturn();
        }}><ArrowLeft size={17} aria-hidden="true"/><span>{enrollmentReturn.label}</span></Link>:
        linkHubReturn?<Link className="chat-header-back chat-enrollment-back" to={linkHubReturn} aria-label={hubReturnLabel}>
          <ArrowLeft size={17} aria-hidden="true"/><span>{hubReturnLabel}</span>
        </Link>:<Link className="chat-header-back" to="/" aria-label={t('返回首页','Return to home','Kembali ke beranda')}><ArrowLeft size={19} aria-hidden="true"/></Link>)}
      {assessment
        ? <span className="chat-header-title">{t('HSK 分班参考测评','HSK placement assessment','Tes penempatan HSK')}</span>
        : <><PublicHeaderBrand/><span className="chat-header-title chat-header-consult-title">
            {t('学习咨询','Learning Advisory','Konsultasi Belajar')}
          </span></>}
    </div>
    <div className="chat-header-actions public-header-tools flex">
      {!assessment&&<PublicHeaderLanguage language={lang} onChange={onLanguageChange}/>}
      {!assessment&&bookmarkParams&&<PublicPageLinkActions path="/chat" language={lang} params={bookmarkParams}
        shareTitle={t('UPER 学习咨询','UPER Learning Advisory','Konsultasi Belajar UPER')} mobileOnly/>}
      {!assessment&&!!actions.length&&<PublicHeaderMenu label={t('更多操作','More actions','Tindakan lainnya')}>
          {close=><>
            {name&&<p className="chat-header-profile">{name}</p>}
            {actions.map(action=>'href' in action
              ? <a key={action.label} href={action.href} target="_blank" rel="noopener noreferrer" onClick={close}>{action.label}</a>
              : <button key={action.label} type="button" disabled={action.disabled} onClick={()=>{close();action.onClick();}}>{action.label}</button>)}
          </>}
      </PublicHeaderMenu>}
      {presentation==='panel'&&onExpand&&<button type="button" className="chat-header-back" onClick={onExpand}
        aria-label={t('展开继续咨询','Continue in full chat','Lanjutkan di halaman chat')} title={t('展开','Expand','Perbesar')}><Maximize2 size={17}/></button>}
      {onDismiss&&<button type="button" className="chat-header-back" onClick={onDismiss} data-chat-host-dismiss
        aria-label={dismissLabel} title={dismissLabel}>{presentation==='expanded'?<Minimize2 size={17}/>:<X size={19}/>}</button>}
    </div>
  </header>;
}

function ChatWelcomeOffer({icon:Icon,title,description,label,onClick}:{
  icon:LucideIcon;title:string;description:string;label:string;onClick:()=>void;
}) {
  return <div className="chat-test-offer">
    <span aria-hidden="true"><Icon size={20}/></span>
    <div><h2>{title}</h2><p>{description}</p></div>
    <button type="button" className="chat-primary" onClick={onClick}>
      {label}<ArrowRight size={16} aria-hidden="true"/>
    </button>
  </div>;
}

export function ChatWelcome({lang,hasDraft,hasResult,onAssessment,onPrompt,hasProfile,onLearningProfile}:{
  lang:HskLanguage;hasDraft:boolean;hasResult:boolean;onAssessment:()=>void;onPrompt:(prompt:string)=>void;
  hasProfile?:boolean;onLearningProfile?:()=>void;
}){
  const t:Translate=(zh,en,id)=>chooseText(lang,zh,en,id);
  const prompts=[
    t('零基础怎么选课？','Which course suits a beginner?','Kelas apa yang cocok untuk pemula?'),
    t('周末有哪些班？','What weekend classes are available?','Apa saja kelas akhir pekan?'),
    t('学费怎么算？','How much are the classes?','Berapa biaya kelasnya?'),
  ];
  return <section className="chat-welcome">
    <h1>{t('你好，想怎么开始学中文？','How would you like to start learning Chinese?','Bagaimana kamu ingin mulai belajar Mandarin?')}</h1>
    <p>{t('我是 UPER AI 学习顾问。可以问我课程、学费和报名。','I’m UPER’s AI learning advisor. Ask me about courses, tuition, or enrollment.','Saya konsultan belajar AI UPER. Tanyakan tentang kelas, biaya, atau pendaftaran.')}</p>
    {onLearningProfile&&<ChatWelcomeOffer icon={ClipboardList}
      title={t('学习登记问卷','Learning questionnaire','Kuesioner belajar')}
      description={t('告诉我们你的学习目标和偏好，方便推荐课程。','Tell us your goals and preferences so we can suggest a class.','Ceritakan tujuan dan preferensimu agar kami bisa menyarankan kelas.')}
      label={hasProfile?t('补充学习资料','Add preferences','Tambah preferensi'):t('填写问卷','Fill out questionnaire','Isi kuesioner')}
      onClick={onLearningProfile}/>}
    <ChatWelcomeOffer icon={ClipboardCheck}
      title={t('免费 HSK 摸底测评','Free HSK placement assessment','Tes penempatan HSK gratis')}
      description={hasResult&&!hasDraft?t('查看你上次测评的学习起点。','Review the starting point from your last assessment.','Lihat titik awal dari tes terakhirmu.'):
        t('15 题快测，看看适合从哪里开始。','Take a 15-question check to find a starting point.','Jawab 15 soal untuk mengetahui titik awal belajarmu.')}
      label={hasDraft?t('继续测评','Resume assessment','Lanjutkan tes'):hasResult?t('查看测评结果','View assessment results','Lihat hasil tes'):
        t('开始免费测评','Start free assessment','Mulai tes gratis')}
      onClick={onAssessment}/>
    <div className="chat-starter-prompts">
      {prompts.map(prompt=><button type="button" key={prompt} onClick={()=>onPrompt(prompt)}>{prompt}<ChevronRight size={15} aria-hidden="true"/></button>)}
    </div>
  </section>;
}

export function ChatWelcomeSocials({lang}:{lang:HskLanguage}) {
  return <nav className="chat-welcome-socials" aria-label={chooseText(lang,'UPER 官方社交账号','UPER social media','Media sosial UPER')}>
    {socialProfileOrder.map(platform=><a
      key={platform} href={socialProfiles[platform].url} aria-label={socialProfiles[platform].name}
      target="_blank" rel="noopener noreferrer"><SocialProfileIcon platform={platform}/></a>)}
  </nav>;
}

export function ChatAssessmentSummary({result,lang,onDetails}:{
  result:HskResult;lang:HskLanguage;onDetails:()=>void;
}){
  const t:Translate=(zh,en,id)=>chooseText(lang,zh,en,id);
  const guidance=learnerAssessmentGuidance(result,lang);
  const start=guidance?.start ?? t('查看学习起点参考','See your placement guidance','Lihat panduan penempatan');
  const heading=guidance?t(`建议从 ${start.replace(/ 内容$/,'')} 开始`,`Suggested starting point: ${start}`,`Titik awal yang disarankan: ${start}`):start;
  return <section className="chat-assessment-summary" data-hsk-result-anchor>
    <p className="chat-assessment-status"><ClipboardCheck size={16} aria-hidden="true"/>
      {result.attempt.mode==='express'?t('快速测评已完成','Quick assessment complete','Tes singkat selesai'):t('完整测评已完成','Full assessment complete','Tes lengkap selesai')}
    </p>
    <h2>{heading}</h2>
    {guidance?.review&&<p className="chat-assessment-review">{guidance.review}</p>}
    {result.saveStatus!=='saved'&&<p className="chat-assessment-review" role="status">
      {t('结果暂未同步。','Results have not synced yet.','Hasil belum tersinkron.')}
    </p>}
    <button type="button" className="chat-enrollment-next" onClick={onDetails}>{t('查看详细结果','View detailed results','Lihat hasil lengkap')}</button>
  </section>;
}

export function StandaloneChatDialog({title,closeLabel,onClose,children,wide=false,locked=false,variant}:{
  title:string;closeLabel:string;onClose:()=>void;children:ReactNode;wide?:boolean;locked?:boolean;variant?:'retake'|'assessment-report';
}){
  const dialog=useRef<HTMLDialogElement>(null);
  const label=useId();
  useEffect(()=>{
    const el=dialog.current;
    el?.showModal();
    return ()=>el?.close();
  },[]);
  return <dialog ref={dialog} className={`standalone-chat-dialog${wide?' is-wide':''}`} aria-labelledby={label} data-chat-dialog={variant}
    onCancel={event=>{event.preventDefault();event.stopPropagation();if(!locked)onClose();}}>
    <header><h2 id={label}>{title}</h2><button type="button" className="chat-dialog-close" aria-label={closeLabel} disabled={locked} onClick={onClose}><X size={19}/></button></header>
    <div className="chat-dialog-body">{children}</div>
  </dialog>;
}
