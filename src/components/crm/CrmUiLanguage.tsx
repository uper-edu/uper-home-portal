import {createContext,useContext,type ReactNode} from 'react';
import {crmUiText} from '../../utils/crmUiText';
export {crmUiText} from '../../utils/crmUiText';
export type UiLanguage='zh'|'en'|'id';
const Language=createContext<UiLanguage|undefined>(undefined);
/** Fixed interface labels only. Customer text, names, notes and quotations are never passed here. */
export function useCrmUiLanguage(fallback?:string){return (useContext(Language)||fallback||'zh') as UiLanguage;}
export function useCrmUiText(fallback?:string){const lang=useContext(Language)||fallback||'zh';return(value:string)=>crmUiText(value,lang);}
export function CrmUiProvider({lang,children}:{lang:UiLanguage;children:ReactNode}){return <Language.Provider value={lang}>{children}</Language.Provider>}
