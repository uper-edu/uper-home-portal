import {useCrmUiText,useCrmUiLanguage} from './CrmUiLanguage';
import React from 'react';
import {UserRound} from 'lucide-react';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
/** Recording provenance only; the occurrence time belongs to the timeline heading. */
export function CrmHistoryAttribution({author,recordedAt}:{author?:string|null;recordedAt?:string|null}){
 const ui=useCrmUiText(),lang=useCrmUiLanguage();

 const identity=author==='visitor'?'客户提交':author==='ai'?'AI整理':author==='system'?'系统记录':author?`${author} 记录`:'记录者未注明';
 return <p className="crm-history-attribution"><UserRound size={14} aria-hidden="true"/><span>{author&&!['visitor','ai','system'].includes(author)?lang==='zh'?`${author} 记录`:ui("记录者：")+author:ui(identity)}</span><span aria-hidden="true">·</span><span>{ui("录入于")} {recordedAt ? <time dateTime={recordedAt} title={viewerTimeZone()}>{formatCrmOperatingTime(recordedAt,viewerTimeZone())}</time> : ui("未注明")}</span></p>;
}
