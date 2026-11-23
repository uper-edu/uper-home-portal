import {useId, useMemo, useRef, useState} from 'react';
type PhoneValidation = Pick<typeof import('../utils/contactPhone'), 'CONTACT_PHONE_MAX_LENGTH' | 'contactPhoneText' | 'validContactPhone'>;

export function useEnrollmentPhoneField(language: string, value: string, validation: PhoneValidation | undefined) {
  const [touched, setTouched] = useState(false);
  const errorId = useId();
  const ref = useRef<HTMLInputElement>(null);
  const valid = useMemo(() => validation?.validContactPhone(value) ?? false, [validation,value]);
  const error = touched && !valid ? validation?.contactPhoneText(language).error ?? '' : '';
  return {
    valid,
    error,
    errorId,
    inputProps: {
      ref,
      maxLength: validation?.CONTACT_PHONE_MAX_LENGTH,
      onBlur: () => setTouched(Boolean(value.trim())),
      'aria-invalid': error ? true as const : undefined,
      'aria-describedby': error ? errorId : undefined,
    },
    check() {
      if (valid) return true;
      ref.current?.focus();
      setTouched(true);
      return false;
    },
  };
}
