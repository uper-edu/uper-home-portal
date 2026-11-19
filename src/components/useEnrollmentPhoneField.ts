import {useId, useRef, useState} from 'react';
import {CONTACT_PHONE_MAX_LENGTH, contactPhoneText, validContactPhone} from '../utils/contactPhone';

export function useEnrollmentPhoneField(language: string, value: string) {
  const [touched, setTouched] = useState(false);
  const errorId = useId();
  const ref = useRef<HTMLInputElement>(null);
  const valid = validContactPhone(value);
  const error = touched && !valid ? contactPhoneText(language).error : '';
  return {
    error,
    errorId,
    inputProps: {
      ref,
      maxLength: CONTACT_PHONE_MAX_LENGTH,
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
