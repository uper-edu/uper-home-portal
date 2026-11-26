export function AdminContentNav({label,items,onNavigate,layout='tabs'}:{
  label:string;
  items:{href:string;label:string;current:boolean}[];
  onNavigate:(href:string)=>void;
  layout?:'tabs'|'directory';
}) {
  return <nav className={layout==='directory'?'crm-content-tabs crm-content-tabs--directory':'crm-content-tabs'} aria-label={label}>
    {items.map(item=><a key={item.href} className="crm-content-tab" href={item.href}
      aria-current={item.current?'page':undefined} onClick={event=>{
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
        event.preventDefault();
        if(!item.current)onNavigate(item.href);
      }}>{item.label}</a>)}
  </nav>;
}
