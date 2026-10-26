import {useCrmUiText} from './CrmUiLanguage';
import React from 'react';
import {Sparkles} from 'lucide-react';
/** Marks derived information, never the original text or a successful empty run. */
export function CrmAiIndicator({mixed=false}:{mixed?:boolean}){
 const ui=useCrmUiText();
 const description=ui(mixed?'本项包含AI根据关联原文整理的信息及人工记录':'由AI根据关联原文整理');
 return <span className="crm-ai-indicator" role="img" aria-label={description} title={description} tabIndex={0}><Sparkles size={13} aria-hidden="true"/><span aria-hidden="true">AI</span></span>;
}
