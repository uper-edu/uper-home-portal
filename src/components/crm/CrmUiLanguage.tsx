import {createContext,useContext,type ReactNode} from 'react';
import dictionary from '../../utils/crm-ui-presentation.json';
export type UiLanguage='zh'|'en'|'id';
const Language=createContext<UiLanguage|undefined>(undefined);
/** Fixed interface labels only. Customer text, names, notes and quotations are never passed here. */
export function crmUiText(value:string,lang:string='zh'):string {if(lang==='zh')return value;const item=(dictionary as Record<string,string[]>)[value];if(item)return item[lang==='id'?1:0];
 if(value.includes(' · '))return value.split(' · ').map(v=>crmUiText(v,lang)).join(' · ');
 if(value.includes('、'))return value.split('、').map(v=>crmUiText(v,lang)).join(', ');
 const count=value.match(/^(\d+)项$/);if(count)return count[1]+(lang==='id'?' item':' items');
 const diff=value.match(/^不同记录(\d+)$/);if(diff)return(lang==='id'?'Catatan berbeda ':'Different record ')+diff[1];
 return value;}
export function useCrmUiLanguage(fallback?:string){return (useContext(Language)||fallback||'zh') as UiLanguage;}
export function useCrmUiText(fallback?:string){const lang=useContext(Language)||fallback||'zh';return(value:string)=>crmUiText(value,lang);}
export function CrmUiProvider({lang,children}:{lang:UiLanguage;children:ReactNode}){return <Language.Provider value={lang}>{children}</Language.Provider>}
