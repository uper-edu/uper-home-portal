import {useContext,type ComponentProps} from 'react';
import {AdminOperationLayer} from '../admin/AdminOperationLayer';
import {CrmCustomer360Button} from './CrmCustomer360Button';
import {CrmHistoryAccess} from './CrmHistoryAccess';

export function CrmOperationLayer({navigation,customerContext=true,...props}:
  ComponentProps<typeof AdminOperationLayer>&{customerContext?:boolean}){
  const openHistory=useContext(CrmHistoryAccess);
  return <AdminOperationLayer {...props} navigation={<>
    {navigation}
    {openHistory&&customerContext&&!props.history&&<CrmCustomer360Button lang={props.lang} onClick={()=>openHistory({})}/>}
  </>}/>;
}
