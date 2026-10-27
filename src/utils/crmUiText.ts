import dictionary from './crm-ui-presentation.json';
/** Translate fixed interface text only, never original customer or staff content. */
export function crmUiText(value:string,lang:string='zh'):string {if(lang==='zh')return value;const item=(dictionary as Record<string,string[]>)[value];if(item)return item[lang==='id'?1:0];
 if(value.includes(' · '))return value.split(' · ').map(v=>crmUiText(v,lang)).join(' · ');
 if(value.includes('、'))return value.split('、').map(v=>crmUiText(v,lang)).join(', ');
 const count=value.match(/^(\d+)项$/);if(count)return count[1]+(lang==='id'?' item':' items');
 const diff=value.match(/^不同记录(\d+)$/);if(diff)return(lang==='id'?'Catatan berbeda ':'Different record ')+diff[1];
 return value;}
