import type {ReactNode} from 'react';
import {aiSupplierIds,aiSupplierTemplates,type AiSupplierView} from '../utils/aiSupplier';
import type {CrmLanguage} from '../utils/crmLanguage';
import {AdminFormSection} from './AdminFormLayout';
import {AdminListTable} from './admin/AdminList';

export function AiSupplierCatalog({suppliers,lang,renderCredential}:{
  suppliers?: AiSupplierView[];
  lang: CrmLanguage;
  renderCredential: (id:string,label:string,info?:ReactNode)=>ReactNode;
}){
  const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const title=t('Provider credentials','Kredensial penyedia','供应商凭证');
  return <AdminFormSection title={title} variant="card">
    <AdminListTable className="llm-credentials-table" label={title}
      headers={[t('Provider','Penyedia','供应商'),t('Credential status','Status kredensial','凭证状态'),t('Actions','Tindakan','操作')]}>
      {renderCredential('openai','OpenAI')}
      {renderCredential('deepseek','DeepSeek')}
      {aiSupplierIds.map(id=>{
        const template=aiSupplierTemplates[id];
        const name=suppliers?.find(supplier=>supplier.id===id)?.name??template.name;
        return renderCredential(id,name,<div><small>{template.models.join(' · ')}</small></div>);
      })}
    </AdminListTable>
  </AdminFormSection>;
}
