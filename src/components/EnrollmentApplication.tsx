import {createBrowserUuid} from '../utils/browserUuid';
import {visitorScope} from '../services/visitorScope';
import {preloadEnrollmentNavigation,readEnrollmentClassDetails} from '../services/enrollmentClassDetails';
import {watchReadReconnect} from '../services/readReconnect';
import {readPendingDemand,sameDemandDraft,submitPendingDemand,type PendingDemand} from '../services/enrollmentDemandSubmission';
import {enrollmentDateFormatter} from '../utils/enrollmentDateFormat';
import {enrollmentCodeInput,enrollmentPost,postEnrollmentProof,readEnrollmentAftercareResponse,readEnrollmentOperation,readEnrollmentEmailAddress,readEnrollmentInterestsResponse,readEnrollmentOrderResponse,readEnrollmentOrdersResponse,recoverEnrollmentOperation,requestEnrollmentEmailCode,signOutEnrollmentEmail,submitEnrollmentInterest,verifyEnrollmentEmail,watchEnrollmentEmailSession} from '../services/enrollmentSession';
import {readVisitorContact,readEnrollmentDraft,writeEnrollmentDraft,subscribeVisitorContact} from '../services/visitorContact';
import {getStudentContext} from '../services/studentProfileStorage';
import {enrollmentCodeRequestErrors,enrollmentReadinessMessage} from '../utils/enrollmentReadinessCopy';
import {enrollmentDemandPrefill} from '../utils/enrollmentGuidance';
import {useEnrollmentPhoneField} from './useEnrollmentPhoneField';
import type {EnrollmentIntakeTools} from './EnrollmentIntake';
import { enrollmentCopy, enrollmentClassTitle, enrollmentScheduleLabel } from '../utils/enrollmentCatalog';
import { allowsEnrollmentProof, enrollmentStatuses } from '../utils/enrollmentOrderStatus';
import {enrollmentProofUploadTimeout,prepareEnrollmentProofFile} from '../utils/enrollmentProofFile';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {EnrollmentJourneyLink,useEnrollmentChatReturnState} from './EnrollmentJourneyLink';
import {promotionJourneyUrl} from '../utils/promotionNavigation';
import {isPlainLinkClick} from '../utils/chatJourneyNavigation';
import { formatCurrency } from '../utils/currency';
import type { PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { readEnrollmentAftercare, type EnrollmentAftercare } from '../utils/enrollmentAftercare';
import { enrollmentSupportPath } from './EnrollmentSupport';
import { EnrollmentModuleBoundary, lazyEnrollmentModule } from './EnrollmentModuleBoundary';
import { EnrollmentPayment, type EnrollmentOrder as Order } from './EnrollmentPayment';
import { interestOption, waitlistStates } from '../utils/enrollmentInterestCopy';
import { parseEnrollmentInterests, type DemandItem, type Interests } from '../utils/enrollmentInterestRecords';
import { enrollmentRecordClassLookup, sortEnrollmentRecords } from '../utils/enrollmentRecordOrder';
import { enrollmentAssistancePath } from '../utils/enrollmentAssistance';
import { validContactEmail } from '../utils/contactEmail';
import { parseEnrollmentBank } from '../utils/enrollmentBank';

type Language = 'zh' | 'en' | 'id';
type Copy = readonly [string, string, string];
const EnrollmentOrderAftercare = lazyEnrollmentModule(() => import('./EnrollmentOrderAftercare').then(module => module.EnrollmentOrderAftercare));
const EnrollmentOrderResult = lazyEnrollmentModule(() => import('./EnrollmentOrderResult').then(module => module.EnrollmentOrderResult));

function isOrderView<T extends Partial<Order>>(receipt:T|null|undefined,orderId:string):receipt is T & Order {
  return receipt?.id===orderId&&typeof receipt.classId==='string'&&
    typeof receipt.status==='string'&&Object.hasOwn(enrollmentStatuses,receipt.status)&&
    typeof receipt.restored==='boolean'&&Number.isFinite(receipt.received);
}
type OrderSummary = Order & {level:string;firstLesson:string;classCancelled?:boolean;updatedAt?:string;needsPayment?:boolean;invitation?:{id:string;deadline:string}};
type AssistedApplication={id:string;name:string;quote:{level:string;format:string;firstLesson:string;schedule:string;price:number};
  createdAt:string;expiresAt:string;active:boolean};
type ApplicationClass = { title: string; schedule: string; price: number; detailsPath: string; listPath: string; fromWaitlist?: string };
type InterestRecord = { kind: 'waitlist' | 'demands'; id: string };

type LearnerDraft={email?:string;name?:string;phone?:string};
type ContactDraft=LearnerDraft & {forAnother?:boolean;priority?:boolean;personal?:LearnerDraft;delegate?:LearnerDraft;applicationRequestId?:string};
type ApplicationEmailDraft = {email:string; verifying:boolean; challengeId?:string; sendId?:string};
const enrollmentCodeReceivedEvent='uper:enrollment-code-received';
const emptyRecordClasses: ReadonlyMap<string,PublicEnrollmentClass> = new Map();
const paymentClassFallbackDelayMs = 300;

function maskedEmail(email:string) {
  const [local,domain]=email.split('@');
  return local.slice(0,1)+'•••@'+domain;
}

type EnrollmentFormProps = {
  classId?: string; language: Language; full?: boolean; demandOnly?: boolean;
  applicationClass?: ApplicationClass; waitlistClass?: PublicEnrollmentClass; mine?: boolean; record?: InterestRecord;
  returnAction?: ReactNode;
} & ({payment: true; intakeTools?: never} | {payment?: false; intakeTools: EnrollmentIntakeTools});

export function EnrollmentForm({ classId, language, full = false, demandOnly = false, payment = false, applicationClass, waitlistClass, mine = false, record, returnAction, intakeTools }: EnrollmentFormProps) {
  const t = (text: Copy) => enrollmentCopy(language,text);
  const [params,setParams] = useSearchParams();
  const navigate = useNavigate();
  const chatReturnState = useEnrollmentChatReturnState();
  const orderId = record ? null : params.get('order');
  const [loadedOrder,setOrder] = useState<Order>();
  const order=loadedOrder?.id===orderId ? loadedOrder : undefined;
  const [lastReadOrder,setLastReadOrder] = useState<string | null>(null);
  const [retryingOrder,setRetryingOrder] = useState(false);
  const loadingOrder=!!orderId && (lastReadOrder!==orderId || retryingOrder);
  const [loadedAftercare,setAftercare] = useState<EnrollmentAftercare>();
  const aftercare=order ? loadedAftercare : undefined;
  const [aftercareFailedFor,setAftercareFailedFor] = useState<string>();
  const aftercareFailureNetwork = useRef(0);
  const confirmedPaymentRead=useRef<AbortSignal|undefined>(undefined);
  const [open,setOpen] = useState(!!orderId || !classId || params.get('apply') === '1');
  const [orders,setOrders] = useState<OrderSummary[]>();
  const [assistedApplications,setAssistedApplications] = useState<AssistedApplication[]>([]);
  const [interests,setInterests] = useState<Interests>();
  const [interestsReadFailed,setInterestsReadFailed] = useState(false);
  // The list can batch optional class details with its waitlist and preferences.
  const recordClassesReady = payment || mine && (!!interests || interestsReadFailed);
  const orderClassId=payment||mine ? order?.classId : undefined;
  const classInfo=aftercare?.currentClass;
  const hasOrderClassInfo=!!(classInfo?.level&&classInfo.format&&classInfo.period&&
    typeof classInfo.schedule==='string'&&typeof classInfo.opened==='boolean');
  const loadingTransferInstructions=payment&&!!order?.bank&&!params.has('view')&&
    (order.status==='awaiting_payment'||order.status==='partial'&&params.get('proof')==='upload'&&!order.restored);
  // The verified aftercare response already includes the class shown on order details.
  const needsOrderClass=!!order&&!hasOrderClassInfo &&
    (loadingTransferInstructions || aftercareFailedFor===order.id || !!aftercare);
  const classLookup=useMemo(()=>{
    if (orderClassId) return needsOrderClass ? orderClassId : '';
    if (!recordClassesReady) return '';
    return enrollmentRecordClassLookup(orders,interests,record);
  },[recordClassesReady,orderClassId,needsOrderClass,orders,interests,record]);
  const [classDetails,setClassDetails] = useState<{key:string;byId:ReadonlyMap<string,PublicEnrollmentClass>}>();
  const recordClasses = classDetails?.key===classLookup ? classDetails.byId : emptyRecordClasses;
  useEffect(() => {
    if (!classLookup) return;
    const controller=new AbortController();
    const collected = new Map<string,PublicEnrollmentClass>();
    const failedIds=new Set<string>();
    const reconnect=watchReadReconnect(()=>void readClassDetails([...failedIds],false),{foregroundOnly:true});
    async function readClassDetails(ids:readonly string[],allowRetry:boolean) {
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
      await readEnrollmentClassDetails(ids,signal,{
        includeAvailability: false,
        onTemporaryFailure: ids => {
          for(const id of ids)failedIds.add(id);
        },
        onBatch: rows => {
          for(const row of rows)collected.set(row.id,row);
          setClassDetails({key:classLookup,byId:new Map(collected)});
        },
      });
      if(allowRetry&&!controller.signal.aborted&&failedIds.size)reconnect.failed();
      else reconnect.stop();
    }
    // Aftercare normally supplies the class information. Keep the public
    // lookup as a fallback when aftercare is slow or incomplete.
    let timer:ReturnType<typeof setTimeout>|undefined;
    const load=()=>void readClassDetails(classLookup.split(','),true);
    if(payment&&orderClassId)timer=setTimeout(load,paymentClassFallbackDelayMs);
    else load();
    return ()=>{clearTimeout(timer);controller.abort();reconnect.stop();};
  },[classLookup,payment,orderClassId]);
  const tab = ['orders','waitlist','demands'].find(value=>value===params.get('tab')) || 'all';
  function selectTab(value: string) {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('tab');
    else next.set('tab', value);
    setParams(next, { replace: true, preventScrollReset: true, state:chatReturnState });
    setEditDemand(undefined);
  }
  const [editDemand,setEditDemand] = useState<DemandItem>();
  const [joined,setJoined] = useState(false);
  const [lastSeatWaitlist,setLastSeatWaitlist] = useState<{id:string;classId:string;email:string;waiting:boolean}>();
  const [savedDemand,setSavedDemand] = useState(false);
  const [hasNoSeat,setHasNoSeat] = useState(full);
  const [owner]=useState(visitorScope);
  const mounted=useRef(false);
  useLayoutEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  const formActive=()=>mounted.current&&visitorScope()===owner;
  const formKey=payment?'payment:'+orderId:classId?(waitlistClass||full?'waitlist:':'apply:')+classId:demandOnly?'demand':'mine';
  const emailDraftKey=formKey+':email-verification';
  const [savedDraft]=useState(()=>readEnrollmentDraft<ContactDraft>(owner,formKey)??{});
  const draftRef=useRef(savedDraft);
  const submittedApplication=useRef<ContactDraft|undefined>(savedDraft.applicationRequestId?savedDraft:undefined);
  const [contact]=useState(()=>readVisitorContact(owner)??getStudentContext()?.leadProfile??{});
  function saveDraft(patch:ContactDraft) {
    if(submittedApplication.current&&!Object.hasOwn(patch,'applicationRequestId'))return;
    draftRef.current={...draftRef.current,...patch};
    writeEnrollmentDraft(owner,formKey,draftRef.current);
  }
  function clearDraft() {
    submittedApplication.current=undefined;
    draftRef.current={};
    writeEnrollmentDraft(owner,formKey);
    writeEnrollmentDraft(owner,emailDraftKey);
  }
  const [forAnother,setForAnother]=useState(!!savedDraft.forAnother);
  const [editingContact,setEditingContact]=useState(false);
  const [email,updateEmail] = useState(savedDraft.email ?? (savedDraft.forAnother||payment?'':contact.email??''));
  const [name,updateName] = useState(savedDraft.name ?? (savedDraft.forAnother||!classId&&!demandOnly?'':contact.fullName??''));
  const [phone,updatePhone] = useState(savedDraft.phone ?? (savedDraft.forAnother||!classId&&!demandOnly?'':contact.whatsapp??''));
  const setEmail=(value:string)=>{updateEmail(value);saveDraft({email:value});};
  const setName=(value:string)=>{updateName(value);saveDraft({name:value});};
  const setPhone=(value:string)=>{updatePhone(value);saveDraft({phone:value});};
  const {ContactPhoneInput, EnrollmentDemandForm, rememberVisitorContact} = intakeTools ?? {};
  const phoneField = useEnrollmentPhoneField(language,phone,intakeTools?.phoneValidation);
  const phoneError = phoneField.error && <small className="enrollment-form-error" role="alert" id={phoneField.errorId}>{phoneField.error}</small>;
  const [priority,updatePriority] = useState(savedDraft.priority??true);
  const setPriority=(value:boolean)=>{updatePriority(value);saveDraft({priority:value});};
  const [savedEmailDraft]=useState(()=>{
    const draft=readEnrollmentDraft<ApplicationEmailDraft>(owner,emailDraftKey);
    if(draft&&draft.email===email.trim().toLowerCase())return draft;
  });
  const [challenge,setChallenge] = useState(savedEmailDraft?.challengeId);
  const [code,setCode] = useState('');
  const [verificationStep,setVerificationStep] = useState(savedEmailDraft?.verifying??false);
  const [sendingCode,setSendingCode] = useState(false);
  const [sessionAddress,setSessionAddress]=useState('');
  const emailCheck = useRef(0);
  const recordsEmail = useRef('');
  const recordRead = useRef<AbortController | undefined>(undefined);
  const orderRead = useRef<AbortController | undefined>(undefined);
  const operationReceiptRead = useRef<AbortController | undefined>(undefined);
  const [checkingRecords,setCheckingRecords] = useState(!!mine&&!orderId);
  const [privateReadRevision,setPrivateReadRevision] = useState(0);
  const enteredEmailField = useRef<HTMLInputElement>(null);
  const applicationHeading = useRef<HTMLHeadingElement>(null);
  const currentEmail = email.trim().toLowerCase();
  const emailConfirmed = sessionAddress === currentEmail && !!currentEmail;
  useEffect(()=>{
    function readConfirmedCode(){
      const saved=readEnrollmentDraft<ApplicationEmailDraft>(owner,emailDraftKey);
      if(saved?.email===currentEmail&&saved.challengeId&&!saved.sendId)setChallenge(saved.challengeId);
    }
    // The sender may belong to an earlier mount of this same form.
    window.addEventListener(enrollmentCodeReceivedEvent,readConfirmedCode);
    readConfirmedCode();
    return ()=>window.removeEventListener(enrollmentCodeReceivedEvent,readConfirmedCode);
  },[owner,emailDraftKey,currentEmail]);
  const canSummarize = !forAnother && emailConfirmed && !!name.trim() && phoneField.valid;
  const [verified,setVerified] = useState(false);
  const [busy,setBusy] = useState(false);
  const [pendingApplication,setPendingApplication]=useState(Boolean(savedDraft.applicationRequestId));
  const [checkingApplicationReceipt,setCheckingApplicationReceipt]=useState(false);
  const [applicationRecovery,setApplicationRecovery]=useState<{requestId:string;afterNetworkRevision?:number}|undefined>(()=>
    savedDraft.applicationRequestId?{requestId:savedDraft.applicationRequestId}:undefined);
  const applicationDraftLocked=busy||pendingApplication;
  const personOption=<label className="enrollment-learner-switch">
    <input type="checkbox" checked={forAnother} disabled={applicationDraftLocked} onChange={event=>{
      const another=event.target.checked;
      const drafts=draftRef.current;
      setForAnother(another);
      setEditingContact(false);
      const saved=another?drafts.delegate:drafts.personal;
      const defaults=another?{}:readVisitorContact(owner)??contact;
      const next={
        email:saved?.email??defaults.email??'',
        name:saved?.name??defaults.fullName??'',
        phone:saved?.phone??defaults.whatsapp??'',
      };
      editEmail(next.email);
      updateName(next.name);
      updatePhone(next.phone);
      saveDraft({...next,forAnother:another,[another?'personal':'delegate']:{email,name,phone}});
    }}/>
    {t(['我在替他人填写','I’m filling this in for someone else','Saya mengisi untuk orang lain'])}
  </label>;
  const [error,setError] = useState('');
  useEffect(()=>{
    if (forAnother || payment || challenge || verified || verificationStep || applicationDraftLocked) return;
    return subscribeVisitorContact(owner,contact=>{
      const edits=draftRef.current;
      if(edits.email===undefined)updateEmail(contact.email??'');
      if(classId||demandOnly){
        if(edits.name===undefined)updateName(contact.fullName??'');
        if(edits.phone===undefined)updatePhone(contact.whatsapp??'');
      }
    });
  },[owner,forAnother,payment,challenge,verified,verificationStep,applicationDraftLocked,classId,demandOnly]);
  const [requestId,setRequestId] = useState(() => savedDraft.applicationRequestId??createBrowserUuid());
  const running=useRef(false);
  const proofKey='proof:'+orderId;
  const proofTransferKey=proofKey+':transfer';
  const [pendingProof,setPendingProof]=useState(()=>payment?readEnrollmentDraft<string>(owner,proofKey):undefined);
  const [checkingProofReceipt,setCheckingProofReceipt]=useState(false);
  const [submittingProof,setSubmittingProof]=useState(false);
  const proofUpload=useRef<AbortController|undefined>(undefined);
  const [proofRecovery,setProofRecovery]=useState<{uploadId:string;afterNetworkRevision?:number}|undefined>(()=>
    pendingProof?{uploadId:pendingProof}:undefined);
  const [proofReadFailure,setProofReadFailure]=useState<'unavailable'|'not_found'>();
  const [confirmedProofOrderId,setConfirmedProofOrderId]=useState<string>();
  const [file,setFile] = useState<File>();
  const [proofTransfer,setProofTransfer] = useState({amount:'',reference:''});
  const [paymentRefresh,setPaymentRefresh] = useState<'checking'|'failed'>();
  const networkRevision=useRef(0);
  useEffect(()=>{
    const onOnline=()=>{networkRevision.current++;};
    window.addEventListener('online',onOnline);
    return ()=>window.removeEventListener('online',onOnline);
  },[]);
  const cancelDialog=useRef<HTMLDialogElement>(null);
  const base = '/api/enrollment';
  function updateProofTransfer(next:typeof proofTransfer) {
    setProofTransfer(next);
    const email=recordsEmail.current;
    if(!payment||!orderId||!email)return;
    writeEnrollmentDraft(owner,proofTransferKey,next.amount||next.reference?{email,...next}:undefined);
  }
  function persistEmailStep(verifying:boolean, challengeId?:string, sendId?:string) {
    writeEnrollmentDraft<ApplicationEmailDraft>(owner,emailDraftKey,{email:currentEmail,verifying,challengeId,sendId});
  }
  function invalidateEmailConfirmation() {
    emailCheck.current++;
    setSessionAddress('');
  }
  function markEmailVerified() {
    emailCheck.current++;
    setSessionAddress(currentEmail);
  }
  async function readOrderData(read:(request:AbortSignal)=>Promise<void>) {
    orderRead.current?.abort();
    const request=new AbortController();
    orderRead.current=request;
    try { await read(request.signal); }
    catch(error) { if(!request.signal.aborted)throw error; }
    finally { if(orderRead.current===request)orderRead.current=undefined; }
  }
  async function readAftercare(path:string,address:string,request:AbortSignal):Promise<EnrollmentAftercare|undefined> {
    const response=await readEnrollmentAftercareResponse(path,address,request,()=>networkRevision.current);
    if(response?.status===401)throw Error('enrollment_verification_required');
    if(request.aborted||visitorScope()!==owner)return;
    const details=readEnrollmentAftercare(response?.data);
    if(!details)aftercareFailureNetwork.current=networkRevision.current;
    return details;
  }
  function getOrder(id:string, allowEarlyPayment = false, onPaymentChecked?:()=>void) {
    const expected=recordsEmail.current||currentEmail;
    const path=base+'/orders/'+encodeURIComponent(id);
    return readOrderData(async request=>{
      const response=await readEnrollmentOrderResponse(path,validContactEmail(expected)?expected:'',request,
        ()=>networkRevision.current,()=>(payment||mine)&&!document.hidden&&formActive());
      if(request.aborted||!formActive())return;
      if (response?.status === 401) throw Error('enrollment_verification_required');
      if (response?.status === 404) throw Error('enrollment_order_not_found');
      if (!response?.ok) throw Error('enrollment_order_read_failed');
      const data=response.data as (Partial<Order> & {verifiedEmail?:string}) | undefined;
      if (!isOrderView(data,id) || !Number.isFinite(data.price) || typeof data.deadline !== 'string' || !Number.isFinite(Date.parse(data.deadline)) ||
        (data.verifiedEmail !== undefined && !validContactEmail(data.verifiedEmail))) throw Error('enrollment_order_read_failed');
      const {verifiedEmail:address,bank,...details}=data;
      const validBank=parseEnrollmentBank(bank);
      const nextOrder={...details,bank:validBank??undefined,bankDetailsInvalid:bank!==undefined&&!validBank};
      const serverDate=Date.parse(response.headers.get('Date') ?? '');
      nextOrder.serverClockOffsetMs=Number.isFinite(serverDate)?serverDate-Date.now():undefined;
      const verifiedAddress=address??expected;
      const showPayment = nextOrder.status === 'awaiting_payment' ||
        (nextOrder.status === 'partial' && params.get('proof') === 'upload' && !nextOrder.restored);
      const renderEarly=allowEarlyPayment && payment && !params.has('view') && address && showPayment && nextOrder.bank;
      if(renderEarly) {
        // The order endpoint has verified ownership and suppresses bank details for a cancelled class.
        recordsEmail.current=verifiedAddress;
        setAftercare(undefined);
        setAftercareFailedFor(undefined);
        setOrder(nextOrder);
        setLastReadOrder(id);
        setRetryingOrder(false);
        confirmedPaymentRead.current=request;
        onPaymentChecked?.();
      } else if (!order && address && ['proof_review','partial','paid'].includes(nextOrder.status)) {
        // The verified order can show its status while aftercare is loading.
        // Payment, transfer and refund controls still wait for their own checks.
        recordsEmail.current=verifiedAddress;
        setAftercare(undefined);
        setAftercareFailedFor(undefined);
        setOrder(nextOrder);
      }
      const nextAftercare=await readAftercare(path,verifiedAddress,request);
      if(request.aborted)return;
      recordsEmail.current=verifiedAddress;
      setAftercare(nextAftercare);
      setAftercareFailedFor(nextAftercare?undefined:id);
      setOrder(nextOrder);
      setProofReadFailure(undefined);
      if(!renderEarly)onPaymentChecked?.();
    });
  }
  function retryOrderRead(id: string) {
    return run(async release => {
      setRetryingOrder(true);
      try { await getOrder(id,true,payment?release:undefined); }
      finally { setRetryingOrder(false); }
    });
  }
  function retryAftercare(id:string) {
    return readOrderData(async request=>{
      const next=await readAftercare(base+'/orders/'+encodeURIComponent(id),recordsEmail.current,request);
      if(request.aborted)return;
      setAftercare(next);
      setAftercareFailedFor(next?undefined:id);
    });
  }
  function clearOrders() {
    recordRead.current?.abort();
    setVerified(false);
    setOrders(undefined);
    setAssistedApplications([]);
    setInterests(undefined);
    setInterestsReadFailed(false);
    setEditDemand(undefined);
  }
  function clearPrivateRecords() {
    clearOrders();
    orderRead.current?.abort();
    operationReceiptRead.current?.abort();
    proofUpload.current?.abort();
    if(payment){
      const uploadId=readEnrollmentDraft<string>(owner,proofKey);
      if(uploadId)setProofRecovery({uploadId});
    }
    setOrder(undefined);
    setAftercare(undefined);
    setAftercareFailedFor(undefined);
    setFile(undefined);
    setProofTransfer({amount:'',reference:''});
    setPaymentRefresh(undefined);
    setProofReadFailure(undefined);
    setConfirmedProofOrderId(undefined);
  }
  function requireEmailVerification() {
    invalidateEmailConfirmation();
    setChallenge(undefined);
    setCode('');
    clearPrivateRecords();
    if(applicationClass){setVerificationStep(true);persistEmailStep(true);}
    else writeEnrollmentDraft(owner,emailDraftKey);
  }
  useEffect(()=>{
    let interruptedFirstRead=false;
    const check=async(isLatest:()=>boolean,signal:AbortSignal,sessionChanged:boolean)=>{
      const revision=++emailCheck.current;
      const displayedAddress=recordsEmail.current;
      if(sessionChanged&&!displayedAddress&&(recordRead.current||orderRead.current)){
        // An initial private read may have used the old cookie before it could confirm an address.
        recordRead.current?.abort();
        orderRead.current?.abort();
        interruptedFirstRead=true;
      }
      const address=await readEnrollmentEmailAddress(signal);
      if(!isLatest()||revision!==emailCheck.current||visitorScope()!==owner)return;
      // A temporary failure on focus does not prove expiry. Cross-tab changes fail closed.
      if(address===undefined&&!sessionChanged)return false;
      setSessionAddress(address??'');
      if(displayedAddress&&recordsEmail.current===displayedAddress&&displayedAddress!==address){
        recordsEmail.current='';
        clearPrivateRecords();
      }
      if(interruptedFirstRead){
        if(address===undefined)return false;
        interruptedFirstRead=false;
        if(address)setPrivateReadRevision(value=>value+1);
      }
      return address!==undefined;
    };
    return watchEnrollmentEmailSession(check,true);
  },[owner]);
  async function readRecords(read:(signal:AbortSignal)=>Promise<unknown>) {
    recordRead.current?.abort();
    const request=new AbortController();
    recordRead.current=request;
    try {
      await read(request.signal);
    } catch(error) {
      if(!request.signal.aborted)throw error;
    } finally {
      if(recordRead.current===request)recordRead.current=undefined;
    }
  }
  async function readInterests(address:string, request:AbortSignal, {
    preserveEmailChallenge=false, confirmSession=!!record,
  } = {}) {
    setInterestsReadFailed(false);
    try {
      const response=await readEnrollmentInterestsResponse(address,request,()=>networkRevision.current);
      if(request.aborted||visitorScope()!==owner)return;
      if(response?.status===401){if(!preserveEmailChallenge)requireEmailVerification();return false;}
      if(!response?.ok)throw Error('enrollment_failed');
      const data=response.data as {verifiedEmail?:unknown}|null;
      const interests=parseEnrollmentInterests(data);
      if(confirmSession){
        const verifiedAddress=data?.verifiedEmail??address;
        if(typeof verifiedAddress!=='string'||!validContactEmail(verifiedAddress)||(address&&verifiedAddress!==address))throw Error('enrollment_failed');
        recordsEmail.current=verifiedAddress;
        setVerified(true);
      }
      setInterests(interests);
    } catch {
      if(request.aborted||visitorScope()!==owner)return;
      if(record&&!verified)throw Error('enrollment_records_read_failed');
      setInterestsReadFailed(true);
    }
  }
  function refreshInterests() {
    return readRecords(request => readInterests(recordsEmail.current, request));
  }
  function getRecords(preserveEmailChallenge=false, refreshRelated=true) {
    const expected=recordsEmail.current||currentEmail;
    if(record)return readRecords(request=>readInterests(expected,request,{preserveEmailChallenge}));
    const hasRelated=!classId&&!demandOnly&&!payment;
    return readRecords(async request=>{
      const response=await readEnrollmentOrdersResponse(expected,request,()=>networkRevision.current);
      if(request.aborted||visitorScope()!==owner)return;
      if (response?.status === 401) {
        // A reload during verification has no enrollment session yet.
        if(!preserveEmailChallenge)requireEmailVerification();
        return;
      }
      const data=response?.data as {orders?:OrderSummary[];applications?:AssistedApplication[];verifiedEmail?:string}|undefined;
      if (!Array.isArray(data?.orders) || data.orders.some(row => typeof row?.id !== 'string' ||
        !isOrderView(row,row.id) || typeof row.level !== 'string' || typeof row.firstLesson !== 'string' ||
        (row.updatedAt!=null&&typeof row.updatedAt!=='string') ||
        (row.invitation!=null&&(typeof row.invitation.id!=='string'||typeof row.invitation.deadline!=='string'))) ||
        (data.applications !== undefined && (!Array.isArray(data.applications) || data.applications.some(row =>
          typeof row?.id !== 'string' || typeof row.quote?.firstLesson !== 'string' ||
          (row.createdAt!=null&&typeof row.createdAt!=='string') ||
          (row.active&&(typeof row.expiresAt!=='string'||!Number.isFinite(Date.parse(row.expiresAt))))))) ||
        (data.verifiedEmail !== undefined && (!validContactEmail(data.verifiedEmail) || (expected && data.verifiedEmail!==expected)))) {
        // The related records endpoint verifies the same email independently.
        // An unavailable order list need not hide the learner's other records.
        if(mine&&hasRelated&&!interests){
          const authorized=await readInterests(expected,request,{preserveEmailChallenge,confirmSession:true});
          if(request.aborted||visitorScope()!==owner||authorized===false)return;
        }
        throw Error('enrollment_records_read_failed');
      }
      const verifiedAddress: string = data.verifiedEmail ?? expected;
      recordsEmail.current=verifiedAddress;
      setOrders(data.orders);
      setAssistedApplications(data.applications??[]);
      setVerified(true);
      setCheckingRecords(false);
      if (hasRelated&&refreshRelated) await readInterests(verifiedAddress,request);
    });
  }
  function retryRecordsRead() {
    return run(async () => {
      if (!verified) setCheckingRecords(true);
      try { await getRecords(false,!interests); }
      finally { setCheckingRecords(false); }
    });
  }
  useEffect(()=>{
    const ordersFailed=error==='enrollment_records_read_failed';
    if(!mine||orderId||(!ordersFailed&&!interestsReadFailed))return;
    const retry=()=>{
      if(document.hidden||running.current||recordRead.current||!formActive())return;
      if(ordersFailed)void retryRecordsRead();
      else if(verified)void run(refreshInterests);
    };
    const onVisible=()=>{if(navigator.onLine!==false)retry();};
    window.addEventListener('online',retry);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{
      window.removeEventListener('online',retry);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[mine,orderId,error,interestsReadFailed,verified,interests,owner]);
  useEffect(() => setHasNoSeat(full),[full]);
  useEffect(() => {
    if(!orderId || savedDraft.email===''&&(mine||payment)){
      setLastReadOrder(orderId);
      return;
    }
    setError('');
    let active=true;
    void getOrder(orderId,true).catch(reason=>{
      if(active){setOrder(undefined);setAftercare(undefined);setError(reason.message);}
    }).finally(()=>{if(active)setLastReadOrder(orderId);});
    return ()=>{active=false;orderRead.current?.abort();};
  },[orderId,privateReadRevision]);
  const showListForMissingOrder=mine&&error==='enrollment_order_not_found';
  useEffect(() => {
    let active=true;
    if (open && (!mine || !orderId || showListForMissingOrder) && !payment && !applicationClass && !demandOnly && !waitlistClass) {
      if (savedDraft.email === undefined || validContactEmail(currentEmail)) {
        if (!verified && mine) setCheckingRecords(true);
        void getRecords(!!savedEmailDraft?.challengeId).catch(reason=>{if(active)setError(reason.message);}).finally(()=>{if(active)setCheckingRecords(false);});
      } else setCheckingRecords(false);
    } else setCheckingRecords(false);
    return ()=>{active=false;recordRead.current?.abort();};
  },[open,classId,orderId,showListForMissingOrder,privateReadRevision]);
  const currentOrderId=order?.id;
  useEffect(()=>()=>operationReceiptRead.current?.abort(),[owner,orderId,classId]);
  useEffect(()=>{
    const address=recordsEmail.current;
    if (!payment || !currentOrderId || !pendingProof || !address || busy || !proofRecovery || proofRecovery.uploadId!==pendingProof) return;
    const {afterNetworkRevision}=proofRecovery;
    // A reloaded attempt is checked until the learner selects a new file.
    if(file && afterNetworkRevision===undefined)return;
    const path=base+'/orders/'+encodeURIComponent(currentOrderId)+'/proofs/'+encodeURIComponent(pendingProof)+'/result';
    return recoverEnrollmentOperation<Order>({
      path,email:address,waitForConnection:afterNetworkRevision===networkRevision.current,
      isCurrent:()=>!running.current&&formActive()&&recordsEmail.current===address,
      matchesOrder:receipt=>isOrderView(receipt,currentOrderId),
      onChecking:setCheckingProofReceipt,
      onResult:result=>{
        setProofRecovery(undefined);
        if(result.state==='saved')finishProof(result.order);
      },
      onVerificationRequired:()=>{
        requireEmailVerification();
        setError('enrollment_verification_required');
      },
    });
  },[payment,currentOrderId,pendingProof,file,owner,busy,proofRecovery]);
  useEffect(()=>{
    if(!payment||!currentOrderId||!recordsEmail.current)return;
    const draft=readEnrollmentDraft<typeof proofTransfer & {email:string}>(owner,proofTransferKey);
    if(draft?.email===recordsEmail.current&&typeof draft.amount==='string'&&typeof draft.reference==='string')
      setProofTransfer({amount:draft.amount,reference:draft.reference});
  },[payment,currentOrderId,owner,proofTransferKey]);
  const visiblePaymentOrderId=payment?currentOrderId:undefined;
  useEffect(()=>{
    if(!visiblePaymentOrderId)return;
    let wasHidden=document.hidden;
    const onVisibility=()=>{
      if(document.hidden){wasHidden=true;return;}
      if(!wasHidden)return;
      wasHidden=false;
      void refreshPaymentOrder(visiblePaymentOrderId);
    };
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>document.removeEventListener('visibilitychange',onVisibility);
  },[visiblePaymentOrderId,params]);
  useEffect(()=>{
    if((!payment&&!mine)||!orderId)return;
    const failedOrderRead=!visiblePaymentOrderId&&error==='enrollment_order_read_failed';
    const onOnline=()=>{
      if(document.hidden)return;
      if(visiblePaymentOrderId&&paymentRefresh==='failed')void refreshPaymentOrder(visiblePaymentOrderId);
      else if(visiblePaymentOrderId&&proofReadFailure==='unavailable'&&!running.current&&!orderRead.current)
        void refreshSavedProof(visiblePaymentOrderId);
      else if(failedOrderRead)void retryOrderRead(orderId);
    };
    const onVisible=()=>{if(failedOrderRead&&navigator.onLine!==false)onOnline();};
    window.addEventListener('online',onOnline);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{
      window.removeEventListener('online',onOnline);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[payment,mine,orderId,visiblePaymentOrderId,paymentRefresh,proofReadFailure,error,params]);
  useEffect(()=>{
    if(!currentOrderId||aftercareFailedFor!==currentOrderId)return;
    const retryMissingAftercare=()=>{
      const address=recordsEmail.current;
      if(document.hidden||running.current||orderRead.current||!address||!formActive())return;
      stop();
      void retryAftercare(currentOrderId).catch(cause=>{
        if(formActive()&&recordsEmail.current===address&&(cause as Error).message==='enrollment_verification_required'){
          requireEmailVerification();
          setError('enrollment_verification_required');
        }
      });
    };
    const onVisible=()=>{if(navigator.onLine!==false)retryMissingAftercare();};
    const stop=()=>{
      window.removeEventListener('online',retryMissingAftercare);
      document.removeEventListener('visibilitychange',onVisible);
    };
    window.addEventListener('online',retryMissingAftercare);
    // Payment already revalidates the entire order when it returns to the foreground.
    if(mine&&!payment)document.addEventListener('visibilitychange',onVisible);
    // Reconnection can arrive after the failed read but before React installs this listener.
    if(aftercareFailureNetwork.current!==networkRevision.current)retryMissingAftercare();
    return stop;
  },[currentOrderId,aftercareFailedFor,mine,payment,owner]);
  async function refreshPaymentOrder(id:string) {
    // A later foreground return may replace an outstanding aftercare read.
    // An in-flight order check already keeps payment details hidden.
    if(running.current||!recordsEmail.current||
      (orderRead.current&&orderRead.current.signal!==confirmedPaymentRead.current))return;
    const address=recordsEmail.current;
    setPaymentRefresh('checking');
    try {
      await getOrder(id,true,()=>setPaymentRefresh(undefined));
    } catch(error) {
      const reason=(error as Error).message;
      if(recordsEmail.current!==address)return;
      if(reason==='enrollment_verification_required'||reason==='enrollment_order_not_found'){
        requireEmailVerification();
        setError(reason);
      }else setPaymentRefresh('failed');
    }
  }
  useEffect(() => {
    if (!verificationStep) return;
    window.scrollTo(0, 0);
    applicationHeading.current?.focus();
  },[verificationStep]);
  const lostSeatWaitlist = error==='enrollment_class_full' ? applicationClass?.fromWaitlist : undefined;
  const stillWaiting=lastSeatWaitlist?.id===lostSeatWaitlist&&lastSeatWaitlist?.classId===classId&&lastSeatWaitlist?.email===currentEmail
    ? lastSeatWaitlist?.waiting : undefined;
  useEffect(() => {
    if (!lostSeatWaitlist || !classId || !validContactEmail(currentEmail)) return;
    const target={id:lostSeatWaitlist,classId,email:currentEmail};
    const controller = new AbortController();
    const {signal}=controller;
    async function check(retryDuringRead:boolean) {
      const response=await readEnrollmentInterestsResponse(currentEmail,signal,retryDuringRead?()=>networkRevision.current:undefined);
      if(signal.aborted||visitorScope()!==owner)return;
      if(response?.ok){
        const data=response.data as {verifiedEmail?:unknown}|null;
        if(data?.verifiedEmail!==target.email)return;
        try {
          const {waitlist}=parseEnrollmentInterests(data);
          const waiting=waitlist.some(row=>row.id===target.id&&row.classId===target.classId&&row.state==='waiting');
          setLastSeatWaitlist({...target,waiting});
        }catch{/* Keep the waitlist link when the server did not confirm its state. */}
      }else if(retryDuringRead&&(!response||response.status===408||response.status>=500)){
        window.addEventListener('online',onOnline,{once:true});
      }
    }
    const onOnline=()=>{if(visitorScope()===owner)void check(false);};
    void check(true);
    return ()=>{
      controller.abort();
      window.removeEventListener('online',onOnline);
    };
  }, [lostSeatWaitlist,classId,currentEmail,owner]);
  async function run(action: (release:()=>void) => Promise<void>) {
    if (running.current) return;
    running.current=true;
    setBusy(true);
    setError('');
    let released=false;
    // Payment can release the form after its order read while aftercare continues.
    // A finishing background read must not reset a later operation's busy state.
    const release=()=>{
      if(released)return;
      released=true;
      running.current=false;
      setBusy(false);
    };
    try { await action(release); } catch (cause) {
      if(!formActive()||cause instanceof DOMException&&cause.name==='AbortError')return;
      const message=(cause as Error).message || 'enrollment_failed';
      if (message==='enrollment_class_full') {
        setLastSeatWaitlist(undefined);
        setHasNoSeat(true);
        window.scrollTo(0,0);
      }
      if (message==='enrollment_seat_available') setHasNoSeat(false);
      if (message==='enrollment_verification_required') requireEmailVerification();
      setError(message);
    }
    finally { release(); }
  }
  async function requestCode() {
    const sendId=createBrowserUuid();
    const currentSend=()=>readEnrollmentDraft<ApplicationEmailDraft>(owner,emailDraftKey)?.sendId===sendId;
    persistEmailStep(!!applicationClass,challenge,sendId);
    setSendingCode(true);
    try {
      const challengeId=await requestEnrollmentEmailCode(email,language,!classId&&!demandOnly?'mine':'apply');
      // Another visit to the same form may have changed the address or sent a newer code.
      if(!currentSend())return;
      setChallenge(challengeId);
      // Clear an unchanged code from an older challenge, even when the new message arrives first.
      if(challenge)setCode(current=>current===code?'':current);
      persistEmailStep(!!applicationClass,challengeId);
      window.dispatchEvent(new Event(enrollmentCodeReceivedEvent));
    } catch (cause) {
      if(currentSend())throw cause;
    } finally {
      setSendingCode(false);
    }
  }
  function sendCode() { return run(requestCode); }
  function beginApplicationVerification() {
    return run(async()=>{
      saveDraft({email,name,phone,priority});
      setVerificationStep(true);
      if(challenge)persistEmailStep(true,challenge);
      else await requestCode();
    });
  }
  function verify() {
    return run(async release => {
      await verifyEnteredEmail();
      if(!payment)rememberVisitorContact?.(owner,{email});
      clearDraft();
      recordsEmail.current=currentEmail;
      if (orderId) await getOrder(orderId,payment,payment?release:undefined);
      else if (!classId) await getRecords();
      else setVerified(true);
    });
  }
  function sourceQuery() {
    const source=new URLSearchParams(params);
    source.set('lang',language);
    return source.toString();
  }
  function openApplicationResult(result:Pick<Order,'id'>) {
    // Keep the original receipt lookup available if the learner left this form.
    if(!formActive())return;
    if(typeof result?.id!=='string'||!result.id)throw Error('enrollment_operation_unconfirmed');
    setApplicationRecovery(undefined);
    if(!forAnother&&(emailConfirmed||applicationClass))rememberVisitorContact?.(owner,{fullName:name,email,whatsapp:phone});
    clearDraft();
    const next=new URLSearchParams(params);
    next.set('order',result.id);
    next.delete('apply');
    navigate('/enrollment/payment?' + next.toString(), { replace:true,state:chatReturnState });
  }
  async function checkApplication() {
    await verifyEnteredEmail();
    if(!formActive())return;
    if(submittedApplication.current?.email!==email)throw Error('enrollment_operation_unconfirmed');
    await confirmApplicationReceipt();
  }
  async function readApplicationReceipt() {
    const result=await readCurrentOperationReceipt(base+'/applications/results/'+encodeURIComponent(requestId),
      currentEmail||recordsEmail.current,receipt=>receipt.classId===classId);
    return result.state==='saved'?result.order:undefined;
  }
  async function confirmApplicationReceipt() {
    try {
      const saved=await readApplicationReceipt();
      if(!formActive())return;
      if(!saved)throw Error('enrollment_operation_unconfirmed');
      openApplicationResult(saved);
    } catch(error) {
      if(!formActive())return;
      if((error as Error).message==='enrollment_operation_unconfirmed'){
        setApplicationRecovery({requestId,afterNetworkRevision:networkRevision.current});
      }
      throw error;
    }
  }
  const hasApplicationClass=!!applicationClass;
  useEffect(()=>{
    if(!hasApplicationClass||!emailConfirmed||busy||!pendingApplication||applicationRecovery?.requestId!==requestId)return;
    const {afterNetworkRevision}=applicationRecovery;
    const path=base+'/applications/results/'+encodeURIComponent(requestId);
    return recoverEnrollmentOperation<Order>({
      path,email:currentEmail,waitForConnection:afterNetworkRevision===networkRevision.current,
      isCurrent:()=>!running.current&&formActive(),
      matchesOrder:receipt=>receipt.classId===classId,
      onChecking:setCheckingApplicationReceipt,
      onResult:result=>{
        setApplicationRecovery(undefined);
        if(result.state==='saved')openApplicationResult(result.order);
      },
      onVerificationRequired:()=>{
        setApplicationRecovery(undefined);
        requireEmailVerification();
        setError('enrollment_verification_required');
      },
    });
  },[hasApplicationClass,classId,currentEmail,emailConfirmed,busy,pendingApplication,applicationRecovery,requestId,owner]);
  async function submitApplication() {
    if(!formActive())return;
    if(pendingApplication){
      const original=submittedApplication.current;
      if(original?.email!==email)throw Error('enrollment_operation_unconfirmed');
      const saved=await readApplicationReceipt();
      if(!formActive())return;
      if(saved){openApplicationResult(saved);return;}
      if(original.name!==name||original.phone!==phone||original.priority!==priority)throw Error('enrollment_operation_unconfirmed');
    }
    saveDraft({email,name,phone,priority,applicationRequestId:requestId});
    setApplicationRecovery(undefined);
    submittedApplication.current=draftRef.current;
    setPendingApplication(true);
    let result;
    try {
      result=await enrollmentPost(base+'/applications',{classId,name,phone,priority,requestId,source:sourceQuery()},
        currentEmail||recordsEmail.current,AbortSignal.timeout(15000));
    } catch(cause){
      if(!formActive())return;
      const status=(cause as {status?:number}).status;
      const message=(cause as Error).message;
      if((status&&status>=400&&status<500&&![401,408,409,425,429].includes(status))||
          ['enrollment_class_full','enrollment_class_unavailable'].includes(message)||message.startsWith('enrollment_intake_')){
        submittedApplication.current=undefined;
        saveDraft({applicationRequestId:undefined});
        setPendingApplication(false);
        setRequestId(createBrowserUuid());
        throw cause;
      }
      if(message==='enrollment_verification_required')throw cause;
      if(status&&status<500&&status!==408)throw Error('enrollment_operation_unconfirmed');
    }
    if(!formActive())return;
    if(typeof result?.id==='string'&&result.id){openApplicationResult(result);return;}
    // The application may have committed before its response was lost.
    await confirmApplicationReceipt();
  }
  const apply = () => phoneField.check() && run(submitApplication);
  async function verifyEnteredEmail() {
    if (emailConfirmed) return;
    if (!challenge || code.length!==6) throw Error('enrollment_verification_required');
    await verifyEnrollmentEmail(email,challenge,code);
    markEmailVerified();
  }
  function verifyApplication() {
    return run(async () => {
      await verifyEnteredEmail();
      await submitApplication();
    });
  }
  function editEmail(value: string) {
    setEmail(value);
    setChallenge(undefined);
    writeEnrollmentDraft(owner,emailDraftKey);
    setCode('');
    setError('');
  }
  function changeRecordsEmail() {
    if(payment&&orderId)writeEnrollmentDraft(owner,proofTransferKey);
    recordsEmail.current='';
    editEmail('');
    clearPrivateRecords();
  }
  function signOutEmail() {
    void run(async()=>{
      await signOutEnrollmentEmail(recordsEmail.current);
      invalidateEmailConfirmation();
      changeRecordsEmail();
    });
  }
  function upload(transfer:{reportedAmount?:number;bankReference?:string}) {
    if (!order || !file || checkingProofReceipt) return;
    return run(async () => {
      const controller=new AbortController();
      proofUpload.current=controller;
      try { await submitProof(transfer,order,file,controller.signal); }
      finally { if(proofUpload.current===controller)proofUpload.current=undefined; }
    });
  }
  async function submitProof(transfer:{reportedAmount?:number;bankReference?:string},order:Order,file:File,signal:AbortSignal) {
    setConfirmedProofOrderId(undefined);
    setProofReadFailure(undefined);
    const path=base+'/orders/'+encodeURIComponent(order.id)+'/proofs';
    const expected=recordsEmail.current||currentEmail;
    const current=()=>formActive()&&!signal.aborted;
    let reservation:{uploadId:string;transport?:'binary-v1'}|undefined;
    if(pendingProof){
      const result=await readCurrentOperationReceipt(path+'/'+pendingProof+'/result',expected,receipt=>isOrderView(receipt,order.id));
      if(!current())return;
      if(result.state==='saved'){finishProof(result.order);return;}
      // The binary-aware start endpoint can recheck the same receipt under
      // the order lock and refresh an eligible upload before sending bytes.
      if(result.uploadActive!==false && result.proofTransport!=='binary-v1')reservation={uploadId:pendingProof};
    }
    const proof=await prepareEnrollmentProofFile(file);
    if(!current())return;
    if(!proof)throw Error('enrollment_invalid_proof');
    if(!reservation){
      const result=await enrollmentPost(path+'/start',pendingProof?{previousUploadId:pendingProof}:{},expected,
        AbortSignal.any([signal,AbortSignal.timeout(15000)]));
      if(!current())return;
      if(result?.state==='saved'){
        finishProof(result.order);
        return;
      }
      reservation=result;
    }
    const uploadId=reservation?.uploadId;
    if(typeof uploadId!=='string'||!uploadId)throw Error('enrollment_operation_unconfirmed');
    storePendingProof(uploadId);
    setSubmittingProof(true);
    let saved;
    try{
      const metadata={uploadId,...transfer};
      const deadline=()=>AbortSignal.any([signal,AbortSignal.timeout(enrollmentProofUploadTimeout(proof.size,reservation?.transport))]);
      if(reservation?.transport==='binary-v1'){
        saved=await postEnrollmentProof(path+'/finish',proof,metadata,expected,deadline());
      }else{
        const encoded=await new Promise<string>((resolve,reject)=>{
          const reader=new FileReader();
          reader.onerror=reject;
          reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
          reader.readAsDataURL(proof);
        });
        if(!current())return;
        saved=await enrollmentPost(path+'/finish',{...metadata,mime:proof.type,encoded},expected,deadline());
      }
    }
    catch(cause){
      if(!current())return;
      const message=(cause as Error).message;
      if(['enrollment_invalid_proof','enrollment_upload_expired'].includes(message)){
        storePendingProof(undefined);
        throw cause;
      }
      if(message==='enrollment_verification_required')throw cause;
      // The upload can finish on the server even when its response is lost.
      await checkProofResult(order.id,uploadId,expected);
      return;
    } finally {
      setSubmittingProof(false);
    }
    if(!current())return;
    if(isOrderView(saved,order.id))finishProof(saved);
    else await checkProofResult(order.id,uploadId,expected);
  }
  function storePendingProof(id?:string){
    setProofRecovery(undefined);
    setPendingProof(id);
    writeEnrollmentDraft(owner,proofKey,id);
  }
  function finishProof(saved:Order){
    if(!formActive())return;
    if(!order||!isOrderView(saved,order.id))throw Error('enrollment_operation_unconfirmed');
    setError(current=>current==='enrollment_operation_unconfirmed'?'':current);
    // A supplemental proof can be saved without changing the order's payment status.
    setConfirmedProofOrderId(saved.status==='proof_review'?undefined:saved.id);
    storePendingProof(undefined);
    setFile(undefined);
    updateProofTransfer({amount:'',reference:''});
    setOrder(previous=>previous?.id===saved.id?{...previous,...saved}:previous);
    if (params.has('proof')) {
      const next = new URLSearchParams(params);
      next.delete('proof');
      setParams(next,{replace:true,preventScrollReset:true,state:chatReturnState});
    }
    window.scrollTo(0,0);
    void refreshSavedProof(saved.id);
  }
  async function refreshSavedProof(id:string){
    if(!formActive())return;
    const address=recordsEmail.current;
    if(!address)return;
    try{await getOrder(id);}
    catch(error){
      if(!formActive()||recordsEmail.current!==address)return;
      const reason=(error as Error).message;
      if(reason==='enrollment_verification_required'){
        requireEmailVerification();
        setError('enrollment_verification_required');
        return;
      }
      setProofReadFailure(reason==='enrollment_order_not_found'?'not_found':'unavailable');
    }
  }
  async function checkProof(){
    if(!order||!pendingProof)return;
    await checkProofResult(order.id,pendingProof,recordsEmail.current||currentEmail);
  }
  async function readCurrentOperationReceipt(path:string,email:string,matchesOrder:(order:Order)=>boolean) {
    if(visitorScope()!==owner)throw Error('enrollment_verification_required');
    const controller=new AbortController();
    operationReceiptRead.current=controller;
    try{
      return await readEnrollmentOperation<Order>(path,email,controller.signal,()=>networkRevision.current,matchesOrder);
    }finally{
      if(operationReceiptRead.current===controller)operationReceiptRead.current=undefined;
    }
  }
  async function checkProofResult(id:string,uploadId:string,expectedEmail:string){
    const path=base+'/orders/'+encodeURIComponent(id)+'/proofs/'+encodeURIComponent(uploadId)+'/result';
    try {
      const result=await readCurrentOperationReceipt(path,expectedEmail,receipt=>isOrderView(receipt,id));
      if(result.state!=='saved')throw Error('enrollment_operation_unconfirmed');
      finishProof(result.order);
    } catch(error) {
      if((error as Error).message==='enrollment_operation_unconfirmed'&&formActive()&&recordsEmail.current===expectedEmail){
        setProofRecovery({uploadId,afterNetworkRevision:networkRevision.current});
      }
      throw error;
    }
  }
  const join = () => phoneField.check() && run(async () => {
    if (waitlistClass) await verifyEnteredEmail();
    await submitEnrollmentInterest('waitlist',{classId,phone,name,source:sourceQuery()},currentEmail||recordsEmail.current);
    if(waitlistClass&&!forAnother)rememberVisitorContact?.(owner,{fullName:name,email,whatsapp:phone});
    clearDraft();
    setJoined(true);
  });
  async function submitDemand(request:PendingDemand,recovering:boolean,preserveDraft=false) {
    await submitPendingDemand(owner,currentEmail,request,recovering);
    if(!formActive())return;
    if(!request.forAnother)rememberVisitorContact?.(owner,{fullName:request.name,email:currentEmail,whatsapp:request.criteria.phone});
    if(!preserveDraft){
      clearDraft();
      writeEnrollmentDraft(owner,formKey+':criteria');
    }
    setSavedDemand(true);
  }
  function savePreferences(data: Parameters<React.ComponentProps<EnrollmentIntakeTools['EnrollmentDemandForm']>['onSave']>[0]) {
    void run(async () => {
      if (demandOnly) {
        await verifyEnteredEmail();
        const pending=readPendingDemand(owner,currentEmail);
        if(pending && typeof pending!=='string' && !sameDemandDraft(pending,data,forAnother)) {
          throw Error('enrollment_demand_previous_unconfirmed');
        }
        const request=typeof pending==='object'?pending:{...data,id:pending??data.id,source:sourceQuery(),forAnother};
        await submitDemand(request,!!pending);
      }
      else {
        await enrollmentPost(base+'/demands',{...data,source:sourceQuery()},recordsEmail.current);
        setEditDemand(undefined);
        await refreshInterests();
      }
    });
  }
  function remove(group:'waitlist'|'demands',id:string) {
    void run(async () => {
      await enrollmentPost(base+'/'+group+'/'+encodeURIComponent(id)+'/withdraw',{},recordsEmail.current);
      await refreshInterests();
    });
  }
  const publicQuery = '?lang='+language;
  const mineLink=promotionJourneyUrl('/enrollment/mine'+publicQuery,params);
  const joinText=t(['加入候补','Join waitlist','Masuk daftar tunggu']);
  const applyText=t(['申请这个班','Apply for this class','Daftar kelas ini']);
  function selectOrder(id?:string) {
    if(id!==orderId){
      orderRead.current?.abort();
      setConfirmedProofOrderId(undefined);
    }
    const next = new URLSearchParams(params);
    next.delete('view');
    next.delete('target');
    if (id) next.set('order', id);
    else {
      next.delete('order');
      setOrder(undefined);
      setAftercare(undefined);
      setAftercareFailedFor(undefined);
    }
    setError('');
    setParams(next, { replace:true, preventScrollReset:true,state:chatReturnState });
  }
  const errors: Record<string, Copy> = {
    enrollment_invitation_expired:['邀请已到期。请刷新查看可转班次。','This invitation has expired. Refresh to check available classes.','Undangan kedaluwarsa. Muat ulang untuk melihat kelas.'],
    enrollment_aftercare_conflict:['报名状态已变化，请刷新后再操作。','Your enrollment has changed. Refresh before trying again.','Pendaftaran berubah. Muat ulang sebelum melanjutkan.'],
    enrollment_class_full:['最后一个席位已被占用。','The last seat has been taken.','Kursi terakhir sudah diambil.'],
    enrollment_seat_available:['现在有空位，可以申请这个班。','A seat is available. You can apply now.','Ada kursi tersedia. Anda dapat mendaftar.'],
    enrollment_demand_conflict:['这条需求已更新或撤回，请刷新后查看。','This request has changed or been withdrawn. Refresh to review.','Permintaan berubah atau ditarik. Muat ulang.'],
    enrollment_demand_previous_unconfirmed:['上次提交还未确认。请先重试上次提交，你刚修改的内容会保留为草稿。','Your previous submission is unconfirmed. Retry it first. Your edits will stay in your draft.','Pengiriman sebelumnya belum dikonfirmasi. Coba kirim ulang terlebih dahulu. Perubahan tetap tersimpan sebagai draf.'],
    enrollment_interest_unconfirmed:['暂时无法确认提交结果。可在「我的报名」查看，或用相同信息重试。','We could not confirm the submission. Check My enrollments or retry with the same details.','Pengiriman belum dapat dikonfirmasi. Periksa Pendaftaran saya atau coba lagi dengan data yang sama.'],
    ...enrollmentCodeRequestErrors,
    enrollment_cancel_not_available:['当前报名无法自行取消。请刷新核对是否已提交凭证、已到账或已超时。','This enrollment can no longer be canceled here. Refresh to check whether a proof was submitted, payment was verified, or the deadline passed.','Pendaftaran ini tidak lagi bisa dibatalkan di sini. Muat ulang untuk memeriksa bukti, pembayaran, atau tenggat.'],
    enrollment_invalid_code:['验证码无效或已过期。','The code is invalid or expired.','Kode tidak berlaku atau kedaluwarsa.'],
    enrollment_email_verification_unconfirmed:['暂时无法确认邮箱验证结果。请重试验证，或重新获取验证码。','We could not confirm email verification. Try verifying again or request a new code.','Verifikasi email belum dapat dikonfirmasi. Coba verifikasi lagi atau minta kode baru.'],
    enrollment_email_signout_unconfirmed:['暂时无法确认是否已退出报名邮箱，请重试退出。','We could not confirm sign-out. Try signing out again.','Status keluar belum dapat dikonfirmasi. Coba keluar lagi.'],
    enrollment_verification_required:['请验证当前邮箱后继续。','Verify this email address to continue.','Verifikasi alamat email ini untuk melanjutkan.'],
    enrollment_order_not_found:['找不到这条报名。','This enrollment could not be found.','Pendaftaran ini tidak ditemukan.'],
    enrollment_order_read_failed:['暂时无法读取报名，请重试。','This enrollment could not be loaded. Please try again.','Pendaftaran belum dapat dimuat. Silakan coba lagi.'],
    enrollment_records_read_failed:['暂时无法读取报名记录。','Enrollment records could not be loaded.','Catatan pendaftaran belum dapat dimuat.'],
    enrollment_invalid_waitlist:['请检查姓名和带区号的电话号码。','Check the name and phone number with country code.','Periksa nama dan nomor telepon beserta kode negara.'],
    enrollment_already_has_seat:['这位学员已有本班席位。请前往「我的报名」查看。','This learner already has a seat. Check My enrollments.','Siswa ini sudah mendapat kursi. Lihat Pendaftaran saya.'],
    enrollment_invalid_application:['请检查学员姓名和带区号的电话号码。','Check the learner name and phone number with country code.','Periksa nama siswa dan nomor telepon beserta kode negara.'],
    enrollment_class_unavailable:['此班次已停止接受报名。','This class is no longer accepting applications.','Pendaftaran kelas ini sudah ditutup.'],
    enrollment_intake_paused:['新报名暂时暂停。已有订单仍可在「我的报名」查看。','New applications are paused. You can still access existing orders from My enrollments.','Pendaftaran baru dijeda. Pesanan yang sudah ada tetap dapat dibuka di Pendaftaran saya.'],
    enrollment_email_unavailable:['目前无法发送验证码，请稍后重试或联系销售。','We could not send your verification code. Try again later or contact our team.','Kode verifikasi belum dapat dikirim. Coba lagi nanti atau hubungi tim kami.'],
    enrollment_transfer_unavailable:['该班次目前无法转入，请返回可转班次刷新查看。','This class is no longer available for transfer. Go back and check the list again.','Kelas ini tidak lagi tersedia. Kembali dan periksa daftar kelas.'],
    enrollment_priority_unavailable:['当前报名无法开启优先安排，请刷新核对状态。','Priority arrangements are unavailable for this enrollment. Refresh to check its status.','Pengaturan prioritas tidak tersedia untuk pendaftaran ini. Muat ulang untuk memeriksa status.'],
    enrollment_invalid_proof:['凭证上传失败。请检查文件后重试。','Upload failed. Check the file and retry.','Unggahan gagal. Periksa file dan coba lagi.'],
    enrollment_operation_unconfirmed:['结果尚未确认。请查询上次提交。','The result is unconfirmed. Check your last submission.','Hasil belum terkonfirmasi. Periksa pengiriman terakhir Anda.'],
  };
  const message=enrollmentReadinessMessage(error.replace(/^enrollment_intake_/,''),language)??t(errors[error] || ['操作未完成，请核对后重试。','The action could not be completed. Please review and retry.','Tindakan belum selesai. Periksa dan coba lagi.']);
  function transfer(targetClassId:string,decision:'accept'|'decline',invitationId?:string) {
    if(!order) return;
    void run(async()=>{
      await enrollmentPost(base+'/orders/'+encodeURIComponent(order.id)+'/transfer',{classId:order.classId,targetClassId,decision,invitationId,requestId:createBrowserUuid()});
      await getOrder(order.id);
      if (decision==='accept') {
        const next = new URLSearchParams(params);
        next.delete('view');
        next.delete('target');
        setParams(next,{replace:true,preventScrollReset:true,state:chatReturnState});
      }
      window.scrollTo(0,0);
    });
  }
  function enablePriority() {
    if(!order) return;
    void run(async()=>{
      await enrollmentPost(base+'/orders/'+encodeURIComponent(order.id)+'/priority',{classId:order.classId});
      await getOrder(order.id);
    });
  }
  const paymentPath = (id: string) => {
    const next = new URLSearchParams(params);
    next.delete('apply');
    next.set('order', id);
    return '/enrollment/payment?' + next.toString();
  };
  const canUpload = order && order.status!=='paid_cancelled' && allowsEnrollmentProof(order.status,order.closureReason) && !order.restored;
  const cancelable=order?.status==='awaiting_payment'&&order.received===0;
  const openCancellation=()=>{if(cancelable){setError('');cancelDialog.current?.showModal();}};
  const cancelEnrollment=()=>order&&void run(async()=>{
    await enrollmentPost(base+'/orders/'+encodeURIComponent(order.id)+'/cancel',{});
    cancelDialog.current?.close();
    await getOrder(order.id);
  });
  const status = order && t(order.restored ? ['已恢复原班报名','Enrollment restored','Pendaftaran dipulihkan'] : enrollmentStatuses[order.status]);
  const emailLabel=t(['电子邮箱','Email address','Alamat email']);
  const sendLabel=t(sendingCode?['正在发送…','Sending…','Mengirim…']:
    challenge?['重发验证码','Resend code','Kirim ulang kode']:['发送验证码','Send code','Kirim kode']);
  const verifiedHint=t(['验证码已发出，请查收邮件。','Code sent. Check your inbox.','Kode dikirim. Periksa kotak masuk Anda.']);
  const learnerLabel=t(['学员姓名','Learner name','Nama siswa']);
  const phoneLabel=t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP']);
  const awaitingCode = !emailConfirmed && (!challenge || code.length!==6);
  const codeField = emailConfirmed ? <p role="status">{t(['邮箱已验证。','Email verified.','Email sudah diverifikasi.'])}</p> :
    <div className="enrollment-code-field">
      <label className="enrollment-field" htmlFor="enrollment-verification-code">{t(['邮箱验证码','Email verification code','Kode verifikasi email'])}</label>
      <div className="enrollment-code-input">
        <input id="enrollment-verification-code" type="text" autoComplete="one-time-code" inputMode="numeric"
          pattern="[0-9]{6}" required value={code} onChange={event=>setCode(enrollmentCodeInput(event.currentTarget.value,code))}
          placeholder={t(['输入 6 位验证码','Enter 6-digit code','Masukkan kode 6 digit'])}/>
        <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>{
          if (!enteredEmailField.current || enteredEmailField.current.reportValidity()) void sendCode();
        }}>{sendLabel}</button>
      </div>
      {sendingCode && <p className="enrollment-code-feedback" role="status">{t(['正在发送验证码…','Sending your verification code…','Mengirim kode verifikasi…'])}</p>}
      {!sendingCode && challenge && !error && <p className="enrollment-code-feedback" role="status">{verifiedHint}</p>}
      {applicationClass && verificationStep && !sendingCode && !challenge && !error &&
        <p className="enrollment-code-feedback" role="status">{t([
          '尚未确认验证码已发出。可点击「发送验证码」继续。',
          'Sending has not been confirmed. Select Send code to continue.',
          'Pengiriman belum terkonfirmasi. Pilih Kirim kode untuk melanjutkan.',
        ])}</p>}
    </div>;
  const emailField = <label className="enrollment-field">{emailLabel}
    <input ref={enteredEmailField} type="email" required autoComplete="email" disabled={busy} readOnly={pendingApplication} value={email} onChange={event=>editEmail(event.target.value)}
      placeholder={t(['输入你的电子邮箱','Enter your email address','Masukkan alamat email'])}/>
  </label>;
  const learnerFields = <div className="enrollment-learner">
    {canSummarize&&<div className="enrollment-identity enrollment-learner-identity">
      <div className="enrollment-identity-info">
        <span className="enrollment-identity-label">{t(['学员资料','Learner details','Data siswa'])}</span>
        <strong>{name.trim()}</strong>
      </div>
      <button type="button" className="enrollment-record-link" aria-expanded={editingContact} disabled={applicationDraftLocked}
        onClick={()=>setEditingContact(!editingContact)}>
        {t(editingContact?['收起','Collapse','Tutup']:['修改','Edit','Ubah'])}
      </button>
      {!editingContact&&<div className="enrollment-learner-meta">
        <div className="enrollment-identity-detail">
          <span>{maskedEmail(currentEmail)}</span>
          <span className="enrollment-identity-verified">{t(['已验证','Verified','Terverifikasi'])}</span>
        </div>
        <div className="enrollment-identity-detail" dir="ltr">WhatsApp •••• {phone.replace(/\D/g,'').slice(-4)}</div>
      </div>}
    </div>}
    {personOption}
    {(!canSummarize||editingContact)&&<>
      <label className="enrollment-field">{learnerLabel}
        <input required maxLength={120} autoComplete="name" readOnly={applicationDraftLocked} value={name} onChange={event=>setName(event.target.value)}
          placeholder={t(['输入学员姓名','Enter learner name','Masukkan nama siswa'])}/>
      </label>
      {forAnother&&sessionAddress&&sessionAddress!==currentEmail&&<button type="button" className="enrollment-record-link"
        disabled={applicationDraftLocked} onClick={()=>editEmail(sessionAddress)}>
        {t(['使用我的已验证邮箱收通知','Use my verified email for updates','Gunakan email terverifikasi saya untuk pemberitahuan'])}
      </button>}
      {emailField}
      <div className="enrollment-field">
        <label htmlFor={phoneField.errorId+'-input'}>{phoneLabel}</label>
        {ContactPhoneInput&&<ContactPhoneInput {...phoneField.inputProps} id={phoneField.errorId+'-input'} language={language} required
          readOnly={applicationDraftLocked} value={phone} onValueChange={setPhone}/>}{phoneError}
      </div>
      {(!applicationClass||emailConfirmed)&&codeField}
    </>}
  </div>;
  if (applicationClass && error==='enrollment_class_full') {
    const next = new URLSearchParams(params);
    next.set('apply','1');
    next.set('join','1');
    next.delete('waitlist');
    return <div className="enrollment-last-seat">
      {returnAction}
      <EnrollmentJourneyLink className="enrollment-back" to={applicationClass.listPath}><ArrowLeft size={15} aria-hidden="true"/>
        {t(['返回课程报名','Back to classes','Kembali ke daftar kelas'])}</EnrollmentJourneyLink>
      <h1>{t(['本班已满','This class is full','Kelas ini penuh'])}</h1>
      <div className="enrollment-result-body">
        <article className="enrollment-record"><h2>{applicationClass.title}</h2><p>{applicationClass.schedule}</p></article>
        <p className="enrollment-result-state" role="alert">{t(['你提交申请时，最后一个席位已被其他学员取得。','The last seat was taken while you were applying.','Kursi terakhir diambil saat Anda mengajukan pendaftaran.'])}</p>
        {stillWaiting&&<p className="enrollment-journey-note">{t(['你的候补仍有效，无需重新加入。','Your waitlist entry is still active. You don’t need to join again.','Posisi daftar tunggu Anda masih aktif. Anda tidak perlu mendaftar ulang.'])}</p>}
      </div>
      <div className="enrollment-journey-actions">
        <EnrollmentJourneyLink className="enrollment-quiet" to={applicationClass.listPath}>{t(['查看其他班次','Browse other classes','Lihat kelas lain'])}</EnrollmentJourneyLink>
        {applicationClass.fromWaitlist && stillWaiting!==false ? <EnrollmentJourneyLink className="enrollment-primary" to={applicationClass.detailsPath}>{t(['返回候补详情','Back to waitlist entry','Kembali ke detail daftar tunggu'])}</EnrollmentJourneyLink>
          : <EnrollmentJourneyLink className="enrollment-primary" to={'/enrollment/'+encodeURIComponent(classId ?? '')+'?'+next.toString()}
            onClick={event=>{
              if(!classId||!isPlainLinkClick(event)||!formActive())return;
              const waitlistDraftKey='waitlist:'+classId;
              if(readEnrollmentDraft<ContactDraft>(owner,waitlistDraftKey)===undefined)
                writeEnrollmentDraft<ContactDraft>(owner,waitlistDraftKey,{email,name,phone,forAnother});
            }}>{joinText}</EnrollmentJourneyLink>}
      </div>
    </div>;
  }
  if (applicationClass && !hasNoSeat) return <div>
    {returnAction}
    {verificationStep
      ? <button type="button" className="enrollment-back" onClick={()=>{setVerificationStep(false);persistEmailStep(false,challenge);setError('');}} disabled={busy}>
        <ArrowLeft size={15} aria-hidden="true"/>{t(['返回申请表','Back to application','Kembali ke formulir'])}
      </button>
      : <EnrollmentJourneyLink className="enrollment-back" to={applicationClass.detailsPath}>
        <ArrowLeft size={15} aria-hidden="true"/>{t(applicationClass.fromWaitlist
          ? ['返回候补详情','Back to waitlist entry','Kembali ke detail daftar tunggu']
          : ['返回班次详情','Back to class details','Kembali ke detail kelas'])}
      </EnrollmentJourneyLink>}
    <h1 ref={applicationHeading} tabIndex={-1}>{verificationStep ? t(['验证邮箱','Verify your email','Verifikasi email']) : applyText}</h1>
    {error && <p className="enrollment-form-error" role="alert">{message}</p>}
    {pendingApplication&&emailConfirmed&&<button type="button" className="enrollment-quiet" disabled={busy||checkingApplicationReceipt}
      aria-busy={checkingApplicationReceipt} onClick={()=>void run(checkApplication)}>
      {t(checkingApplicationReceipt?['正在查询上次申请…','Checking last application…','Memeriksa pendaftaran terakhir…']:
        ['查询上次申请','Check last application','Periksa pendaftaran terakhir'])}
    </button>}
    {verificationStep ? <form className="enrollment-journey-form" onSubmit={event=>{event.preventDefault();if(!checkingApplicationReceipt)void verifyApplication();}}>
      <p className="enrollment-journey-note">{t([
        '验证后，你可以用这个邮箱查看报名。转班邀请、班次取消等重要事项也会通过邮件通知你。',
        'Use this email to check your enrollment. We’ll also email you about important updates, such as class transfer invitations and class cancellations.',
        'Gunakan email ini untuk melihat pendaftaran. Kami juga akan mengirimkan pemberitahuan penting melalui email, seperti undangan pindah kelas dan pembatalan kelas.',
      ])}</p>
      <label className="enrollment-field">{emailLabel}<input type="email" value={email} readOnly autoComplete="email"/></label>
      {!pendingApplication&&<button type="button" className="enrollment-record-link justify-self-start" disabled={busy} onClick={()=>{
        setVerificationStep(false);
        persistEmailStep(false,challenge);
        setError('');
        setEditingContact(true);
        requestAnimationFrame(()=>enteredEmailField.current?.focus({preventScroll:true}));
      }}>{t(['更换邮箱','Change email','Ganti email'])}</button>}
      {codeField}
      <div className="enrollment-journey-actions">
        <p>{t(['取得席位后进入「转账与凭证」。','Once a seat is reserved, you’ll go to Transfer & proof.','Setelah mendapat kursi, Anda akan masuk ke Transfer dan bukti.'])}</p>
        <button className="enrollment-primary" type="submit" disabled={busy || checkingApplicationReceipt || awaitingCode}>
          {t(emailConfirmed?['继续提交申请','Continue application','Lanjutkan pendaftaran']:['验证并继续','Verify and continue','Verifikasi dan lanjutkan'])}
        </button>
      </div>
    </form> : <form className="enrollment-journey-form" onSubmit={event=>{
      event.preventDefault();
      if(busy||checkingApplicationReceipt||!phoneField.check())return;
      if(emailConfirmed){void verifyApplication();return;}
      void beginApplicationVerification();
    }}>
      <div className="enrollment-payment-summary">
        <h2>{applicationClass.title}</h2>
        <p>{applicationClass.schedule}</p>
      </div>
      <p className="enrollment-tuition">{t(['本班学费','Class tuition','Biaya kelas'])} <strong>{formatCurrency(applicationClass.price,language)}</strong></p>
      {learnerFields}
      <label className="enrollment-priority">
        <input type="checkbox" checked={priority} disabled={applicationDraftLocked} onChange={event=>setPriority(event.target.checked)}/>
        <span><strong>{t(['优先安排 · 可取消','Priority arrangements · Optional','Pengaturan prioritas · Opsional'])}</strong>
          <span>{t([
            '原班不开课且你已付清学费时，我们会优先寻找最近开课的同级别、同班型班次。有合适席位时先为你保留，再请你确认。',
            'If your original class will not open and you have paid in full, we’ll look for the next class at the same level and in the same format. We’ll hold an available seat and ask you to confirm.',
            'Jika kelas awal tidak dibuka dan biaya sudah lunas, kami akan mencari kelas berikutnya dengan level dan jenis yang sama. Jika ada kursi, kami akan menahannya sambil menunggu konfirmasi Anda.',
          ])}</span>
        </span>
      </label>
      <div className="enrollment-journey-actions">
        <p>{t(['财务核实足额到账后，报名才算成功。','Enrollment is confirmed after Finance verifies full payment.','Pendaftaran berhasil setelah pembayaran penuh diverifikasi.'])}</p>
        <button className="enrollment-primary" type="submit" disabled={busy||checkingApplicationReceipt}>{t(emailConfirmed
          ?['提交申请','Submit application','Ajukan pendaftaran']
          :['验证邮箱并继续','Verify email and continue','Verifikasi email dan lanjutkan'])}</button>
      </div>
    </form>}
  </div>;
  const dayFormat = enrollmentDateFormatter(language,'day');
  function displayDate(value: string) {
    const date = new Date(value.slice(0,10) + 'T00:00:00+07:00');
    return Number.isFinite(date.valueOf()) ? dayFormat.format(date) : '';
  }
  function classTitle(level: string, firstLesson: string, id: string) {
    const course = waitlistClass?.id===id ? waitlistClass : recordClasses.get(id);
    if(course)return enrollmentClassTitle(course,language);
    return [level,displayDate(firstLesson)].filter(Boolean).join(' · ');
  }
  if (waitlistClass || demandOnly) {
    const completed = joined || savedDemand;
    const waitlist = !!waitlistClass;
    const pendingDemand=demandOnly?readPendingDemand(owner,currentEmail):undefined;
    return <>
      {error && <p className="enrollment-form-error" role="alert">{message}</p>}
      {!completed&&emailConfirmed&&typeof pendingDemand==='object'&&<button type="button" className="enrollment-quiet" disabled={busy}
        onClick={()=>void run(()=>submitDemand(pendingDemand,true,true))}>
        {t(['重试上次提交','Retry previous submission','Kirim ulang pengiriman sebelumnya'])}
      </button>}
      {(error==='enrollment_interest_unconfirmed'||error==='enrollment_demand_previous_unconfirmed'||error==='enrollment_demand_conflict')&&
        <EnrollmentJourneyLink className="enrollment-quiet" to={mineLink+(demandOnly?'&tab=demands':'')}>{t(['我的报名','My enrollments','Pendaftaran saya'])}</EnrollmentJourneyLink>}
      {completed ? <div className="enrollment-intake-complete">
        <p className="enrollment-result-state" data-paid="true" role="status">{t(waitlist
          ? ['候补已登记。','You joined the waitlist.','Anda masuk daftar tunggu.']
          : ['选课需求已保存。','Course preferences saved.','Preferensi kursus disimpan.'])}</p>
        <EnrollmentJourneyLink className="enrollment-primary" to={mineLink+'&tab='+(waitlist?'waitlist':'demands')}>{t(waitlist
          ? ['查看我的候补','View my waitlist','Lihat daftar tunggu saya']
          : ['查看我的需求','See my preferences','Lihat preferensi saya'])}</EnrollmentJourneyLink>
      </div> : waitlistClass ? <form className="enrollment-journey-form" onSubmit={event=>{event.preventDefault();void join();}}>
        <article className="enrollment-record">
          <h2>{classTitle(waitlistClass.level,waitlistClass.firstLesson,waitlistClass.id)}</h2>
          <p>{enrollmentScheduleLabel(waitlistClass,language)}</p>
          <p><span className="enrollment-status" data-state="full">{t(waitlistClass.opened
            ? ['已确认开班 · 满班','Class confirmed · Full','Kelas dikonfirmasi · Penuh']
            : ['满班','Full','Penuh'])}</span></p>
        </article>
        {learnerFields}
        <div className="enrollment-journey-actions">
          {hasNoSeat ? <>
            <p>{t(['候补无需付款。有空位时会通知你自行申请。','There is no payment to join the waitlist. We’ll let you know when a seat opens so you can apply.','Daftar tunggu tidak memerlukan pembayaran. Kami akan memberi kabar saat ada kursi agar Anda bisa mendaftar.'])}</p>
            <button type="submit" className="enrollment-primary" disabled={busy||awaitingCode}>
              {t(emailConfirmed?['加入候补','Join waitlist','Masuk daftar tunggu']:['验证并加入候补','Verify and join waitlist','Verifikasi dan masuk daftar tunggu'])}
            </button>
          </> : <EnrollmentJourneyLink className="enrollment-primary" to={'/enrollment?'+sourceQuery()}>
            {t(['返回课程报名','Back to classes','Kembali ke daftar kelas'])}
          </EnrollmentJourneyLink>}
        </div>
      </form> : EnrollmentDemandForm&&<EnrollmentDemandForm language={language} prefill={enrollmentDemandPrefill(params,language)} busy={busy} onSave={savePreferences}
        awaitingCode={awaitingCode} emailVerified={emailConfirmed}
        contact={{name,phone,fields:learnerFields,checkPhone:phoneField.check}} draft={{owner,key:formKey+':criteria'}}/>}
    </>;
  }
  function paymentDeadline(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf())) return '';
    const time = enrollmentDateFormatter(language,'time').format(date);
    return t([dayFormat.format(date)+' '+time+' WIB 截止','Due '+dayFormat.format(date)+' at '+time+' WIB','Batas '+dayFormat.format(date)+' pukul '+time+' WIB']);
  }
  const orderIsActive = (row: OrderSummary) => row.restored || !['expired','ended','refunded'].includes(row.status);
  const showRecordList=verified&&!checkingRecords&&!loadingOrder&&!order&&!payment&&!record&&!classId;
  function transferInvitationPath(id:string,invitationId:string) {
    const query=new URLSearchParams(params);
    query.delete('proof');
    query.set('order',id);
    query.set('view','invitation');
    query.set('target',invitationId);
    return '/enrollment/mine?'+query.toString();
  }
  const orderCards = (showRecordList&&(tab==='all'||tab==='orders')?orders??[]:[]).map(row => {
    const course = recordClasses.get(row.classId);
    const schedule = enrollmentScheduleLabel(course,language);
    const status = row.restored ? t(['已恢复原班报名','Enrollment restored','Pendaftaran dipulihkan']) : t(row.closureReason==='learner_cancelled'?['已取消报名','Enrollment canceled','Pendaftaran dibatalkan']:enrollmentStatuses[row.status]);
    const active = orderIsActive(row);
    const payable = row.status==='awaiting_payment'&&!row.classCancelled;
    const action = t(payable ? ['查看转账与凭证','View transfer & proof','Lihat transfer dan bukti']
      : row.status==='expired'&&!row.restored ? ['查看原订单','View original order','Lihat pesanan asal']
      : ['查看报名','View enrollment','Lihat pendaftaran']);
    return {key:'order-'+row.id,active,updatedAt:row.updatedAt,needsAction:active&&!!(row.needsPayment||row.invitation),card:<article className="enrollment-record">
      <header><small>{t(['报名申请','Application','Pendaftaran'])}</small>
        <span className="enrollment-status" data-state={!active?'full':row.status==='paid'||row.restored?'confirmed':'pending'}>{status}</span></header>
      <h2>{classTitle(row.level,row.firstLesson,row.classId)}</h2>
      {row.invitation&&<p>{t(['待答复转班邀请','Transfer invitation awaiting reply','Undangan pindah kelas menunggu jawaban'])} · {paymentDeadline(row.invitation.deadline)}</p>}
      {payable && <p>{paymentDeadline(row.deadline)}</p>}
      {row.classCancelled&&row.status==='awaiting_payment'&&<p>{t(['原班已停止收款','Payment for the original class is closed','Pembayaran untuk kelas asal ditutup'])}</p>}
      {row.status==='expired'&&!row.restored && <p>{t(['付款凭证未按时提交','Proof was not submitted by the deadline','Bukti tidak dikirim sebelum batas waktu'])}</p>}
      {row.status==='paid' && schedule && <p>{[course?.opened&&t(['已确认开班','Class confirmed','Kelas dikonfirmasi']),schedule].filter(Boolean).join(' · ')}</p>}
      {row.learnerName&&<p>{row.learnerName}</p>}
      {row.invitation ? <EnrollmentJourneyLink className="enrollment-record-link" to={transferInvitationPath(row.id,row.invitation.id)}>
        {t(['查看转班邀请','View transfer invitation','Lihat undangan pindah kelas'])}<ChevronRight size={15} aria-hidden="true"/></EnrollmentJourneyLink>
        : payable ? <EnrollmentJourneyLink className="enrollment-record-link" to={paymentPath(row.id)}>{action}<ChevronRight size={15} aria-hidden="true"/></EnrollmentJourneyLink>
        : <button type="button" className="enrollment-record-link" onClick={()=>selectOrder(row.id)}>{action}<ChevronRight size={15} aria-hidden="true"/></button>}
    </article>};
  });
  const mineParams = new URLSearchParams(params);
  mineParams.delete('order');
  mineParams.delete('proof');
  mineParams.delete('apply');
  mineParams.delete('view');
  mineParams.delete('target');
  const listPath = '/enrollment/mine?' + mineParams.toString();
  function recordPath(kind: InterestRecord['kind'], id: string) {
    return '/enrollment/mine/' + kind + '/' + encodeURIComponent(id) + '?' + mineParams.toString();
  }
  const catalogParams = new URLSearchParams(mineParams);
  catalogParams.delete('tab');
  catalogParams.delete('apply');
  const catalogPath = '/enrollment?' + catalogParams.toString();
  function classFromRecord(classId: string, key: 'waitlist' | 'fromDemand', recordId: string) {
    const query = new URLSearchParams(catalogParams);
    query.set(key,recordId);
    if (key==='waitlist') query.set('apply','1');
    return '/enrollment/'+encodeURIComponent(classId)+'?'+query.toString();
  }
  function preloadClassFromRecord(event:MouseEvent<HTMLAnchorElement>) {
    if(isPlainLinkClick(event))preloadEnrollmentNavigation(new URL(event.currentTarget.href));
  }
  const waitlistDetail = record?.kind === 'waitlist' ? interests?.waitlist.find(row=>row.id===record.id) : undefined;
  const demandDetail = record?.kind === 'demands' ? interests?.demands.find(row=>row.id===record.id) : undefined;
  const demandTitle = (row: DemandItem) => [row.criteria.level,row.criteria.period,row.criteria.format]
    .map(value=>interestOption(language,value)).join(' · ');
  const demandStatus = (row: DemandItem) => row.state==='withdrawn' ? t(['需求已撤回','Request withdrawn','Permintaan ditarik'])
    : row.matches.length ? t(['有符合你需求的班次','Matching classes available','Ada kelas yang cocok'])
    : t(['已登记 · 等待匹配','Saved · Waiting for a match','Tersimpan · Menunggu kecocokan']);
  function renderWaitlistDetail(row: NonNullable<typeof waitlistDetail>) {
    const course = recordClasses.get(row.classId);
    const schedule = enrollmentScheduleLabel(course,language);
    const waiting = row.state==='waiting';
    const available = waiting && row.available;
    const related = new URLSearchParams(mineParams);
    if (row.orderId) related.set('order',row.orderId);
    return <div className="enrollment-interest-detail">
      <article className="enrollment-record">
        <h2>{classTitle(row.level,row.firstLesson,row.classId)}</h2>
        <p><span className="enrollment-status" data-state={available?'confirmed':waiting?'pending':'full'}>
          {t(waitlistStates[row.state])}{waiting&&!available && ' · '+t(['暂无空位','No seats available','Belum ada kursi'])}
        </span></p>
        {schedule && <p>{schedule}</p>}
        {row.learnerName&&<p>{row.learnerName}</p>}
      </article>
      {waiting && <p className="enrollment-journey-note">{t(available
        ? ['本班有空位，可申请。席位以提交时为准。','A seat is available. Availability is checked when you apply.','Ada kursi. Ketersediaan diperiksa saat Anda mendaftar.']
        : ['有空位时会通知你。也可以从公开班次详情查看最新情况。','We’ll notify you if a seat opens. You can also check the class page for updates.','Kami akan memberi kabar jika ada kursi. Anda juga dapat memeriksa halaman kelas.'])}</p>}
      {row.state==='withdrawn' && <p role="status" className="enrollment-journey-note">{t(['你已取消候补，之后不会收到本次候补的空位通知。','You cancelled this waitlist entry. You won’t receive availability updates for it.','Anda membatalkan daftar tunggu ini dan tidak akan menerima kabar ketersediaan untuknya.'])}</p>}
      <div className="enrollment-interest-actions">
        {waiting && <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>remove('waitlist',row.id)}>{t(['取消候补','Cancel waitlist entry','Batalkan daftar tunggu'])}</button>}
        {available ? <EnrollmentJourneyLink className="enrollment-primary" to={classFromRecord(row.classId,'waitlist',row.id)}
          onClick={preloadClassFromRecord}>{applyText}</EnrollmentJourneyLink>
          : row.state==='converted'&&row.orderId ? <EnrollmentJourneyLink className="enrollment-primary" to={'/enrollment/mine?'+related.toString()}>{t(['查看对应报名','View related application','Lihat pendaftaran terkait'])}</EnrollmentJourneyLink>
          : <EnrollmentJourneyLink className="enrollment-primary" to={catalogPath}>{t(['查看其他班次','Browse other classes','Lihat kelas lain'])}</EnrollmentJourneyLink>}
      </div>
    </div>;
  }
  function renderDemandDetail(row: DemandItem) {
    const active = row.state==='active';
    return <div className="enrollment-interest-detail">
      <p className="enrollment-journey-note" role="status">{demandStatus(row)}</p>
      {row.state!=='withdrawn' ? <>
        <article className="enrollment-record">
          <small>{t(['想上的课','Your preferences','Preferensi Anda'])}</small>
          <h2>{demandTitle(row)}</h2>
          {row.criteria.notes&&<p>{row.criteria.notes}</p>}
        </article>
        {row.matches.map(match=>{
          const schedule = enrollmentScheduleLabel(recordClasses.get(match.id),language);
          return <article className="enrollment-record" key={match.id}>
          <small>{t(['匹配班次','Matching class','Kelas yang cocok'])}</small>
          <h2>{classTitle(match.level,match.firstLesson,match.id)}</h2>
          {schedule && <p>{schedule}</p>}
          {row.matches.length>1&&<EnrollmentJourneyLink className="enrollment-record-link" to={classFromRecord(match.id,'fromDemand',row.id)}
            onClick={preloadClassFromRecord}>
            {t(['查看匹配班次','View matching class','Lihat kelas yang cocok'])}<ChevronRight size={15} aria-hidden="true"/>
          </EnrollmentJourneyLink>}
          </article>;
        })}
        {!!row.matches.length&&<p className="enrollment-journey-note">{t(['申请时以实际空位为准。','Availability is checked when you apply.','Ketersediaan diperiksa saat Anda mendaftar.'])}</p>}
        {active&&<div className="enrollment-interest-actions">
          <button type="button" className={row.matches.length===1?'enrollment-quiet':'enrollment-primary enrollment-demand-edit'} disabled={busy||editDemand?.id===row.id} onClick={()=>setEditDemand(row)}>{t(['修改需求','Edit preferences','Ubah preferensi'])}</button>
          <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>remove('demands',row.id)}>{t(['撤回需求','Withdraw request','Tarik permintaan'])}</button>
          {row.matches.length===1&&<EnrollmentJourneyLink className="enrollment-primary" to={classFromRecord(row.matches[0].id,'fromDemand',row.id)}
            onClick={preloadClassFromRecord}>
            {t(['查看匹配班次','View matching class','Lihat kelas yang cocok'])}</EnrollmentJourneyLink>}
        </div>}
        {EnrollmentDemandForm&&editDemand?.id===row.id&&<div className="enrollment-record">
          <EnrollmentDemandForm key={row.id+':'+row.revision} language={language} initial={row} busy={busy} onSave={savePreferences}/>
          <button type="button" className="enrollment-record-link" disabled={busy} onClick={()=>setEditDemand(undefined)}>{t(['取消修改','Cancel editing','Batalkan perubahan'])}</button>
        </div>}
      </> : <>
        <p>{t(['这条需求停止匹配，之后不会收到它的新班通知。','This request is no longer matched and won’t send updates about new classes.','Permintaan ini tidak lagi dicocokkan dan tidak akan mengirim kabar kelas baru.'])}</p>
        <div className="enrollment-interest-actions"><EnrollmentJourneyLink className="enrollment-primary" to={listPath}>{t(['返回我的报名','Back to my enrollments','Kembali ke pendaftaran saya'])}</EnrollmentJourneyLink></div>
      </>}
    </div>;
  }
  const waitlistCards = (showRecordList&&(tab==='all'||tab==='waitlist')?interests?.waitlist??[]:[]).map(row => ({
    key:'waitlist-'+row.id, active:row.state==='waiting',updatedAt:row.updatedAt,needsAction:row.state==='waiting'&&row.available, card:<article className="enrollment-record">
      <header><small>{t(['候补','Waitlist','Daftar tunggu'])}</small>
        <span className="enrollment-status" data-state={row.state==='waiting'?'pending':'full'}>{t(waitlistStates[row.state])}</span></header>
      <h2>{classTitle(row.level,row.firstLesson,row.classId)}</h2>
      {row.state==='waiting' && <p>{row.available?t(['有空位可申请','Seats available','Kursi tersedia']):t(['暂无空位','No seats available','Belum ada kursi'])}</p>}
      {row.learnerName&&<p>{row.learnerName}</p>}
      <EnrollmentJourneyLink className="enrollment-record-link" to={recordPath('waitlist',row.id)}>
        {t(['查看候补','View waitlist entry','Lihat daftar tunggu'])}<ChevronRight size={15} aria-hidden="true"/>
      </EnrollmentJourneyLink>
    </article>,
  }));
  const demandCards = (showRecordList&&(tab==='all'||tab==='demands')?interests?.demands??[]:[]).map(row => ({
    key:'demand-'+row.id, active:row.state==='active',updatedAt:row.updatedAt,needsAction:row.state==='active'&&!!row.matches.length, card:<article className="enrollment-record">
      <header><small>{t(['选课需求','Course preferences','Preferensi kursus'])}</small>
        <span className="enrollment-status" data-state={row.state==='withdrawn'?'full':row.matches.length?'confirmed':'pending'}>{row.state==='withdrawn'
          ? t(['已撤回','Withdrawn','Ditarik']) : row.matches.length
            ? t(['有匹配班次','Matching classes available','Ada kelas yang cocok']) : t(['等待匹配','Waiting for a match','Menunggu kecocokan'])}</span></header>
      <h2>{[row.criteria.level,row.criteria.period,row.criteria.format].map(value=>interestOption(language,value)).join(' · ')}</h2>
      <EnrollmentJourneyLink className="enrollment-record-link" to={recordPath('demands',row.id)}>
        {t(['查看需求','View preferences','Lihat preferensi'])}<ChevronRight size={15} aria-hidden="true"/>
      </EnrollmentJourneyLink>
    </article>,
  }));
  const assistedCards=(showRecordList&&(tab==='all'||tab==='orders')?assistedApplications:[]).map(row=>({
    key:'assistance-'+row.id,active:row.active,updatedAt:row.createdAt,needsAction:row.active,
    card:<article className="enrollment-record">
      <header><small>{t(['销售协助报名','Advisor-assisted application','Pendaftaran dibantu tim UPER'])}</small>
        <span className="enrollment-status" data-state={row.active?'pending':'full'}>{row.active
          ?t(['待学员确认','Awaiting your confirmation','Menunggu konfirmasi kamu'])
          :t(['确认链接已失效','Confirmation link expired','Tautan konfirmasi kedaluwarsa'])}</span></header>
      <h2>{[row.quote.level,interestOption(language,row.quote.format),row.quote.firstLesson.replace('T',' ')+' WIB'].join(' · ')}</h2>
      <p>{row.name} · {formatCurrency(row.quote.price,language)}</p>
      {row.active&&<>
        <p>{t(['确认截止','Confirm by','Konfirmasi sebelum'])} · <time dateTime={row.expiresAt}>{enrollmentDateFormatter(language,'dateTime').format(new Date(row.expiresAt))} WIB</time></p>
        <EnrollmentJourneyLink className="enrollment-record-link" to={enrollmentAssistancePath(row.id,language)}>
          {t(['确认报名','Confirm enrollment','Konfirmasi pendaftaran'])}<ChevronRight size={15} aria-hidden="true"/>
        </EnrollmentJourneyLink>
      </>}
    </article>,
  }));
  const records = showRecordList ? sortEnrollmentRecords([...orderCards,...assistedCards,...waitlistCards,...demandCards]) : [];
  const activeRecords = records.filter(record=>record.active);
  const pastRecords = records.filter(record=>!record.active);
  const editingProof = payment && !!canUpload &&
    (params.get('proof')==='upload'||!!file||!!proofTransfer.amount||!!proofTransfer.reference);
  const classCancelled=aftercare?.originalClassState==='cancelled';
  const existingTransferOnly = !!(editingProof && order && (!order.bank||classCancelled) &&
    (order.status==='expired' || order.closureReason==='learner_cancelled' || aftercare?.originalClassState==='cancelled'));
  const originalOrderParams = new URLSearchParams(mineParams);
  if (order) originalOrderParams.set('order',order.id);
  const refundMode = aftercare?.refund.mode;
  const canConsultRefund = refundMode==='contact_support' || refundMode==='special_review';
  const aftercareView = params.get('view');
  const transferred = order && order.status==='paid' && aftercare?.transferHistory.some(row=>row.target_class_id===order.classId);
  const showAftercare = order && !editingProof && (
    ['paid_cancelled','ended','refunding','refunded'].includes(order.status) || (order.status==='expired' && !order.restored)
    || ((aftercareView==='refund'||aftercareView==='refund-contact') && canConsultRefund)
    || aftercare?.originalClassState==='cancelled' || transferred
  );
  const showOrderResult = order && (order.status==='paid' || (['proof_review','partial'].includes(order.status) && !editingProof));
  const aftercareUnavailable=!!order&&aftercareFailedFor===order.id;
  const waitingForAftercare=aftercareUnavailable&&(showAftercare||['transfers','transfer','refund','refund-contact','invitation'].includes(aftercareView??''));
  const resultCourse = order && recordClasses.get(order.classId);
  const refundParams = new URLSearchParams(mineParams);
  if (order) refundParams.set('order',order.id);
  refundParams.set('view','refund');
  const proofParams = new URLSearchParams(mineParams);
  if (order) proofParams.set('order',order.id);
  proofParams.set('proof','upload');
  const showEmailIdentity=!!recordsEmail.current&&(!!order||(!!mine&&verified));
  const recordsReadFailed=error==='enrollment_records_read_failed' && mine && !orderId;
  const interestsNotice=<div className="enrollment-journey-note" role="status">
    <p>{t(['暂时无法更新候补和选课需求。','Waitlist and course preferences could not be refreshed.','Daftar tunggu dan preferensi kursus belum dapat diperbarui.'])}</p>
    <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void run(refreshInterests)}>
      {t(['重试读取','Try again','Coba lagi'])}
    </button>
  </div>;
  function orderDetailsView(content:ReactNode,view:'aftercare'|'result') {
    const proofReceived = view==='result' && order?.status==='proof_review'
      ? t(['已收到付款凭证，等待核实到账。','Payment proof received. Awaiting payment verification.','Bukti pembayaran sudah diterima dan menunggu verifikasi.'])
      : undefined;
    return <EnrollmentModuleBoundary key={`${order?.id}:${view}`}
      pending={<div role="status">
        {proofReceived&&<p>{proofReceived}</p>}
        <p>{t(['正在读取报名详情…','Loading enrollment details…','Memuat detail pendaftaran…'])}</p>
      </div>}
      failure={<div className="enrollment-form-error" role="alert">
        {proofReceived&&<p>{proofReceived}</p>}
        <p>{t(['暂时无法打开报名详情。','Enrollment details could not be opened.','Detail pendaftaran belum dapat dibuka.'])}</p>
        <button type="button" className="enrollment-quiet" onClick={() => window.location.reload()}>
          {t(['刷新页面','Reload page','Muat ulang halaman'])}
        </button>
      </div>}>
      {content}
    </EnrollmentModuleBoundary>;
  }
  if (!open) return <button className="enrollment-action" type="button" onClick={()=>setOpen(true)}>{hasNoSeat?joinText:applyText}</button>;
  return <section className={showAftercare || showOrderResult ? "enrollment-application enrollment-order-result-shell" : mine && !order ? "enrollment-application enrollment-mine-content" : order && payment ? "enrollment-application enrollment-payment-content" : "enrollment-card enrollment-application"}>
    {error && !(payment && order && ['enrollment_invalid_proof','enrollment_upload_expired'].includes(error)) && <p role="alert">{message}{' '}
      {error==='enrollment_order_read_failed' && orderId && <button type="button" className="enrollment-quiet" disabled={busy}
        onClick={()=>void retryOrderRead(orderId)}>{t(['重试读取报名','Retry loading enrollment','Coba muat ulang pendaftaran'])}</button>}
      {recordsReadFailed && <button type="button" className="enrollment-quiet" disabled={busy}
        onClick={()=>void retryRecordsRead()}>{t(['重试读取记录','Retry loading records','Coba muat ulang catatan'])}</button>}
    </p>}
    {showEmailIdentity&&<div className="enrollment-identity enrollment-email-identity">
      <div className="enrollment-identity-info">
        <span className="enrollment-identity-label">{t(['报名邮箱','Enrollment email','Email pendaftaran'])}</span>
        <div className="enrollment-identity-detail">
          <strong>{maskedEmail(recordsEmail.current)}</strong>
          <span className="enrollment-identity-verified">{t(['已验证','Verified','Terverifikasi'])}</span>
        </div>
      </div>
      <div className="enrollment-identity-actions">
        <button className="enrollment-record-link" type="button" disabled={busy} onClick={changeRecordsEmail}>
          {t(['更换邮箱','Change email','Ganti email'])}
        </button>
        <button className="enrollment-record-link enrollment-identity-signout" type="button" disabled={busy} onClick={signOutEmail}>
          {t(['退出报名邮箱','Sign out','Keluar'])}
        </button>
      </div>
    </div>}
    <dialog key={orderId} className="enrollment-cancel-dialog" ref={cancelDialog} aria-labelledby="enrollment-cancel-title" onCancel={event=>{if(busy)event.preventDefault();}}>
      <h2 id="enrollment-cancel-title">{t(['取消这笔报名？','Cancel this enrollment?','Batalkan pendaftaran ini?'])}</h2>
      <p>{t(['取消后，付款入口会关闭，席位会释放。如果你已经转账，请先提交凭证。','Canceling closes the payment link and releases your seat. If you already transferred the money, submit the proof first.','Pembatalan menutup pembayaran dan melepas kursi. Jika sudah transfer, kirim bukti terlebih dahulu.'])}</p>
      {error&&<p role="alert">{message}</p>}
      <div className="enrollment-cancel-actions">
        <button type="button" className="enrollment-quiet" autoFocus disabled={busy} onClick={()=>cancelDialog.current?.close()}>{t(['保留报名','Keep enrollment','Pertahankan pendaftaran'])}</button>
        <button type="button" className="enrollment-primary" disabled={busy} onClick={cancelEnrollment}>{t(['确认取消','Confirm cancellation','Konfirmasi pembatalan'])}</button>
      </div>
    </dialog>
    {order&&!loadingOrder&&pendingProof&&<button type="button" className="enrollment-quiet" disabled={busy||checkingProofReceipt}
      aria-busy={checkingProofReceipt} onClick={()=>void run(checkProof)}>
      {t(checkingProofReceipt?['正在查询上次上传…','Checking last upload…','Memeriksa unggahan terakhir…']:
        ['查询上次上传','Check last upload','Periksa unggahan terakhir'])}
    </button>}
    {order&&proofReadFailure&&<p role="status">
      {t(['凭证已保存。暂时无法更新订单详情。','Proof saved. Order details could not be refreshed.','Bukti disimpan. Detail pesanan belum dapat dimuat ulang.'])}{' '}
      <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void run(()=>refreshSavedProof(order.id))}>
        {t(['刷新订单','Refresh order','Muat ulang pesanan'])}
      </button>
    </p>}
    {order&&order.id===orderId&&order.id===confirmedProofOrderId&&!proofReadFailure&&<p className="enrollment-journey-note" role="status">
      {t(['已收到补交的付款凭证。','Additional payment proof received.','Bukti pembayaran tambahan sudah diterima.'])}
    </p>}
    {checkingRecords || loadingOrder ? <>
      {order && <div className="enrollment-result-body">
        <p className="enrollment-result-state">{status}</p>
        <p>{t(['报名编号','Order number','Nomor pendaftaran'])} {order.id}</p>
      </div>}
      <p role="status">{order ? t(['正在读取报名详情…','Loading enrollment details…','Memuat detail pendaftaran…'])
        : t(['正在读取报名…','Loading enrollment…','Memuat pendaftaran…'])}</p>
    </> : order ? <>
      {aftercareUnavailable&&<p role="status">
        {t(['暂时无法读取售后详情。','Aftercare details are temporarily unavailable.','Detail layanan lanjutan belum dapat dimuat.'])}{' '}
        <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void run(()=>retryAftercare(order.id))}>
          {t(['重试读取售后详情','Retry loading aftercare','Coba muat ulang detail layanan'])}
        </button>
      </p>}
      {waitingForAftercare ? <p>{status}</p> : showAftercare ? orderDetailsView(<EnrollmentOrderAftercare order={order} details={aftercare} catalog={recordClasses} search={params}
        language={language} minePath={listPath} busy={busy} proofPath={canUpload ? '/enrollment/payment?'+proofParams.toString() : undefined}
        onCancel={cancelable?openCancellation:undefined} onTransfer={transfer} onEnablePriority={enablePriority} onRefresh={()=>void run(()=>getOrder(order.id))}/>, 'aftercare') : showOrderResult ? orderDetailsView(<EnrollmentOrderResult order={order} course={resultCourse} classInfo={aftercare?.currentClass}
        classState={aftercare?.originalClassState} language={language} backPath={listPath} busy={busy}
        refundPath={canConsultRefund ? '/enrollment/mine?'+refundParams.toString() : undefined}
        balancePath={order.status==='partial' ? '/enrollment/payment?'+proofParams.toString() : undefined}
        uploadPath={canUpload ? '/enrollment/payment?'+proofParams.toString() : undefined}
        onRefresh={()=>void run(()=>getOrder(order.id))}/>, 'result') : payment ? <div className={existingTransferOnly ? 'enrollment-order-result enrollment-order-result-shell' : 'contents'}>
        {existingTransferOnly && <>
          <div>
            <EnrollmentJourneyLink className="enrollment-back" to={'/enrollment/mine?'+originalOrderParams.toString()}><ArrowLeft size={15} aria-hidden="true"/>
              {t(['返回原订单详情','Back to original order','Kembali ke detail pesanan asal'])}
            </EnrollmentJourneyLink>
            <h1>{t(['提交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan'])}</h1>
          </div>
        </>}
        {paymentRefresh&&<p role="status" className="enrollment-journey-note">
          {paymentRefresh==='checking'?t(['正在核对付款状态…','Checking payment status…','Memeriksa status pembayaran…']):
            t(['暂时无法确认付款状态。已填写的凭证资料已保留。','Payment status could not be checked. Your proof details are kept.','Status pembayaran belum dapat diperiksa. Isian bukti tetap tersimpan.'])}
          {paymentRefresh==='failed'&&<button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>void refreshPaymentOrder(order.id)}>
            {t(['重试读取','Try again','Coba lagi'])}
          </button>}
        </p>}
        <EnrollmentPayment order={classCancelled||paymentRefresh?{...order,bank:undefined}:order} course={resultCourse} classInfo={aftercare?.currentClass} language={language}
          status={status ?? ''} onCancel={cancelable?openCancellation:undefined} canUpload={!!canUpload} file={file} busy={busy||checkingProofReceipt} setFile={setFile}
          proofTransfer={proofTransfer} onProofTransferChange={updateProofTransfer}
          upload={transfer=>void upload(transfer)} existingTransferOnly={existingTransferOnly}
          submittingProof={submittingProof} proofUploadFailed={['enrollment_invalid_proof','enrollment_upload_expired'].includes(error)}/>
      </div> : <>
      {!classId && <button type="button" onClick={()=>selectOrder()}>
        {t(['返回报名列表','Back to enrollments','Kembali ke daftar pendaftaran'])}
      </button>}
      <h2>{status}</h2>
      {order.learnerName&&<p>{t(['学员姓名','Learner name','Nama siswa'])} · {order.learnerName}</p>}
      <p>{t(['报名编号','Order number','Nomor pendaftaran'])} {order.id}</p>
      <p>{t(['应付','Amount due','Tagihan'])} {formatCurrency(order.price,language)} · {t(['实际到账','Verified receipts','Dana terverifikasi'])} {formatCurrency(order.received,language)}</p>
      {order.status==='awaiting_payment' && <p>{t(['付款截止','Payment deadline','Batas pembayaran'])} {enrollmentDateFormatter(language,'dateTime').format(new Date(order.deadline))} WIB</p>}
      {cancelable&&<button type="button" className="enrollment-quiet" onClick={openCancellation}>{t(['取消报名','Cancel enrollment','Batalkan pendaftaran'])}</button>}
      {canUpload && <EnrollmentJourneyLink className="enrollment-action" to={paymentPath(order.id)}>
        {t(['转账与凭证','Transfer & proof','Transfer dan bukti'])}
      </EnrollmentJourneyLink>}
      </>}
      {!showAftercare && !showOrderResult && canConsultRefund && <EnrollmentJourneyLink className="enrollment-quiet" to={'/enrollment/mine?'+refundParams.toString()}>
        {t(['退款咨询','Refund assistance','Bantuan pengembalian dana'])}
      </EnrollmentJourneyLink>}
      {!showAftercare && !showOrderResult && (!payment || !order.bank) && <button type="button" onClick={()=>void run(()=>getOrder(order.id))}>{t(['刷新状态','Refresh status','Muat ulang status'])}</button>}
    </> : (error==='enrollment_order_read_failed' && orderId || recordsReadFailed) && !verified ? null : !verified && (mine||payment) ? <form className="enrollment-journey-form enrollment-lookup"
      onSubmit={event=>{event.preventDefault();if (!awaitingCode) void verify();}}>
      <p className="enrollment-journey-note">{t(payment?[
        '使用这笔订单的报名邮箱查看付款信息或补交凭证。',
        'Use the email on this order to view payment details or submit proof.',
        'Gunakan email pada pesanan ini untuk melihat rincian pembayaran atau mengirim bukti.',
      ]:[
        '输入报名、候补或登记选课需求时使用的邮箱，获取验证码。',
        'Enter the email you used to enroll, join a waitlist, or save course preferences.',
        'Masukkan email yang digunakan untuk mendaftar, masuk daftar tunggu, atau menyimpan preferensi kursus.',
      ])}</p>
      {emailField}{codeField}
      <div className="enrollment-journey-actions">
        <EnrollmentJourneyLink className="enrollment-quiet" to={enrollmentSupportPath('account',language)}>{t(['无法使用原邮箱？联系销售或客服','Can’t use your original email? Contact support','Tidak bisa memakai email awal? Hubungi layanan pelanggan'])}</EnrollmentJourneyLink>
        <button type="submit" className="enrollment-primary" disabled={busy||awaitingCode}>
          {t(emailConfirmed?['查看报名','View enrollments','Lihat pendaftaran']:['验证并查看','Verify and view','Verifikasi dan lihat'])}</button>
      </div>
    </form> : !verified ? <form onSubmit={event=>{event.preventDefault();void (challenge?verify():sendCode());}}>
      <h2>{t(['验证邮箱','Verify your email','Verifikasi email'])}</h2>
      <label>{t(['电子邮箱','Email','Email'])}<input type="email" autoComplete="email" required value={email} disabled={busy} onChange={event=>editEmail(event.target.value)}/></label>
      {challenge && <label>{t(['六位验证码','Six-digit code','Kode enam digit'])}<input autoComplete="one-time-code" required pattern="[0-9]{6}" inputMode="numeric" value={code} onChange={event=>setCode(event.target.value)}/></label>}
      <button className="enrollment-action" type="submit" disabled={busy}>{t(challenge?['验证','Verify','Verifikasi']:['发送验证码','Send code','Kirim kode'])}</button>
      {challenge && <button type="button" disabled={busy} onClick={()=>void sendCode()}>{t(['重发验证码','Resend code','Kirim ulang'])}</button>}
    </form> : payment ? null
    : record ? interestsReadFailed ? interestsNotice
      : waitlistDetail ? renderWaitlistDetail(waitlistDetail)
      : demandDetail ? renderDemandDetail(demandDetail)
      : interests ? <p>{t(['这条记录无法查看。','This record is not available.','Catatan ini tidak tersedia.'])}</p>
      : <p role="status">{t(['正在读取记录…','Loading record…','Memuat catatan…'])}</p>
    : !classId ? <div className="enrollment-records">
      <div className="enrollment-record-tabs" role="group" aria-label={t(['记录类别','Activity type','Jenis aktivitas'])}>
        {([
          ['all', ['全部','All','Semua'], undefined],
          ['orders',['申请','Applications','Pendaftaran'],orders&&orders.filter(orderIsActive).length+assistedApplications.filter(row=>row.active).length],
          ['waitlist',['候补','Waitlist','Daftar tunggu'],interests?.waitlist.filter(row=>row.state==='waiting').length],
          ['demands',['选课需求','Course preferences','Preferensi kursus'],interests?.demands.filter(row=>row.state==='active').length],
        ] as const).map(([key,label,count])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>selectTab(key)}>
          {t(label)}{count!==undefined&&<span className="enrollment-tab-count">{count}</span>}
        </button>)}
      </div>
      <div className="enrollment-record-toolbar">
        <p>{t(['分类数字为当前有效记录数','Counts show active records','Jumlah menunjukkan catatan aktif'])}</p>
        <button type="button" className="enrollment-record-link" onClick={()=>void run(()=>getRecords())} disabled={busy}>
          <RefreshCw size={14} aria-hidden="true"/>{t(['刷新记录','Refresh','Muat ulang'])}
        </button>
      </div>
      {interestsReadFailed && interestsNotice}
      {(!orders||!interests&&!interestsReadFailed) && !error && <p role="status">{t(['正在读取报名…','Loading enrollments…','Memuat pendaftaran…'])}</p>}
      {activeRecords.map(record=><div key={record.key}>{record.card}</div>)}
      {!!pastRecords.length && <section className="enrollment-records">
        <h2 className="enrollment-history-title">{t(['历史记录','History','Riwayat'])}</h2>
        {pastRecords.map(record=><div key={record.key}>{record.card}</div>)}
      </section>}
      {!!orders&&(tab==='orders'||!!interests&&!interestsReadFailed)&&!records.length &&
        <p className="enrollment-record">{t(['该类别暂无记录。','No records in this category.','Belum ada catatan dalam kategori ini.'])}</p>}
    </div> : joined ? <><p role="status">{t(['候补已登记。','You joined the waitlist.','Anda masuk daftar tunggu.'])}</p>
      <EnrollmentJourneyLink to={mineLink+'&tab=waitlist'}>{t(['查看我的候补','View my waitlist','Lihat daftar tunggu saya'])}</EnrollmentJourneyLink></>
    : hasNoSeat ? <form onSubmit={event=>{event.preventDefault();void join();}}>
      <h2>{joinText}</h2>
      <label>{t(['学员姓名','Learner name','Nama siswa'])}<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
      <div className="enrollment-field"><label htmlFor={phoneField.errorId+'-input'}>{phoneLabel}</label>
        {ContactPhoneInput&&<ContactPhoneInput {...phoneField.inputProps} id={phoneField.errorId+'-input'} language={language} required value={phone} onValueChange={setPhone}/>}{phoneError}</div>
      <p>{t(['有空位时可以自行申请。','Apply when a seat becomes available.','Daftar saat kursi tersedia.'])}</p>
      <button className="enrollment-action" type="submit" disabled={busy}>{t(['确认加入候补','Confirm waitlist entry','Konfirmasi daftar tunggu'])}</button>
    </form> : <form onSubmit={event=>{event.preventDefault();void apply();}}>
      <h2>{applyText}</h2>
      <label>{t(['学员姓名','Learner name','Nama siswa'])}<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
      <div className="enrollment-field"><label htmlFor={phoneField.errorId+'-input'}>{phoneLabel}</label>
        {ContactPhoneInput&&<ContactPhoneInput {...phoneField.inputProps} id={phoneField.errorId+'-input'} language={language} required value={phone} onValueChange={setPhone}/>}{phoneError}</div>
      <label><input type="checkbox" checked={priority} onChange={event=>setPriority(event.target.checked)}/> {t(['优先安排顺延或转班方案','Prioritize rescheduling or transfer options','Utamakan opsi penjadwalan ulang atau pindah kelas'])}</label>
      <p>{t(['财务核实足额到账后，报名才算成功。','Enrollment is confirmed after Finance verifies full payment.','Pendaftaran berhasil setelah pembayaran penuh diverifikasi.'])}</p>
      <button className="enrollment-action" type="submit" disabled={busy}>{t(['提交申请','Submit application','Kirim pendaftaran'])}</button>
    </form>}
  </section>;
}
