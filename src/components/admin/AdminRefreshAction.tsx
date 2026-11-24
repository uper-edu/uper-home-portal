import {RefreshCw} from 'lucide-react';
import {AdminPageAction} from './AdminPageAction';
import type {ComponentProps} from 'react';

type RefreshProps=Pick<ComponentProps<typeof AdminPageAction>,
  'label'|'description'|'loading'|'disabled'|'onClick'>;

export function AdminRefreshAction(props: RefreshProps) {
  return <AdminPageAction {...props} icon={RefreshCw} keepFocusWhileLoading/>;
}
