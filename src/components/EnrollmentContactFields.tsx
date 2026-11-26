import type {ComponentProps, ComponentPropsWithoutRef, ReactNode} from 'react';
import type {ContactPhoneInput} from './ContactPhoneInput';
import type {useEnrollmentPhoneField} from './useEnrollmentPhoneField';

export function EnrollmentContactFields({
  nameLabel,nameInput,nameLabelClassName,children,phoneLabel,PhoneInput,phoneInput,phoneField,
}: {
  nameLabel:string;
  nameInput:ComponentPropsWithoutRef<'input'>;
  nameLabelClassName?:string;
  children?:ReactNode;
  phoneLabel:string;
  PhoneInput?:typeof ContactPhoneInput;
  phoneInput:Pick<ComponentProps<typeof ContactPhoneInput>,'language'|'value'|'onValueChange'|'readOnly'>;
  phoneField:Pick<ReturnType<typeof useEnrollmentPhoneField>,'error'|'errorId'|'inputProps'>;
}) {
  const phoneId=phoneField.errorId+'-input';
  return <>
    <label className={nameLabelClassName}>{nameLabel}<input {...nameInput} required maxLength={120}/></label>
    {children}
    <div className="enrollment-field">
      <label htmlFor={phoneId}>{phoneLabel}</label>
      {PhoneInput&&<PhoneInput {...phoneInput} {...phoneField.inputProps} id={phoneId} required/>}
      {phoneField.error&&<small className="enrollment-form-error" role="alert" id={phoneField.errorId}>{phoneField.error}</small>}
    </div>
  </>;
}
