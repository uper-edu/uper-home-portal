import type {ComponentPropsWithRef} from 'react';

type LinkProps=Omit<ComponentPropsWithRef<'a'>,'className'|'href'> & {href:string;className?:string};
type ButtonProps=Omit<ComponentPropsWithRef<'button'>,'className'|'type'> & {href?:never;className?:string};
type ListControlProps=LinkProps|ButtonProps;

function isLink(props:ListControlProps):props is LinkProps{
  return typeof props.href==='string';
}

function ListControl({styleClass,props}:{styleClass:string;props:ListControlProps}){
  const className=[styleClass,props.className].filter(Boolean).join(' ');
  if(isLink(props))return <a {...props} className={className}/>;
  const {href:_,...button}=props;
  return <button {...button} type="button" className={className}/>;
}

export function AdminRecordEntry(props:ListControlProps){
  return <ListControl styleClass="admin-record-entry" props={props}/>;
}

export function AdminRowAction(props:ListControlProps){
  return <ListControl styleClass="admin-row-action" props={props}/>;
}
