/** Source-document illustration only: no runtime business state or fabricated statistics. */
const ink='var(--admin-text, #172b45)',muted='var(--admin-muted, #435a75)',surface='var(--admin-surface, #ffffff)',border='var(--doc-border, #cbd5e1)',action='var(--admin-action, #007b74)',info='var(--admin-info, #1d4ed8)';
const label=(x:number,y:number,text:string,size=17,color=ink,weight=400)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${text}</text>`;
function box(id:string,x:number,y:number,w:number,h:number,title:string,lines:string[],tone=action){return `<g data-node="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${surface}" stroke="${border}"/><rect x="${x}" y="${y+12}" width="3" height="${h-24}" rx="1" fill="${tone}"/>${label(x+16,y+30,title,id==='E'?15:18,ink,600)}${lines.map((line,i)=>label(x+16,y+57+i*23,line,15,muted)).join('')}</g>`;}
function arrow(id:string,x1:number,y:number,x2:number,dashed=false,color=action){return `<g data-edge="${id}" fill="none" stroke="${color}" stroke-width="2"${dashed?' stroke-dasharray="5 4"':''}><path d="M${x1} ${y}H${x2-7}"/><path d="M${x2-12} ${y-5}L${x2-5} ${y}L${x2-12} ${y+5}" stroke-dasharray="none"/></g>`;}
export const marketingOverviewSvg=`<svg xmlns="http://www.w3.org/2000/svg" class="crm-marketing-overview-svg" viewBox="0 0 960 756" width="100%" role="img" aria-labelledby="marketing-overview-title marketing-overview-desc" font-family="system-ui, PingFang SC, Microsoft YaHei, sans-serif">
<title id="marketing-overview-title">从广告到经营结果：一条主线与两条反馈回路</title>
<desc id="marketing-overview-desc">建议架构，非已部署配置。Meta广告触达客户，客户通过Instagram Direct或WhatsApp咨询，消息接入CRM；UPER业务规则与销售核实形成资格、预约、申请和付款事实。业务事实经事件映射与最小数据筛选，通过适用CAPI路线进入Meta接收与诊断，仅在支持且配置正确时用于广告优化。广告报表与业务事实进入UPER经营分析，由人员决策调整广告。这是两条不同回路，上传成功不代表匹配、归因或优化成功。</desc>
<rect x="1" y="1" width="958" height="754" rx="16" fill="${surface}" stroke="${border}"/>
${label(24,36,'客户旅程',21,ink,600)}${label(158,36,'一条主线｜接触客户，保留原文，核实业务事实',16,muted)}
${box('E',754,62,182,49,'UPER规则＋销售核实',[],action)}
<path data-edge="E-F" d="M845 111V139M840 133L845 140L850 133" fill="none" stroke="${action}" stroke-width="2"/>
${box('A',24,150,158,122,'① 广告投放',['Meta广告设置','与投放计划'])}
${box('B',210,150,158,122,'② 广告触达',['学生看到广告','Instagram 或','Facebook'])}
${box('C',396,150,158,122,'③ 客户咨询',['Instagram Direct','或WhatsApp'])}
${box('D',582,150,144,122,'④ CRM归档',['客户 · 来源','会话与原文'])}
${box('F',754,150,182,122,'⑤ 业务事实',['资格 · 预约 · 申请','付款等事实记录'])}
${arrow('A-B',182,210,210)}${arrow('B-C',368,210,396)}${arrow('C-D',554,210,582,true)}${arrow('D-F',726,210,754)}
${label(485,299,'咨询消息接入为目标方案；不能把“打开聊天”当成已发送。',15,muted)}
<rect x="16" y="324" width="928" height="177" rx="12" fill="none" stroke="${border}"/>
${label(32,354,'回路一  Meta算法反馈',20,ink,600)}${label(317,354,'经过筛选的数据反馈，不是整份客户档案',15,muted)}
${box('F-reference',32,376,166,98,'来自⑤业务事实',['保留实际发生时间','与可靠依据'],info)}
${box('G',238,376,228,98,'事件映射与数据筛选',['按适用事件定义','仅选必要的数据'],info)}
${box('H',506,376,220,98,'Meta接收与诊断',['走适用的CAPI路线','核对回执与诊断'],info)}
${box('A-meta-reference',766,376,162,98,'回到①广告投放',['支持且配置正确时','才可能用于优化'],info)}
${arrow('F-G',198,424,238,false,info)}${arrow('G-H',466,424,506,true,info)}${arrow('H-A',726,424,766,true,info)}
<rect x="16" y="521" width="928" height="164" rx="12" fill="none" stroke="${border}"/>
${label(32,552,'回路二  UPER人员决策',20,ink,600)}${label(317,552,'经营判断与广告算法反馈分别处理',15,muted)}
${box('A-report-reference',32,574,184,42,'① 广告报表',[],action)}
${box('F-analysis-reference',32,628,184,42,'⑤ 业务事实',[],action)}
<g fill="none" stroke="${action}" stroke-width="2"><path data-edge="A-I" d="M216 595H235V623H256"/><path data-edge="F-I" d="M216 649H235V623"/><path d="M249 618L256 623L249 628"/></g>
${box('I',266,574,326,96,'UPER经营分析',['CPQL · 付费 · 获客成本','结合广告报表与实际业务记录'])}
${arrow('I-A',592,623,750)}${label(613,608,'人员决策',16,action,600)}
${box('A-human-reference',760,574,168,96,'回到①广告投放',['人员调整投放策略','不是自动回传结果'])}
${label(28,715,'实线：业务数据／人员决策     虚线：待接入或受条件约束的路径',15,muted)}
${label(28,740,'建议架构 · 上传成功 ≠ 匹配成功 ≠ 归因成功 ≠ 优化生效',16,ink,600)}
</svg>`;

/** Replace only section 2.2's first diagram; retain every source character outside that SVG. */
export function overviewSectionHtml(html:string){
 const heading=html.indexOf('<h5>2.2 '),start=html.indexOf('<svg',heading),end=html.indexOf('</svg>',start);
 if(heading<0||start<heading||end<start)throw Error('Marketing overview source boundary changed; review required');
 return html.slice(0,start)+marketingOverviewSvg+html.slice(end+6);
}
