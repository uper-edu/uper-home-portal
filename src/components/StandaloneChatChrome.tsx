import {useEffect,useId,useRef,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight,ChevronDown,ChevronRight,ClipboardCheck,Globe,Maximize2,Minimize2,MoreHorizontal,X} from 'lucide-react';
import {chooseText,type HskLanguage,type HskResult} from '../data/hskAssessment';
import {learnerAssessmentGuidance} from '../data/hskLearnerGuidance';
import {isPlainLinkClick} from '../utils/chatJourneyNavigation';

export type ChatPresentation = 'page' | 'panel' | 'mobile' | 'expanded';

type Translate = (zh:string,en:string,id:string)=>string;
type HeaderAction = {label:string; onClick:()=>void; disabled?:boolean} | {label:string; href:string};

function HeaderDisclosure({trigger,label,group,children}:{
  trigger:ReactNode;label:string;group:string;children:(close:()=>void)=>ReactNode;
}){
  const disclosure=useRef<HTMLDetailsElement>(null);
  const summary=useRef<HTMLElement>(null);
  function close(returnFocus=false){
    if(disclosure.current)disclosure.current.open=false;
    if(returnFocus)summary.current?.focus();
  }
  return <details name={group} className="chat-header-disclosure" ref={disclosure}
    onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))close();}}
    onKeyDown={event=>{
      if(event.key==='Escape'&&disclosure.current?.open){event.preventDefault();close(true);}
    }}>
    <summary ref={summary} aria-label={label}>{trigger}</summary>
    <div className="chat-header-popover" role="group" aria-label={label}>
      {children(()=>close(true))}
    </div>
  </details>;
}

const languageNames: Record<HskLanguage,string>={zh:'中文',en:'English',id:'Bahasa Indonesia'};

export function StandaloneChatHeader({lang,onLanguageChange,actions,name,assessment=false,inactive,presentation='page',enrollmentReturn,linkHubReturn,onDismiss,onExpand}:{
  lang:HskLanguage;onLanguageChange:(language:HskLanguage)=>void;actions:HeaderAction[];name?:string;assessment?:boolean;inactive?:boolean;
  presentation?:ChatPresentation;enrollmentReturn?:{href:string;label:string;onReturn:()=>void};onDismiss?:()=>void;onExpand?:()=>void;
  linkHubReturn?:string;
}){
  const group=useId();
  const t:Translate=(zh,en,id)=>chooseText(lang,zh,en,id);
  const languageLabel=t('页面语言','Page language','Bahasa halaman');
  const dismissLabel = presentation === 'expanded' ? t('收起咨询','Minimize consultation','Perkecil konsultasi') :
    t('关闭咨询','Close consultation','Tutup konsultasi');
  return <header className="standalone-chat-header" inert={inactive}>
    <div className="chat-header-brand">
      {presentation==='page'&&!assessment&&(enrollmentReturn?
        <Link className="chat-header-back chat-enrollment-back" to={enrollmentReturn.href} onClick={event=>{
          if (!isPlainLinkClick(event)) return;
          event.preventDefault();
          enrollmentReturn.onReturn();
        }}><ArrowLeft size={17} aria-hidden="true"/>{enrollmentReturn.label}</Link>:
        linkHubReturn?<Link className="chat-header-back chat-enrollment-back" to={linkHubReturn}>
          <ArrowLeft size={17} aria-hidden="true"/>{t('全部入口','All links','Semua tautan')}
        </Link>:<Link className="chat-header-back" to="/" aria-label={t('返回首页','Return to home','Kembali ke beranda')}><ArrowLeft size={19} aria-hidden="true"/></Link>)}
      {!assessment&&<img src="/uper-logo-mark.svg" width="22" height="26" alt=""/>}
      <span>{assessment?t('HSK 分班参考测评','HSK placement assessment','Tes penempatan HSK'):
        t('UPER 学习咨询','UPER Learning Advisory','Konsultasi Belajar UPER')}</span>
    </div>
    <div className="chat-header-actions">
      {!assessment&&<HeaderDisclosure group={group} label={languageLabel+', '+languageNames[lang]} trigger={<>
          <Globe size={15} className="chat-header-globe"/><span>{lang==='id'?'Indonesia':languageNames[lang]}</span><ChevronDown size={14}/>
        </>}>
          {close=>(Object.keys(languageNames) as HskLanguage[]).map(language=><button key={language} type="button"
            aria-pressed={lang===language} onClick={()=>{onLanguageChange(language);close();}}>{languageNames[language]}</button>)}
        </HeaderDisclosure>}
        {!assessment&&!!actions.length&&<HeaderDisclosure group={group} label={t('更多操作','More actions','Tindakan lainnya')} trigger={<MoreHorizontal size={20}/>}>
          {close=><>
            {name&&<p className="chat-header-profile">{name}</p>}
            {actions.map(action=>'href' in action
              ? <a key={action.label} href={action.href} target="_blank" rel="noopener noreferrer" onClick={close}>{action.label}</a>
              : <button key={action.label} type="button" disabled={action.disabled} onClick={()=>{close();action.onClick();}}>{action.label}</button>)}
          </>}
        </HeaderDisclosure>}
      {presentation==='panel'&&onExpand&&<button type="button" className="chat-header-back" onClick={onExpand}
        aria-label={t('展开继续咨询','Continue in full chat','Lanjutkan di halaman chat')} title={t('展开','Expand','Perbesar')}><Maximize2 size={17}/></button>}
      {onDismiss&&<button type="button" className="chat-header-back" onClick={onDismiss} data-chat-host-dismiss
        aria-label={dismissLabel} title={dismissLabel}>{presentation==='expanded'?<Minimize2 size={17}/>:<X size={19}/>}</button>}
    </div>
  </header>;
}

export function ChatWelcome({lang,hasDraft,hasResult,onAssessment,onPrompt}:{
  lang:HskLanguage;hasDraft:boolean;hasResult:boolean;onAssessment:()=>void;onPrompt:(prompt:string)=>void;
}){
  const t:Translate=(zh,en,id)=>chooseText(lang,zh,en,id);
  const prompts=[
    t('零基础怎么选课？','Which course suits a beginner?','Kelas apa yang cocok untuk pemula?'),
    t('周末有哪些班？','What weekend classes are available?','Apa saja kelas akhir pekan?'),
    t('学费怎么算？','How much are the classes?','Berapa biaya kelasnya?'),
  ];
  return <section className="chat-welcome">
    <div className="chat-welcome-mark"><img src="/uper-logo-mark.svg" alt="" width="23" height="27"/></div>
    <h1>{t('你好，想怎么开始学中文？','How would you like to start learning Chinese?','Bagaimana kamu ingin mulai belajar Mandarin?')}</h1>
    <p>{t('我是 UPER AI 学习顾问。可以问我课程、学费和报名。','I’m UPER’s AI learning advisor. Ask me about courses, tuition, or enrollment.','Saya konsultan belajar AI UPER. Tanyakan tentang kelas, biaya, atau pendaftaran.')}</p>
    <div className="chat-test-offer">
      <span aria-hidden="true"><ClipboardCheck size={20}/></span>
      <div>
        <h2>{t('免费 HSK 摸底测评','Free HSK placement assessment','Tes penempatan HSK gratis')}</h2>
        <p>{hasResult&&!hasDraft?t('查看你上次测评的学习起点。','Review the starting point from your last assessment.','Lihat titik awal dari tes terakhirmu.'):
          t('15 题快测，看看适合从哪里开始。','Take a 15-question check to find a starting point.','Jawab 15 soal untuk mengetahui titik awal belajarmu.')}</p>
      </div>
      <button type="button" className="chat-primary" onClick={onAssessment}>
        {hasDraft?t('继续测评','Resume assessment','Lanjutkan tes'):hasResult?t('查看测评结果','View assessment results','Lihat hasil tes'):
          t('开始免费测评','Start free assessment','Mulai tes gratis')}<ArrowRight size={16} aria-hidden="true"/>
      </button>
    </div>
    <div className="chat-starter-prompts">
      {prompts.map(prompt=><button type="button" key={prompt} onClick={()=>onPrompt(prompt)}>{prompt}<ChevronRight size={15} aria-hidden="true"/></button>)}
    </div>
  </section>;
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
    <button type="button" onClick={onDetails}>{t('查看详细结果','View detailed results','Lihat hasil lengkap')}<ChevronRight size={15} aria-hidden="true"/></button>
  </section>;
}

export function StandaloneChatDialog({title,closeLabel,onClose,children,wide=false,locked=false}:{
  title:string;closeLabel:string;onClose:()=>void;children:ReactNode;wide?:boolean;locked?:boolean;
}){
  const dialog=useRef<HTMLDialogElement>(null);
  const label=useId();
  useEffect(()=>{
    const el=dialog.current;
    el?.showModal();
    return ()=>el?.close();
  },[]);
  return <dialog ref={dialog} className={`standalone-chat-dialog${wide?' is-wide':''}`} aria-labelledby={label}
    onCancel={event=>{event.preventDefault();if(!locked)onClose();}}>
    <header><h2 id={label}>{title}</h2><button type="button" className="chat-dialog-close" aria-label={closeLabel} disabled={locked} onClick={onClose}><X size={19}/></button></header>
    <div className="chat-dialog-body">{children}</div>
  </dialog>;
}
