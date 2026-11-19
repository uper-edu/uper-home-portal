import {RefreshCw} from 'lucide-react';
import {CrmPageAction} from '../crm/CrmPageAction';
import type {ComponentProps} from 'react';

type RefreshProps=Pick<ComponentProps<typeof CrmPageAction>,
  'label'|'description'|'loading'|'disabled'|'onClick'>;

export function AdminRefreshAction(props: RefreshProps) {
  return <CrmPageAction {...props} icon={RefreshCw} keepFocusWhileLoading/>;
}
