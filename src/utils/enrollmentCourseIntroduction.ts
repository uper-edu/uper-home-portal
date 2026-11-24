export const enrollmentIntroductionLanguages = ['en','id','zh'] as const;
export const enrollmentIntroductionFields = ['audience','outcomes','topics','practice'] as const;
export type EnrollmentIntroductionLanguage = typeof enrollmentIntroductionLanguages[number];
export type EnrollmentIntroductionField = typeof enrollmentIntroductionFields[number];
export type EnrollmentCourseIntroduction = Partial<Record<EnrollmentIntroductionLanguage,Partial<Record<EnrollmentIntroductionField,string>>>>;

export const enrollmentIntroductionLimits = {audience: 320, outcomes: 1200, topics: 1200, practice: 1200};

export function parseEnrollmentCourseIntroduction(value:unknown):EnrollmentCourseIntroduction {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid course introduction');
  const introduction:EnrollmentCourseIntroduction={};
  for(const [locale,raw] of Object.entries(value)){
    const language=enrollmentIntroductionLanguages.find(candidate=>candidate===locale);
    if(!language||!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid course introduction');
    const translation:NonNullable<EnrollmentCourseIntroduction[typeof language]>={};
    for(const [key,text] of Object.entries(raw)){
      const field=enrollmentIntroductionFields.find(candidate=>candidate===key);
      if(!field||typeof text!=='string'||text.length>enrollmentIntroductionLimits[field])throw Error('Invalid course introduction');
      if(text.trim())translation[field]=text.trim();
    }
    if(Object.keys(translation).length)introduction[language]=translation;
  }
  return introduction;
}
