import{adminFormGuide}from'../utils/adminFormLanguage';
export function AdminFormGuide({lang='zh'}:{lang?:string}){const col=lang==='zh'?2:lang==='id'?1:0;return <section className="admin-form-guide"><h3>{adminFormGuide.title[col]}</h3><p>{adminFormGuide.body[col]}</p></section>;}
