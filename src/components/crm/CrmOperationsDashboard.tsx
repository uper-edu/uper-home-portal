import {enrollmentPaymentPath,enrollmentVerificationPath as financePath} from '../../utils/financeNavigation';
import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {ArrowUpRight,Maximize,Minimize,SlidersHorizontal} from 'lucide-react';
import {AdminTopicFrame} from '../AdminTopicFrame';
import {AdminContentNav} from '../admin/AdminContentNav';
import {AdminPageHeader} from '../admin/AdminPageHeader';
import {AdminPageAction} from '../admin/AdminPageAction';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {AdminDateField} from '../admin/AdminDateField';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {CrmDashboardKpiList} from './CrmDashboardKpiList';
import {canManageDashboardKpi,dashboardAdSpendScale,dashboardChannelKey,dashboardFormats,dashboardKpiMonthProgress,dashboardLandingPages,dashboardLevels,dashboardPath,dashboardPeriods,dashboardScopes,dashboardTopics,readDashboardFilters,
  dashboardChannelLeaders,dashboardPaymentSampleIssue,dashboardRateComparisonMinimum,dashboardSupply,
  type DashboardAdSpend,type DashboardCash,type DashboardEconomicsRow,type DashboardEnrollmentFunnel,type DashboardFilters,type DashboardKpiTarget,type DashboardLandingPage,type DashboardMovementPage,
  type EnrollmentFunnelCounts,
  type DashboardLandingCounts,type DashboardSnapshot,type DashboardSource,type DashboardSources,type DashboardTeaching,type DashboardTeachingRow,type DashboardTopic,
  type DashboardTraffic,type DashboardTrafficChannel} from '../../utils/crmOperationsDashboard';
import type {AccessEmployee} from '../../utils/accessControl';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {enrollmentClassManagementPath,enrollmentClassShortfall,type EnrollmentClassSummary} from '../../utils/crmEnrollmentManagement';
import {enrollmentClassTitle,enrollmentPeriods} from '../../utils/enrollmentCatalog';
import {crmInstant,formatCrmEventTime,formatCrmOperatingTime} from '../../utils/crmOperatingTime';
import {formatCurrency} from '../../utils/currency';
import {promotionKindForMedium} from '../../utils/promotionNavigation';
import {dashboardLabel,type DashboardWord} from './crmOperationsDashboardText';
import {salesWallboardApi,type SalesWallboardSnapshot,type WallboardClass} from '../../utils/salesWallboard';
import {readAdminLanguage} from '../../utils/adminLanguagePreference';
import './crm-operations-dashboard.css';

type Translate=(key:DashboardWord)=>string;
const TeacherSettlements=lazy(()=>import('./CrmTeacherSettlements').then(module=>({default:module.CrmTeacherSettlements})));
const languageTag={zh:'zh-CN',en:'en-GB',id:'id-ID'} as const;
const salesPath='/crm?tab=leads';
const cashComponents=['received','refunded','returned','net'] as const;
type CashComponent=typeof cashComponents[number];
const readLocation=()=>{
  const p=new URLSearchParams(window.location.search);
  const topic=dashboardTopics.find(topic=>topic===p.get('dashboardTopic'))??'overview';
  return {topic,filter:readDashboardFilters(p),kpiList:topic==='overview'&&p.get('dashboardKpi')==='plans'};
};
const filterDefaults=readDashboardFilters(new URLSearchParams());
const periodOptions:DashboardWord[]=['month','week','days','custom'];
const sameDate=(a:string,b:string)=>a===b?a:a+' – '+b;
const formatWib=(at:string)=>formatCrmOperatingTime(at,'Asia/Jakarta');
const landingTitle=(key:DashboardLandingPage,t:Translate)=>key==='homepage'?t('homeLanding'):
  key==='unknown'?t('unknownLanding'):key==='other'?t('otherLanding'):'/'+key;
const landingCount=(landings:DashboardLandingCounts,key:DashboardLandingPage,homeDays?:number)=>
  key==='homepage'&&!homeDays?'—':landings[key];
const gaSourceTitle=(row:Pick<DashboardTrafficChannel,'source'|'medium'>,t:Translate)=>{
  if(row.source==='(direct)')return t('directTraffic');
  return [row.source,row.medium].filter(value=>value!=='(not set)'&&value!=='(none)').join(' · ')||t('unattributed');
};
const gaDates=(data:DashboardTraffic)=>sameDate(data.from,data.to)+' · WIB';
const gaFreshness=(data:DashboardTraffic,t:Translate)=>t('gaSnapshotTime')+' '+formatWib(data.fetchedAt)+' WIB';
const gaCoverage=(data:DashboardTraffic,t:Translate)=>t('gaDaysCovered')+' '+data.coveredDays+' / '+data.expectedDays;
const enrollmentFunnelCoverage=(data:DashboardEnrollmentFunnel,t:Translate)=>
  t('enrollmentFunnel')+' · '+sameDate(data.firstCovered,data.lastCovered)+' WIB · '+t('gaDaysCovered')+' '+data.coveredDays+' / '+data.expectedDays;
function paymentSampleNote(metrics:DashboardSnapshot['current'],t:Translate,count:(value:number)=>string){
  const issue=dashboardPaymentSampleIssue(metrics);
  if(!issue)return null;
  if(issue==='missingTime')return t(issue)+' · '+count(metrics.timingUnknown);
  return t(issue)+(metrics.observing?' · '+count(metrics.observing):'');
}

function useDashboard<T=DashboardSnapshot>(url:string,accessKey:string,enabled:boolean,polling:boolean,revision:number,credentials?:RequestCredentials){
  const key=url+'|'+accessKey;
  const [state,setState]=useState<{key:string;snapshot?:T;error?:number}>({key:''});
  const [loading,setLoading]=useState(enabled);
  useEffect(()=>{
    if(!enabled)return;
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>|undefined;
    const read=async()=>{
      setLoading(true);
      try{
        const response=await fetch(url,{signal:controller.signal,cache:'no-store',credentials});
        if(!response.ok){
          if(!controller.signal.aborted)setState(prior=>({key,error:response.status,
            snapshot:response.status>=500&&prior.key===key?prior.snapshot:undefined}));
          return;
        }
        const snapshot:T=await response.json();
        if(!controller.signal.aborted)setState({key,snapshot});
      }catch{
        if(!controller.signal.aborted)setState(prior=>({key,error:503,snapshot:prior.key===key?prior.snapshot:undefined}));
      }finally{
        if(!controller.signal.aborted){
          setLoading(false);
          if(polling)timer=setTimeout(()=>void read(),60_000);
        }
      }
    };
    void read();
    return ()=>{controller.abort();if(timer)clearTimeout(timer);};
  },[key,url,enabled,polling,revision,credentials]);
  return {...(enabled&&state.key===key?state:{}),loading:enabled&&(loading||state.key!==key)};
}

function Panel({title,children,aside,className=''}:{title:string;children:ReactNode;aside?:ReactNode;className?:string}){
  return <section className={'ops-dash-panel '+className}>
    <header><h2>{title}</h2>{aside}</header>
    {children}
  </section>;
}

function Table({headers,children}:{headers:string[];children:ReactNode}){
  return <div className="ops-dash-table-scroll"><table>
    <thead><tr>{headers.map(header=><th scope="col" key={header}>{header}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table></div>;
}

function Link({href,children,onNavigate}:{href:string;children:ReactNode;onNavigate?:(href:string)=>void}){
  return <a className="ops-dash-link" href={href} onClick={event=>{
    if(!onNavigate||event.defaultPrevented||event.button||event.ctrlKey||event.altKey||event.shiftKey||event.metaKey)return;
    event.preventDefault();onNavigate(href);
  }}>{children}<ArrowUpRight aria-hidden="true" size={15}/></a>;
}

function NumberCard({label,value,note,onClick}:{label:string;value:ReactNode;note?:ReactNode;onClick?:()=>void}){
  const contents=<><span className="ops-dash-kpi-label">{label}{onClick&&<ArrowUpRight size={15} aria-hidden="true"/>}</span>
    <strong>{value}</strong>{note&&<small>{note}</small>}</>;
  return onClick?<button type="button" className="ops-dash-kpi" onClick={onClick}>{contents}</button>:
    <article className="ops-dash-kpi">{contents}</article>;
}

function DashboardDelta({value,format=String,unit}:{value:number;format?:(value:number)=>string;unit?:string}){
  const tone=value>0?'success':value<0?'warning':undefined;
  return <strong className="ops-dash-delta" data-tone={tone}>
    {value>0?'+':value<0?'−':''}{format(Math.abs(value))}{unit?' '+unit:''}
  </strong>;
}

function Trend({title,series,comparison,display,t,onDay,maximum}:{title:string;series:{date:string;value:number}[];
  comparison?:{date:string;value:number}[];display:(value:number)=>string;t:Translate;onDay?:(date:string)=>void;maximum?:number}){
  const [active,setActive]=useState('');
  if(!series.length)return <Panel title={title}><p>{t('noSamples')}</p></Panel>;
  const values=[...series.map(row=>row.value),...(comparison?.map(row=>row.value)??[])];
  const min=Math.min(0,...values),max=Math.max(1,maximum??0,...values);
  const baseline=-min/(max-min)*100;
  const bar=(value:number)=>({height:Math.abs(value)/(max-min)*100+'%',
    bottom:(value<0?(value-min)/(max-min)*100:baseline)+'%'});
  const activeRow=series.find(row=>row.date===active);
  const activePrevious=comparison?.[series.findIndex(row=>row.date===active)];
  return <Panel title={title} aside={activeRow&&<span>{activeRow.date} · {display(activeRow.value)}
    {activePrevious&&' · '+t('previous')+' '+activePrevious.date+' · '+display(activePrevious.value)}</span>}>
    <div className="ops-dash-trend" aria-hidden={!onDay}>
      <div className="ops-dash-baseline" style={{bottom:baseline+'%'}} aria-hidden="true"/>
      {series.map((row,index)=>{
        const previous=comparison?.[index];
        const value=<><span className="ops-dash-trend-bar" style={bar(row.value)}
          data-negative={row.value<0||undefined}/>
          {previous&&<span className="ops-dash-trend-bar previous" style={bar(previous.value)}
            data-negative={previous.value<0||undefined}/>}</>;
        const label=row.date+' · '+display(row.value)+(previous?' · '+t('previous')+' '+previous.date+' · '+display(previous.value):'');
        return onDay?<button type="button" key={row.date} className="ops-dash-trend-slot" data-active={active===row.date||undefined}
          tabIndex={active===row.date||!active&&index===0?0:-1} title={label} aria-label={label}
          onKeyDown={event=>{
            const next=event.key==='ArrowRight'?event.currentTarget.nextElementSibling:event.key==='ArrowLeft'?event.currentTarget.previousElementSibling:null;
            if(next instanceof HTMLButtonElement){event.preventDefault();next.focus();}
          }} onClick={()=>{setActive(row.date);onDay(row.date);}} onFocus={()=>setActive(row.date)} onMouseEnter={()=>setActive(row.date)}>{value}</button>:
          <span key={row.date} className="ops-dash-trend-slot" title={label}
            onMouseEnter={()=>setActive(row.date)}>{value}</span>;
      })}
    </div>
    <div className="ops-dash-axis" aria-hidden="true"><span>{series[0].date}</span><span>{series.at(-1)?.date}</span></div>
    {comparison&&<p className="ops-dash-caption"><i aria-hidden="true"/> {t('period')} <i className="previous" aria-hidden="true"/> {t('previous')}</p>}
    <AdminDisclosure heading={t('showData')} density="compact">
      <Table headers={[t('date'),t('period'),...(comparison?[t('previous')]:[])]}>
        {series.map((row,index)=><tr key={row.date}><th scope="row">{row.date}</th><td>{display(row.value)}</td>
          {comparison&&<td>{comparison[index]?comparison[index].date+' · '+display(comparison[index].value):'—'}</td>}</tr>)}
      </Table>
    </AdminDisclosure>
  </Panel>;
}

function Capacity({row,t}:{row:WallboardClass;t:Translate}){
  const held=Math.max(0,row.occupied-row.counts.paid);
  const width=(count:number)=>Math.min(100,100*count/Math.max(1,row.capacity))+'%';
  return <>
    <div className="ops-dash-capacity" aria-hidden="true">
      <i style={{width:width(row.counts.paid)}}/><i className="reserved" style={{width:width(Math.min(held,Math.max(0,row.capacity-row.counts.paid))),left:width(row.counts.paid)}}/>
      {row.minimumPaid>0&&<i className="goal" style={{left:width(row.minimumPaid)}}/>}
    </div>
    <small className="ops-dash-capacity-values">
      <span>{t('openingGoal')} {row.counts.paid} / {row.minimumPaid}</span>{' · '}
      <span>{t('held')} {held}</span>{' · '}
      <span>{t('available')} {row.available}</span>
    </small>
  </>;
}

function Upcoming({rows,t,lang,limited,onNavigate,pendingByClass,publicLayout=false}:{rows:WallboardClass[];t:Translate;lang:CrmLanguage;
  limited?:boolean;onNavigate?:(href:string)=>void;pendingByClass?:Record<string,number>;publicLayout?:boolean}){
  return <Panel title={t('nextClasses')} aside={<span>{t('last14')}</span>} className="ops-dash-upcoming">
    {rows.length?<ul>{(limited?rows.slice(0,3):rows).map(row=>{
      const gap=enrollmentClassShortfall(row);
      const title=enrollmentClassTitle(row,lang);
      const pending=pendingByClass?(Object.hasOwn(pendingByClass,row.id)?pendingByClass[row.id]:0):undefined;
      const ready=t(row.status==='opened'?'openingDone':'openingGoal');
      if(publicLayout){
        const first=crmInstant(row.firstLessonAt);
        const wib=formatWib(row.firstLessonAt);
        return <li key={row.id}>
          <div className="ops-dash-tv-class-priority">
            <div className="ops-dash-tv-first-class">
              <span>{t('classStart')}</span>
              {first?<time dateTime={first.toISOString()} title={wib+' WIB'}>{wib.slice(0,16)} WIB</time>:
                <span>{t('tvMissingData')}</span>}
            </div>
            <span className="ops-dash-tag" data-tone={gap?'warning':'success'}>
              {gap?<>{t('tvActiveShortage')} <b>{gap} {t('tvLearnerUnit')}</b></>:ready}
            </span>
          </div>
          <p className="ops-dash-class-meta">
            <strong>{title}</strong>
            {pending!==undefined&&<small>{t('tvClassPending')} · {pending}</small>}
          </p>
          <Capacity row={row} t={t}/>
        </li>;
      }
      return <li key={row.id}>
        <div className="ops-dash-class-head">
          {onNavigate?<Link href={enrollmentClassManagementPath(row.id)} onNavigate={onNavigate}>{title}</Link>:<strong>{title}</strong>}
          <span className="ops-dash-tag" data-tone={gap?'warning':'success'}>
            {gap?<>{t('missingSeats')} <b>{gap}</b></>:ready}
          </span>
        </div>
        <p className="ops-dash-subvalue ops-dash-class-meta">
          <span>{t('classStart')} · {formatWib(row.firstLessonAt)} WIB</span>
          {pending!==undefined&&<span>{t('tvClassPending')} · {pending}</span>}
        </p>
        <Capacity row={row} t={t}/>
      </li>;
    })}</ul>:<p>{t('noSamples')}</p>}
  </Panel>;
}

function Queue({data,t,wallboard=false,publicLayout=false,onNavigate,lang='zh'}:{data:Pick<SalesWallboardSnapshot,'queue'|'followup'|'demand'>;t:Translate;wallboard?:boolean;publicLayout?:boolean;
  onNavigate?:(href:string)=>void;lang?:CrmLanguage}){
  const rows:[DashboardWord,number|undefined,string?,string?][]=[
    ['review',data.queue?.pending,financePath,wallboard&&data.queue?t('tvCurrentQueueAge')+' · '+data.queue.reviewAges.atLeast72:
      data.queue?.oldest?t('oldest')+' · '+formatCrmEventTime(data.queue.oldest):undefined],
    ['pendingRefund',data.queue?.refunds,financePath,wallboard&&data.queue?formatCurrency(data.queue.refundOutstanding,lang):undefined],
    ['overdue',data.followup?.overdue,salesPath],
  ];
  if(wallboard)rows.push(['tvPendingSchedule',data.demand?.filter(row=>row.format==='one-on-one'&&row.state==='active')
    .reduce((sum,row)=>sum+row.count,0)]);
  return <Panel title={t('queue')} className="ops-dash-queue">
    <ul>{rows.map(([key,value,url,note])=>{
      const tone=value?(key==='overdue'?'danger':'warning'):undefined;
      return <li key={key} data-queue-state={publicLayout?(tone??(value===undefined?'unavailable':'clear')):undefined}>
        <strong data-tone={tone}>{value??'—'}</strong>
        <div>{url&&value!==undefined&&!wallboard?<Link href={url} onNavigate={url===financePath?onNavigate:undefined}>{t(key)}</Link>:<span>{t(key)}</span>}
          {value===undefined?<small>{t('denied')}</small>:note?<small>{note}</small>:null}
        </div>
      </li>;
    })}</ul>
  </Panel>;
}

function sourceTitle(row:DashboardSource,t:Translate){
  if(row.kind==='verified')return row.source+' · '+row.medium+(row.campaignCode?' · '+row.campaignCode:'');
  if(row.kind==='website')return t('websiteOnly');
  if(row.kind==='campaign')return row.campaignCode?t('campaignOnly')+' · '+row.campaignCode:t('campaignOnly');
  return t('unattributed');
}

function OverviewTrends({data,t,lang,onDay}:{data:DashboardSnapshot;t:Translate;lang:CrmLanguage;
  onDay:(topic:'sales'|'finance',date:string)=>void}){
  const count=new Intl.NumberFormat(languageTag[lang]);
  const paid=(rows:DashboardSnapshot['trend'])=>rows.map(row=>({date:row.date,value:row.paid}));
  const currency=(amount:number)=>formatCurrency(amount,lang);
  const amounts=(rows:DashboardSnapshot['trend'],kind:'received'|'refunded')=>
    rows.flatMap(row=>row.cash?[{date:row.date,value:row.cash[kind]}]:[]);
  const sharedMaximum=Math.max(1,...[...data.trend,...data.compareTrend].flatMap(row=>row.cash?[row.cash.received,row.cash.refunded]:[]));
  return <div className="ops-dash-trend-stack">
    <Trend title={t('trend')} series={paid(data.trend)} comparison={paid(data.compareTrend)}
      display={value=>count.format(value)} t={t} onDay={date=>onDay('sales',date)}/>
    {data.cash&&<div className="ops-dash-grid">
      {(['received','refunded'] as const).map(kind=><Trend key={kind} title={t(kind==='received'?'receiptTrend':'refundTrend')}
        series={amounts(data.trend,kind)} comparison={amounts(data.compareTrend,kind)} maximum={sharedMaximum}
        display={currency} t={t} onDay={date=>onDay('finance',date)}/>)}
    </div>}
  </div>;
}

type ChangeDimension='level'|'format'|'source';
type ChangeMeasure='paid'|'net';
function OverviewChanges({data,t,lang,isLight,dimension,measure,onDimension,onMeasure,onGroup}:{data:DashboardSnapshot;t:Translate;
  lang:CrmLanguage;isLight:boolean;dimension:ChangeDimension;measure:ChangeMeasure;
  onDimension:(value:ChangeDimension)=>void;onMeasure:(value:ChangeMeasure)=>void;
  onGroup:(dimension:'level'|'format',value:string,measure:ChangeMeasure)=>void}){
  const count=new Intl.NumberFormat(languageTag[lang]);
  const effectiveMeasure=data.cash?measure:'paid';
  const rows=dimension==='level'?data.contributions.map(row=>({...row,key:row.level,label:row.level||t('unclassified')})):
    dimension==='format'?data.formatContributions.map(row=>({...row,key:row.format,
      label:row.format==='standard'||row.format==='small'?t(row.format):row.format||t('unclassified')})):
      data.channelContributions.map(row=>({...row,key:row.source.key,label:sourceTitle(row.source,t)}));
  const value=(row:typeof rows[number])=>effectiveMeasure==='net'?row.net??0:row.paid;
  const previous=(row:typeof rows[number])=>effectiveMeasure==='net'?row.previousNet??0:row.previousPaid;
  const difference=(row:typeof rows[number])=>value(row)-previous(row);
  const display=(amount:number)=>effectiveMeasure==='net'?formatCurrency(amount,lang):count.format(amount);
  const linkable=(value:string)=>dimension==='level'?dashboardLevels.some(level=>level===value):
    dimension==='format'&&dashboardFormats.some(format=>format===value);
  return <Panel title={t('changeDrivers')}>
    <div className="ops-dash-filters">
      <AdminSingleSelect label={t('groupBy')} value={dimension} lang={lang} isLight={isLight}
        options={[{value:'level',label:t('level')},{value:'format',label:t('format')},{value:'source',label:t('byOrderSource')}]}
        onChange={choice=>onDimension(choice as ChangeDimension)}/>
      {data.cash&&<AdminSingleSelect label={t('changeMeasure')} value={effectiveMeasure} lang={lang} isLight={isLight}
        options={[{value:'paid',label:t('paid')},{value:'net',label:t('net')}]}
        onChange={choice=>onMeasure(choice as ChangeMeasure)}/>}
    </div>
    {rows.length?<Table headers={[t(dimension),t('period'),t('previous'),t('versus')]}>
      {rows.sort((a,b)=>Math.abs(difference(b))-Math.abs(difference(a))||a.label.localeCompare(b.label)).map(row=><tr key={row.key}>
        <th scope="row">{dimension!=='source'&&linkable(row.key)?<button type="button" className="ops-dash-link"
          onClick={()=>onGroup(dimension,row.key,effectiveMeasure)}>{row.label}<ArrowUpRight aria-hidden="true" size={15}/></button>:row.label}</th>
        <td>{display(value(row))}</td><td>{display(previous(row))}</td>
        <td><DashboardDelta value={difference(row)} format={display}/></td>
      </tr>)}
    </Table>:<p>{t('noSamples')}</p>}
    {dimension==='source'&&<p className="ops-dash-caption">{t('orderSourceChangeBasis')}</p>}
  </Panel>;
}

function entryTitle(value:string,t:Translate){
  const labels:Record<string,string>={website:t('webEntry'),homepage_widget:t('homeChat'),direct:t('directEntry'),linkhub:'/link',
    ai_chat:'/chat',whatsapp:'WhatsApp',unknown:t('unattributed')};
  return labels[value]??value;
}
function sourceCoverage(rows:DashboardSources[],metric:'orders'|'first'){
  return rows.reduce((coverage,row)=>{
    coverage.total+=row[metric];
    if(row.kind==='verified')coverage.verified+=row[metric];
    return coverage;
  },{total:0,verified:0});
}
function wallboardSourceIdentified(source:DashboardSource){
  return source.kind==='verified'&&Boolean(source.source&&source.medium)&&
    !['(direct)','(not set)','(data not available)','direct','(other)'].includes(source.source)&&
    !['(none)','(not set)','(data not available)'].includes(source.medium);
}

function wallboardChannels(data:SalesWallboardSnapshot){
  type Row={source:DashboardSource;orders:number;eligible:number;paid:number;noProof:number;withProof:number;
    first:number;previousFirst:number;sessions?:number;funnel?:EnrollmentFunnelCounts;spend:Map<string,number>};
  const rows=new Map<string,Row>();
  function channel(source:DashboardSource){
    const key=dashboardChannelKey(source);
    const current=rows.get(key);
    if(current)return current;
    const row:Row={source:{key,kind:source.kind,source:source.source,medium:source.medium},orders:0,eligible:0,
      paid:0,noProof:0,withProof:0,first:0,previousFirst:0,spend:new Map()};
    rows.set(key,row);
    return row;
  }
  for(const outcome of data.wallboard?.channels??[]){
    const row=channel(outcome.source);
    const paid=outcome.paidAfterProof+outcome.paidWithoutPriorProof;
    row.orders=outcome.orders;
    row.eligible=outcome.eligible;
    row.paid=paid;
    row.withProof=outcome.unpaidWithProof;
    row.noProof=outcome.eligible-paid-outcome.unpaidWithProof;
  }
  for(const source of data.sources)if(source.first)channel(source).first+=source.first;
  for(const source of data.compareSources)if(source.first)channel(source).previousFirst+=source.first;
  for(const item of data.wallboard?.traffic?.channels??[]){
    channel({...item,key:'',kind:'verified'}).sessions=item.sessions;
  }
  for(const item of data.wallboard?.enrollmentFunnel?.channels??[]){
    channel({...item,key:'',kind:'verified'}).funnel=item;
  }
  for(const item of data.adSpend?.campaigns??[]){
    if(!item.mapping||!item.channel)continue;
    const {spend}=channel({...item.channel,key:'',kind:'verified'});
    spend.set(item.currency,(spend.get(item.currency)??0)+item.amount);
  }
  const all=[...rows.values()];
  const selected=all.filter(row=>row.first||row.previousFirst||row.orders||row.sessions||row.funnel?.landed||row.spend.size)
    .sort((a,b)=>b.first-a.first||b.orders-a.orders||(b.sessions??0)-(a.sessions??0)||
      (b.funnel?.landed??0)-(a.funnel?.landed??0)||a.source.key.localeCompare(b.source.key));
  const verified=selected.filter(row=>row.source.kind==='verified');
  const paid=verified.filter(row=>[...row.spend.values()].some(amount=>amount>0)).slice(0,2);
  const primary=[...new Set([...paid,...verified])].slice(0,4);
  return [...primary,...selected.filter(row=>row.source.kind!=='verified')];
}

function WallboardChannels({data,rows,t,lang,publicLayout}:{data:SalesWallboardSnapshot;rows:ReturnType<typeof wallboardChannels>;t:Translate;lang:CrmLanguage;publicLayout:boolean}){
  const number=new Intl.NumberFormat(languageTag[lang]);
  const percent=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const traffic=data.wallboard?.traffic;
  const funnel=data.wallboard?.enrollmentFunnel;
  const coverage=sourceCoverage(data.sources,'first');
  const spend=data.adSpend;
  const completeTraffic=Boolean(traffic&&traffic.coveredDays===traffic.expectedDays);
  const leaders=dashboardChannelLeaders(rows.map(row=>({...row,identified:wallboardSourceIdentified(row.source)})),completeTraffic);
  function metric(text:string,leading:boolean,detail?:ReactNode){
    return <td data-column-leader={leading||undefined}>
      <strong>{text}</strong>{detail&&<> <small>{detail}</small></>}
      {leading&&<span className="sr-only"> · {t('tvColumnLeader')}</span>}
    </td>;
  }
  const unavailable=(label:DashboardWord)=><td className="ops-dash-tv-unavailable">{t(label)}</td>;
  return <Panel title={t('tvChannelMatrix')} className="ops-dash-tv-channel-matrix" aside={<span>
    <strong className="ops-dash-tv-leading-key">{t('tvColumnLegend')}</strong> · {t('tvRateRankMinimum')} {dashboardRateComparisonMinimum}
  </span>}>
    <Table headers={[t('source'),t('sessions'),t('tvApplicationRate'),t('sevenDayConversion'),t('firstThisPeriod'),t('adSpend'),t('tvAcquisitionCost')]}>
      {rows.map((row,index)=>{
        const ranked=wallboardSourceIdentified(row.source);
        const medium=row.source.medium;
        const kind=promotionKindForMedium(medium);
        const mediumLabel=kind==='paid'?t('tvPaidMedia'):medium==='organic'?t('tvOrganicSearch'):kind==='unpaid'?t('tvOrganicSocial'):medium;
        const source=ranked?row.source.source+' · '+mediumLabel:row.source.kind==='verified'?gaSourceTitle(row.source,t):sourceTitle(row.source,t);
        const rate=row.eligible?row.paid/row.eligible:undefined;
        const unpaid=kind==='unpaid'||medium==='organic';
        const costState=!ranked?t('tvSourcePending'):!row.spend.size&&unpaid?t('tvNonPaid'):
          publicLayout?t('tvCostReconciliation'):'—';
        return <tr key={row.source.key} data-source-pending={!ranked||undefined}>
          <th scope="row">{source}</th>
          {publicLayout&&row.sessions===undefined?unavailable('tvMissingData'):
            metric(row.sessions===undefined?'—':number.format(row.sessions),leaders[index].sessions)}
          {publicLayout&&!row.funnel?.landed?unavailable(funnel?'tvNoSessionSample':'tvNoSessionData'):
            metric(row.funnel?.landed?percent.format(row.funnel.started/row.funnel.landed):'—',false,
            row.funnel?.landed?number.format(row.funnel.started)+'/'+number.format(row.funnel.landed):undefined)}
          {publicLayout&&rate===undefined?unavailable('tvNoMatureSample'):metric(rate===undefined?'—':percent.format(rate),leaders[index].rate,
            rate!==undefined?<>{number.format(row.paid)}/{number.format(row.eligible)}
              {publicLayout&&row.eligible<dashboardRateComparisonMinimum&&<span className="ops-dash-tv-small-sample">{t('tvLowSample')}</span>}</>:undefined)}
          {metric(number.format(row.first),leaders[index].first,
            <DashboardDelta value={row.first-row.previousFirst} format={value=>number.format(value)}/>)}
          {publicLayout&&kind==='paid'&&!row.spend.size?unavailable('tvNoSpendData'):
            <td><strong>{[...row.spend].map(([currency,amount])=>formatCurrency(amount/dashboardAdSpendScale,lang,currency)).join(' · ')||'—'}</strong></td>}
          <td>{costState}</td>
        </tr>;
      })}
      {!rows.length&&<tr><td colSpan={7}>{t('noSamples')}</td></tr>}
    </Table>
    <p className="ops-dash-caption">{t('tvChannelPeriods')} · {sameDate(data.period.from,data.period.to)} WIB · {t('versus')} {sameDate(data.period.compareFrom,data.period.compareTo)}</p>
    <p className="ops-dash-caption">{traffic?gaCoverage(traffic,t):t('trafficGap')} · {t('sourceCoverage')} {coverage.verified}/{coverage.total}
      {spend?.currencies.map(row=>' · '+t('tvMappedSpend')+' '+row.currency+' '+(row.amount?percent.format(row.mapped/row.amount):'—'))}</p>
    <p className="ops-dash-caption">{funnel?
      <>{t('enrollmentFunnelThrough')} <time dateTime={funnel.lastCovered}>{funnel.lastCovered}</time> WIB
        {' · '+t('gaDaysCovered')+' '+funnel.coveredDays+' / '+funnel.expectedDays}</>:
      t('enrollmentFunnelGap')} · {t('tvNeedsEvents')}</p>
  </Panel>;
}

function WallboardPayment({rows,t,lang,publicLayout}:{rows:ReturnType<typeof wallboardChannels>;t:Translate;lang:CrmLanguage;publicLayout:boolean}){
  const percent=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  return <Panel title={t('tvChannelDrop')} aside={<span>{t('byOrderSource')}</span>}>
    <Table headers={[t('source'),t('orders'),t('tvNoProof'),t('tvWithProof'),t('paid')]}>
      {rows.filter(row=>row.orders).map(row=><tr key={row.source.key}>
        <th scope="row">{sourceTitle(row.source,t)}</th><td>{row.eligible}</td>
        {publicLayout&&!row.eligible?<td colSpan={3} className="ops-dash-tv-unavailable">{t('tvNoMatureSample')}</td>:
          [row.noProof,row.withProof,row.paid].map((count,index)=>{
          const prominent=row.source.kind==='verified'&&index<2&&count>(index===0?row.withProof:row.noProof);
          return <td key={index} className={prominent?'ops-dash-loss-focus':undefined}
            title={prominent?t('tvLossFocus'):undefined}>
            {row.eligible?<>{percent.format(count/row.eligible)} <small>{count}</small></>:'—'}
          </td>;
        })}
      </tr>)}
      {!rows.some(row=>row.orders)&&<tr><td colSpan={5}>{t('noSamples')}</td></tr>}
    </Table>
    <p className="ops-dash-caption">{t('completedWindow')} · {t('tvTopChannels')} · <span className="ops-dash-loss-key">{t('tvLossFocus')}</span></p>
  </Panel>;
}

function WallboardSupply({data,t,publicLayout}:{data:SalesWallboardSnapshot;t:Translate;publicLayout:boolean}){
  const groups=dashboardSupply(data.upcoming,data.demand);
  const shownLevels=dashboardLevels.filter(level=>groups.some(row=>row.level===level));
  return <Panel title={t('tvSupply')} className="ops-dash-tv-supply" aside={<span>{t('tvSupplyLegend')}</span>}>
    <Table headers={[t('level'),t('weekday'),t('weekend'),t('mixed')]}>
      {shownLevels.map(level=><tr key={level}>
        <th scope="row">{level}</th>
        {enrollmentPeriods.map(period=>{
          const value=groups.find(row=>row.level===level&&row.period===period);
          return <td key={period} title={value?t('tvSupplyBasis'):undefined} data-shortage={Boolean(value?.waiting&&!value.seats)||undefined}>
            {value?publicLayout?<span className="ops-dash-tv-supply-values">
              <span>{value.waiting}</span><span aria-hidden="true">·</span>
              <span>{data.demand?value.requests:'—'}</span><span aria-hidden="true">·</span>
              <strong>{value.seats}</strong>
            </span>:<>{value.waiting} · {data.demand?value.requests:'—'} · <strong>{value.seats}</strong></>:'—'}
          </td>;
        })}
      </tr>)}
      {!shownLevels.length&&<tr><td colSpan={4}>{t('noSamples')}</td></tr>}
    </Table>
    <p className="ops-dash-caption">{t('tvSupplyNote')}</p>
  </Panel>;
}

function WallboardSeries({series,format,dates}:{series:{date:string;current:number;previous:number}[];format:(value:number)=>string;dates:boolean}){
  const values=series.flatMap(row=>[row.current,row.previous]);
  const min=Math.min(0,...values)*1.25,max=Math.max(1,...values)*1.25;
  const axis=-min/(max-min)*100;
  const position=(value:number)=>({
    height:Math.abs(value)/(max-min)*100+'%',
    bottom:(value<0?(value-min)/(max-min)*100:axis)+'%',
  });
  return <div className="ops-dash-tv-chart">
    {series.map(row=><div key={row.date} aria-label={row.date+' · '+format(row.current)+' / '+format(row.previous)} role="img">
      <div className="ops-dash-tv-bars" aria-hidden="true">
        <span style={{bottom:axis+'%'}}/>
        <i className="prior" style={position(row.previous)} data-negative={row.previous<0||undefined}/>
        <i style={position(row.current)} data-negative={row.current<0||undefined}><b>{format(row.current)}</b></i>
      </div>
      {dates&&<small>{row.date.slice(5)}</small>}
    </div>)}
  </div>;
}

function WallboardTrend({data,t,lang,publicLayout}:{data:SalesWallboardSnapshot;t:Translate;lang:CrmLanguage;publicLayout:boolean}){
  const rows=data.wallboard?.dailyPaid??[];
  const hasCash=rows.some(row=>row.net!==null&&row.net!==undefined);
  const amounts=rows.flatMap(row=>row.net!=null&&row.previousNet!=null?[{date:row.date,current:row.net,previous:row.previousNet}]:[]);
  const compact=new Intl.NumberFormat(languageTag[lang],{notation:'compact',maximumFractionDigits:1});
  return <Panel title={t(publicLayout?'tvSevenDayTrend':'trend')} className="ops-dash-tv-trend">
    <strong>{t('tvTrendCount')}</strong>
    <WallboardSeries series={rows.map(row=>({date:row.date,current:row.paid,previous:row.previous}))}
      dates={!hasCash} format={value=>String(value)}/>
    {hasCash?<><strong>{t('tvTrendCash')} · Rp</strong>
      <WallboardSeries series={amounts} dates format={value=>compact.format(value)}/>
    </>:<small>{t('tvTrendCash')} · {t('denied')}</small>}
    <p className="ops-dash-caption"><i/> {t('recentDays')} <i className="previous"/> {t('tvPriorSeven')}</p>
  </Panel>;
}

function WallboardLevelChanges({data,t,lang}:{data:SalesWallboardSnapshot;t:Translate;lang:CrmLanguage}){
  const levels=['HSK 1','HSK 2','HSK 3','HSK 4'];
  const groups=new Map(levels.map(level=>[level,{paid:0,previous:0}]));
  const other={paid:0,previous:0};
  for(const row of data.contributions){
    const level=row.level==='HSK 4A'||row.level==='HSK 4B'?'HSK 4':row.level;
    const total=groups.get(level)??other;
    total.paid+=row.paid;
    total.previous+=row.previousPaid;
  }
  if(other.paid||other.previous)groups.set(t('tvChangeOther'),other);
  const rows=[...groups].map(([level,{paid,previous}])=>({level,paid,previous,change:paid-previous}));
  const count=new Intl.NumberFormat(languageTag[lang]);
  const number=(value:number)=>count.format(value);
  const scale=Math.max(1,...rows.map(row=>Math.abs(row.change)));
  const largestGain=rows.reduce<(typeof rows)[number]|undefined>((top,row)=>row.change>(top?.change??0)?row:top,undefined);
  const largestLoss=rows.reduce<(typeof rows)[number]|undefined>((top,row)=>row.change<(top?.change??0)?row:top,undefined);
  return <Panel title={t('tvLevelChanges')} className="ops-dash-tv-changes">
    {rows.some(row=>row.paid||row.previous)?<>
      <p className="ops-dash-caption ops-dash-tv-changes-summary">
        <span>{t('tvTrendCount')} <DashboardDelta value={data.current.paid-data.compare.paid} format={number}/></span>
        {[largestGain,largestLoss].map(row=>row&&<span key={row.level}>{row.level} <DashboardDelta value={row.change} format={number}/></span>)}
      </p>
      <Table headers={[t('level'),t('tvChangeThisMonth'),t('tvKpiComparison'),t('tvChangeDifference')]}>
        {rows.map(row=><tr key={row.level}>
          <th scope="row">{row.level}</th><td>{number(row.paid)}</td><td>{number(row.previous)}</td>
          <td><div className="ops-dash-tv-change-cell">
            <span className="ops-dash-tv-change-axis" aria-hidden="true">
              {row.change!==0&&<i data-direction={row.change>0?'gain':'loss'} style={{width:Math.abs(row.change)/scale*50+'%'}}/>}
            </span>
            <DashboardDelta value={row.change} format={number}/>
          </div></td>
        </tr>)}
      </Table>
    </>:<p className="ops-dash-caption">{t('noSamples')}</p>}
  </Panel>;
}

function WallboardIntake({data,t,lang}:{data:SalesWallboardSnapshot;t:Translate;lang:CrmLanguage}){
  const traffic=data.traffic;
  const number=new Intl.NumberFormat(languageTag[lang]);
  const percent=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const current=new Map(data.reservationOutcomes.entries.map(row=>[row.key,row]));
  const recent=new Map(data.latestEntries.map(row=>[row.entry,row.count]));
  const entries=[...new Set([...current.keys(),...recent.keys()])];
  function totals(keys:string[]){
    return keys.reduce((sum,key)=>{
      const row=current.get(key);
      return {orders:sum.orders+(row?.orders??0),observed:sum.observed+(row?.eligible??0),
        paid:sum.paid+(row?row.paidAfterProof+row.paidWithoutPriorProof:0),recent:sum.recent+(recent.get(key)??0)};
    },{orders:0,observed:0,paid:0,recent:0});
  }
  const rows=entries.slice(0,4).map(key=>({key,label:entryTitle(key,t),...totals([key])}));
  if(entries.length>4)rows.push({key:'',label:t('tvOtherEntry'),...totals(entries.slice(4))});
  const max=Math.max(1,...dashboardLandingPages.map(key=>traffic?.landings[key]??0));
  return <Panel title={t('tvIntake')} className="ops-dash-tv-intake">
    <div className="ops-dash-tv-intake-grid">
      <section>
        <h3>{t('tvLandingGroup')}</h3>
        {traffic?<>
          <p className="ops-dash-caption">{t('sessions')} <strong>{number.format(traffic.sessions)}</strong> · {gaCoverage(traffic,t)}</p>
          <ul className="ops-dash-tv-landing-bars" aria-label={t('sessions')}>
            {dashboardLandingPages.map(key=>{
              const value=landingCount(traffic.landings,key,traffic.homepageCoveredDays);
              return <li key={key}>
              <span>{landingTitle(key,t)}</span>
              <span className="ops-dash-tv-landing-track" aria-hidden="true">
                {typeof value==='number'&&<i style={{width:value/max*100+'%'}}/>}
              </span>
              <strong>{typeof value==='number'?number.format(value):value}</strong>
            </li>;})}
          </ul>
          {(traffic.homepageCoveredDays??0)<traffic.coveredDays&&<p className="ops-dash-caption">
            {t('homeLandingCoverage')} {traffic.homepageCoveredDays??0} / {traffic.coveredDays}
          </p>}
        </>:<p className="ops-dash-caption">{t('trafficGap')}</p>}
      </section>
      <section>
        <h3>{t('tvOrderEntryGroup')}</h3>
        {rows.length?<Table headers={[t('tvEntryColumn'),t('tvMonthReservations'),t('sevenDayConversion'),t('tvRecentReservations')]}>
          {rows.map(row=><tr key={row.key}>
            <th scope="row">{row.label}</th>
            <td>{number.format(row.orders)}</td>
            <td>{row.observed?<>{percent.format(row.paid/row.observed)} <small>{row.paid}/{row.observed}</small></>:'—'}</td>
            <td>{number.format(row.recent)}</td>
          </tr>)}
        </Table>:<p className="ops-dash-caption">{t('noSamples')}</p>}
      </section>
    </div>
  </Panel>;
}

function AcquisitionSources({data,t,lang,canManageCampaigns}:{data:DashboardSnapshot;t:Translate;lang:CrmLanguage;canManageCampaigns:boolean}){
  const orderCoverage=sourceCoverage(data.sources,'orders');
  const firstCoverage=sourceCoverage(data.sources,'first');
  const previous=new Map(data.compareSources.filter(row=>row.first).map(row=>[row.key,row]));
  const labels=new Map([...previous,...data.sources.filter(row=>row.first).map(row=>[row.key,row] as const)]);
  const current=new Map(data.sources.map(row=>[row.key,row.first]));
  const first=[...labels.values()].map(row=>({row,current:current.get(row.key)??0,previous:previous.get(row.key)?.first??0}))
    .sort((a,b)=>b.current-a.current||b.previous-a.previous||a.row.key.localeCompare(b.row.key));
  const orders=data.sources.filter(row=>row.orders).sort((a,b)=>b.orders-a.orders||a.key.localeCompare(b.key));
  const percent=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const name=(row:DashboardSources)=>{
    const label=sourceTitle(row,t);
    return canManageCampaigns&&row.campaignId?<Link href={'/crm?tab=campaigns&campaign='+encodeURIComponent(row.campaignId)}>{label}</Link>:label;
  };
  const totals=(coverage:ReturnType<typeof sourceCoverage>)=>
    <b>{coverage.verified} / {coverage.total}{coverage.total>0&&' · '+percent.format(coverage.verified/coverage.total)}</b>;
  return <div className="ops-dash-grid">
    <Panel title={t('byOrderSource')} className="ops-dash-sources">
      {orders.length?<Table headers={[t('source'),t('orders'),t('sevenDayConversion')]}>
        {orders.map(row=><tr key={row.key}>
          <th scope="row">{name(row)}</th><td>{row.orders}</td>
          <td>{row.mature?<>{percent.format(row.paidWithinWindow/row.mature)} <small className="ops-dash-subvalue">({row.paidWithinWindow}/{row.mature})</small></>:'—'}</td>
        </tr>)}
      </Table>:<p>{t('noSamples')}</p>}
      <p className="ops-dash-caption">{t('sourceCoverage')} {totals(orderCoverage)}</p>
      <p className="ops-dash-caption">{t('sourceCohortBasis')}</p>
    </Panel>
    <Panel title={t('byFirstSource')} aside={canManageCampaigns?<Link href="/crm?tab=campaigns&campaignArea=sources">{t('sourceReview')}</Link>:undefined}>
      {first.length?<Table headers={[t('source'),t('firstThisPeriod'),t('firstPreviousPeriod'),t('versus')]}>
        {first.map(({row,current,previous})=><tr key={row.key}>
          <th scope="row">{name(row)}</th><td>{current}</td><td>{previous}</td>
          <td><DashboardDelta value={current-previous}/></td>
        </tr>)}
      </Table>:<p>{t('noSamples')}</p>}
      <p className="ops-dash-caption">{t('sourceCoverage')} {totals(firstCoverage)}</p>
      {data.current.identityUnknown>0&&<p className="ops-dash-caption">{t('missingIdentity')} · {data.current.identityUnknown}</p>}
    </Panel>
  </div>;
}

function AcquisitionTraffic({data,t,filtered}:{data:DashboardTraffic|null|undefined;t:Translate;filtered:boolean}){
  const other=data?.otherChannels;
  const cells=(landings:DashboardLandingCounts,homeDays?:number)=>dashboardLandingPages.map(key=>
    <td key={key}>{landingCount(landings,key,homeDays)}</td>);
  return <Panel title={t('sessions')} aside={data?<span>{gaDates(data)}</span>:undefined}>
    {data?<>
      <Table headers={[t('source'),...dashboardLandingPages.map(key=>landingTitle(key,t)),t('sessionCount')]}>
        <tr><th scope="row">{t('trafficTotal')}</th>{cells(data.landings,data.homepageCoveredDays)}<td>{data.sessions}</td></tr>
        {data.channels.map(row=><tr key={JSON.stringify([row.source,row.medium])}>
          <th scope="row">{gaSourceTitle(row,t)}</th>{cells(row.landings,data.homepageCoveredDays)}<td>{row.sessions}</td>
        </tr>)}
        {other&&<tr><th scope="row">{t('otherSources')}</th>
          {cells(other.landings,data.homepageCoveredDays)}<td>{other.sessions}</td>
        </tr>}
      </Table>
      <p className="ops-dash-caption">{gaCoverage(data,t)} · {gaFreshness(data,t)}</p>
      {data.coveredDays<data.expectedDays&&<p className="ops-dash-caption">{t('gaPartial')}</p>}
      {(data.homepageCoveredDays??0)<data.coveredDays&&<p className="ops-dash-caption">
        {t('homeLandingCoverage')} {data.homepageCoveredDays??0} / {data.coveredDays}
      </p>}
      {data.devices?<AdminDisclosure heading={t('sessionsByDevice')} density="compact">
        {data.devices.rows.length?<Table headers={[t('device'),...dashboardLandingPages.map(key=>landingTitle(key,t)),t('sessionCount')]}>
          {data.devices.rows.map(row=><tr key={row.device}>
            <th scope="row">{row.device==='unknown'?t('unknownDevice'):row.device==='other'?t('otherDevice'):t(row.device)}</th>
            {cells(row.landings,data.devices?.homepageCoveredDays)}<td>{row.sessions}</td>
          </tr>)}
        </Table>:<p>{t('noSamples')}</p>}
        <p className="ops-dash-caption">{t('gaDaysCovered')} {data.devices.coveredDays} / {data.expectedDays}</p>
      </AdminDisclosure>:<p className="ops-dash-caption">{t('deviceGap')}</p>}
    </>:<p className="ops-dash-caption">{t('trafficGap')}</p>}
    {filtered&&<p className="ops-dash-caption">{t('gaSiteScope')}</p>}
  </Panel>;
}

function AcquisitionEnrollmentFunnel({data,t,lang,filtered}:{data:DashboardEnrollmentFunnel|null|undefined;t:Translate;
  lang:CrmLanguage;filtered:boolean}){
  const number=new Intl.NumberFormat(languageTag[lang]);
  const percent=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const steps=[['landed','enrollmentFunnelLanded'],['started','enrollmentFunnelStarted'],['reserved','enrollmentFunnelReserved'],
    ['savedProof','enrollmentFunnelProof']] as const;
  return <Panel title={t('enrollmentFunnel')} aside={data?<span>{sameDate(data.from,data.to)} · WIB</span>:undefined}>
    {data?<>
      {data.totals.landed?<ul className="ops-dash-stages" aria-label={t('enrollmentFunnel')}>
        {steps.map(([step,label])=>{
          const share=data.totals[step]/data.totals.landed;
          return <li key={step}><span>{t(label)}</span><strong>{number.format(data.totals[step])} · {percent.format(share)}</strong>
            <i aria-hidden="true" style={{width:share*100+'%'}}/></li>;
        })}
      </ul>:<p>{t('enrollmentFunnelNoLandings')}</p>}
      {data.totals.landed>0&&<p className="ops-dash-caption">
        {t('enrollmentFunnelViewed')} · {number.format(data.totals.viewedClass)} · {percent.format(data.totals.viewedClass/data.totals.landed)}
      </p>}
      <p className="ops-dash-caption">{t('enrollmentFunnelBasis')}</p>
      <p className="ops-dash-caption">{enrollmentFunnelCoverage(data,t)} · {t('gaSnapshotTime')} {formatWib(data.fetchedAt)} WIB</p>
      {data.coveredDays<data.expectedDays&&<p className="ops-dash-caption">{t('gaPartial')}</p>}
      {data.missingSessionViews>0&&<p className="ops-dash-caption">
        {t('enrollmentFunnelMissing')} · {number.format(data.missingSessionViews)}
      </p>}
      {data.campaigns.length>0&&<AdminDisclosure heading={t('enrollmentFunnelByCampaign')} density="compact">
        <Table headers={[t('source'),t('enrollmentFunnelCampaign'),...steps.map(([,label])=>t(label)),t('tvApplicationRate')]}>
          {data.campaigns.map(row=><tr key={JSON.stringify([row.source,row.medium,row.campaignId||row.campaign])}>
            <th scope="row">{gaSourceTitle(row,t)}</th>
            <td>{[row.campaign,row.campaignId].filter((value,index,values)=>value&&values.indexOf(value)===index).join(' · ')||'—'}</td>
            {steps.map(([step])=><td key={step}>{number.format(row[step])}</td>)}
            <td>{row.landed?percent.format(row.started/row.landed):'—'}</td>
          </tr>)}
        </Table>
        {data.campaignsOmitted>0&&<p className="ops-dash-caption">{t('enrollmentFunnelOmitted')} · {number.format(data.campaignsOmitted)}</p>}
      </AdminDisclosure>}
    </>:<p className="ops-dash-caption">{t('enrollmentFunnelGap')}</p>}
    {filtered&&<p className="ops-dash-caption">{t('gaSiteScope')}</p>}
  </Panel>;
}

function AcquisitionAdSpend({data,t,lang,filtered}:{data:DashboardAdSpend|null;t:Translate;lang:CrmLanguage;filtered:boolean}){
  const money=(amount:number,currency:string)=>formatCurrency(amount/dashboardAdSpendScale,lang,currency);
  const percent=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  return <Panel title={t('adSpend')} aside={data?<span>{sameDate(data.from,data.to)} · WIB</span>:undefined}>
    {data?<>
      <Table headers={[t('adCurrency'),t('adSpend'),t('adMapped'),t('adUnmapped')]}>
        {data.currencies.map(row=><tr key={row.currency}>
          <th scope="row">{row.currency}</th><td>{money(row.amount,row.currency)}</td>
          <td>{money(row.mapped,row.currency)} {row.amount>0&&<small className="ops-dash-subvalue">({percent.format(row.mapped/row.amount)})</small>}</td>
          <td>{money(row.amount-row.mapped,row.currency)}</td>
        </tr>)}
      </Table>
      {data.campaigns.length>0&&<AdminDisclosure heading={t('adCampaignBreakdown')} density="compact">
        <Table headers={[t('adExternalCampaign'),t('adAccount'),t('adPromotion'),t('adSpend')]}>
          {data.campaigns.map(row=><tr key={JSON.stringify([row.platform,row.accountId,row.currency,row.campaignId,row.mapping?.promotionId,row.mapping?.campaignId])}>
            <th scope="row">{row.name}{row.name!==row.campaignId&&<small className="ops-dash-subvalue"> · {row.campaignId}</small>}</th>
            <td>{row.platform} · {row.accountId}</td>
            <td>{row.mapping?<Link href={'/crm?tab=campaigns&campaign='+encodeURIComponent(row.mapping.campaignId)}>
              {row.mapping.campaignCode} · {row.mapping.promotionId}</Link>:t('adNotMapped')}</td>
            <td>{money(row.amount,row.currency)}</td>
          </tr>)}
        </Table>
      </AdminDisclosure>}
      <AdminDisclosure heading={t('adCoverage')} density="compact">
        <Table headers={[t('adAccount'),t('adCurrency'),t('gaDaysCovered'),t('gaSnapshotTime')]}>
          {data.accounts.map(row=><tr key={JSON.stringify([row.platform,row.accountId,row.currency])}>
            <th scope="row">{row.platform} · {row.accountId}</th><td>{row.currency}</td>
            <td>{row.days} / {data.expectedDays}</td><td>{formatWib(row.asOf)} WIB</td>
          </tr>)}
        </Table>
      </AdminDisclosure>
      <p className="ops-dash-caption">{t('adCoverageNote')}</p>
    </>:<p className="ops-dash-caption">{t('adEmpty')}</p>}
    {filtered&&<p className="ops-dash-caption">{t('adAccountScope')}</p>}
    <p className="ops-dash-caption">{t('adCacPending')}</p>
  </Panel>;
}

function Finance({data,filter,lang,t,onNavigate}:{data:DashboardSnapshot;filter:DashboardFilters;lang:CrmLanguage;t:Translate;onNavigate:(href:string)=>void}){
  const [kind,setKind]=useState<CashComponent>('net');
  const [day,setDay]=useState('');
  const [page,setPage]=useState(1);
  const [result,setResult]=useState<{panelKey:string;data?:DashboardMovementPage;error?:boolean}>();
  const cash=data.cash;
  const params=new URLSearchParams(dashboardPath('finance',day?{...filter,period:'custom',from:day,to:day}:filter).split('?')[1]);
  params.set('page',String(page));
  if(kind!=='net')params.set('kind',kind);
  const panelKey=params.toString()+'|'+data.asOf;
  useEffect(()=>{
    if(!cash)return;
    const controller=new AbortController();
    fetch('/api/crm/operations-dashboard/cash?'+panelKey.split('|')[0],{signal:controller.signal,cache:'no-store'})
      .then(response=>{if(!response.ok)throw Error();return response.json();})
      .then(value=>{if(!controller.signal.aborted)setResult({panelKey,data:value});})
      .catch(()=>{if(!controller.signal.aborted)setResult({panelKey,error:true});});
    return ()=>controller.abort();
  },[panelKey,Boolean(cash)]);
  if(!cash)return <Panel title={t('finance')}><p>{t('denied')}</p></Panel>;
  const report=result?.panelKey===panelKey?result:undefined;
  const money=(n:number)=>formatCurrency(n,lang);
  const valuation=cash.current;
  const [received,refunded,returned]=[valuation.received,valuation.refunded,valuation.returned];
  const low=Math.min(0,received-refunded,valuation.net);
  const high=Math.max(1,received,valuation.net);
  const starts=[0,received,received-refunded,0];
  const changes=[received,-refunded,returned,valuation.net];
  return <>
    <Panel title={t('finance')} aside={<Link href={financePath} onNavigate={onNavigate}>{t('financeLink')}</Link>}>
      <div className="ops-dash-waterfall">
        {cashComponents.map((item,index)=>{
          const amount=changes[index],start=starts[index];
          return <button key={item} type="button" aria-pressed={kind===item} onClick={()=>{setKind(item);setDay('');setPage(1);}}>
            <span className="ops-dash-float" aria-hidden="true"><i data-negative={amount<0||undefined}
              style={{bottom:(Math.min(start,start+amount)-low)/(high-low)*100+'%',height:Math.max(1,Math.abs(amount)/(high-low)*100)+'%'}}/></span>
            <span>{t(item)}</span><strong>{money(amount)}</strong>
          </button>;
        })}
      </div>
      <p className="ops-dash-caption">{t('netDefinition')}</p>
    </Panel>
    {data.queue&&<>
      <div className="ops-dash-kpis compact">
        <NumberCard label={t('receivable')} value={money(data.queue.receivable)}/>
        <NumberCard label={t('refundAmount')} value={money(data.queue.refundOutstanding)}/>
        <NumberCard label={t('review')} value={data.queue.pending}/>
      </div>
      <Panel title={t('financeAging')}>
        <Table headers={[t('financeAging'),t('ageUnder24'),t('ageUnder72'),t('ageAtLeast72'),t('ageUnknown')]}>
          {([
            ['review',data.queue.reviewAges],
            ['pendingRefund',data.queue.refundAges],
          ] as const).map(([label,ages])=><tr key={label}>
            <th scope="row">{t(label)}</th>
            <td>{ages.under24}</td><td>{ages.under72}</td><td>{ages.atLeast72}</td><td>{ages.unknown}</td>
          </tr>)}
        </Table>
        <p className="ops-dash-caption">{t('financeAgingBasis')}</p>
      </Panel>
    </>}
    <Trend title={t('financeTrend')} series={data.trend.map(row=>({date:row.date,value:row.cash?.net??0}))}
      display={money} t={t} onDay={value=>{setDay(value);setKind('net');setPage(1);}}/>
    <Panel title={t('movements')+' · '+t(kind)} aside={day&&<button type="button" className="crm-work-button" onClick={()=>{setDay('');setPage(1);}}>{day} · {t('clear')}</button>}>
      {report?.data?.rows.length?<Table headers={[t('order'),t('movementReference'),t('recordedAt'),t('settledAt'),t('type'),t('amount')]}>
        {report.data.rows.map(row=><tr key={row.kind+':'+row.reference}>
          <th scope="row"><Link href={enrollmentPaymentPath(row.orderId)} onNavigate={onNavigate}>{row.orderId}</Link></th>
          <td>{row.reference}</td><td>{formatCrmEventTime(row.at)}</td><td>{row.settledAt?formatCrmEventTime(row.settledAt):'—'}</td>
          <td>{t(row.kind)}</td><td>{money(row.kind==='refunded'?-row.amount:row.amount)}</td>
        </tr>)}
      </Table>:<p role={report?.error?'alert':'status'}>{report?.error?t('error'):report?t('noSamples'):t('load')}</p>}
      <div className="ops-dash-pagination">
        <button type="button" className="crm-work-button" disabled={page===1} onClick={()=>setPage(page-1)}>{t('previousPage')}</button>
        <button type="button" className="crm-work-button" disabled={!report?.data?.more} onClick={()=>setPage(page+1)}>{t('nextPage')}</button>
      </div>
    </Panel>
  </>;
}

function WallboardKpiTrack({fill,marker,tone}:{fill:number|null;marker:number|null;tone?:'warning'|'success'}){
  const width=(value:number)=>Math.max(0,Math.min(1,value))*100+'%';
  return <div className="ops-dash-tv-kpi-track" aria-hidden="true" data-tone={tone}>
    {fill!==null&&<i style={{width:width(fill)}}/>}
    {marker!==null&&<b style={{left:width(marker)}}/>}
  </div>;
}

function WallboardCumulativeKpi({label,value,previous,plan,monthProgress,format,percent,unit,t,coverage,publicLayout}:{
  label:string;value:number|null;previous:number|null;plan?:DashboardKpiTarget;format:(value:number)=>string;
  monthProgress:number;percent:(value:number)=>string;unit?:string;t:Translate;coverage?:string;publicLayout:boolean;
}){
  const amount=(value:number)=>format(value)+(unit?' '+unit:'');
  const ratio=value!==null&&plan?value/plan.target:null;
  const scale=plan?.target??Math.max(1,value??0,previous??0);
  const expected=plan?Math.floor(plan.target*monthProgress):null;
  const reference=expected??previous;
  const pace=value!==null&&expected!==null?value-expected:null;
  const tone=pace===null?undefined:pace<0?'warning':'success';
  const paceText=pace===null?null:pace===0?t('tvKpiOnPace'):
    t(pace>0?'tvKpiAhead':'tvKpiBehind')+' '+amount(Math.abs(pace));
  if(publicLayout)return <article className="ops-dash-tv-score ops-dash-tv-kpi-primary">
    <span>{label}</span>
    <div className="ops-dash-tv-score-value">
      <strong>{value===null?'—':format(value)}</strong>
      {value!==null&&unit&&<span>{unit}</span>}
    </div>
    <div className="ops-dash-tv-score-meta">
      <span>{t(value===null?'tvMissingData':'tvKpiActual')}</span>
      {ratio!==null&&<span aria-label={t('tvKpiCompletion')+' '+percent(ratio)}>{percent(ratio)}</span>}
    </div>
    <WallboardKpiTrack fill={value!==null&&value>=0?value/scale:null}
      marker={reference!==null&&reference>=0?reference/scale:null} tone={tone}/>
    <dl className="ops-dash-tv-kpi-breakdown">
      {plan?<><div><dt>{t('tvKpiPlan')}</dt><dd>{expected===null?'—':amount(expected)}</dd></div>
        <div><dt>{t('tvKpiGap')}</dt><dd>{paceText===null?t('tvMissingData'):<strong data-tone={tone}>{paceText}</strong>}</dd></div>
        <div><dt>{t('tvKpiTarget')}</dt><dd>{amount(plan.target)}</dd></div></>:
        <div><dt>{t('tvKpiComparison')}</dt><dd>{previous===null?t('tvMissingData'):amount(previous)}</dd></div>}
    </dl>
    {!plan&&<p>{t('tvTargetPending')}{value!==null&&previous!==null&&<> · <DashboardDelta value={value-previous} format={format}/></>}</p>}
    {coverage&&<p className="ops-dash-caption">{coverage}</p>}
  </article>;
  return <article className="ops-dash-tv-score">
    <span>{label}</span>
    <div className="ops-dash-tv-score-value"><strong>{value===null?'—':format(value)}</strong>
      {value!==null&&unit&&<span>{plan?'/ '+amount(plan.target):unit}</span>}
    </div>
    <div className="ops-dash-tv-score-meta">
      <span>{plan?unit?t('tvKpiCompletion'):t('tvKpiTarget')+' '+amount(plan.target):t('tvKpiComparison')}</span>
      <span>{plan?ratio===null?'—':percent(ratio):previous===null?'—':amount(previous)}</span>
    </div>
    <WallboardKpiTrack fill={value!==null&&value>=0?value/scale:null}
      marker={reference!==null&&reference>=0?reference/scale:null} tone={tone}/>
    <p>{value===null?t('denied'):pace!==null&&expected!==null?<>
      <strong data-tone={tone}>{paceText}</strong>
      {' · '+t('tvKpiPlan')+' '+amount(expected)}
    </>:<>{t('tvTargetPending')}{previous!==null&&<> · <DashboardDelta value={value-previous} format={format}/></>}</>}</p>
    {coverage&&<p className="ops-dash-caption">{coverage}</p>}
  </article>;
}

function WallboardRateKpi({data,t,percent,count,publicLayout}:{data:SalesWallboardSnapshot;t:Translate;
  percent:(value:number)=>string;count:(value:number)=>string;publicLayout:boolean}){
  const current=data.current,previous=data.compare;
  const rate=current.mature?current.paidWithinWindow/current.mature:null;
  const sampleNote=paymentSampleNote(current,t,count);
  const prior=previous.mature?previous.paidWithinWindow/previous.mature:null;
  const target=data.wallboard?.kpiPlan?.paymentRate;
  const deviation=rate!==null&&target!==undefined?Math.round((rate-target)*1000)/10:null;
  const periodChange=rate!==null&&prior!==null?Math.round((rate-prior)*1000)/10:null;
  const tone=deviation!==null?deviation<0?'warning':'success':undefined;
  const noMatureOrders=publicLayout&&rate===null;
  const note=noMatureOrders&&!current.timingUnknown
    ?current.observing?count(current.observing)+' '+t('tvKpiOrdersObserving'):null
    :sampleNote;
  return <article className={'ops-dash-tv-score'+(publicLayout?' ops-dash-tv-kpi-primary':'')}>
    <span>{t('rate')}</span>
    <div className="ops-dash-tv-score-value"><strong>{rate===null?'—':percent(rate)}</strong>
      {target!==undefined&&<span>{t('tvKpiTarget')} {percent(target)}</span>}
    </div>
    {noMatureOrders?<div className="ops-dash-tv-score-meta"><span>{t('tvKpiNoSample')}</span></div>:
      <div className="ops-dash-tv-score-meta">
      <span>{t('tvKpiMaturePaid')}</span>
      <span>{count(current.paidWithinWindow)} / {count(current.mature)}</span>
    </div>}
    <WallboardKpiTrack fill={rate} marker={target??prior} tone={tone}/>
    <p>{note??(noMatureOrders?null:deviation!==null?
      <strong data-tone={tone}>{deviation===0?t('tvKpiAtTarget'):
        t(deviation>0?'tvKpiAbove':'tvKpiBelow')+' '+count(Math.abs(deviation))+' '+t('percentagePoints')}</strong>:
      t('tvTargetPending'))}
      {prior!==null&&<> · {t('tvKpiComparison')} {percent(prior)}</>}
      {target===undefined&&periodChange!==null&&<> · <DashboardDelta value={periodChange} format={count} unit={t('percentagePoints')}/></>}
    </p>
  </article>;
}

function WallboardKpis({data,t,lang,compactMoney,publicLayout}:{data:SalesWallboardSnapshot;t:Translate;lang:CrmLanguage;compactMoney:(value:number)=>string;publicLayout:boolean}){
  const number=new Intl.NumberFormat(languageTag[lang]);
  const format=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const monthProgress=dashboardKpiMonthProgress(Date.parse(data.asOf));
  const kpi=data.wallboard?.kpiPlan;
  const classes=data.upcoming;
  const belowMinimum=classes.filter(row=>enrollmentClassShortfall(row)>0).length;
  const ready=classes.length-belowMinimum;
  const balance=data.queue?.receivable;
  return <section className="ops-dash-tv-scoreboard" aria-label={t('tvKpiHeading')}>
    <div className="ops-dash-tv-score-grid">
      <WallboardCumulativeKpi label={t('net')} value={data.cash?.current.net??null} previous={data.cash?.compare.net??null}
        plan={kpi?.net} monthProgress={monthProgress} format={compactMoney} percent={value=>format.format(value)} t={t} publicLayout={publicLayout}/>
      <WallboardCumulativeKpi label={t('paid')} value={data.current.paid} previous={data.compare.paid}
        plan={kpi?.paid} monthProgress={monthProgress} format={value=>number.format(value)} percent={value=>format.format(value)} unit={t('tvEnrollmentUnit')} t={t} publicLayout={publicLayout}/>
      <WallboardCumulativeKpi label={t('first')} value={data.current.first} previous={data.compare.first}
        plan={kpi?.first} monthProgress={monthProgress} format={value=>number.format(value)} percent={value=>format.format(value)} unit={t('tvLearnerUnit')} t={t} publicLayout={publicLayout}
        coverage={data.current.identityUnknown?t('firstIdentityPending')+' · '+number.format(data.current.identityUnknown):undefined}/>
      <WallboardRateKpi data={data} t={t} percent={value=>format.format(value)} count={value=>number.format(value)} publicLayout={publicLayout}/>
      <article className="ops-dash-tv-score">
        <span>{t('tvKpiClassReadiness')}</span>
        <div className="ops-dash-tv-score-value"><strong>{number.format(ready)}</strong><span>/ {number.format(classes.length)}</span></div>
        <div className="ops-dash-tv-score-meta"><span>{t('tvKpiClassBasis')}</span>
          <span>{classes.length?format.format(ready/classes.length):'—'}</span></div>
        <WallboardKpiTrack fill={classes.length?ready/classes.length:null} marker={null}
          tone={classes.length?belowMinimum?'warning':'success':undefined}/>
        <p>{classes.length?<strong data-tone={belowMinimum?'warning':'success'}>
          {belowMinimum?number.format(belowMinimum)+' '+t('tvKpiClassGap'):t('tvKpiClassReady')}
        </strong>:t('tvKpiNoClasses')}</p>
      </article>
      <article className="ops-dash-tv-score">
        <span>{t('tvKpiReceivable')}</span>
        <div className="ops-dash-tv-score-value"><strong>{balance===undefined?'—':compactMoney(balance)}</strong></div>
        <div className="ops-dash-tv-score-meta"><span>{t('tvKpiReceivableScope')}</span></div>
        <p>{t(balance===undefined?'denied':'tvKpiReceivableBasis')}</p>
      </article>
      <div className="ops-dash-tv-score-extension">
        <article className="ops-dash-tv-compact-score">
          <span>{t('tvFirstBuyerCost')}</span><strong aria-hidden="true">—</strong>
          <small>{t('tvCostCoveragePending')}</small>
        </article>
        <article className="ops-dash-tv-compact-score">
          <span>{t('tvRepurchase')}</span><strong aria-hidden="true">—</strong>
          <small>{t('tvRepurchaseCohortPending')}</small>
        </article>
      </div>
    </div>
  </section>;
}

function Wallboard({data,lang,t,stale,publicLayout=false}:{data:SalesWallboardSnapshot;lang:CrmLanguage;t:Translate;stale:boolean;publicLayout?:boolean}){
  const board=useRef<HTMLDivElement>(null);
  const fullscreenPending=useRef(false);
  const [fullscreen,setFullscreen]=useState<'native'|'viewport'|null>(null);
  useEffect(()=>{
    const changed=()=>setFullscreen(mode=>document.fullscreenElement===board.current?'native':mode==='native'?null:mode);
    document.addEventListener('fullscreenchange',changed);
    return ()=>document.removeEventListener('fullscreenchange',changed);
  },[]);
  useEffect(()=>{
    if(fullscreen!=='viewport')return;
    const close=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented)setFullscreen(null);
    };
    document.addEventListener('keydown',close);
    return ()=>document.removeEventListener('keydown',close);
  },[fullscreen]);
  const toggleFullscreen=async()=>{
    const element=board.current;
    if(!element||fullscreenPending.current)return;
    if(fullscreen==='viewport'){
      setFullscreen(null);
      return;
    }
    const exiting=document.fullscreenElement===element;
    fullscreenPending.current=true;
    try{
      if(exiting)await document.exitFullscreen();
      else if(document.fullscreenEnabled)await element.requestFullscreen({navigationUI:'hide'});
    }catch{
      // An embedded or background page can be denied native fullscreen.
    }finally{
      fullscreenPending.current=false;
    }
    if(element.isConnected){
      setFullscreen(document.fullscreenElement===element?'native':exiting?null:'viewport');
    }
  };
  const money=(value:number)=>formatCurrency(value,lang);
  const compact=new Intl.NumberFormat(languageTag[lang],{notation:'compact',maximumFractionDigits:1});
  const compactMoney=(value:number)=>'Rp '+compact.format(value);
  const todayChange=(value:number,previous?:number)=>previous===undefined?null:
    <small><DashboardDelta value={value-previous}/></small>;
  const cash=data.cash;
  const today=data.wallboard?.priorDay;
  const monthEnd=new Date(data.period.from+'T00:00:00Z');
  monthEnd.setUTCMonth(monthEnd.getUTCMonth()+1,0);
  const rows=wallboardChannels(data);
  const classStart=(row:WallboardClass)=>crmInstant(row.firstLessonAt)?.getTime()??Infinity;
  const leader=rows.reduce<(typeof rows)[number]|undefined>((top,row)=>
    wallboardSourceIdentified(row.source)&&row.first>(top?.first??0)?row:top,undefined);
  const short=data.upcoming.reduce<WallboardClass|undefined>((earliest,row)=>
    enrollmentClassShortfall(row)>0&&(!earliest||classStart(row)<classStart(earliest))?row:earliest,undefined);
  const fullscreenAction=fullscreen==='native'?'closeFullscreen':fullscreen==='viewport'?'closeWallboardViewport':'fullscreen';
  return <div className="ops-dash-tv-outer" ref={board} data-fullscreen={fullscreen??undefined} data-wallboard-layout={publicLayout?'public':undefined}>
    <div className="ops-dash-tv">
      <header><div><span>UPER</span> <strong>{t('tvTitle')}</strong></div>
        <div>{publicLayout?<div className="ops-dash-tv-updated">
          <time dateTime={data.asOf}>{t('asOf')} · {formatWib(data.asOf)} WIB</time>
          {stale&&<span role="status">{t('stale')}</span>}
        </div>:<time dateTime={data.asOf}>{formatWib(data.asOf)} WIB</time>}
          <AdminPageAction label={t(fullscreenAction)} icon={fullscreen?Minimize:Maximize} onClick={toggleFullscreen}/></div>
      </header>
      <div className="ops-dash-tv-strip ops-dash-tv-summary">
        <strong>{leader?<>{sourceTitle(leader.source,t)} {t('tvChannelFirst')} · {leader.first} {t('tvLearnerUnit')}</>:t('tvMonthCompare')}</strong>
        {short&&<span>{enrollmentClassTitle(short,lang)} · {t('tvActiveShortage')} <b className="ops-dash-loss-key">{enrollmentClassShortfall(short)} {t('tvLearnerUnit')}</b></span>}
        <span className="ops-dash-tv-context">{t('tvKpiHeading')} · {sameDate(data.period.from,monthEnd.toISOString().slice(0,10))} WIB</span>
      </div>
      <WallboardKpis data={data} t={t} lang={lang} compactMoney={compactMoney} publicLayout={publicLayout}/>
      <div className="ops-dash-tv-strip">
        <strong>{t('tvSameTimeLastWeek')}</strong>
        <span>{t('orders')} <b>{data.today.orders}</b> {todayChange(data.today.orders,today?.orders)}</span>
        <span>{t('todayPaid')} <b>{data.today.paid}</b> {todayChange(data.today.paid,today?.paid)}</span>
        <span>{t('todayNet')} <b>{cash?compactMoney(cash.today.net):'—'}</b>
          {cash&&today?.net!=null&&<> <small><DashboardDelta value={cash.today.net-today.net} format={money}/></small></>}</span>
        <span className="ops-dash-tv-kpi-legend ops-dash-tv-context">{t('tvKpiMarker')}</span>
      </div>
      <div className="ops-dash-tv-upper">
        <WallboardChannels data={data} rows={rows} t={t} lang={lang} publicLayout={publicLayout}/>
        <WallboardTrend data={data} t={t} lang={lang} publicLayout={publicLayout}/>
      </div>
      <div className="ops-dash-tv-lower">
        <WallboardPayment rows={rows} t={t} lang={lang} publicLayout={publicLayout}/>
        <WallboardSupply data={data} t={t} publicLayout={publicLayout}/>
        <Upcoming rows={data.upcoming} t={t} lang={lang} limited pendingByClass={data.queue?.pendingByClass} publicLayout={publicLayout}/>
      </div>
      <div className="ops-dash-tv-strip">
        <strong>{t('tvProcess')}</strong>
        {(['tvFirstContactRate','tvRefundRate'] as const).map(key=><span key={key}>{t(key)} <small>{t('tvRulesPending')}</small></span>)}
      </div>
      <div className="ops-dash-tv-footer-panels">
        <WallboardIntake data={data} t={t} lang={lang}/>
        <WallboardLevelChanges data={data} t={t} lang={lang}/>
        <Queue data={data} t={t} lang={lang} wallboard publicLayout={publicLayout}/>
      </div>
      {!publicLayout&&<footer role="status">{stale?t('stale'):t('asOf')+' · '+formatWib(data.asOf)+' WIB'}</footer>}
    </div>
  </div>;
}

export function PublicSalesWallboard(){
  const selected=new URLSearchParams(window.location.search).get('lang');
  const lang=selected==='zh'||selected==='id'||selected==='en'?selected:readAdminLanguage();
  const t:Translate=key=>dashboardLabel(lang,key);
  const data=useDashboard<SalesWallboardSnapshot>(salesWallboardApi,'',true,true,0,'omit');
  return <main className="ops-dash-tv-public" aria-label={t('tvTitle')}>
    {data.snapshot?<Wallboard data={data.snapshot} lang={lang} t={t} stale={Boolean(data.error)} publicLayout/>:
      <p role={data.error?'alert':'status'}>{t(data.error?'error':'load')}</p>}
  </main>;
}

function AcquisitionReservations({outcomes,t,lang,isLight}:{outcomes:DashboardSnapshot['reservationOutcomes'];
  t:Translate;lang:CrmLanguage;isLight:boolean}){
  const [group,setGroup]=useState<'entries'|'languages'>('entries');
  const rows=outcomes[group];
  const languageLabels:Record<string,string>={en:'English',id:'Bahasa Indonesia',zh:'中文'};
  const rate=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const observing=rows.reduce((sum,row)=>sum+row.observing,0);
  const timingUnknown=rows.reduce((sum,row)=>sum+row.timingUnknown,0);
  return <Panel title={t('reservationOutcomes')}>
    <div className="ops-dash-filters">
      <AdminSingleSelect label={t('groupBy')} value={group} lang={lang} isLight={isLight}
        options={[{value:'entries',label:t('entry')},{value:'languages',label:t('reservationLanguage')}]}
        onChange={value=>setGroup(value==='languages'?'languages':'entries')}/>
    </div>
    {rows.length?<Table headers={[t(group==='entries'?'entry':'reservationLanguage'),t('orders'),t('paymentEligible'),
      t('proofInWindow'),t('paidAfterProof'),t('paidWithoutPriorProof'),t('sevenDayConversion')]}>
      {rows.map(row=><tr key={row.key}>
        <th scope="row">{group==='entries'?entryTitle(row.key,t):languageLabels[row.key]??t('unknownReservationLanguage')}</th>
        <td>{row.orders}</td><td>{row.eligible}</td><td>{row.proof}</td><td>{row.paidAfterProof}</td><td>{row.paidWithoutPriorProof}</td>
        <td>{row.eligible?rate.format((row.paidAfterProof+row.paidWithoutPriorProof)/row.eligible):'—'}</td>
      </tr>)}
    </Table>:<p>{t('noSamples')}</p>}
    <p className="ops-dash-caption">{t('reservationOutcomeBasis')}</p>
    {observing>0&&<p className="ops-dash-caption">{t('observing')} · {observing}</p>}
    {timingUnknown>0&&<p className="ops-dash-caption">{t('missingTime')} · {timingUnknown}</p>}
  </Panel>;
}

function Acquisition({data,t,lang,isLight,canManageCampaigns,filtered}:{data:DashboardSnapshot;t:Translate;lang:CrmLanguage;
  isLight:boolean;canManageCampaigns:boolean;filtered:boolean}){
  const {current}=data;
  const cohorts:[DashboardWord,number][]=[['completedWindow',current.mature],['paidInTime',current.paidWithinWindow],['observing',current.observing]];
  return <>
    <AcquisitionTraffic data={data.traffic} t={t} filtered={filtered}/>
    <AcquisitionEnrollmentFunnel data={data.enrollmentFunnel} t={t} lang={lang} filtered={filtered}/>
    {canManageCampaigns&&<AcquisitionAdSpend data={data.adSpend??null} t={t} lang={lang} filtered={filtered}/>}
    <AcquisitionSources data={data} t={t} lang={lang} canManageCampaigns={canManageCampaigns}/>
    <AcquisitionReservations outcomes={data.reservationOutcomes} t={t} lang={lang} isLight={isLight}/>
    <div className="ops-dash-grid">
      <Panel title={t('funnel')}>
        <ul className="ops-dash-stages">{cohorts.map(([label,value])=><li key={label}><span>{t(label)}</span><strong>{value}</strong>
          <i aria-hidden="true" style={{width:100*value/Math.max(1,current.mature,current.observing)+'%'}}/></li>)}</ul>
        {current.timingUnknown>0&&<p className="ops-dash-caption">{t('missingTime')} · {current.timingUnknown}</p>}
      </Panel>
      <Panel title={t('orderStates')}>
        <Table headers={[t('demandStatus'),t('orders')]}>
          {(['awaiting','proof','partial','expired','cancelled'] as const).map(key=><tr key={key}>
            <th scope="row">{t(key)}</th><td>{key==='proof'?current.review:current[key]}</td>
          </tr>)}
        </Table>
      </Panel>
    </div>
    <Panel title={t('paymentCohorts')}>
      {data.cohorts?.length?<Table headers={[t('cohortWeek'),t('orders'),t('oneDay'),t('threeDays'),t('sevenDays')]}>
        {data.cohorts.map(row=><tr key={row.week}>
          <th scope="row">{row.week}</th><td>{row.orders}</td>
          {row.windows.map(window=><td key={window.days}><span className="ops-dash-cohort"
            style={{'--ops-cohort':(window.observed?Math.round(window.confirmed/window.observed*42):0)+'%'} as CSSProperties}>
            {window.observed?window.confirmed+' / '+window.observed:'—'}
          </span></td>)}
        </tr>)}
      </Table>:<p>{t('noSamples')}</p>}
      <p className="ops-dash-caption">{t('cohortBasis')}</p>
    </Panel>
  </>;
}

function Sales({data,t}:{data:DashboardSnapshot;t:Translate}){
  return <>
    <div className="ops-dash-kpis compact">
      <NumberCard label={t('openContact')} value={data.followup?.open??'—'} note={!data.followup?t('denied'):undefined}/>
      <NumberCard label={t('overdue')} value={data.followup?.overdue??'—'} note={!data.followup?t('denied'):undefined}/>
      <NumberCard label={t('assistOffers')} value={data.assists.confirmed+' / '+data.assists.offered}/>
    </div>
    <Panel title={t('mode')} aside={<Link href={salesPath}>{t('followup')}</Link>}>
      <Table headers={[t('type'),t('paid')]}>{(['self','assisted','staff','unclassified'] as const).map(key=>
        <tr key={key}><th scope="row">{t(key)}</th><td>{data.current[key]}</td></tr>)}</Table>
    </Panel>
  </>;
}

function Classes({data,filter,t,lang,onNavigate}:{data:DashboardSnapshot;filter:DashboardFilters;t:Translate;lang:CrmLanguage;onNavigate:(href:string)=>void}){
  const demand=data.demand?.filter(row=>row.state!=='withdrawn'&&(!filter.level||row.level===filter.level)&&(!filter.format||row.format===filter.format))??null;
  const breakdown=dashboardSupply(data.upcoming,demand).sort((a,b)=>a.level.localeCompare(b.level)||a.period.localeCompare(b.period));
  const format=(value:string)=>value==='standard'||value==='small'?t(value):value==='one-on-one'?t('oneToOne'):value||'—';
  const timeLabel=(value:string)=>value==='weekday-evening'?t('weekday'):value==='weekend'||value==='mixed'?t(value):value||'—';
  const enrollmentsHref='/crm?tab=enrollment-management';
  const demandTable=(rows:typeof demand)=>rows?.length?<Table headers={[t('level'),t('format'),t('schedule'),t('demandStatus'),t('demandCount')]}>
    {rows.map(row=><tr key={JSON.stringify([row.level,row.format,row.period,row.state])}>
      <th scope="row">{row.level||'—'}</th><td>{format(row.format)}</td><td>{timeLabel(row.period)}</td>
      <td>{row.state==='confirmed'?t('confirmedSchedule'):row.format==='one-on-one'?t('awaitingSchedule'):t('active')}</td><td>{row.count}</td>
    </tr>)}
  </Table>:<p>{t(rows?'noSamples':'denied')}</p>;
  return <>
    <Upcoming rows={data.upcoming} t={t} lang={lang} onNavigate={onNavigate}/>
    <Panel title={t('supplyDemand')}>
      {breakdown.length?<Table headers={[t('level'),t('schedule'),t('waitlist'),t('groupDemand'),t('bookableSeats'),t('physicalSeats')]}>
        {breakdown.map(row=><tr key={JSON.stringify([row.level,row.period])}>
          <th scope="row">{row.level||'—'}</th><td>{timeLabel(row.period)}</td><td>{row.waiting}</td><td>{demand?row.requests:'—'}</td>
          <td>{row.seats}</td><td>{row.physicalSeats}</td>
        </tr>)}
      </Table>:<p>{t('noSamples')}</p>}
      <p className="ops-dash-caption">{t('tvSupplyNote')} {t('physicalSeatsNote')}{!demand&&' '+t('denied')}</p>
    </Panel>
    <Panel title={t('groupDemand')} aside={<Link href={enrollmentsHref} onNavigate={onNavigate}>{t('enrollment')}</Link>}>
      {demandTable(demand?.filter(row=>row.format!=='one-on-one')??null)}
    </Panel>
    {!filter.format&&<Panel title={t('privateBookings')}>
      {demandTable(demand?.filter(row=>row.format==='one-on-one')??null)}
    </Panel>}
  </>;
}

function teachingCohort(row:DashboardTeachingRow,t:Translate,onNavigate:(href:string)=>void){
  const label=row.level+' · '+t(row.format==='one-on-one'?'oneToOne':row.format);
  return row.kind==='class'?<Link href={enrollmentClassManagementPath(row.referenceId)} onNavigate={onNavigate}>{label}</Link>:label;
}

function Teaching({data,t,lang,allowed,onNavigate}:{data:DashboardTeaching|null|undefined;t:Translate;lang:CrmLanguage;
  allowed:boolean;onNavigate:(href:string)=>void}){
  if(!allowed)return <Panel title={t('teaching')}><p>{t('denied')}</p></Panel>;
  if(!data)return <Panel title={t('teaching')}><p>{t('teachingGap')}</p><p className="ops-dash-caption">{t('teachingRules')}</p></Panel>;
  const totals=data.cohorts.reduce((sum,row)=>({
    lessons:sum.lessons+row.lessons,minutes:sum.minutes+row.minutes,rosterLessons:sum.rosterLessons+row.rosterLessons,
    expected:sum.expected+row.expected,recorded:sum.recorded+row.recorded,present:sum.present+row.present,
  }),{lessons:0,minutes:0,rosterLessons:0,expected:0,recorded:0,present:0});
  const percent=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const rate=(part:number,total:number)=>total?percent.format(part/total):'—';
  const tally=(part:number,total:number)=>part+' / '+total;
  return <>
    <div className="ops-dash-kpis compact">
      <NumberCard label={t('delivery')} value={totals.lessons} note={totals.minutes+' · '+t('lessonMinutes')}/>
      <NumberCard label={t('attendanceRate')} value={rate(totals.present,totals.recorded)} note={tally(totals.present,totals.recorded)}/>
      <NumberCard label={t('registerCoverage')} value={rate(totals.recorded,totals.expected)} note={tally(totals.recorded,totals.expected)}/>
    </div>
    <Panel title={t('delivery')} aside={<span>{sameDate(data.from,data.to)} · WIB</span>}>
      <Table headers={[t('className'),t('delivery'),t('rosterCoverage'),t('attendanceRate'),t('registerCoverage'),t('gaDaysCovered')]}>
        {data.cohorts.map(row=><tr key={row.kind+':'+row.referenceId}>
          <th scope="row">{teachingCohort(row,t,onNavigate)} <small className="ops-dash-subvalue">· {row.referenceId}</small></th>
          <td>{row.lessons} · {row.minutes} {t('lessonMinutes')}</td><td>{tally(row.rosterLessons,row.lessons)}</td>
          <td>{rate(row.present,row.recorded)} <small className="ops-dash-subvalue">({tally(row.present,row.recorded)})</small></td>
          <td>{rate(row.recorded,row.expected)} <small className="ops-dash-subvalue">({tally(row.recorded,row.expected)})</small></td>
          <td>{tally(row.days,data.expectedDays)}</td>
        </tr>)}
      </Table>
      <p className="ops-dash-caption">{t('teachingCoverage')} {tally(totals.rosterLessons,totals.lessons)} · {t('gaSnapshotTime')} {formatWib(data.asOf)} WIB</p>
    </Panel>
    <Panel title={t('completion')}><p>{t('teachingRules')}</p></Panel>
  </>;
}

function CourseEconomics({data,t,lang,allowed,onNavigate}:{data:DashboardTeaching<DashboardEconomicsRow>|null|undefined;
  t:Translate;lang:CrmLanguage;allowed:boolean;onNavigate:(href:string)=>void}){
  if(!allowed)return <Panel title={t('economics')}><p>{t('denied')}</p></Panel>;
  if(!data)return <Panel title={t('economics')}><p>{t('costGap')}</p></Panel>;
  const money=(value:number|null)=>value===null?'—':formatCurrency(value,lang);
  return <Panel title={t('economics')} aside={<span>{sameDate(data.from,data.to)} · WIB</span>}>
    <Table headers={[t('className'),t('costCoverage'),t('directCost'),t('deliveredRevenue'),t('allDirectCost'),t('deliveredContribution'),t('gaDaysCovered')]}>
      {data.cohorts.map(row=><tr key={row.kind+':'+row.referenceId}>
        <th scope="row">{teachingCohort(row,t,onNavigate)} <small className="ops-dash-subvalue">· {row.referenceId}</small></th>
        <td>{row.costedLessons} / {row.lessons}</td><td>{money(row.teacherCost)}</td>
        <td>{money(row.revenue)}</td><td>{money(row.directCost)}</td><td>{money(row.contribution)}</td><td>{row.days} / {data.expectedDays}</td>
      </tr>)}
    </Table>
    <p className="ops-dash-caption">{t('costCoverageNote')} · {t('gaSnapshotTime')} {formatWib(data.asOf)} WIB</p>
  </Panel>;
}

export function CrmOperationsDashboard({actor,lang,isLight,onNavigate,onLocation}:{actor:AccessEmployee;lang:CrmLanguage;isLight:boolean;
  onNavigate:(href:string)=>void;onLocation:(url:string)=>void}){
  const sections=dashboardScopes(actor);
  const [location,setLocation]=useState(readLocation);
  const {topic,filter,kpiList}=location;
  const t:Translate=key=>dashboardLabel(lang,key);
  const [draft,setDraft]=useState(()=>({from:filter.from,to:filter.to}));
  const [revision,setRevision]=useState(0);
  const canManageKpi=canManageDashboardKpi(actor);
  const [changeDimension,setChangeDimension]=useState<ChangeDimension>('level');
  const [changeMeasure,setChangeMeasure]=useState<ChangeMeasure>('paid');
  const heading=useRef<HTMLHeadingElement>(null);
  const outputTopic=topic==='wallboard';
  const reportTopic=outputTopic||topic==='acquisition'||topic==='teaching'||topic==='economics';
  const query=dashboardPath(reportTopic?topic:'overview',outputTopic?filterDefaults:filter).split('?')[1];
  const accessKey=[sections.finance,sections.operations,sections.followup,sections.marketing].join('|');
  const data=useDashboard('/api/crm/operations-dashboard?'+query,accessKey,sections.view&&!kpiList,outputTopic,revision);
  const snapshot=data.snapshot;
  useEffect(()=>{
    const restore=()=>{const current=readLocation();setLocation(current);setDraft({from:current.filter.from,to:current.filter.to});};
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  const choose=(nextTopic:DashboardTopic,next:DashboardFilters=filter,focusHeading=true,showKpiList=false)=>{
    const href=dashboardPath(nextTopic,next)+(showKpiList?'&dashboardKpi=plans':'');
    window.history.pushState(window.history.state,'',href);
    onLocation(window.location.href);
    setLocation({topic:nextTopic,filter:next,kpiList:showKpiList});
    if(next.from!==filter.from||next.to!==filter.to)setDraft({from:next.from,to:next.to});
    if((nextTopic!==topic||showKpiList!==kpiList)&&focusHeading)requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
  };
  const chooseLink=(href:string)=>{
    const search=new URL(href,window.location.origin).searchParams;
    choose(dashboardTopics.find(v=>v===search.get('dashboardTopic'))??'overview',filter,false);
  };
  const openRange=(period:typeof dashboardPeriods[number])=>{
    const from=period==='custom'?filter.from||snapshot?.period.from||formatWib(new Date().toISOString()).slice(0,10):'';
    const to=period==='custom'?filter.to||snapshot?.period.to||from:'';
    setDraft({from,to});
    choose(topic,{...filter,period,from,to});
  };
  const status=data.error===401||data.error===403?'denied':data.error===400?'rejected':snapshot?'stale':'error';
  const content=<>
    <AdminPageHeader title={t('dashboard')} subtitle={snapshot?t('asOf')+' · '+formatWib(snapshot.asOf)+' WIB':'WIB'}
      headingRef={heading} actions={sections.view&&<>
        {!outputTopic&&<Link href="/crm?tab=docs#crm-guide-dashboard-metrics">{t('metricsReference')}</Link>}
        {topic==='overview'&&canManageKpi&&<AdminPageAction icon={SlidersHorizontal} label={t('kpiSettings')}
          onClick={()=>choose('overview',filter,true,true)}/>}
        <AdminRefreshAction label={t('refresh')} loading={data.loading} onClick={()=>setRevision(v=>v+1)}/>
      </>}/>
    {sections.view&&!outputTopic&&<div className="ops-dash-filters">
      <AdminSingleSelect label={t('period')} value={filter.period} lang={lang} isLight={isLight}
        options={dashboardPeriods.map((value,index)=>({value,label:t(periodOptions[index])}))}
        onChange={value=>openRange(value as DashboardFilters['period'])}/>
      <AdminSingleSelect label={t('level')} value={filter.level} lang={lang} isLight={isLight}
        options={[{value:'',label:t('allLevels')},...dashboardLevels.map(value=>({value,label:value}))]}
        onChange={value=>choose(topic,{...filter,level:value as DashboardFilters['level']})}/>
      <AdminSingleSelect label={t('format')} value={filter.format} lang={lang} isLight={isLight}
        options={[{value:'',label:t('allFormats')},...dashboardFormats.map(value=>({value,label:t(value)}))]}
        onChange={value=>choose(topic,{...filter,format:value as DashboardFilters['format']})}/>
      {filter.period==='custom'&&<form onSubmit={event=>{event.preventDefault();choose(topic,{...filter,...draft});}}>
        <AdminDateField label={t('start')} value={draft.from} lang={lang} onChange={from=>setDraft(v=>({...v,from}))}/>
        <AdminDateField label={t('end')} value={draft.to} lang={lang} onChange={to=>setDraft(v=>({...v,to}))}/>
        <button type="submit" className="crm-work-button" disabled={!draft.from||!draft.to||draft.from>draft.to}>{t('apply')}</button>
      </form>}
      {(filter.period!=='month'||filter.level||filter.format)&&<button type="button" className="crm-work-button" onClick={()=>choose(topic,filterDefaults)}>{t('clear')}</button>}
    </div>}
    {!sections.view?<p className="ops-dash-feedback" role="alert">{t('denied')}</p>:
      data.error?<p className="ops-dash-feedback" role="alert">{t(status)}</p>:!snapshot?<p className="ops-dash-feedback" role="status">{t('load')}</p>:null}
  </>;
  const selected=snapshot?sameDate(snapshot.period.from,snapshot.period.to):'';
  const comparison=snapshot?sameDate(snapshot.period.compareFrom,snapshot.period.compareTo):'';
  const money=(value:number)=>formatCurrency(value,lang);
  const numeric=new Intl.NumberFormat(languageTag[lang]);
  const count=(n:number)=>numeric.format(n);
  const formatRate=new Intl.NumberFormat(languageTag[lang],{style:'percent',maximumFractionDigits:1});
  const rate=snapshot?.current.mature?snapshot.current.paidWithinWindow/snapshot.current.mature:null;
  const sampleNote=snapshot&&paymentSampleNote(snapshot.current,t,count);
  const earlierRate=snapshot?.compare.mature?snapshot.compare.paidWithinWindow/snapshot.compare.mature:null;
  const points=rate!==null&&earlierRate!==null?(rate-earlierRate)*100:null;
  const pointChange=points===null?null:<>
    {' · '+t('versus')+' '}<DashboardDelta value={Math.round(points*10)/10} format={count} unit={t('percentagePoints')}/>
  </>;
  const change=(n:number,render:(value:number)=>string=count)=><>{t('versus')} · <DashboardDelta value={n} format={render}/></>;

  function panels(data:DashboardSnapshot){
    if(topic==='acquisition')return <Acquisition data={data} t={t} lang={lang} isLight={isLight} filtered={Boolean(filter.level||filter.format)}
      canManageCampaigns={sections.marketing}/>;
    if(topic==='sales')return <Sales data={data} t={t}/>;
    if(topic==='classes')return <Classes data={data} filter={filter} t={t} lang={lang} onNavigate={onNavigate}/>;
    if(topic==='finance')return <Finance key={query} data={data} filter={filter} lang={lang} t={t} onNavigate={onNavigate}/>;
    if(topic==='teaching')return <Teaching data={data.teaching} t={t} lang={lang} allowed={sections.operations} onNavigate={onNavigate}/>;
    if(topic==='economics')return <>
      {sections.finance&&<Suspense fallback={<p role="status">{t('load')}</p>}>
        <TeacherSettlements lang={lang} isLight={isLight} asOf={data.asOf} refresh={revision} filter={filter}
          onFaculty={()=>onNavigate('/academics?policyTopic=faculty')}/>
      </Suspense>}
      {(!sections.finance||sections.operations)&&<CourseEconomics data={data.economics} t={t} lang={lang}
        allowed={sections.operations&&sections.finance} onNavigate={onNavigate}/>}
    </>;
    return <>
      <div className="ops-dash-kpis">
        <NumberCard label={t('first')} value={count(data.current.first)} note={<>{change(data.current.first-data.compare.first)}
          {data.current.identityUnknown>0&&' · '+t('firstIdentityPending')+' '+count(data.current.identityUnknown)}</>} onClick={()=>choose('acquisition')}/>
        <NumberCard label={t('paid')} value={count(data.current.paid)} note={change(data.current.paid-data.compare.paid)} onClick={()=>choose('sales')}/>
        <NumberCard label={t('net')} value={data.cash?money(data.cash.current.net):'—'}
          note={data.cash?change(data.cash.current.net-data.cash.compare.net,money):t('denied')} onClick={data.cash?()=>choose('finance'):undefined}/>
        <NumberCard label={t('rate')} value={rate===null?'—':formatRate.format(rate)}
          note={sampleNote??<>{data.current.paidWithinWindow} / {data.current.mature} · {t('completedWindow')}{pointChange}</>} onClick={()=>choose('acquisition')}/>
      </div>
      <div className="ops-dash-grid ops-dash-overview-grid">
        <OverviewTrends key={query} data={data} t={t} lang={lang}
          onDay={(target,date)=>choose(target,{...filter,period:'custom',from:date,to:date})}/>
        <Upcoming rows={data.upcoming} t={t} lang={lang} limited onNavigate={onNavigate}/>
      </div>
      <Queue data={data} t={t} onNavigate={onNavigate}/>
      <OverviewChanges data={data} t={t} lang={lang} isLight={isLight} dimension={changeDimension} measure={changeMeasure}
        onDimension={setChangeDimension} onMeasure={setChangeMeasure}
        onGroup={(dimension,value,measure)=>choose(measure==='net'?'finance':'sales',
          dimension==='level'?{...filter,level:value as DashboardFilters['level']}:{...filter,format:value as DashboardFilters['format']})}/>
      <AdminDisclosure heading={t('guide')} density="compact">
        <ul className="ops-dash-plain-list">
          <li>{t('trafficExplain')}</li><li>{t('netDefinition')}</li>
          <li>{t('missingIdentity')} · {data.current.identityUnknown}</li>
          <li>{t('missingTime')} · {data.current.timingUnknown}</li>
        </ul>
      </AdminDisclosure>
    </>;
  }
  const main=<div className="ops-dash-main">
    {kpiList?<CrmDashboardKpiList key={[canManageKpi,sections.finance].join('|')} lang={lang} isLight={isLight}
      allowed={canManageKpi} headingRef={heading} onBack={()=>choose('overview')}/>:<>
      {content}
      {snapshot&&sections.view&&<>
        {!outputTopic&&<p className="ops-dash-period">{selected} · WIB <span>{t('previous')} {comparison}</span></p>}
        <div className="ops-dash-content" data-wallboard={outputTopic||undefined} aria-busy={data.loading}>
          {outputTopic?<Wallboard data={snapshot} lang={lang} t={t} stale={Boolean(data.error)} />:panels(snapshot)}
        </div>
      </>}
    </>}
  </div>;
  return <section className="ops-dash" aria-label={t('dashboard')}>
    {sections.view?<AdminTopicFrame selection={topic} label={t(topic)} headingRef={heading} navigation={
      <AdminContentNav layout="directory" label={t('dashboard')} onNavigate={chooseLink}
        items={dashboardTopics.map(key=>({href:dashboardPath(key,filter),label:t(key),current:key===topic}))}/>
    }>{main}</AdminTopicFrame>:main}
  </section>;
}
