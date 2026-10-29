import {createContext,useContext} from 'react';
export const CrmHistorySearch=createContext('');
/** Literal display highlighting only: never parse customer intent or insert HTML. */
export function searchTextParts(text:string,query:string){
 const term=query.trim();if(!term)return [{text,match:false}];
 const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const parts:{text:string;match:boolean}[]=[];let end=0;
 for(const match of text.matchAll(new RegExp(escaped,'giu'))){const start=match.index!;if(start>end)parts.push({text:text.slice(end,start),match:false});parts.push({text:match[0],match:true});end=start+match[0].length;}
 if(end<text.length)parts.push({text:text.slice(end),match:false});return parts;
}
export function CrmSearchHighlight({text}:{text:string}){const query=useContext(CrmHistorySearch);return <>{searchTextParts(text,query).map((part,i)=>part.match?<mark className="crm-search-match" key={i}>{part.text}</mark>:part.text)}</>;}
