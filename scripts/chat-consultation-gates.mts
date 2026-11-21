import {isDeepStrictEqual} from 'node:util';

export const gateVersion='uper-chat-consultation-gates-v1';
type Row={id:string;sessions?:number;minutes?:number;format?:string;firstLesson?:string;price?:number;period?:string;level?:string;
  weeklySchedule?:{days:number[];start:string;startByDay?:Record<number,string>}};
type Turn={input?:string;suggestedPrompts?:string[];reply?:string;status?:number;state?:string;modelUsed?:string;
  assistantId?:string;consultationConstraints?:{days?:number[];windows?:Array<{day:number;earliest?:string}>};
  links?:Array<{href:string;status:number}>;
  enrollment?:{kind:string;replyLanguage?:string;rows?:Row[];quotes?:Array<{level:string;unitPriced:boolean;actual:number}>}};
type Attempt={message_id:string;content:string;failed:boolean};
export type Transcript={id:string;repetition:number;turns:Turn[];providerAttempts?:Attempt[]};
export type Gate={id:string;case:string;turn:number;rule:string;critical:boolean};
export type Run={version:{consistent:boolean;backend:{buildId:string}};suite:string;fixtureDigest:string;cases:string[];repeat:number;
  jakartaDate:string;expectedModel?:string;selection:unknown;catalog:{classes:Row[];appointments:unknown[]};
  intake:{accepting:boolean};auditVerifiedLinks:boolean};
type RawIntent={enrollment?:{kind?:string;question?:string;referenceIds?:string[]};classCriteria?:{subjectChanged?:boolean}};
type Outcome={pass:boolean;layer:string;evidence:string};
const ok=(evidence:string):Outcome=>({pass:true,layer:'verified',evidence});
const fail=(layer:string,evidence:string):Outcome=>({pass:false,layer,evidence});

function rawIntent(record:Transcript,turn:Turn):RawIntent|undefined{
  const attempt=record.providerAttempts?.findLast(item=>!item.failed&&item.message_id===turn.assistantId);
  try{return attempt?JSON.parse(attempt.content):undefined;}catch{return undefined;}
}

function accessible(turn:Turn,path:string){
  return turn.links?.some(link=>{
    const url=new URL(link.href,'http://localhost:3000');
    return url.origin==='http://localhost:3000'&&url.pathname===path&&url.searchParams.get('enrollment_via')==='ai_chat'&&link.status===200;
  })??false;
}

function advisorQuestion(turn:Turn):Outcome{
  const reply=turn.reply??'';
  if(turn.enrollment?.kind!=='advisor')return fail('intent','未识别为如何向顾问咨询。');
  if(!/(?:我|想学).{0,85}HSK\s*1/s.test(reply)||!reply.includes('雅加达')||!reply.includes('线下')||
    !/(?:请问|可以这样问|可以发|可直接发送|你可以问|目前有.{0,12}班)/.test(reply))
    return fail('reply','正文未给出包含雅加达、线下、HSK 1 的可直接转述问法。');
  if(!accessible(turn,'/enrollment/help/consultation'))return fail('link','顾问咨询入口不可达。');
  return ok('正文给出可转述的咨询话术，并提供顾问入口。');
}

function onlinePreference(turn:Turn):Outcome{
  if(turn.enrollment?.kind==='advisor')return fail('intent','仍按仅线下处理，未接受学员更新的线上偏好。');
  const open=turn.links?.some(link=>{
    const url=new URL(link.href,'http://localhost:3000');
    return link.status===200&&url.origin==='http://localhost:3000'&&url.searchParams.get('enrollment_via')==='ai_chat'&&
      url.searchParams.get('level')==='1'&&(/^\/enrollment\/?$/.test(url.pathname)||
        (turn.enrollment?.rows??[]).some(row=>row.level==='HSK 1'&&url.pathname==='/enrollment/'+row.id));
  });
  return open?ok('线上浏览入口保留 HSK 1。'):fail('link','缺少可达的 HSK 1 线上目录或班次。');
}

function advisorSendStatus(turn:Turn):Outcome{
  if(!/^(?:我)?(?:还|并)?没有(?:代你|替你|帮你)?(?:向.{0,12})?(?:发送|发消息|发出)/.test(turn.reply??''))
    return fail('reply','未直接说明没有代发。');
  return accessible(turn,'/enrollment/help/consultation')?ok('直接说明未代发，保留自行联系的入口。'):
    fail('link','缺少自行联系顾问的入口。');
}

function offlineEntryConditions(turn:Turn):Outcome{
  const reply=turn.reply??'';
  if(!/^(?:目前|现在|我)?(?:还)?(?:不能|无法|没法|不敢|不可以)保证/.test(reply))
    return fail('reply','本周能否入学需先给出无法保证的明确结论。');
  if(/付款|核款|到账|缴费|转账|付款核验/.test(reply))
    return fail('reply','本轮仅问线下面授能否本周入学，答复引入了未经证实的付款或核款条件。');
  if(!/名额|余位|空位/.test(reply)||!/开课|首课|开始|时间|日期/.test(reply))
    return fail('reply','应说明需向顾问确认面授名额和最早开课时间。');
  return ok('无法保证本周入学，明确待顾问核对的面授名额与开课时间。');
}

function seatHoldOnlyAfterAllocation(turn:Turn):Outcome{
  const reply=turn.reply??'';
  if(!/(?:无法|不能|没法).{0,14}(?:锁位|锁住|预留|保留)/s.test(reply))
    return fail('reply','应明确聊天无法代锁。');
  if(!/(?:只有|仅|等你|在你|确认).{0,20}(?:获席|获得席位|分配.{0,4}(?:席位|名额)).{0,14}(?:才|后).{0,16}(?:预留|保留|锁定)|(?:获席|获得席位).{0,10}后.{0,10}(?:预留|保留)/s.test(reply))
    return fail('reply','未说明只有申请成功获席后才会预留席位。');
  return ok('明确不可代锁，并说明获席后才预留。');
}

function strictLocalTimeNoMatch(turn:Turn):Outcome{
  const reply=turn.reply??'';
  if(!/13:00|下午\s*[1一]\s*点/.test(reply)||!/WIB|雅加达/.test(reply))
    return fail('reply','正文需明确东京 15:00 对应 WIB 13:00。');
  if(!/(?:^|[。！？\n；，])\s*(?:目前|当前|暂时|查询结果[：:]?)?\s*(?:没有|未找到|未查到|暂无|没找到)[^。！？\n]{0,45}(?:班次|班课|合适的班|课程|符合|匹配)/.test(reply))
    return fail('reply','未明确说明实时目录无符合严格时段的班次。');
  if(turn.enrollment?.rows?.length)return fail('matching','正文称无匹配但附了班次推荐。');
  return ok('正文直接说明换算时间及无匹配结果。');
}

function browseWithoutHolding(turn:Turn):Outcome{
  const reply=turn.reply??'';
  if(!/(?:无需|不用|不需要|不必).{0,12}(?:验证|验邮箱)/s.test(reply)||
    !/浏览|查看/.test(reply)||/帮你锁|你已经获席/.test(reply))
    return fail('reply','只浏览时应说明无需验证邮箱、不给出代锁或申请结果。');
  return ok('只浏览，无需验证邮箱。');
}

function strictLocalTimeMatch(turn:Turn):Outcome{
  const reply=turn.reply??'';
  if(!/15:00|下午\s*[3三]\s*点/.test(reply)||!/WIB|雅加达/.test(reply))
    return fail('reply','正文需说明东京 17:00 对应 WIB 15:00。');
  const rows=turn.enrollment?.rows??[];
  if(!rows.length||rows.some(row=>row.level!=='HSK 1'||!row.weeklySchedule?.days.length||
    row.weeklySchedule.days.some(day=>![6,7].includes(day)||(row.weeklySchedule!.startByDay?.[day]??row.weeklySchedule!.start)!=='15:00')))
    return fail('matching','未按换算后的严格时间返回匹配的 HSK 1 班次。');
  if(!rows.some(row=>accessible(turn,'/enrollment/'+row.id)))return fail('link','匹配班次缺少可达详情。');
  return ok('严格时段确实有匹配时返回真实班次。');
}

function comparePair(turn:Turn,history:Turn[],raw?:RawIntent):Outcome{
  const pair=history.findLast(item=>item.enrollment?.rows?.length===2)?.enrollment?.rows??[];
  if(pair.length!==2)return fail('context','这条会话在比较前未展示两个班次。');
  const actual=turn.enrollment?.rows?.map(row=>row.id)??[];
  if(pair.some(row=>!actual.includes(row.id))||actual.length!==2)
    return raw?.enrollment?.referenceIds?.length===2?fail('matching','模型返回两个引用，服务端没有返回原来的两班。'):
      fail('context','比较时未恢复之前一起展示的两个班次。');
  const dates=pair.map(row=>row.firstLesson?.replace('T',' '));
  if(dates.some(date=>!date||!turn.reply?.includes(date))||turn.reply?.includes('验证邮箱并提交'))
    return fail('reply','正文缺少其中一个班次的首课，或加入了没有要求的报名步骤。');
  if(pair.some(row=>!accessible(turn,'/enrollment/'+row.id)))return fail('link','原推荐的两条班次详情链接没有全部通过。');
  return ok('正文覆盖原来的两班首课，两条详情链接均可达。');
}

function duplicateTransfer(turn:Turn,raw?:RawIntent):Outcome{
  if(!/^(?:不用再付|不需要再(?:付|转)|无需再(?:付|转)|请勿再次(?:付|转)|不要再(?:付|转))/.test(turn.reply??''))
    return raw?.enrollment?.question==='avoid_duplicate_payment'?fail('reply','已识别为重复付款，正文未先给出明确结论。'):
      fail('intent','已转账后问是否再付，答复没有明确阻止重复转账。');
  if(!accessible(turn,'/enrollment/mine'))return fail('link','没有可达的原订单入口。');
  return ok('正文先说明无需再转账，原订单入口可达。');
}

function sisterTuition(turn:Turn,history:Turn[],run:Run,record:Transcript):Outcome{
  const change=history.at(-1);
  const criteria=change?.consultationConstraints;
  const days=(criteria?.windows?.map(window=>window.day)??criteria?.days??[]).toSorted((a,b)=>a-b);
  if(!isDeepStrictEqual(days,[2,4]))
    return fail('context',change&&rawIntent(record,change)?.classCriteria?.subjectChanged
      ?'模型识别了咨询对象变化，但没有保存新的周二、周四条件。':'对象切换后的回执没有记录周二、周四条件。');
  const action=turn.enrollment;
  const level=action?.rows?.[0]?.level??action?.quotes?.[0]?.level??'HSK 2';
  const matches=run.catalog.classes.filter(row=>row.level===level&&row.weeklySchedule?.days.length&&
    row.weeklySchedule.days.every(day=>{
      const start=row.weeklySchedule!.startByDay?.[day]??row.weeklySchedule!.start;
      const earliest=criteria?.windows?.find(window=>window.day===day)?.earliest??'18:00';
      return days.includes(day)&&start>=earliest;
    }));
  if(matches.length){
    if(!action?.rows?.length||action.rows.some(row=>!matches.some(match=>match.id===row.id)))
      return fail('matching','报价没有引用符合新学员时间的公开团班。');
    if(!turn.reply?.includes('实付总价'))return fail('reply','正文未给出匹配团班的价格。');
    if(action.rows.some(row=>!accessible(turn,'/enrollment/'+row.id)))return fail('link','匹配班次详情不可达。');
  }else{
    if(!['demand','catalog'].includes(action?.kind??'')||action?.quotes?.some(quote=>quote.unitPriced))
      return fail('matching','无匹配团班时，报价没有走选课需求或目录入口，或替换成了一对一。');
    if(!turn.reply?.includes('没有符合')||(action?.quotes?.length&&!turn.reply?.includes('预算参考')))
      return fail('reply','正文未区分无匹配班次与预算参考报价。');
    if(run.intake.accepting&&!accessible(turn,'/enrollment/interest'))return fail('link','开放报名时缺少选课需求入口。');
  }
  return ok('回读到周二、周四限制，按实时匹配结果提供团班报价或预算参考。');
}

export function evaluateGates(run:Run,records:Map<string,Transcript>,gates:Gate[]){
  return gates.filter(gate=>run.cases.includes(gate.case)).flatMap(gate=>
    Array.from({length:run.repeat},(_,index)=>{
      const repetition=index+1,record=records.get(gate.case+'-'+repetition),turn=record?.turns[gate.turn-1];
      let outcome:Outcome;
      if(!record||!turn||turn.status!==200||turn.state!=='completed'||!turn.reply||
        (run.expectedModel&&turn.modelUsed!==run.expectedModel)){
        outcome=fail('execution','缺少完整答复，或实际模型与本轮指定模型不同。');
      }else{
        const history=record.turns.slice(0,gate.turn-1),raw=rawIntent(record,turn);
        switch(gate.rule){
          case 'chat_feature_current_topic':
            outcome=/\p{Script=Han}/u.test(turn.reply??'')&&turn.suggestedPrompts?.length===0
              ?ok('功能说明用中文，旧话题没有生成气泡。'):fail('reply','功能说明切错语言或沿用了旧气泡。');
            break;
          case 'current_learner_chinese':
            outcome=/\p{Script=Han}/u.test(turn.reply??'')&&(!turn.enrollment?.replyLanguage||turn.enrollment.replyLanguage==='zh')&&
              (turn.suggestedPrompts??[]).every(prompt=>/\p{Script=Han}/u.test(prompt))
              ?ok('沿用当轮中文。'):fail('reply','正文、班次回复或气泡未沿用当轮中文。');
            break;
          case 'verified_tuition_difference':{
            const rows=turn.enrollment?.rows??[];
            const previous=history.at(-1)?.enrollment?.rows??[];
            const [a,b]=[...rows].sort((a,b)=>(a.price??0)-(b.price??0));
            const actual=(b?.price??0)-(a?.price??0);
            const unit=a?.sessions&&a.sessions===b.sessions?actual/a.sessions:0;
            const reply=turn.reply??'';
            outcome=rows.length===2&&rows.every(r=>previous.some(p=>p.id===r.id))&&actual>0&&reply.includes(actual.toLocaleString('en-US'))&&
              unit>0&&reply.includes(unit.toLocaleString('en-US'))&&/^两班都是/.test(reply)
              ?ok('先解释同等节数的单节和整班差额，两班仍是上轮推荐对象。'):fail('reply','差价未在正文直接答齐或换了班次。');
            break;
          }
          case 'public_small_group_size':
            outcome=/4[–—-]6\s*人/.test(turn.reply??'')&&!/有余位|余位有限/.test(turn.reply??'')
              ?ok('正文回答公开小班规模。'):fail('reply','没有直接回答小班规模，或用余位代替。');
            break;
          case 'public_standard_group_size':
            outcome=/10[–—-]15\s*人/.test(turn.reply??'')&&!/有余位|余位有限/.test(turn.reply??'')
              ?ok('正文回答公开标准班规模。'):fail('reply','没有直接回答标准班规模，或用余位代替。');
            break;
          case 'public_pair_size':
            outcome=/4[–—-]6\s*人/.test(turn.reply??'')&&/10[–—-]15\s*人/.test(turn.reply??'')
              ?ok('点气泡后正文回答原两班的公开规模。'):fail('reply','原两班的公开规模没有一次答齐。');
            break;
          case 'seat_hold_only_after_allocation':outcome=seatHoldOnlyAfterAllocation(turn);break;
          case 'strict_local_time_no_match':outcome=strictLocalTimeNoMatch(turn);break;
          case 'browse_without_holding':outcome=browseWithoutHolding(turn);break;
          case 'strict_local_time_match':outcome=strictLocalTimeMatch(turn);break;
          case 'offline_entry_conditions':outcome=offlineEntryConditions(turn);break;
          case 'advisor_question':outcome=advisorQuestion(turn);break;
          case 'online_preference':outcome=onlinePreference(turn);break;
          case 'advisor_send_status':outcome=advisorSendStatus(turn);break;
          case 'compare_original_pair':outcome=comparePair(turn,history,raw);break;
          case 'avoid_duplicate_transfer':outcome=duplicateTransfer(turn,raw);break;
          case 'keep_new_learner_schedule':outcome=sisterTuition(turn,history,run,record);break;
          default:throw Error('Unrecognized regression rule: '+gate.rule);
        }
      }
      return {...gate,repetition,...outcome};
    }));
}

export function comparisonDifferences(baseline:Run,candidate:Run){
  return (['suite','fixtureDigest','cases','repeat','jakartaDate','expectedModel','selection','intake','catalog','auditVerifiedLinks'] as const)
    .filter(key=>baseline[key]===undefined||candidate[key]===undefined||!isDeepStrictEqual(baseline[key],candidate[key]));
}
