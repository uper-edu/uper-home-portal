import {IntegrationCredentialControl} from './IntegrationCredentials';
import {AdminDateField,completeAdminDateTime} from './admin/AdminDateField';
import {AdminRefreshAction} from './admin/AdminRefreshAction';
import {AdminTopicHeader} from './admin/AdminTopicHeader';
import {CrmPageAction} from './crm/CrmPageAction';
import {AdminConfirmation} from './admin/AdminConfirmation';
import {AdminDisclosure} from './admin/AdminDisclosure';
import {AdminListPagination,AdminListState,AdminListTable} from './admin/AdminList';
import {AdminStatus} from './AdminStatus';
import {AdminRowAction} from './admin/AdminListControl';
import {LARK_DEFAULT_LANGUAGE,LARK_DEFAULT_MAX_PER_HOUR} from '../utils/larkNotificationDefaults';
import {allowsLarkGroup, allowsLarkPersonal, LARK_GROUP, LARK_PERSONAL, MAX_NOTIFICATION_GROUPS, notificationGroupIds, policyDeliveryChannels} from '../utils/notificationGroupTargets';
import {LEAD_ASSIGNED_EVENT} from '../utils/leadAssignmentNotification';
import {larkNotificationColor} from '../utils/larkNotificationColors';
import {dailyDigestPreview} from '../utils/larkDailyDigest';
import {larkNotificationSample} from '../utils/larkNotificationSamples';
import {standardLarkKinds,type LarkKind,larkNotificationPreview} from '../utils/larkNotificationPresentation';
import {AdminFormFeedback,AdminSavedReadError,AdminFormSection,AdminFormSummary} from './AdminFormLayout';
import {CrmDiscardDialog} from './crm/CrmDetailWorkspace';
import { LarkChannelTestControls, type LarkChannelTest } from "./crm/LarkChannelTestControls";
import {crmFormText} from '../utils/crmFormLanguage';
import {isSalesProgressStage,progressLabel} from '../utils/crmSalesProgress';
import {AdminField,AdminRequiredNote,AdminFieldLabel} from './AdminForm';
import {notificationTopicIcons} from "./crm/notificationTopicIcons";
import {createElement} from "react";
import {AdminTopicFrame} from "./AdminTopicFrame";
import {notificationTopics} from "./crm/operationsSections";
import { AdminSingleSelect } from "./admin/AdminSingleSelect";
import { crmId } from "../utils/crmIndonesian";
import { notificationPlanningSummary } from '../utils/notificationPlanning';
import {
  crmLocale,
  crmValue,
  crmError,
  crmDeliveryResult,
} from "../utils/crmLanguage";
import SearchableChoices from "./SearchableChoices";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Plus,
  Settings2,
  Radio,
  History,
  Mail,
  MessageSquare,
  ShieldCheck,
  Play,
  Trash2,
  X,
} from "lucide-react";
export type Tab =
  | "notification-rules"
  | "notification-channels"
  | "notification-jobs"
  | "notification-audit"
  | "integration-readiness";
interface Rule {
  calendarMode?: "inherit" | "custom";
  event: string;
  channels: string[];
  recipient: string;
  team?: string;
  group: string;
  groupIds?: string[];
  sources: string[];
  tiers: string[];
  states: string[];
  teams?: string[];
  requiresRoutingReview?: boolean;
  timing: string;
  delayMinutes: number;
  digestTime: string;
  businessOnly: boolean;
  timezone: string;
  days: number[];
  start: string;
  end: string;
  dedupeMinutes: number;
  maxPerHour: number;
  retries: number[];
  template: string;
  language: string;
  quiet?: {
    start: string;
    end: string;
  };
}
interface Channel {
  revision?: number;
  appConfigured?: boolean;
  maxPerHour?: number;
  groupName?: string;
  teamName?: string;
  team?: string;
  webhookRevision?: string | null;
  mode: string;
  signingEnabled?: boolean;
  secretRef?: string;
  signingSecretRef?: string;
}
const PERSONAL_CHANNEL_ROW = "lark:personal";
// Older policy snapshots and delivery records can outlive the original channel row.
const historicalSystemGroupId = "CRM_Leads_Update";
interface Row {
  id: string;
  systemManaged?: boolean;
  testDelivery?: LarkChannelTest;
  config?: Rule & Channel;
  enabled?: boolean;
  version?: number;
  settingsVersion?: string;
  [key: string]: any;
}
const initialRule: Rule = {
  calendarMode: "inherit",
  event: "lead.created",
  channels: ["inapp"],
  recipient: "owner",
  group: "",
  groupIds: undefined,
  sources: [],
  tiers: [],
  states: [],
  timing: "immediate",
  delayMinutes: 0,
  digestTime: "18:00",
  businessOnly: true,
  timezone: "Asia/Jakarta",
  days: [1, 2, 3, 4, 5, 6],
  start: "09:00",
  end: "20:00",
  dedupeMinutes: 15,
  maxPerHour: LARK_DEFAULT_MAX_PER_HOUR,
  retries: [1, 5, 15],
  template: "{{event}} · {{name}} · {{owner}} · {{due}}",
  language: LARK_DEFAULT_LANGUAGE,
};
const editorTriggerId = (kind: "rule" | "channel", id: string) => `notification-${kind}-edit-${id}`;
const eventNames: Record<string, [string, string]> = {
  "commitment.due": ["客户约定到期", "Customer agreement due"],
  "lead.created": ["客户登记", "New lead"],
  [LEAD_ASSIGNED_EVENT]: ["客户已分配", "Customer assigned"],
  "conversation.updated": ["聊天更新", "Chat updated"],
  "conversation.reactivated": ["客户重新咨询", "Consultation reopened"],
  "handoff.requested": ["请求人工", "Human follow-up requested"],
  "booking.requested": ["预约申请", "Booking requested"],
  "enrollment.requested": ["报名申请", "Enrollment requested"],
  "assessment.completed": ["评测完成", "Assessment completed"],
  "task.created": ["任务新增", "Task created"],
  "task.rescheduled": ["任务改约", "Task rescheduled"],
  "task.appointment_due": ["约定时间已到", "Appointment due"],
  "task.overdue": ["跟进逾期", "Follow-up overdue"],
  "ai.failed": ["AI 调用失败", "AI failure"],
  "notification.failed": ["通知最终失败", "Notification failure"],
  "daily.digest": ["每日汇总", "Daily summary"],
};
const stateNames: Record<string, [string, string]> = {
  pending: ["待发送", "Pending"],
  sending: ["发送中", "Sending"],
  accepted: ["接口接受", "Accepted"],
  simulated: ["模拟完成", "Simulated"],
  failed: ["明确失败", "Failed"],
  unknown: ["结果未知", "Unknown"],
  cancelled: ["已取消", "Cancelled"],
};
const jobsPageSize=25;
const jobsPositionKey='uper_notification_jobs_position';
function notificationJobsLocation(){
  const params=typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);
  const state=params.get('deliveryState')??'all',page=Number(params.get('deliveryPage'));
  return {state:Object.hasOwn(stateNames,state)?state:'all',page:Number.isSafeInteger(page)&&page>0?page:1,job:params.get('job')};
}
async function api(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const r = await fetch("/api/crm/" + path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.error || String(r.status)), {
      status: r.status,
    });
  return data;
}
const split = (text: string) =>
  text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
export function pollNotificationReads(load: () => Promise<void>) {
  let polling = false;
  const refresh = async () => {
    if (polling) return;
    polling = true;
    try { await load(); }
    finally { polling = false; }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), 10000);
  return () => clearInterval(timer);
}

export default function NotificationCenter({
  isLight,
  lang,
  navigationRequest = 0,
  canEdit = true,
  embeddedTab,
  active = true,
}: {
  isLight: boolean;
  lang: "zh" | "en" | "id";
  navigationRequest?: number;
  canEdit?: boolean;
  embeddedTab?: Tab;
  active?: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const noticeRef=useRef<HTMLParagraphElement>(null);
  const zh = lang === "zh",
    t = (a: string, b: string) => (lang === "id" ? crmId(b) : zh ? a : b);
  const languageIndex = zh ? 2 : lang === "id" ? 1 : 0;
  const [open, setOpen] = useState(Boolean(embeddedTab)),
    [tab, setTab] = useState<Tab>(embeddedTab || "notification-rules"),
    [rows, setRows] = useState<Row[]>([]),
    [channels, setChannels] = useState<Row[]>([]);
  useEffect(() => {
    if (navigationRequest > 0) setOpen(true);
  }, [navigationRequest]);
  useEffect(() => {
    if (!embeddedTab && navigationRequest > 0 && open)
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [navigationRequest, open, embeddedTab]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false);
  const [auditRead,setAuditRead] = useState<"loading"|"ready"|"denied"|"error">("loading");
  const [editor, setEditor] = useState<"rule" | "channel" | null>(null),
    [key, setKey] = useState(""),
    [existing, setExisting] = useState(false),
    [routingReviewed, setRoutingReviewed] = useState(false),
    [rule, setRule] = useState<Rule>(initialRule),
    [channel, setChannel] = useState<Channel>({
      mode: "simulation",
      maxPerHour: LARK_DEFAULT_MAX_PER_HOUR,
    });
  const [webhookDraft, setWebhookDraft] = useState<string | null>();
  const [webhookStored, setWebhookStored] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [environmentGroupWebhook, setEnvironmentGroupWebhook] = useState(false);
  const [managedCredentials,setManagedCredentials]=useState(false);
  const [canManageCredentials,setCanManageCredentials]=useState(false);
  const [editingWebhook, setEditingWebhook] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<{id: string; name: string; version: string} | null>(null);
  const [channelDeleteError, setChannelDeleteError] = useState("");
  const [ruleToDelete, setRuleToDelete] = useState<{id: string; name: string; version: number} | null>(null);
  const [ruleDeleteError, setRuleDeleteError] = useState("");
  const [confirmWebhookClear, setConfirmWebhookClear] = useState(false);
  const editorPanel = useRef<HTMLDivElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const [awaitingSavedRead,setAwaitingSavedRead]=useState<Tab>();
  const editorReturn = useRef<string | null>(null);
  useEffect(() => {
    if (editor) {
      editorPanel.current?.scrollIntoView({ block: "start" });
      editorHeading.current?.focus({ preventScroll: true });
    }
  }, [editor]);
  useEffect(() => {
    const id=editorReturn.current;
    if (editor || busy || awaitingSavedRead===tab || !active || !id) return;
    const frame=requestAnimationFrame(()=>{
      const trigger=document.getElementById(id)??panelRef.current?.querySelector<HTMLElement>('.crm-page-action');
      trigger?.focus({preventScroll:true});
      editorReturn.current=null;
    });
    return()=>cancelAnimationFrame(frame);
  }, [editor,busy,active,awaitingSavedRead,tab]);
  const channelNameInput = useRef<HTMLInputElement>(null);
  const signingRefInput = useRef<HTMLInputElement>(null);
  const webhookInput = useRef<HTMLInputElement>(null);
  const webhookAction = useRef<HTMLButtonElement>(null);
  const undoWebhookAction = useRef<HTMLButtonElement>(null);
  const editorBaseline=useRef<string|null>(null);
  const editorVersion=useRef<number|string|null|undefined>(undefined);
  const [confirmEnable,setConfirmEnable]=useState(false);
  const [saveResult,setSaveResult]=useState<{requestId:string;lookup?:'missing'|'error'}>();
  const [settingsConflict,setSettingsConflict]=useState(false);
  const editorBlocked=busy||!!saveResult;

  const [discardEditor,setDiscardEditor]=useState<null|{run:()=>void}>(null);
  const editorSnapshot=JSON.stringify({key,config:editor==='rule'?rule:channel,routingReviewed,webhookEdited:webhookDraft!==undefined});
  const editorDirty=Boolean(editor&&editorBaseline.current!==null&&editorBaseline.current!==editorSnapshot);
  useEffect(()=>{if(editor&&editorBaseline.current===null)editorBaseline.current=editorSnapshot;if(!editor)editorBaseline.current=null;});
  useEffect(()=>{if(!editor){setWebhookDraft(undefined);setEditingWebhook(false);}},[editor]);
  useEffect(() => {
    if (webhookDraft === null) undoWebhookAction.current?.focus();
  }, [webhookDraft]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(editorDirty||busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[editorDirty,busy]);
  const leaveEditor=(run:()=>void)=>{if(editorBlocked)return;if(editorDirty)setDiscardEditor({run});else run();};
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({
    sources: [],
    tiers: [],
    states: [],
  });
  useEffect(() => setNotice(""), [lang]);
  const [routing, setRouting] = useState<any>(null);
  const [globalCalendar, setGlobalCalendar] = useState({
    timezone: "Asia/Jakarta",
    start: "09:00",
    end: "20:00",
    days: [1, 2, 3, 4, 5, 6],
    source: "fallback",
  });
  const [simulation, setSimulation] = useState<
      {
        channel: string;
        at: string;
      }[]
    >([]),
    [simulateAt, setSimulateAt] = useState(""),
    [jobsLocation,setJobsLocation] = useState(notificationJobsLocation),
    [cancelId, setCancelId] = useState(""),
    [cancelReason, setCancelReason] = useState("");
  const [cancelNeedsCheck,setCancelNeedsCheck]=useState(false);
  const [cancelFeedback,setCancelFeedback]=useState<{state:'error'|'unknown';message:string}>();
  const closeCancel=()=>{setCancelId('');setCancelReason('');setCancelFeedback(undefined);setCancelNeedsCheck(false);};
  const targetJob=jobsLocation.job;
  const [jobs,setJobs]=useState<{target:string|null;rows?:Row[];error?:string;denied?:boolean}>();
  const jobsTable=useRef<HTMLDivElement>(null);
  const readRequest=useRef(0);
  const jobsResult=jobs?.target===targetJob?jobs:undefined;
  const matchingJobs=jobsResult?.rows?.filter(row=>targetJob?row.id===targetJob:jobsLocation.state==='all'||row.state===jobsLocation.state);
  const jobPages=Math.max(1,Math.ceil((matchingJobs?.length??0)/jobsPageSize));
  const jobPage=Math.min(jobsLocation.page,jobPages);
  const visibleJobs=matchingJobs?.slice((jobPage-1)*jobsPageSize,jobPage*jobsPageSize);
  const changeJobsLocation=(state:string,page:number)=>{
    const url=new URL(window.location.href);
    if(state==='all')url.searchParams.delete('deliveryState');
    else url.searchParams.set('deliveryState',state);
    if(page===1)url.searchParams.delete('deliveryPage');
    else url.searchParams.set('deliveryPage',String(page));
    window.history.replaceState(window.history.state,'',url);
    setJobsLocation(notificationJobsLocation());
  };
  const openAllJobs=()=>{
    const url=new URL(window.location.href);
    url.searchParams.delete('job');
    window.history.pushState(window.history.state,'',url);
    setJobsLocation(notificationJobsLocation());
  };
  useEffect(()=>{
    if(tab!=='notification-jobs'||!active)return;
    const restore=()=>setJobsLocation(notificationJobsLocation());
    restore();
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[tab,active]);
  const rememberJobPosition=(event:React.MouseEvent<HTMLAnchorElement>,id:string)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
    const rowTop=event.currentTarget.closest('tr')?.getBoundingClientRect().top;
    try{sessionStorage.setItem(jobsPositionKey,JSON.stringify({
      url:window.location.pathname+window.location.search,id,rowTop,top:window.scrollY,left:jobsTable.current?.scrollLeft,
    }));}catch{}
  };
  const box = `rounded-2xl border ${isLight ? "bg-white border-slate-200/90" : "bg-slate-900 border-slate-800"}`;
  const muted = isLight ? "text-slate-500" : "text-slate-400";
  const input = `w-full h-9 px-3 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-primary-500/30 ${isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-950 border-slate-700 text-slate-200"}`;
  const button = `px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${isLight ? "border-slate-200 hover:bg-slate-50" : "border-slate-700 hover:bg-slate-800"}`;
  const primary =
    "px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold disabled:opacity-50";
  const patch = (value: Partial<Rule>) => {
    setRule((prev) => ({ ...prev, ...value }));
    setSimulation([]);
  };
  const load = useCallback(async () => {
    const request=++readRequest.current;
    setLoading(true);
    if(tab==='notification-jobs'){
      try{
        const data=await api(tab+(targetJob?'?job='+encodeURIComponent(targetJob):''));
        if(!Array.isArray(data))throw Error('Invalid delivery records response');
        if(request===readRequest.current){setJobs({target:targetJob,rows:data});setError('');}
      }catch(e){
        if(request===readRequest.current){
          const status=(e as {status?:number}).status;
          const denied=status===401||status===403;
          setJobs(previous=>({target:targetJob,...(!denied&&previous?.target===targetJob?{rows:previous.rows}:{}),
            error:(e as Error).message,denied}));
        }
      }finally{if(request===readRequest.current)setLoading(false);}
      return;
    }
    if(tab==='notification-audit')setAuditRead(previous=>previous==='ready'?'ready':'loading');
    try {
      const data = await api(tab);
      const ruleData = tab === "notification-rules" ? await Promise.all([
        api("notification-channels"),
        api("notification-calendar"),
        api("notification-options"),
        api("notification-routing"),
      ]) : undefined;
      if(request!==readRequest.current)return;
      if(tab==='notification-audit'){
        if(!Array.isArray(data))throw Error('Invalid notification history response');
        setAuditRead('ready');
      }
      if (tab === "notification-channels") {
        setEnvironmentGroupWebhook(data.groupWebhookUsesEnvironment === true);
        setManagedCredentials(data.managedCredentials === true);
        setCanManageCredentials(data.canManageCredentials === true);
      }
      setRows(
        tab === "integration-readiness"
          ? [{ id: "status", ...data }]
          : Array.isArray(data)
            ? data
            : tab === "notification-channels" && data.personalChannel
              ? [...(data.channels || []), { id: PERSONAL_CHANNEL_ROW, config: data.personalChannel, systemManaged: true, testDelivery: data.personalChannel.testDelivery }]
              : data.channels || [],
      );
      if (ruleData) {
        const [d, calendar, options, routingConfig] = ruleData;
        setChannels(d.channels || []);
        setGlobalCalendar(calendar);
        setFilterOptions(options);
        setRouting(routingConfig);
      }
      if (editorBaseline.current === null) setError("");
      setAwaitingSavedRead(topic=>topic===tab?undefined:topic);
      setDenied(false);
    } catch (e) {
      if(request!==readRequest.current)return;
      const status=(e as {status?:number}).status;
      if(tab==='notification-audit')setAuditRead(status===401||status===403?'denied':'error');
      else setError((e as Error).message);
      setDenied(status===401||status===403);
    } finally {
      if(request===readRequest.current)setLoading(false);
    }
  }, [tab,targetJob]);
  useEffect(() => {
    if (!open || !active) return;
    const stop = pollNotificationReads(load);
    return ()=>{stop();readRequest.current++;};
  }, [open,load,active,tab]);
  useEffect(()=>{if(notice){noticeRef.current?.focus({preventScroll:true});noticeRef.current?.scrollIntoView({block:'nearest',behavior:'instant'});}},[notice]);
  const focusedNotificationJob=useRef<string|null>(null);
  useEffect(()=>{
    if(!targetJob)focusedNotificationJob.current=null;
    if(!active||tab!=='notification-jobs'||!visibleJobs?.length)return;
    const frame=requestAnimationFrame(()=>{
      if(targetJob&&focusedNotificationJob.current!==targetJob){
        const node=document.getElementById('notification-job-'+targetJob);
        if(node){
          focusedNotificationJob.current=targetJob;
          const receipt=node.querySelector<HTMLDetailsElement>('details[data-job-receipt]');
          if(receipt)receipt.open=true;
          node.scrollIntoView({block:'center'});
          node.focus({preventScroll:true});
        }
      }
      try{
        const position=JSON.parse(sessionStorage.getItem(jobsPositionKey)??'null');
        if(position?.url!==window.location.pathname+window.location.search)return;
        sessionStorage.removeItem(jobsPositionKey);
        if(jobsTable.current&&typeof position.left==='number')jobsTable.current.scrollLeft=position.left;
        const row=document.getElementById('notification-job-'+position.id);
        row?.querySelector('a')?.focus({preventScroll:true});
        const top=row&&typeof position.rowTop==='number'
          ?window.scrollY+row.getBoundingClientRect().top-position.rowTop:position.top;
        window.scrollTo({top,behavior:'instant'});
      }catch{}
    });
    return ()=>cancelAnimationFrame(frame);
  },[jobsResult,jobPage,jobsLocation.state,tab,targetJob,active]);
  const cancelText=(zhText:string,enText:string,idText:string)=>lang==='zh'?zhText:lang==='id'?idText:enText;
  const finishCancel=async()=>{
    closeCancel();
    setNotice(t('通知已取消','Notification cancelled'));
    await load();
  };
  async function confirmCancel(){
    if(!canEdit||busy||cancelNeedsCheck||!cancelId||!cancelReason.trim())return;
    setBusy(true);setCancelFeedback(undefined);
    try{
      const outcome=await api('notification-jobs/'+encodeURIComponent(cancelId)+'/cancel',{reason:cancelReason});
      if(outcome.success!==true)throw Error();
      await finishCancel();
    }catch(cause){
      const status=(cause as {status?:number}).status;
      const rejected=Boolean(status&&status<500&&status!==409&&status!==404);
      setCancelNeedsCheck(!rejected);
      setCancelFeedback(rejected?{state:'error',message:crmError((cause as Error).message,lang)}:
        {state:'unknown',message:cancelText('取消结果待确认，请先查询这条通知。','Check this notification before trying again.','Periksa notifikasi ini sebelum mencoba lagi.')});
    }finally{setBusy(false);}
  }
  async function checkCancelled(){
    if(busy||!cancelId||!cancelNeedsCheck)return;
    setBusy(true);
    try{
      const records=await api('notification-jobs?job='+encodeURIComponent(cancelId));
      const job=Array.isArray(records)?records.find(row=>row.id===cancelId):undefined;
      if(!job)throw Error();
      if(job.state==='cancelled'){await finishCancel();return;}
      if(job.state==='pending'){
        setCancelNeedsCheck(false);
        setCancelFeedback({state:'unknown',message:cancelText('通知仍在排队，可以再次确认取消。','The notification is still queued. You can confirm cancellation again.','Notifikasi masih dalam antrean. Anda dapat mengonfirmasi pembatalan lagi.')});
        return;
      }
      closeCancel();
      setNotice(cancelText('通知已开始处理，无法取消。请查看发送状态。','The notification has started processing and can no longer be cancelled. Review its delivery state.','Notifikasi sudah diproses dan tidak dapat dibatalkan. Periksa status pengiriman.'));
      await load();
    }catch{
      setCancelFeedback({state:'unknown',message:cancelText('暂时无法查询这条通知，请稍后核对。','This notification is unavailable. Try checking again later.','Notifikasi belum dapat diperiksa. Coba lagi nanti.')});
    }finally{setBusy(false);}
  }
  const format = (value: string | undefined) =>
    value ? new Date(value).toLocaleString(crmLocale(lang)) : "—";
  const label = (name: string) =>
    (lang === "id"
      ? crmId(eventNames[name]?.[1])
      : eventNames[name]?.[zh ? 0 : 1]) || name;
  const connectionLabel = (row: Row) =>
    (
      ({
        simulation: t("模拟模式 · 不真实发送", "Simulation · no live delivery"),
        missing_webhook: t(
          "未连接 · Webhook 未配置或无法读取",
          "Not connected · Webhook missing or unreadable",
        ),
        missing_signing_secret: t(
          "未连接 · 缺少签名密钥",
          "Not connected · missing signing secret",
        ),
        configured: t(
          "已配置 · 待群内实收确认",
          "Configured · group receipt not verified",
        ),
      }) as Record<string, string>
    )[row.connection?.status] ||
    t("配置状态未确认", "Configuration status unverified");
  const assignmentRule = rule.event === LEAD_ASSIGNED_EVENT;
  const personalChannelEditor = editor === "channel" && key === PERSONAL_CHANNEL_ROW;
  const systemGroupEditor = editor === "channel" && !personalChannelEditor && rows.some(row => row.id === key && row.systemManaged);
  const selectedGroupIds = notificationGroupIds(rule);
  const ruleConfig = { ...rule, group: "", groupIds: selectedGroupIds };
  const conflictRow=settingsConflict?rows.find(row=>row.id===key):undefined;
  const freshConflict=conflictRow&&(editor==='rule'?conflictRow.version!==editorVersion.current:
    personalChannelEditor?conflictRow.config?.revision!==editorVersion.current:conflictRow.settingsVersion!==editorVersion.current);
  const systemGroupLabel = t("Lark 群通知", "Lark group notifications");
  const isSystemGroupReference = (id: string) => {
    const row = channels.find(channel => channel.id === id);
    return row ? row.systemManaged === true : id === historicalSystemGroupId;
  };
  const groupName = (id: string) => isSystemGroupReference(id)
    ? systemGroupLabel : channels.find(channel => channel.id === id)?.config?.groupName || id;
  const groupChoices = channels.map(row => ({value: row.id, label: groupName(row.id)}));
  if (selectedGroupIds.includes(historicalSystemGroupId) && !channels.some(row => row.id === historicalSystemGroupId)) {
    groupChoices.push({value: historicalSystemGroupId, label: systemGroupLabel});
  }
  const groupNames = (ids: string[]) => ids.map(groupName).join(zh ? "、" : ", ");
  const channelLabel = (channel: string) => channel === LARK_GROUP
    ? systemGroupLabel
    : channel === LARK_PERSONAL ? t("Lark 个人通知", "Lark personal notifications") : t("站内消息", "In-app messages");
  const groupDeliveryLabel = (ids: string[]) => ids.length === 1 && isSystemGroupReference(ids[0])
    ? channelLabel(LARK_GROUP)
    : channelLabel(LARK_GROUP) + " · " + (groupNames(ids) || t("未命名群", "Unnamed group"));
  const usesGroup = rule.channels.includes(LARK_GROUP);
  const usesPersonal = rule.channels.includes(LARK_PERSONAL);
  const usesLark = usesGroup || usesPersonal;
  const channelOptions = ["inapp", ...(allowsLarkGroup(rule.event) ? [LARK_GROUP] : []),
    ...(allowsLarkPersonal(rule.event) ? [LARK_PERSONAL] : [])];
  const timed = usesLark || rule.event === "daily.digest";
  const field = (title: string, child: React.ReactNode, hint?: string, required?:boolean) => (
    <AdminField required={required} className="block space-y-1.5">
      <span className="text-xs font-semibold">{title}</span>
      {child}
      {hint && <span className={`block text-[11px] ${muted}`}>{hint}</span>}
    </AdminField>
  );
  const text = (
    title: string,
    value: string,
    onChange: (v: string) => void,
    hint?: string,
  ) =>
    field(
      title,
      <input
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />,
      hint,
    );
  const list = (
    title: string,
    value: string[],
    onChange: (v: string[]) => void,
    hint?: string,
  ) =>
    field(
      title,
      <input
        key={key + title}
        className={input}
        defaultValue={value.join(", ")}
        onBlur={(e) => onChange(split(e.target.value))}
      />,
      hint,
    );
  const select = (
    title: string,
    value: string,
    options: [string, string][],
    onChange: (v: string) => void,
  ) =>
    field(
      title,
      <AdminSingleSelect
        label={title}
        value={value}
        options={options.map(([value, label]) => ({ value, label }))}
        onChange={onChange}
        lang={lang}
        isLight={isLight}
      />,
      undefined, [t("运行方式", "Operation mode"),t("Lark 群渠道", "Lark group channel")].includes(title)||undefined,
    );
  const number = (
    title: string,
    value: number,
    onChange: (v: number) => void,
  ) =>
    field(
      title,
      <input
        className={input}
        type="number"
        min="0"
        max="10080"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />,
    );
  const section = (title: string | undefined, children: React.ReactNode) => {
    const fields = <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" data-admin-grid="">{children}</div>;
    return title
      ? <AdminFormSection className="crm-form-section notification-form-section" title={title}>{fields}</AdminFormSection>
      : fields;
  };
  const finishSettingsSave=async()=>{
    setSaveResult(undefined);
    setEditor(null);
    setNotice('');
    setAwaitingSavedRead(tab);
    await load();
  };
  const checkSettingsSave=async()=>{
    if(busy||!canEdit||!saveResult)return;
    setBusy(true);
    try{
      const receipt=await api('notification-settings/results/'+encodeURIComponent(saveResult.requestId));
      if(receipt?.success!==true)throw Error();
      await finishSettingsSave();
    }catch(error){
      setSaveResult({...saveResult,lookup:(error as {status?:number}).status===404?'missing':'error'});
    }finally{setBusy(false);}
  };
  async function save(enabled: boolean) {
    if(!canEdit||editorBlocked||settingsConflict)return;
    setConfirmEnable(false);
    let submitted=false;
    const requestId=crypto.randomUUID();
    const expectedVersion=editorVersion.current;
    const persist=(path:string,config:object)=>{
      submitted=true;
      return api(path,{...config,requestId,expectedVersion});
    };
    setBusy(true);
    setError("");
    try {
      if (!personalChannelEditor && !/^[a-zA-Z0-9_.-]{1,100}$/.test(key))
        throw Error("Use letters, numbers, dots, hyphens and underscores for the ID");
      if (editor === "rule") {
        if (!rule.channels.length) {
          editorPanel.current?.querySelector<HTMLInputElement>(".notification-rule-channels input")?.focus();
          throw Error("Select at least one channel");
        }
        if (usesGroup &&
            (!selectedGroupIds.length || selectedGroupIds.length > MAX_NOTIFICATION_GROUPS ||
              selectedGroupIds.some(id => !channels.some(channel => channel.id === id)))) {
          editorPanel.current?.querySelector<HTMLButtonElement>(".notification-rule-group-select [role=combobox]")?.focus();
          throw Error(!selectedGroupIds.length ? "Select at least one Lark group channel."
            : selectedGroupIds.length > MAX_NOTIFICATION_GROUPS ? "Select up to 20 distinct Lark group channels."
            : "One or more Lark group channels are no longer available.");
        }
        await persist("notification-rules/" + encodeURIComponent(key), {
          config: ruleConfig,
          enabled,
          confirmRoutingReset: routingReviewed,
        });
      } else if (personalChannelEditor) {
        await persist("notification-personal-channel",{mode:channel.mode,revision:channel.revision});
      } else {
        const config = { ...channel };
        if (!systemGroupEditor && !config.groupName?.trim()) {
          channelNameInput.current?.focus();
          throw Error("Enter a channel name.");
        }
        if (systemGroupEditor) delete config.groupName;
        delete config.team;
        delete config.teamName;
        if (editingWebhook && !webhookDraft?.trim()) {
          webhookInput.current?.focus();
          throw Error("Paste the Lark group bot Webhook address.");
        }
        if (config.mode === "simulation" && !managedCredentials) {
          delete config.signingSecretRef;
          delete config.signingEnabled;
        } else if (config.mode === "live") {
          if (!webhookStored && !webhookDraft && (!existing || rows.find(row => row.id === key)?.config?.mode !== "live"))
            throw Error("Save a Webhook before enabling live delivery.");
          config.signingEnabled = !!config.signingEnabled;
          if (canManageCredentials && !managedCredentials && config.signingEnabled && !config.signingSecretRef?.trim()) {
            signingRefInput.current?.focus();
            throw Error("Signing requires a secret reference");
          }
          if (!config.signingEnabled) delete config.signingSecretRef;
        }
        if(managedCredentials||!canManageCredentials){delete config.signingSecretRef;delete config.secretRef;}
        if(!canManageCredentials)delete config.signingEnabled;
        await persist("notification-channels/" + encodeURIComponent(key), {
          ...config,
          webhook: managedCredentials||!canManageCredentials ? undefined : typeof webhookDraft === "string" ? webhookDraft.trim() : webhookDraft,
        });
      }
      await finishSettingsSave();
    } catch (e) {
      const failure=e as Error&{status?:number};
      if(submitted&&(!failure.status||failure.status>=500)){
        setSaveResult({requestId});
      }else if(failure.message==='notification_settings_conflict'){
        setSettingsConflict(true);
        await load();
      }else setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteChannel(target: NonNullable<typeof channelToDelete>) {
    const path = "notification-channels/" + encodeURIComponent(target.id);
    setChannelToDelete(null);
    setChannelDeleteError("");
    setNotice("");
    setBusy(true);
    try {
      try {
        await api(path, {version: target.version}, "DELETE");
      } catch (error) {
        const status = (error as {status?: number}).status;
        if (status && status < 500) throw error;
        const current = await api("notification-channels").catch(() => null);
        if (!Array.isArray(current?.channels) || current.channels.some((row: Row) => row.id === target.id))
          throw Error("Deletion outcome could not be confirmed. Refresh the channel list to check.");
      }
      setRows(current => current.filter(row => row.id !== target.id));
      setNotice(t("通知渠道已删除。", "Notification channel deleted."));
      await load();
    } catch (error) {
      setChannelDeleteError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteRule(target: NonNullable<typeof ruleToDelete>) {
    setRuleToDelete(null);
    setRuleDeleteError("");
    setNotice("");
    setBusy(true);
    try {
      try {
        await api("notification-rules/" + encodeURIComponent(target.id), {version: target.version}, "DELETE");
      } catch (error) {
        const status = (error as {status?: number}).status;
        if (status && status < 500) throw error;
        const current = await api("notification-rules").catch(() => null);
        if (!Array.isArray(current) || current.some((row: Row) => row.id === target.id))
          throw Error("Policy deletion outcome is unknown. Refresh the list to check.");
      }
      setRows(current => current.filter(row => row.id !== target.id));
      setNotice(t("通知策略已删除。", "Notification policy deleted."));
      await load();
    } catch (error) {
      setRuleDeleteError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(row?: Row) {leaveEditor(()=>openEditor(row));}
  function openEditor(row?: Row) {
    editorBaseline.current=null;
    editorVersion.current=tab==='notification-rules'?Number(row?.version??0):
      row?.id===PERSONAL_CHANNEL_ROW?row.config?.revision:row?row.settingsVersion:null;
    setSettingsConflict(false);
    setSaveResult(undefined);
    setWebhookDraft(undefined);
    setEditingWebhook(false);
    setNotice("");
    setError("");
    setRoutingReviewed(false);
    setSimulation([]);
    setSimulateAt("");
    setExisting(!!row);
    setKey(row?.id || "");
    editorReturn.current = editorTriggerId(tab === "notification-rules" ? "rule" : "channel", row?.id || "");
    if (tab === "notification-rules") {
      setRule(
        row?.config ? { ...initialRule, ...row.config, channels: policyDeliveryChannels(row.config) } : structuredClone(initialRule),
      );
      setEditor("rule");
    } else {
      setWebhookStored(Boolean(row?.connection?.webhookStored));
      setWebhookConfigured(Boolean(row?.connection?.webhookConfigured));
      setChannel(
        row
          ? ({
              ...row.config,
              signingEnabled:
                row.config?.signingEnabled ?? !!row.config?.signingSecretRef,
              maxPerHour:
                row.rateLimit?.maxPerHour ?? row.config?.maxPerHour ?? LARK_DEFAULT_MAX_PER_HOUR,
            } as Channel)
          : {
              mode: "simulation",
              maxPerHour: LARK_DEFAULT_MAX_PER_HOUR,
            },
      );
      if (!row) setKey("lark-" + crypto.randomUUID().slice(0, 12));
      setEditor("channel");
    }
  }
  const tabs: [Tab, string, typeof Bell][] = [
    ["notification-channels", t("渠道配置", "Channels"), Radio],
    ["notification-rules", t("通知策略", "Policies"), Settings2],
    ["notification-jobs", t("发送记录", "Delivery records"), Bell],
    ["notification-audit", lang==='id'?'Riwayat eksekusi dan perubahan':t("执行与修改记录", "Execution & change history"), History],
    ["integration-readiness", t("联调检查", "Integration checks"), ShieldCheck],
  ];
  const isRuleTopic = tab === "notification-rules";
  const isChannelTopic = tab === "notification-channels";
  const notificationHeading = notificationTopics.find(topic => topic.id === tab)!;
  return (
    <section
      data-admin-form="" ref={panelRef}
      style={{ scrollMarginTop: 128 }}
      className={`${embeddedTab?"notification-topic-content":box+" p-5"} space-y-4 ${isLight ? "text-slate-800" : "text-slate-200"}`}
    >
      <div style={embeddedTab?{display:"none"}:undefined} hidden={Boolean(embeddedTab)} className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="p-2 h-fit rounded-xl bg-primary-500/10 text-primary-500">
            <Bell className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-bold text-sm">
              {t(
                "7. 通知设置与发送审计",
                "7. Notification settings & delivery audit",
              )}
            </h3>
            <p className={`text-xs mt-1 ${muted}`}>
              {t(
                "配置事件、收件人与发送时间；客户跟进仍在 客户列表处理。通知策略和渠道分别使用本区域的保存按钮。",
                "Configure events, recipients and delivery timing. Handle follow-ups in Leads. Save notification policies and channels using the buttons in this section.",
              )}
            </p>
          </div>
        </div>
        <button
          className={button}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          <span className="sr-only">
            {t(
              "展开或收起通知设置",
              "Expand or collapse notification settings",
            )}
          </span>
        </button>
      </div>
      {discardEditor&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscardEditor(null)} onDiscard={()=>{const run=discardEditor.run;setDiscardEditor(null);run();}}/>}
      {channelToDelete && (
        <CrmDiscardDialog lang={lang} isLight={isLight} tone="danger"
          title={t("删除通知渠道？", "Delete notification channel?")}
          description={t("将删除 {name} 的连接设置。历史发送记录仍可查看。", "Connection settings for {name} will be deleted. Past delivery records remain available.").replace("{name}", () => channelToDelete.name)}
          keepLabel={t("取消", "Cancel")}
          discardLabel={t("确认删除", "Confirm deletion")}
          onKeep={() => setChannelToDelete(null)}
          onDiscard={() => void deleteChannel(channelToDelete)}
        />
      )}
      {channelDeleteError && <p role="alert" className="notification-channel-delete-error" data-unknown={channelDeleteError.startsWith("Deletion outcome")}>{crmError(channelDeleteError, lang)}</p>}
      {ruleToDelete && (
        <CrmDiscardDialog lang={lang} isLight={isLight} tone="danger"
          title={t("删除通知策略？", "Delete notification policy?")}
          description={t(
            "删除「{name}」后，后续事件将不再使用此策略。已排队的通知仍按原计划处理，发送记录和变更历史仍可查看。",
            "After deleting {name}, future events will no longer use this policy. Queued notifications will still be processed, and delivery and change history will remain available.",
          ).replace("{name}", () => ruleToDelete.name)}
          keepLabel={t("取消", "Cancel")}
          discardLabel={t("确认删除", "Confirm deletion")}
          onKeep={() => setRuleToDelete(null)}
          onDiscard={() => void deleteRule(ruleToDelete)}
        />
      )}
      {ruleDeleteError && <p role="alert" className="notification-channel-delete-error" data-unknown={ruleDeleteError.startsWith("Policy deletion outcome")}>{crmError(ruleDeleteError, lang)}</p>}
      {active&&confirmEnable&&<AdminConfirmation light={isLight}
        title={editor==='rule'?cancelText('保存并启用策略？','Save and enable this policy?','Simpan dan aktifkan kebijakan ini?'):
          cancelText('启用真实发送？','Enable live delivery?','Aktifkan pengiriman langsung?')}
        description={editor==='rule'?
          cancelText('保存后，新事件将按此策略和所选渠道处理。','New events will use this policy and the selected channels.','Peristiwa baru memakai kebijakan dan kanal yang dipilih.'):
          cancelText('保存后，此渠道可向配置的 Lark 目标发送符合条件的通知。','This channel can send eligible notifications to its configured Lark destination.','Kanal ini dapat mengirim notifikasi yang memenuhi syarat ke tujuan Lark.')}
        cancelLabel={cancelText('取消','Cancel','Batal')} confirmLabel={cancelText('确认启用','Enable','Aktifkan')}
        onCancel={()=>setConfirmEnable(false)} onConfirm={()=>void save(true)}/>}
      {confirmWebhookClear && (
        <CrmDiscardDialog lang={lang} isLight={isLight} tone="danger"
          title={t("清除群机器人地址？", "Clear the group bot address?")}
          description={t("保存后，此渠道将无法向 Lark 群发送通知。", "After saving, this channel will stop sending to the Lark group.")}
          keepLabel={t("取消", "Cancel")}
          discardLabel={t("标记为待清除", "Mark for removal")}
          onKeep={() => setConfirmWebhookClear(false)}
          onDiscard={() => {setConfirmWebhookClear(false);setWebhookDraft(null);}}
        />
      )}
      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2" hidden={Boolean(embeddedTab)} style={embeddedTab?{display:"none"}:undefined}>
            <div
              style={embeddedTab?{display:"none"}:undefined} hidden={Boolean(embeddedTab)}
              className={`flex flex-wrap gap-1 p-1 rounded-xl border ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-800 border-slate-700"}`}
            >
              {tabs.map(([value, title, Icon]) => (
                <button
                  key={value}
                  onClick={() => leaveEditor(() => {
                    setTab(value);
                    setRows([]);
                    setEditor(null);
                    setNotice("");
                    closeCancel();
                  })}
                  className={`flex gap-1.5 items-center px-3 py-2 rounded-lg text-xs font-semibold ${tab === value ? (isLight ? "bg-white text-primary-700 shadow-2xs" : "bg-primary-600 text-white") : muted}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {title}
                </button>
              ))}
            </div>
          </div>
          <AdminTopicHeader isLight={isLight} title={notificationHeading.title[languageIndex]}
            subtitle={notificationHeading.purpose[languageIndex]} actions={!editor&&!denied&&<>
              <AdminRefreshAction label={t("刷新", "Refresh")} loading={loading} onClick={()=>void load()}/>
              {(isRuleTopic||isChannelTopic)&&canEdit&&<CrmPageAction icon={Plus} variant="primary"
                id={editorTriggerId(isRuleTopic?'rule':'channel','')}
                label={isRuleTopic?t('新增策略','Add policy'):t('新增渠道','Add channel')} onClick={()=>edit()}/>}
            </>}/>
          {error&&!denied&&!editor&&awaitingSavedRead===tab&&<AdminSavedReadError lang={lang} busy={loading} onRetry={()=>void load()}/>}
          {error && !editor && (denied||awaitingSavedRead!==tab) && (tab!=="notification-jobs"||cancelId) && (
            <p
              role="alert"
              className="text-xs p-3 rounded-lg bg-rose-500/10 text-rose-500"
            >
              {denied
                ? t(
                    "此账号没有通知管理权限，请联系管理员。",
                    "This account has no notification management permission.",
                  )
                : crmError(error, lang)}
            </p>
          )}
          {notice && (
            <p ref={noticeRef} tabIndex={-1}
              role="status"
              className="text-xs p-3 rounded-lg bg-emerald-500/10 text-emerald-600"
            >
              {notice}
            </p>
          )}
          {(!denied||tab==="notification-jobs"||tab==="notification-audit") && (
            <>
              {tab !== "notification-channels" && !editor && <div className="notification-topic-toolbar">
                <p className={`text-xs ${muted}`}>
                  {tab === "notification-rules"
                    ? t(
                        "启用仅作用于新事件。已排队任务保留原版本，停用规则不会自动取消它们。生效前已错过的约定时间不补发，历史失败仍可查。",
                        "Activation applies to new events. Queued jobs retain their policy version; disabling does not cancel them. Appointments missed before activation are not replayed; historical failures remain visible.",
                      )
                      : tab === "notification-jobs"
                        ? t(
                            "接口接受不代表员工已读或已跟进。结果未知请人工核查，避免重复发送。",
                            "Accepted does not mean read or followed up. Check unknown results manually before resending.",
                          )
                        : tab === "notification-audit"
                          ? t(
                              "通知规划结果、未生成作业的原因、策略版本及修改操作，最多显示最近200条。规划完成不等于已送达。",
                              "Notification planning results, reasons for no job, policy versions and changes. Latest 200 records. Planned does not mean delivered.",
                            )
                          : t(
                              "配置检查不代表真实平台联调或群内实收通过。",
                              "Configuration checks do not prove live identity integration or receipt in the group.",
                            )}
                </p>
              </div>}
              {tab === "notification-rules" && routing && !editor && (
                <details className="notification-routing text-xs">
                  <summary className="font-bold cursor-pointer">
                    {t("全局通知路由", "Global notification routing")}
                  </summary>
                  <p>
                    {t(
                      "站内客户通知默认通知有效负责人；未分配或负责人无效时通知有权处理该客户的 CRM 管理者。只改变收件人，不修改客户归属。",
                      "In-app lead notifications go to a valid Owner; otherwise to authorized CRM Managers. Routing does not assign ownership.",
                    )}
                  </p>
                  <p className={muted}>
                    {t(
                      "客户分配只通知新负责人。其他 Lark 通知按各策略发送。运营异常和每日汇总由有权限的 CRM 管理者接收。",
                      "Assignment notices go only to the new owner. Other Lark notices follow their policies. Authorized CRM Managers receive operational incidents and daily summaries.",
                    )}
                  </p>
                  <p>
                    {t("身份目录", "Identity directory")}：
                    {routing.identityMode === "local"
                      ? lang === "id"
                        ? crmId("Local staff accounts")
                        : lang === "zh"
                          ? "本地员工账号"
                          : "Local staff accounts"
                      : routing.identityMode === "mock"
                        ? t("本地模拟", "Local mock")
                        : t("平台", "Platform")}{" "}
                    · {t("有效 CRM 管理者", "Eligible CRM Managers")}：
                    {routing.leaders.map((e: any) => e.id).join(", ") ||
                      t("未配置", "None configured")}
                  </p>
                </details>
              )}
              {editor && (
                <div
                  ref={editorPanel}
                  className={`crm-form-layout notification-form-editor${editor === "channel" ? " notification-channel-editor" : " notification-rule-editor"}`}
                  aria-label={t(
                    "通知配置表单",
                    "Notification configuration form",
                  )}
                >
                  <header className="admin-edit-header" data-theme={isLight?'light':'dark'}>
                    <div className="admin-edit-title">
                      <h4 ref={editorHeading} tabIndex={-1}>
                        {editor === 'rule'
                          ? (existing ? t('编辑通知策略','Edit notification policy') : t('新增策略','Add policy'))
                          : personalChannelEditor ? t("编辑 Lark 个人渠道", "Edit Lark personal channel") : t('编辑 Lark 渠道','Edit Lark channel')}
                        <AdminRequiredNote lang={lang} inline/>
                      </h4>
                      {editorDirty && <span className="crm-form-draft-status" role="status">{crmFormText(lang,'unsaved')}</span>}
                    </div>
                  <div className="admin-edit-actions">
                    {saveResult?<button type="button" className="crm-work-button" disabled={!canEdit||busy} onClick={()=>void checkSettingsSave()}>
                      {cancelText('查询保存结果','Check save result','Periksa hasil simpan')}</button>:<>
                      {editor==='rule'&&<button type="button" className="crm-work-button" disabled={!canEdit||busy||settingsConflict}
                        onClick={()=>void save(false)}>{t('保存为停用草稿','Save inactive draft')}</button>}
                      <button type="button" className="crm-work-button" data-primary
                        disabled={!canEdit||busy||settingsConflict} onClick={event=>{
                          if(editor==='rule'||channel.mode==='live'&&rows.find(row=>row.id===key)?.config?.mode!=='live'){
                            event.currentTarget.focus({preventScroll:true});
                            setConfirmEnable(true);
                          }else void save(true);
                        }}>{busy?t('保存中…','Saving…'):editor==='rule'?t('保存并启用','Save and enable'):t('保存','Save')}</button>
                    </>}
                  </div>
                    <button type="button" className="crm-work-button admin-edit-close"
                      disabled={editorBlocked} onClick={()=>leaveEditor(()=>{setEditor(null);setError('');})}>
                      <X className="w-4 h-4" aria-hidden="true"/><span className="sr-only">{t('关闭编辑','Close editor')}</span>
                    </button>
                    {saveResult?<AdminFormFeedback state="unknown" lang={lang} className="admin-edit-feedback">
                      {saveResult.lookup==='missing'?cancelText('暂未查到保存回执，草稿已保留。','No receipt yet. The draft is retained.','Belum ada bukti simpan. Draf tetap disimpan.'):
                        saveResult.lookup==='error'?cancelText('查询失败，保存结果仍待确认。','Lookup failed. The save result remains unconfirmed.','Pencarian gagal. Hasil simpan belum terkonfirmasi.'):undefined}
                    </AdminFormFeedback>:settingsConflict?<AdminFormFeedback state="error" lang={lang} className="admin-edit-feedback">
                      {cancelText('此记录已在别处更新，草稿仍保留。请核对当前配置，再重新打开编辑。','This record changed elsewhere. The draft is retained. Review the current configuration before reopening the editor.','Catatan ini telah berubah. Draf tetap disimpan. Tinjau pengaturan terbaru sebelum membuka editor kembali.')}
                    </AdminFormFeedback>:error&&<AdminFormFeedback state="error" lang={lang} className="admin-edit-feedback">{crmError(error,lang)}</AdminFormFeedback>}
                  </header>
                  {settingsConflict&&<AdminFormSection variant="subgroup" title={cancelText('当前配置','Current configuration','Pengaturan terkini')}
                    actions={<AdminRefreshAction loading={loading} disabled={busy}
                      label={cancelText('刷新','Refresh','Segarkan')} onClick={()=>void load()}/>}>
                    {freshConflict&&conflictRow.config?<AdminFormSummary fields={editor==='rule'?[
                      [cancelText('版本','Version','Versi'),conflictRow.version],
                      [t('状态','Status'),conflictRow.enabled?t('已启用','Enabled'):t('停用 / 草稿','Inactive / draft')],
                      [t('业务事件','Business event'),label(conflictRow.config.event)],
                      [t('通知渠道','Delivery channels'),policyDeliveryChannels(conflictRow.config).map(channelLabel).join(' · ')],
                    ]:[
                      [t('渠道名称','Channel name'),conflictRow.config.groupName??(personalChannelEditor?cancelText('Lark 个人渠道','Lark personal channel','Kanal pribadi Lark'):key)],
                      [t('发送模式','Delivery mode'),conflictRow.config.mode==='live'?t('真实发送','Live delivery'):t('模拟发送','Simulation')],
                      ...(!personalChannelEditor?[[t('每小时发送上限','Hourly delivery limit'),conflictRow.config.maxPerHour??LARK_DEFAULT_MAX_PER_HOUR] as const]:[]),
                    ]}/>:<p className="notification-channel-help">
                      {cancelText('当前未能读取新版配置。','The newer configuration is unavailable.','Pengaturan terbaru belum dapat dibaca.')}
                    </p>}
                  </AdminFormSection>}
                  <fieldset className="notification-editor-fields" disabled={editorBlocked||!canEdit}>
                  {editor === "rule" ? (
                    <div className="notification-rule-body">
                      {section(
                        t("触发条件", "Trigger conditions"),
                        <>
                          {!existing && field(
                            t("配置标识", "Configuration ID"),
                            <input className={input} value={key} required
                              onChange={(e) => setKey(e.target.value)} placeholder="crm-followup"/>,
                            undefined,
                            true,
                          )}
                          <SearchableChoices
                            required
                            title={t("业务事件", "Business event")}
                            values={[rule.event]}
                            choices={Object.entries(eventNames).filter(([key])=>!['task.created','task.rescheduled','task.appointment_due'].includes(key)).map(
                              ([value, n]) => ({
                                value,
                                label:
                                  lang === "id" ? crmId(n[1]) : n[zh ? 0 : 1],
                              }),
                            )}
                            onChange={([event]) => {
                              if (!event) return;
                              patch({
                                event,
                                channels: rule.channels.filter(channel =>
                                  (channel !== LARK_GROUP || allowsLarkGroup(event)) &&
                                  (channel !== LARK_PERSONAL || allowsLarkPersonal(event))),
                                ...(!allowsLarkGroup(event) ? { group: "", groupIds: [] } : {}),
                              });
                            }}
                            zh={zh}
                            lang={lang}
                            isLight={isLight}
                            multiple={false}
                          />
                          <p
                            className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                          >
                            {t(
                              "各项筛选需同时满足，留空表示不限。",
                              "All selected filters must match. Leave blank for all.",
                            )}
                          </p>
                          {(["sources", "tiers", "states"] as const).map(
                            (key) => {
                              const labels: Record<string, [string, string]> = {
                                homepage_widget: [
                                  "主页助手",
                                  "Homepage assistant",
                                ],
                                standalone_chat: [
                                  "独立聊天",
                                  "Standalone chat",
                                ],
                                legacy_unknown: [
                                  "历史来源未知",
                                  "Unknown legacy source",
                                ],
                                Unqualified: ["待确认等级", "Unqualified"],
                                Hot: ["高意向", "Hot"],
                                "Warm-Offline": [
                                  "常规意向·线下",
                                  "Warm · offline",
                                ],
                                "Warm-Online": [
                                  "常规意向·线上",
                                  "Warm · online",
                                ],
                                School: ["院校合作", "School partnership"],
                                "Cold-Nurture": ["培育客户", "Cold nurture"],
                                New: ["待初访", "New"],
                                Contacted: ["已建联", "Contacted"],
                                "Assessment Booked": [
                                  "已约测评",
                                  "Assessment booked",
                                ],
                                "Assessment Done": [
                                  "测评完成",
                                  "Assessment completed",
                                ],
                                "Trial Booked": ["已约试听", "Trial booked"],
                                "Trial Attended": [
                                  "试听出席",
                                  "Trial attended",
                                ],
                                Enrolled: ["已报名", "Enrolled"],
                                Lost: ["已流失", "Lost"],
                              };
                              const titles = {
                                sources: t("客户来源", "Lead sources"),
                                tiers: t("客户等级", "Lead tiers"),
                                states: t("客户阶段", "Lead stages"),
                              };
                              return (
                                <SearchableChoices
                                  key={key}
                                  title={titles[key]}
                                  values={rule[key] || []}
                                  choices={(filterOptions[key] || []).map(
                                    (value) => ({
                                      value,
                                      label: isSalesProgressStage(value)?progressLabel(value,lang):
                                        (lang === "id"
                                          ? crmId(labels[value]?.[1])
                                          : labels[value]?.[zh ? 0 : 1]) ||
                                        t(
                                          `历史或目录值：${value}`,
                                          `Historical or directory value: ${value}`,
                                        ),
                                    }),
                                  )}
                                  onChange={(values) =>
                                    patch({ [key]: values })
                                  }
                                  zh={zh}
                                  lang={lang}
                                  isLight={isLight}
                                />
                              );
                            },
                          )}
                        </>,
                      )}
                      {section(
                        t("收件人与渠道", "Recipients and channels"),
                        <>
                          <p className="sm:col-span-2 lg:col-span-3">
                            {assignmentRule
                              ? t("仅新负责人收到通知。Lark 私信需已绑定账号。", "Only the new owner is notified. Lark direct messages require a linked account.")
                              : rule.event.includes("failed") || rule.event === "daily.digest"
                              ? t(
                                  "运营异常及汇总通知 CRM 管理者；全量汇总仅对有全量查看权限的管理者开放。",
                                  "Operational incidents and summaries go to CRM Managers. Full summaries require access to all customers.",
                                )
                              : t(
                                  "客户通知按全局路由：有效负责人 → 有权处理客户的 CRM 管理者。",
                                  "Customer notifications follow global routing: valid Owner → authorized CRM Manager.",
                                )}
                          </p>
                          {rule.requiresRoutingReview && (
                            <AdminField className="sm:col-span-2 lg:col-span-3">
                              <input
                                type="checkbox"
                                checked={routingReviewed}
                                onChange={(e) =>
                                  setRoutingReviewed(e.target.checked)
                                }
                              />
                              {t(
                                "复核并确认移除历史团队限制，再启用本策略。原条件保留在历史版本。",
                                "Review and confirm removal of retired team restrictions before enabling. Original conditions remain in version history.",
                              )}
                            </AdminField>
                          )}
                          <fieldset className="notification-rule-channel-group">
                            <legend><AdminFieldLabel required>{t("通知渠道", "Delivery channels")}</AdminFieldLabel></legend>
                            <div className="notification-rule-channels">
                              {channelOptions.map((c) => (
                                <AdminField
                                  key={c}
                                  className="flex gap-2 items-center"
                                >
                                  <input
                                    type="checkbox"
                                    checked={rule.channels.includes(c)}
                                    onChange={(e) =>
                                      patch({
                                        channels: e.target.checked
                                          ? [...rule.channels, c]
                                          : rule.channels.filter(
                                              (x) => x !== c,
                                            ),
                                      })
                                    }
                                  />
                                  {channelLabel(c)}
                                </AdminField>
                              ))}
                            </div>
                          </fieldset>
                          {usesGroup && (
                            <div className="notification-rule-group-select">
                              <SearchableChoices
                                title={t("Lark 群渠道", "Lark group channel")}
                                values={selectedGroupIds}
                                choices={groupChoices}
                                onChange={groupIds => patch({group: "", groupIds})}
                                required zh={zh} lang={lang} isLight={isLight}
                              />
                              <p className="notification-channel-help">{t("可选择多个群，系统会分别发送。", "Select multiple groups for separate deliveries.")}</p>
                            </div>
                          )}
                        </>,
                      )}
                      {section(
                        t("发送安排", "Delivery schedule"),
                        <>
                          {!timed && (
                            <p
                              className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                            >
                              {t(
                                "站内消息即时发送。",
                                "In-app messages are sent immediately.",
                              )}
                            </p>
                          )}
                          {timed && (
                            <>
                              {rule.event === "daily.digest"
                                ? field(
                                    t("汇总时间模式", "Summary timing"),
                                    <p className="text-xs py-2">
                                      {t(
                                        "Lark每天按汇总时间生成；站内汇总遵循工作日",
                                        "Lark summary runs daily at the set time; in-app summary follows working days",
                                      )}
                                    </p>,
                                  )
                                : select(
                                    t("发送方式", "Timing"),
                                    rule.timing,
                                    [
                                      ["immediate", t("立即", "Immediately")],
                                      ["delay", t("延迟", "Delay")],
                                      [
                                        "digest",
                                        t(
                                          "指定时刻发送（逐条通知）",
                                          "Send at a set time (individual notifications)",
                                        ),
                                      ],
                                    ],
                                    (v) => patch({ timing: v }),
                                  )}
                              {rule.event !== "daily.digest" &&
                                rule.timing === "delay" &&
                                number(
                                  t("延迟分钟", "Delay minutes"),
                                  rule.delayMinutes,
                                  (v) => patch({ delayMinutes: v }),
                                )}
                              {(rule.event === "daily.digest" ||
                                rule.timing === "digest") &&
                                field(
                                  t(
                                    rule.event === "daily.digest"
                                      ? "每日统计汇总时间"
                                      : "通知发送时刻",
                                    rule.event === "daily.digest"
                                      ? "Daily summary time"
                                      : "Scheduled notification time",
                                  ),
                                  <input
                                    className={input}
                                    type="time"
                                    value={rule.digestTime}
                                    onChange={(e) =>
                                      patch({ digestTime: e.target.value })
                                    }
                                  />,
                                )}
                              {select(
                                (lang==='zh'?'时区来源':lang==='id'?'Sumber zona waktu':'Timezone source'),
                                rule.calendarMode || "custom",
                                [
                                  [
                                    "inherit",
                                    t(
                                      "继承运营时区",
                                      "Inherit operating timezone",
                                    ),
                                  ],
                                  [
                                    "custom",
                                    t(
                                      "此策略自定义时区",
                                      "Custom timezone for this policy",
                                    ),
                                  ],
                                ],
                                (v) =>
                                  patch({
                                    calendarMode: v as "inherit" | "custom",
                                  }),
                              )}
                              {rule.calendarMode === "inherit" && (
                                <div className="sm:col-span-2 lg:col-span-3 text-xs space-y-2">
                                  <p>{globalCalendar.timezone}</p>
                                </div>
                              )}
                              {rule.calendarMode === "custom" && (
                                <>
                                  {text(
                                    t("时区", "Timezone"),
                                    rule.timezone,
                                    (v) => patch({ timezone: v }),
                                    "Asia/Jakarta",
                                  )}

                                </>
                              )}
                              {usesLark &&
                                field(
                                  t("静默时段", "Quiet hours"),
                                  <AdminField className="flex gap-2 py-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={!!rule.quiet}
                                      onChange={(e) =>
                                        patch({
                                          quiet: e.target.checked
                                            ? { start: "22:00", end: "08:00" }
                                            : undefined,
                                        })
                                      }
                                    />
                                    {t(
                                      "启用 Lark 静默时段",
                                      "Enable Lark quiet hours",
                                    )}
                                  </AdminField>,
                                )}
                              {usesLark && <p className={`sm:col-span-2 lg:col-span-3 ${muted}`}>{lang==='zh'?'Lark 通知不受工作日历限制，静默时段仍然生效。':lang==='id'?'Notifikasi Lark tidak dibatasi kalender kerja; jam hening tetap berlaku.':'Lark notifications are independent of the working calendar. Quiet hours still apply.'}</p>}
                              {usesLark && rule.quiet && (
                                <>
                                  {field(
                                    t("静默开始", "Quiet hours start"),
                                    <input
                                      className={input}
                                      type="time"
                                      value={rule.quiet.start}
                                      onChange={(e) =>
                                        patch({
                                          quiet: {
                                            ...rule.quiet!,
                                            start: e.target.value,
                                          },
                                        })
                                      }
                                    />,
                                  )}
                                  {field(
                                    t("静默结束", "Quiet hours end"),
                                    <input
                                      className={input}
                                      type="time"
                                      value={rule.quiet.end}
                                      onChange={(e) =>
                                        patch({
                                          quiet: {
                                            ...rule.quiet!,
                                            end: e.target.value,
                                          },
                                        })
                                      }
                                    />,
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </>,
                      )}
                      {usesLark && section(
                        t("消息内容", "Message content"),
                        <>
                          {usesLark && (
                            <>
                              {select(
                                t("通知语言", "Notification language"),
                                rule.language,
                                [
                                  ["zh", "中文"],
                                  ["en", "English"],
                                  ["id", "Bahasa Indonesia"],
                                ],
                                (v) => patch({ language: v }),
                              )}
                              {!standardLarkKinds.includes(rule.event as LarkKind) && (<div className="sm:col-span-2 lg:col-span-3">
                                {field(
                                  rule.event === "daily.digest" ? t("站内摘要模板（Lark使用标准卡片）", "In-app template (Lark uses the standard card)") : t("消息摘要模板", "Message summary template"),
                                  <textarea
                                    className={`${input} h-24 py-2`}
                                    value={rule.template}
                                    maxLength={2000}
                                    onChange={(e) =>
                                      patch({ template: e.target.value })
                                    }
                                  />,
                                  t(
                                    "可用变量：{{event}}、{{name}}、{{owner}}、{{due}}。语言不会自动翻译模板。",
                                    "Variables: {{event}}, {{name}}, {{owner}}, {{due}}. Language does not translate the template.",
                                  ),
                                )}
                              </div>)}
                              <div
                                className={`${box} p-3 text-xs sm:col-span-2 lg:col-span-3`}
                              >
                                <p className="font-semibold mb-2">{t('Lark 卡片预览','Lark card preview')}</p>
                                <p data-lark-header={larkNotificationColor(rule.event).template} className="font-semibold mb-2 rounded px-3 py-2" style={{color:larkNotificationColor(rule.event).foreground,background:larkNotificationColor(rule.event).background}}>
                                  UPER · TEST · {rule.event==='daily.digest'?dailyDigestPreview({language:rule.language as 'zh'|'en'|'id',date:'2030-01-06',counts:[]}).title:standardLarkKinds.includes(rule.event as LarkKind)?larkNotificationPreview(larkNotificationSample(rule.event as LarkKind,rule.language as 'zh'|'en'|'id')).title:label(rule.event)}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  {rule.event==='daily.digest' ? (()=>{const preview=dailyDigestPreview({language:rule.language as 'zh'|'en'|'id',date:'2030-01-06',timezone:rule.timezone,counts:[{stage:'progress:unreached',count:8},{stage:'progress:discovery',count:3},{stage:'progress:proposal',count:1}],filtered:!!(rule.tiers.length||rule.states.length||rule.sources.length)});return [...preview.rows.map(row=>row.label+(rule.language==='zh'?'：':': ')+row.value),preview.note].join('\n');})() : standardLarkKinds.includes(rule.event as LarkKind) ? (()=>{const preview=larkNotificationPreview(larkNotificationSample(rule.event as LarkKind,rule.language as 'zh'|'en'|'id'));return [...preview.rows.map(row=>row.label+(rule.language==='zh'?'：':': ')+row.value),preview.note].filter(Boolean).join('\n');})() : rule.template.replace(/\{\{(event|name|owner|due)\}\}/g,(_,key)=>({event:rule.event,name:'Maya Putri',owner:'Sample advisor',due:'2026-10-31 18:00'} as Record<string,string>)[key])}
                                </p>
                                <p className={muted}>
                                  {t(
                                    "仅展示模拟数据，不发送消息。标准卡片按所选语言展示，实际值关联原始记录。",
                                    "Synthetic preview only; no delivery. Standard cards use the selected language and linked source records.",
                                  )}
                                </p>
                              </div>
                            </>
                          )}
                        </>,
                      )}
                      {usesLark && (
                        <details className="notification-rule-disclosure">
                          <summary className="text-xs font-bold cursor-pointer">
                            {t(
                              "去重与重试",
                              "Deduplication and retries",
                            )}
                          </summary>
                          <div>
                            {section(
                              undefined,
                              <>
                                {number(
                                  t(
                                    "重复通知抑制窗口（分钟）",
                                    "Lark deduplication window (minutes)",
                                  ),
                                  rule.dedupeMinutes,
                                  (v) => patch({ dedupeMinutes: v }),
                                )}
                                {list(
                                  t(
                                    "暂时失败重试间隔（分钟）",
                                    "Transient failure retry delays (minutes)",
                                  ),
                                  rule.retries.map(String),
                                  (v) => patch({ retries: v.map(Number) }),
                                  t(
                                    "默认 1, 5, 15；结果未知不自动重发。",
                                    "Default 1, 5, 15; unknown results are not retried automatically.",
                                  ),
                                )}
                                {usesPersonal ? number(
                                  t("每位负责人每小时发送上限", "Hourly limit per owner"),
                                  rule.maxPerHour,
                                  (v) => patch({ maxPerHour: v }),
                                ) : <p className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}>
                                  {t(
                                    "同一群、客户、事件与紧急级别的后续通知会被抑制，不合并内容，也不影响聊天保存。每群限流统一在渠道设置中配置。",
                                    "Subsequent notifications for the same group, lead, event and priority are suppressed. Content is not merged and chats remain saved. Configure hourly limits in channel settings.",
                                  )}
                                </p>}
                              </>,
                            )}
                          </div>
                        </details>
                      )}
                      <AdminFormSection className="crm-form-section notification-form-section" title={t("发送时间预览", "Delivery timing preview")}>
                        <div className="notification-rule-preview">
                        <div className="flex flex-wrap gap-3 items-end">
                          <AdminDateField label={cancelText("模拟事件时间（本机时区）","Simulated event time (browser timezone)","Waktu simulasi (zona waktu browser)")}
                            lang={lang} withTime value={simulateAt} disabled={!canEdit||busy} onChange={setSimulateAt}
                            error={simulateAt&&!completeAdminDateTime(simulateAt)?cancelText("请填写完整的日期和 24 小时时间。","Enter a complete date and 24-hour time.","Isi tanggal dan waktu 24 jam secara lengkap."):undefined}/>
                          <button
                            type="button"
                            className="crm-work-button flex gap-1 items-center"
                            disabled={!canEdit || busy || !!simulateAt&&!completeAdminDateTime(simulateAt)}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const d = await api("notification-simulate", {
                                  config:
                                    rule.event === "daily.digest"
                                      ? { ...ruleConfig, timing: "digest" }
                                      : ruleConfig,
                                  ...(simulateAt
                                    ? { at: new Date(simulateAt).toISOString() }
                                    : {}),
                                });
                                setSimulation(d.sendAt);
                                setError("");
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <Play className="w-3.5 h-3.5" />
                            {t("预览发送时间", "Preview delivery timing")}
                          </button>
                        </div>
                        {simulation.map((s) => (
                          <p key={s.channel} className="text-xs">
                            {s.channel === LARK_GROUP
                              ? groupDeliveryLabel(selectedGroupIds) : channelLabel(s.channel)} ·{" "}
                            {new Date(s.at).toLocaleString(crmLocale(lang), {
                              timeZone:
                                rule.calendarMode === "inherit"
                                  ? globalCalendar.timezone
                                  : rule.timezone,
                            })}{" "}
                            ·{" "}
                            {rule.calendarMode === "inherit"
                              ? globalCalendar.timezone
                              : rule.timezone}
                          </p>
                        ))}
                        </div>
                      </AdminFormSection>
                    </div>
                  ) : (
                    <div className="notification-channel-body" data-admin-stack="">
                      <div className="notification-channel-fields" data-admin-stack="">
                        {!personalChannelEditor && (systemGroupEditor ? <div className="notification-channel-row">
                          <span className="notification-channel-label">{t("渠道名称", "Channel name")}</span>
                          <span>{systemGroupLabel}</span>
                        </div> : <AdminField className="notification-channel-row" required>
                          {t("渠道名称", "Channel name")}
                          <input ref={channelNameInput} className={input} required maxLength={100}
                            disabled={busy || !canEdit} value={channel.groupName || ""}
                            onChange={e => setChannel({ ...channel, groupName: e.target.value })}
                          />
                        </AdminField>)}
                        <AdminField as="div" className="notification-channel-row" required>
                          <AdminFieldLabel required>{t("发送模式", "Delivery mode")}</AdminFieldLabel>
                          <div className="notification-channel-mode">
                            <AdminSingleSelect label={t("发送模式", "Delivery mode")} value={channel.mode}
                              options={[
                                {value: "simulation", label: t("模拟发送", "Simulation")},
                                {value: "live", label: t("真实发送", "Live delivery"),
                                  disabled: personalChannelEditor && !channel.appConfigured},
                              ]}
                              disabled={busy || !canEdit}
                              onChange={mode => setChannel({ ...channel, mode })}
                              lang={lang} isLight={isLight}
                            />
                            {channel.mode === "simulation" && <p className="notification-channel-help">
                              {t("通知触发后只记模拟结果，不发到 Lark。", "Triggered notifications are recorded without sending to Lark.")}
                            </p>}
                            {personalChannelEditor && <p className="notification-channel-help">
                              {t("个人业务通知和绑定确认使用此模式。", "This mode applies to personal business notifications and binding confirmations.")}
                            </p>}
                          </div>
                        </AdminField>
                      </div>

                      {!personalChannelEditor && <>
                      <section className="notification-channel-webhook" aria-label={t("群机器人 Webhook", "Group bot Webhook")} data-admin-stack="">
                        <div className="notification-channel-row">
                          <h3 className="notification-channel-label">{t("群机器人 Webhook", "Group bot Webhook")}</h3>
                          <div className="notification-channel-webhook-row">
                            <p className="notification-channel-help" role="status">
                              {webhookDraft === null ? t("待清除", "Pending removal")
                                : webhookConfigured ? t("已配置", "Configured")
                                  : webhookStored ? t("已保存，暂不可用", "Saved, currently unavailable")
                                    : t("未配置", "Not configured")}
                            </p>
                            {canManageCredentials&&!managedCredentials&&!environmentGroupWebhook && <div className="admin-form-actions">
                              {editingWebhook || webhookDraft === null ? (
                                <button ref={undoWebhookAction} type="button" className="crm-work-button" disabled={busy || !canEdit}
                                  onClick={() => {
                                    setEditingWebhook(false);
                                    setWebhookDraft(undefined);
                                    requestAnimationFrame(() => webhookAction.current?.focus());
                                  }}>
                                  {t("撤销地址更改", "Undo address change")}
                                </button>
                              ) : (
                                <>
                                  <button ref={webhookAction} type="button" className="crm-work-button" disabled={busy || !canEdit}
                                    onClick={() => setEditingWebhook(true)}>
                                    {webhookStored ? t("替换地址", "Replace address") : t("粘贴地址", "Paste address")}
                                  </button>
                                  {webhookStored && (
                                    <button type="button" className="crm-work-button" disabled={busy || !canEdit}
                                      onClick={() => setConfirmWebhookClear(true)}>
                                      {t("清除地址", "Clear address")}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>}
                          </div>
                        </div>
                        {!managedCredentials&&environmentGroupWebhook && <p className="notification-channel-help">
                          {t("群地址由服务端维护。", "The group address is managed on the server.")}
                        </p>}
                        {editingWebhook && (
                          <AdminField className="notification-channel-row" required>
                            {t("Lark 群 Webhook 地址", "Lark group Webhook address")}
                            <input ref={webhookInput} className={input} type="password" autoComplete="new-password" autoFocus
                              required spellCheck={false} maxLength={512} disabled={busy || !canEdit}
                              value={webhookDraft ?? ""} onChange={e => setWebhookDraft(e.target.value)}
                            />
                            <small>{t("加密保存，保存后不显示。", "Encrypted and hidden after saving.")}</small>
                          </AdminField>
                        )}
                        {webhookDraft === null && (
                          <p className="admin-form-feedback" data-tone="warning">
                            {t("保存后，此渠道将无法向 Lark 群发送通知。", "After saving, this channel will stop sending to the Lark group.")}
                          </p>
                        )}
                      </section>

                      <div className="notification-channel-fields notification-channel-delivery" data-admin-stack="">
                        <AdminField className="notification-channel-row notification-channel-limit">
                          {t("每小时发送上限", "Hourly delivery limit")}
                          <input className={input} type="number" min={0} max={10080} disabled={busy || !canEdit}
                            value={channel.maxPerHour ?? LARK_DEFAULT_MAX_PER_HOUR}
                            onChange={e => setChannel({ ...channel, maxPerHour: Number(e.target.value) })}
                          />
                          <small>{t("0 表示暂停，超出上限的通知顺延。", "0 pauses delivery. Excess notifications are deferred.")}</small>
                        </AdminField>
                        {(channel.mode === "live" || managedCredentials) && <>
                            <div className="notification-channel-row">
                              <span className="notification-channel-label" aria-hidden="true">{t("签名验证", "Signature verification")}</span>
                              <div className="notification-channel-mode">
                                <AdminField className="notification-channel-signing">
                                  <input type="checkbox" aria-label={t("启用签名验证", "Enable signature verification")}
                                    checked={!!channel.signingEnabled} disabled={busy || !canEdit || !canManageCredentials}
                                    onChange={e => setChannel({ ...channel, signingEnabled: e.target.checked })}
                                  />
                                  {t("启用", "Enable")}
                                </AdminField>
                                <p className="notification-channel-help">
                                  {t("仅在 Lark 群机器人启用签名时开启。", "Enable if the Lark group bot requires signing.")}
                                </p>
                              </div>
                            </div>
                            {canManageCredentials&&!managedCredentials&&channel.signingEnabled && (
                              <AdminField className="notification-channel-row" required>
                                {t("签名密钥引用", "Signing secret reference")}
                                <input ref={signingRefInput} className={input} required disabled={busy || !canEdit}
                                  value={channel.signingSecretRef || ""}
                                  onChange={e => setChannel({ ...channel, signingSecretRef: e.target.value })}
                                />
                                <small>{t("填写服务器变量名。", "Enter the server variable name.")}</small>
                              </AdminField>
                            )}
                        </>}
                      </div>
                      </>}
                    </div>
                  )}

                  </fieldset>
                </div>
              )}
              {!editor && (
                <>
                  {tab !== "notification-jobs" && tab !== "notification-audit" && rows.length === 0 && !loading && (
                    <p className={`text-xs text-center py-8 ${muted}`}>
                      {t("暂无记录", "No records yet")}
                    </p>
                  )}
                  {tab === "notification-rules" && (
                    <div className="notification-policy-list">
                      {rows.map((row) => {
                        const config = row.config!;
                        const version = row.version;
                        const status = row.enabled ? t("已启用", "Enabled") : t("停用 / 草稿", "Inactive / draft");
                        const assignment = config.event === LEAD_ASSIGNED_EVENT;
                        const deliveryOptions = policyDeliveryChannels(config);
                        const usesLark = deliveryOptions.includes(LARK_GROUP) || deliveryOptions.includes(LARK_PERSONAL);
                        const usesInApp = config.channels.includes("inapp");
                        const deliveryChannels = deliveryOptions.map(channel =>
                          channel === LARK_GROUP ? groupDeliveryLabel(notificationGroupIds(config)) : channelLabel(channel),
                        ).join(" + ");
                        const inAppRecipient = assignment ? t("仅新负责人", "New owner only")
                          : config.event.includes("failed") || config.event === "daily.digest"
                            ? t("有权限的 CRM 管理者", "Authorized CRM Managers")
                            : t("有效负责人 → CRM 管理者", "Valid Owner → CRM Manager");
                        const schedule = config.event === "daily.digest"
                          ? t("每日统计汇总", "Daily summary") + " " + config.digestTime
                          : config.timing === "digest"
                            ? t("指定时刻逐条发送", "Individual sends at set time") + " " + config.digestTime
                            : config.timing === "delay"
                              ? config.delayMinutes + " " + t("分钟延迟", "minute delay")
                              : t("立即发送", "Immediate");
                        const deliveryTiming = usesLark || config.event === "daily.digest"
                          ? schedule + " · " + (config.calendarMode === "inherit" ? t("继承运营时区", "Operating timezone") : config.timezone)
                          : t("立即发送", "Immediate");
                        const filters = [
                          {label: t("来源", "Source"), values: config.sources},
                          {label: t("等级", "Tier"), values: config.tiers},
                          {label: t("阶段", "Stage"), values: config.states},
                        ].filter(filter => filter.values.length);
                        return (
                          <article key={row.id} className="notification-policy-card">
                            <header className="notification-policy-card-header">
                              <h4>{label(config.event)}</h4>
                              <span className="notification-channel-card-status" data-tone={row.enabled ? "enabled" : undefined}>{status}</span>
                            </header>
                            <dl className="notification-policy-card-details">
                              <dt>{t("通知渠道", "Delivery channels")}</dt><dd>{deliveryChannels}</dd>
                              {(assignment || usesInApp) && <><dt>{assignment ? t("收件人", "Recipients") : t("站内收件人", "In-app recipients")}</dt><dd>{inAppRecipient}</dd></>}
                              <dt>{t("发送安排", "Delivery schedule")}</dt><dd>{deliveryTiming}</dd>
                              <dt>{t("适用范围", "Applies to")}</dt>
                              <dd>{filters.length ? filters.map(({label, values}) => (
                                <div key={label}>{label} · {values.map(value => crmValue(value, lang)).join(zh ? "、" : ", ")}</div>
                              )) : t("全部客户", "All leads")}</dd>
                            </dl>
                            {config.requiresRoutingReview && <p className="notification-policy-card-review">{t("历史范围待复核，保持停用", "Historical scope needs review; remains inactive")}</p>}
                            <footer className="notification-policy-card-footer">
                              <small>{row.id} · v{row.version}</small>
                              {canEdit && <div className="notification-policy-card-actions">
                                <AdminRowAction id={editorTriggerId("rule", row.id)}
                                  disabled={busy} onClick={() => edit(row)}>
                                  {t("编辑策略", "Edit policy")}
                                </AdminRowAction>
                                {typeof version === "number" && <button type="button"
                                  className="crm-work-button notification-channel-remove"
                                  aria-label={t("删除通知策略", "Delete notification policy")}
                                  title={t("删除通知策略", "Delete notification policy")}
                                  disabled={busy} onClick={() => {
                                    setRuleDeleteError("");
                                    setRuleToDelete({id: row.id, name: label(config.event), version});
                                  }}>
                                  <Trash2 size={16} aria-hidden="true"/>
                                </button>}
                              </div>}
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  {tab === "notification-channels" && (
                    <div className="notification-channel-list">
                      {rows.map((row) => {
                        const config = row.config!;
                        if (row.id === PERSONAL_CHANNEL_ROW) return (
                          <article key={row.id} className="notification-channel-card" aria-label={t("Lark 个人通知", "Lark personal notifications")}>
                            <header className="notification-channel-card-header">
                              <div className="notification-channel-card-identity">
                                <span className="notification-channel-card-icon"><img src="/images/lark-mark.png" alt="" width={24} height={24}/></span>
                                <div>
                                  <h4>{t("Lark 个人通知", "Lark personal notifications")}</h4>
                                  <p className="notification-channel-help">{t("系统渠道", "System channel")} · {config.mode === "live" ? t("真实发送", "Live") : t("模拟发送", "Simulation")}</p>
                                </div>
                              </div>
                              <span className="notification-channel-card-status" data-tone={config.appConfigured ? "ready" : "warning"}>
                                {config.appConfigured ? t("Lark 应用已配置", "Lark app configured") : t("Lark 应用未配置", "Lark app not configured")}
                              </span>
                            </header>
                            <p className="notification-channel-help">{t("个人业务通知和绑定确认使用此模式。", "This mode applies to personal business notifications and binding confirmations.")}</p>
                            {canEdit && <div className="notification-channel-card-actions">
                              <AdminRowAction id={editorTriggerId("channel", row.id)} disabled={busy} onClick={() => edit(row)}>
                                {t("编辑渠道", "Edit channel")}
                              </AdminRowAction>
                              {row.testDelivery && <LarkChannelTestControls id={row.id} personal
                                name={t("Lark 个人通知", "Lark personal notifications")} test={row.testDelivery}
                                lang={lang} isLight={isLight} request={api}/>}
                            </div>}
                          </article>
                        );
                        const name = row.systemManaged ? systemGroupLabel : config.groupName || t("未命名群", "Unnamed group");
                        const limit = row.rateLimit?.maxPerHour ?? LARK_DEFAULT_MAX_PER_HOUR;
                        const status = row.connection?.status;
                        const webhookReady = row.connection?.webhookConfigured;
                        const deleteBlocked = (row.usage?.total ?? 0) > 0;
                        const deleteReason = deleteBlocked
                          ? t("仍有关联策略，解除关联后可删除。", "Remove linked policies before deleting this channel.")
                          : t("删除通知渠道", "Delete notification channel");
                        const connection = status === "configured" || (status === "simulation" && webhookReady)
                          ? t("Webhook 已配置", "Webhook configured")
                          : status === "simulation" ? t("Webhook 未配置", "Webhook not configured") : connectionLabel(row);
                        return (
                          <article key={row.id} className="notification-channel-card" aria-label={name}>
                            <header className="notification-channel-card-header">
                              <div className="notification-channel-card-identity">
                                <span className="notification-channel-card-icon">
                                  <img src="/images/lark-mark.png" alt="" width={24} height={24}/>
                                </span>
                                <div>
                                  <h4>{name}</h4>
                                  <p className="notification-channel-help">
                                    {row.systemManaged ? t("系统渠道", "System channel") : systemGroupLabel} · {config.mode === "live"
                                      ? t("真实发送", "Live") : t("模拟发送", "Simulation")}
                                  </p>
                                </div>
                              </div>
                              <span className="notification-channel-card-status" data-tone={
                                status === "configured" || (status === "simulation" && webhookReady) ? "ready"
                                  : status === "simulation" ? "neutral" : "warning"
                              }>{connection}</span>
                            </header>
                            <dl className="notification-channel-card-metrics">
                              <div>
                                <dt>{t("每小时上限", "Hourly limit")}</dt>
                                <dd>
                                  <strong>{limit === 0 ? t("已暂停", "Paused") : limit}</strong>
                                  {row.rateLimit?.source === "legacy_strictest" && (
                                    <small>{t("沿用旧策略上限", "Uses legacy policy limit")}</small>
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>{t("通知策略", "Notification policies")}</dt>
                                <dd>
                                  <strong>{row.usage?.enabled ?? 0} / {row.usage?.total ?? 0}</strong>
                                  <small>{t("已启用 / 已关联", "Enabled / linked")}</small>
                                </dd>
                              </div>
                            </dl>
                            {canManageCredentials&&managedCredentials&&<IntegrationCredentialControl kind="lark-group" resource={row.id} lang={lang} isLight={isLight} subject={name}
                              onChange={()=>void load()}/>}
                            {canEdit && (
                              <div className="notification-channel-card-actions">
                                <AdminRowAction id={editorTriggerId("channel", row.id)} disabled={busy} onClick={() => edit(row)}>
                                  {t("编辑渠道", "Edit channel")}
                                </AdminRowAction>
                                {row.testDelivery && <LarkChannelTestControls id={row.id}
                                  name={name} test={row.testDelivery} lang={lang} isLight={isLight} request={api}/>}
                                {row.testDelivery && !row.systemManaged && <button type="button"
                                  className="crm-work-button notification-channel-remove"
                                  aria-label={t("删除通知渠道", "Delete notification channel")}
                                  aria-disabled={deleteBlocked || undefined} disabled={busy}
                                  aria-description={deleteBlocked ? deleteReason : undefined} title={deleteReason}
                                  onClick={() => { if (!deleteBlocked) setChannelToDelete({id: row.id, name, version: row.testDelivery!.version}); }}>
                                  <Trash2 size={16} aria-hidden="true"/>
                                </button>}
                              </div>
                            )}
                          </article>
                        );
                      })}
                        {([["Email", Mail], ["SMS", MessageSquare]] as const).map(([name, Icon]) => (
                          <article key={name} className="notification-channel-card notification-channel-placeholder">
                            <header className="notification-channel-card-header">
                              <div className="notification-channel-card-identity">
                                <span className="notification-channel-card-icon"><Icon size={20} aria-hidden="true"/></span>
                                <h4>{name}</h4>
                              </div>
                              <span className="notification-channel-card-status">{t("暂未接入", "Not connected")}</span>
                            </header>
                            <p className="notification-channel-help">{t("接入后可在通知策略中选择此渠道。", "This channel will be available in notification policies once connected.")}</p>
                          </article>
                        ))}
                    </div>
                  )}
                  {tab === "notification-jobs" && (
                    <>
                      {jobsResult?.denied?<AdminListState lang={lang} state="denied"/>:<>
                        {targetJob?<AdminRowAction onClick={openAllJobs}>
                          {zh?'查看全部发送记录':lang==='id'?'Lihat semua catatan pengiriman':'View all delivery records'}
                        </AdminRowAction>:<div className="max-w-xs">
                          {select(t("发送状态","Delivery state"),jobsLocation.state,[
                            ["all",t("全部状态","All states")],
                            ...Object.entries(stateNames).map(([value,name])=>[
                              value,lang==="id"?crmId(name[1]):name[zh?0:1],
                            ] as [string,string]),
                          ],state=>changeJobsLocation(state,1))}
                        </div>}
                        {!targetJob&&<p className="crm-list-meta">
                          {zh?'按当前筛选查看最近 200 条发送记录。':lang==='id'?'Filter berlaku pada 200 catatan pengiriman terakhir.':'Filters apply to the latest 200 delivery records.'}
                        </p>}
                        {!jobsResult&&<AdminListState lang={lang} state="loading"/>}
                        {jobsResult?.error&&<AdminListState lang={lang} state="error" message={crmError(jobsResult.error,lang)}
                          compact={Boolean(visibleJobs?.length)} onRetry={()=>void load()}/>}
                        {jobsResult&&!jobsResult.error&&!visibleJobs?.length&&<AdminListState lang={lang} state="empty"
                          message={targetJob?(zh?'未找到对应发送记录，可能已移除或无权查看。':lang==='id'?'Catatan pengiriman tidak ditemukan atau tidak dapat diakses.':'Delivery record not found or unavailable to this account.'):undefined}/>}
                        {!!visibleJobs?.length&&<AdminListTable label={t("发送记录","Delivery records")} busy={loading} viewportRef={jobsTable}
                          headers={[
                            t("事件 / 客户","Event / lead"),t("渠道 / 收件人","Channel / recipient"),t("状态","State"),
                            t("计划时间 / 次数","Scheduled / attempts"),t("结果 / 操作","Result / action"),
                          ]}>
                          {visibleJobs.map(row=>(
                                <tr
                                  id={"notification-job-"+row.id}
                                  tabIndex={-1}
                                  data-notification-focused={targetJob===row.id||undefined}
                                  key={row.id}
                                >
                                  <td>
                                    <p>{label(row.snapshot?.event || "")}</p>
                                    {row.snapshot?.leadId && (
                                      <AdminRowAction
                                        href={
                                          "/crm?lead=" +
                                          encodeURIComponent(
                                            row.snapshot.leadId,
                                          )
                                        }
                                        onClick={event=>rememberJobPosition(event,row.id)}
                                      >
                                        {t("查看客户", "View lead")}
                                      </AdminRowAction>
                                    )}
                                    <p className={`text-[10px] ${muted}`}>
                                      {row.id}
                                    </p>
                                  </td>
                                  <td>
                                    {(row.systemGroupRecipient || (row.channel === "lark" && row.recipient === historicalSystemGroupId)) ? systemGroupLabel : <>
                                      {crmValue(row.channel, lang)}
                                      <br />
                                      {row.recipient}
                                    </>}
                                  </td>
                                  <td>
                                    <AdminStatus tone={row.state==='unknown'?'warning':row.state==='failed'?'danger':row.state==='accepted'?'success':'neutral'}>
                                      {(lang === "id"
                                        ? crmId(stateNames[row.state]?.[1])
                                        : stateNames[row.state]?.[
                                            zh ? 0 : 1
                                          ]) || row.state}
                                    </AdminStatus>
                                  </td>
                                  <td className="whitespace-nowrap">
                                    {format(row.due_at)}
                                    <br />
                                    {row.attempts} {t("次", "attempts")} · v
                                    {row.version}
                                  </td>
                                  <td className="max-w-xs break-words">
                                    {row.historicalHold && (
                                      <p className={muted}>
                                        {lang === "zh"
                                          ? "历史迁移记录 · 不自动重发"
                                          : lang === "id"
                                            ? "Catatan migrasi lama · tidak dikirim ulang otomatis"
                                            : "Historical migration record · no automatic resend"}
                                      </p>
                                    )}
                                    {row.result
                                      ? crmDeliveryResult(
                                          row.result,
                                          row.state,
                                          lang,
                                        )
                                      : "—"}
                                    {row.result && (
                                      <AdminDisclosure density="compact" data-job-receipt=""
                                        heading={t("原始技术回执","Original technical receipt")}>
                                        <pre className="admin-disclosure-original">{row.result}</pre>
                                      </AdminDisclosure>
                                    )}
                                    {canEdit && row.state === "pending" && (
                                      <button
                                        className={`${button} block mt-2`}
                                        onClick={() => {
                                          closeCancel();
                                          setCancelId(row.id);
                                        }}
                                      >
                                        {t("取消通知", "Cancel notification")}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                        </AdminListTable>}
                        {!targetJob&&<AdminListPagination lang={lang} page={jobPage} pageCount={jobPages}
                          onPageChange={page=>changeJobsLocation(jobsLocation.state,page)}/>}
                      </>}
                      {cancelId && !jobsResult?.denied && <AdminConfirmation light={isLight} busy={busy} danger
                        title={t('取消通知','Cancel notification')}
                        description={<>{t('仅取消这条通知，不完成客户跟进任务。','Cancels this notification only; does not complete follow-up.')} · {cancelId}</>}
                        cancelLabel={t('保留通知','Keep notification')} confirmLabel={t('确认取消','Confirm cancellation')}
                        confirmDisabled={cancelNeedsCheck||!cancelReason.trim()} onCancel={closeCancel} onConfirm={()=>void confirmCancel()}>
                        <AdminField required>{t('取消原因','Cancellation reason')}
                          <textarea value={cancelReason} onChange={event=>setCancelReason(event.target.value)}
                            required maxLength={300} disabled={busy||cancelNeedsCheck}/>
                        </AdminField>
                        {cancelFeedback&&<AdminFormFeedback lang={lang} state={cancelFeedback.state}>{cancelFeedback.message}</AdminFormFeedback>}
                        {cancelNeedsCheck&&<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void checkCancelled()}>
                          {cancelText('查询取消结果','Check cancellation result','Periksa hasil pembatalan')}</button>}
                      </AdminConfirmation>}
                    </>
                  )}
                  {tab === "notification-audit" && (auditRead!=='ready'||!rows.length) && (
                    <AdminListState lang={lang} state={auditRead==='ready'?'empty':auditRead}
                      message={auditRead==='ready'?t("暂无记录","No records yet"):undefined} onRetry={()=>void load()}/>
                  )}
                  {tab === "notification-audit" && auditRead==='ready' && rows.length>0 && (
                    <AdminListTable label={t('执行与变更历史','Execution & change history')}
                      headers={[t('操作人','Actor'),t('操作','Action'),t('对象 / 版本 / 原因','Object / version / reason')]}>
                          {rows.map((row) => (
                            <tr
                              key={row.id}
                              className={`border-t ${isLight ? "border-slate-200" : "border-slate-800"}`}
                            >
                              <td className="p-3">{row.actor}</td>
                              <td className="p-3">
                                {{
                                  "notification.plan": lang==='id'?'Perencanaan notifikasi':t('通知规划','Notification planning'),
                                  "rule.save": t("保存策略", "Policy saved"),
                                  "rule.delete": t("删除策略", "Policy deleted"),
                                  "channel.save": t(
                                    "保存渠道",
                                    "Channel saved",
                                  ),
                                  "notification.cancel": t(
                                    "取消通知",
                                    "Notification cancelled",
                                  ),
                                }[row.action] || row.action}
                              </td>
                              <td className="p-3 break-words">
                                {(row.systemGroupChannel || (row.action.startsWith("channel.") && (row.data?.channelId ?? row.data?.id) === historicalSystemGroupId))
                                  ? systemGroupLabel : row.data?.id || row.data?.jobId || row.data?.eventId || "—"}
                                {row.action==='notification.plan' && <p className="mt-1">{notificationPlanningSummary(row.data,lang)}</p>}
                                {row.data?.version
                                  ? " · v" + row.data.version
                                  : ""}
                                {row.action!=='notification.plan' && row.data?.reason
                                  ? " · " + row.data.reason
                                  : ""}
                              </td>
                            </tr>
                          ))}
                    </AdminListTable>
                  )}
                  {tab === "integration-readiness" &&
                    rows.map((row) => (
                      <div key={row.id} className="space-y-3">
                        <div className={`${box} p-4`}>
                          <h4 className="text-xs font-bold">
                            {t(
                              "员工身份与权限",
                              "Employee identity and permissions",
                            )}
                          </h4>
                          <p className={`text-xs mt-2 ${muted}`}>
                            {t("当前模式", "Current mode")}：
                            {row.identity?.mode} ·{" "}
                            {t(
                              "真实平台联调尚未确认",
                              "Live platform integration is not confirmed",
                            )}
                          </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          {row.channels?.map((c: any) => (
                            <div
                              key={c.id}
                              className={`${box} p-4 text-xs space-y-2`}
                            >
                              <h4 className="font-bold">{c.systemManaged ? systemGroupLabel : c.groupName || c.id}</h4>
                              <p>
                                {t("机器人连接 配置", "Webhook configured")}：
                                {c.webhookConfigured
                                  ? t("是", "Yes")
                                  : t("否", "No")}
                              </p>
                              <p>
                                {t(
                                  "签名配置满足要求",
                                  "Signature requirements met",
                                )}
                                ：
                                {c.signingSecretConfigured
                                  ? t("是", "Yes")
                                  : t("否", "No")}
                              </p>
                              <p className={muted}>
                                {t(
                                  "群内实收需结合发送记录和验收报告确认。",
                                  "Confirm group receipt using delivery records and acceptance reports.",
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Lazy keep-alive panels keep rule/channel drafts separate. Inactive panels stop polling. */
export function NotificationTopicPanels({topic,enabled=true,...props}:{topic:Tab;enabled?:boolean;isLight:boolean;lang:"en"|"zh"|"id";canEdit:boolean}){
 const [visited,setVisited]=useState<Tab[]>(enabled?[topic]:[]);
 useEffect(()=>{if(enabled)setVisited(items=>items.includes(topic)?items:[...items,topic]);},[topic,enabled]);
 const topics=!enabled||visited.includes(topic)?visited:[...visited,topic];
 return <>{topics.map(value=><div key={value} hidden={value!==topic} style={value===topic?undefined:{display:'none'}}><NotificationCenter {...props} embeddedTab={value} active={enabled&&value===topic}/></div>)}</>;
}

/** Same navigation for notification readers without policy-management permission. */
export function NotificationWorkspace({topic,onTopicChange,...props}:{topic:Tab;onTopicChange:(topic:Tab)=>void;isLight:boolean;lang:"en"|"zh"|"id";canEdit:boolean}){
 const col=props.lang==='zh'?2:props.lang==='id'?1:0;
 return <div className="crm-ops-workspace-sample" data-theme={props.isLight?'light':'dark'}><AdminTopicFrame label={['Notifications and audit','Notifikasi dan audit','通知与审计'][col]} selection={topic} navigation={<nav className="crm-ops-nav" aria-label={['Notifications and audit','Notifikasi dan audit','通知与审计'][col]}>{notificationTopics.map(s=><button key={s.id} type="button" aria-current={s.id===topic?'page':undefined} onClick={()=>onTopicChange(s.id as Tab)}>{createElement(notificationTopicIcons[s.id as Tab],{size:16,"aria-hidden":true})}{s.title[col]}</button>)}</nav>}><NotificationTopicPanels {...props} topic={topic}/></AdminTopicFrame></div>;
}
