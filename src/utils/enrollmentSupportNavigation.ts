import type {InterestLanguage} from './enrollmentInterestCopy';

export type EnrollmentSupportTopic = 'consultation' | 'account' | 'payment' | 'refund' | 'one-on-one' | 'advisor';

export function enrollmentSupportPath(topic: EnrollmentSupportTopic, language: InterestLanguage) {
  return '/enrollment/help/'+topic+'?lang='+language;
}
