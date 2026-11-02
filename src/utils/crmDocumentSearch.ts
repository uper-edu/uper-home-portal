/** Plain-text context only; never renders source HTML or changes original content. */
export function documentSearchExcerpt(text:string,query:string,radius=65){
 const plain=text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const at=plain.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
 if(at<0)return '';
 const start=Math.max(0,at-radius),end=Math.min(plain.length,at+query.trim().length+radius);
 return (start?'…':'')+plain.slice(start,end)+(end<plain.length?'…':'');
}
export function locateDocumentMatch(root:HTMLElement,query:string){
 const term=query.trim().toLocaleLowerCase();if(!term)return null;
 root.querySelectorAll('[data-doc-search-hit]').forEach(n=>n.removeAttribute('data-doc-search-hit'));
 const reveal=(target:HTMLElement)=>{
  for(let ancestor:HTMLElement|null=target;ancestor&&ancestor!==root;ancestor=ancestor.parentElement)if(ancestor instanceof HTMLDetailsElement)ancestor.open=true;
  target.setAttribute('data-doc-search-hit','');target.tabIndex=-1;return target;
 };
 const field=[...root.querySelectorAll<HTMLElement>('.crm-doc-dict tbody tr')].find(row=>{const key=row.querySelector('th code')?.textContent?.toLocaleLowerCase()||'';return key===term||key.endsWith('.'+term)});
 if(field)return reveal(field);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let text:Node|null;
 while((text=walker.nextNode())){
  const parent=text.parentElement;
  if(!parent||parent.closest('summary,button,script,style,.crm-doc-search-return,.crm-doc-breadcrumb')||!text.textContent?.toLocaleLowerCase().includes(term))continue;
  const target=parent.closest<HTMLElement>('tr,p,li,blockquote,h4,h5')||parent;
  return reveal(target);
 }
 return null;
}

/** Editorial breakpoints only. Every character of the original instruction is retained. */
export function followupReadingParagraphs(text:string,col:number){
 const breaks=[['Opening an empty section','Agreement choices show','The four sections share','Existing-agreement handling'],['Membuka bagian kosong','Pilihan kesepakatan','Keempat bagian memakai','Penanganan kesepakatan'],['打开空白区域','约定选项','四区采用','仅有有效约定']][col]||[];
 const points=[0,...breaks.map(v=>text.indexOf(v)).filter(v=>v>0),text.length].sort((a,b)=>a-b);
 return points.slice(0,-1).map((at,i)=>text.slice(at,points[i+1]));
}
