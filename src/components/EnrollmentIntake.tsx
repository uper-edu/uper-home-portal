import type {ComponentProps} from 'react';
import {EnrollmentForm} from './EnrollmentApplication';
import {ContactPhoneInput} from './ContactPhoneInput';
import {EnrollmentDemandForm} from './EnrollmentInterests';
import {rememberVisitorContact} from '../services/rememberVisitorContact';
import * as phoneValidation from '../utils/contactPhone';

const intakeTools = {ContactPhoneInput, EnrollmentDemandForm, rememberVisitorContact, phoneValidation};
export type EnrollmentIntakeTools = typeof intakeTools;

export function EnrollmentIntake(props: Omit<ComponentProps<typeof EnrollmentForm>, 'intakeTools' | 'payment'>) {
  return <EnrollmentForm {...props} intakeTools={intakeTools}/>;
}
