import {Search} from 'lucide-react';
import type {Ref} from 'react';

export type CrmSearchFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
  id?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
};

export function CrmSearchField({label,value,onChange,placeholder,inputRef,id,disabled,maxLength,className}:CrmSearchFieldProps) {
  return <div className={['crm-search-field',className].filter(Boolean).join(' ')}>
    <Search size={16} aria-hidden="true"/>
    <input ref={inputRef} id={id} type="search" aria-label={label} placeholder={placeholder}
      value={value} disabled={disabled} maxLength={maxLength} onChange={event=>onChange(event.currentTarget.value)}/>
  </div>;
}
