import type {ComponentProps,ReactNode} from 'react';
import{AdminFormSection}from'../AdminFormLayout';
import{crmFormText,type CrmFormLabel}from'../../utils/crmFormLanguage';
import type{CrmLanguage}from'../../utils/crmLanguage';
/** A business-labelled section, with no form values, lifecycle or save behavior. */
export function CrmFormSection({name,lang,className='',...props}:Omit<ComponentProps<typeof AdminFormSection>,'title'> & {name:CrmFormLabel;lang:CrmLanguage}){
 return <AdminFormSection {...props} title={crmFormText(lang,name)} className={`crm-form-section ${className}`.trim()}/>;
}
export function CrmFormSummary({children}: {children:ReactNode}){return <div className="crm-form-summary">{children}</div>;}
