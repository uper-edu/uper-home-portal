export const enrollmentIntroductionLanguages = ['en','id','zh'] as const;
export const enrollmentIntroductionFields = ['audience','outcomes','topics','practice'] as const;
export const enrollmentIntroductionStages = ['4A','4B'] as const;
export type EnrollmentIntroductionLanguage = typeof enrollmentIntroductionLanguages[number];
export type EnrollmentIntroductionField = typeof enrollmentIntroductionFields[number];
export type EnrollmentIntroductionStage = typeof enrollmentIntroductionStages[number];
export type EnrollmentIntroductionContent = Partial<Record<EnrollmentIntroductionField,string>>;
type EnrollmentIntroductionTranslation = EnrollmentIntroductionContent & {
  stages?: Partial<Record<EnrollmentIntroductionStage,EnrollmentIntroductionContent>>;
};
export type EnrollmentCourseIntroduction = Partial<Record<EnrollmentIntroductionLanguage,EnrollmentIntroductionTranslation>>;

export const enrollmentIntroductionLimits = {audience: 320, outcomes: 1200, topics: 1200, practice: 1200};

function entries(value:unknown) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid course introduction');
  return Object.entries(value);
}

function parseContent(fields:[string,unknown][]):EnrollmentIntroductionContent {
  const content:EnrollmentIntroductionContent={};
  for(const [key,text] of fields){
    const field=enrollmentIntroductionFields.find(candidate=>candidate===key);
    if(!field||typeof text!=='string'||text.length>enrollmentIntroductionLimits[field])throw Error('Invalid course introduction');
    if(text.trim())content[field]=text.trim();
  }
  return content;
}

export function parseEnrollmentCourseIntroduction(value:unknown):EnrollmentCourseIntroduction {
  const introduction:EnrollmentCourseIntroduction={};
  for(const [locale,raw] of entries(value)){
    const language=enrollmentIntroductionLanguages.find(candidate=>candidate===locale);
    if(!language)throw Error('Invalid course introduction');
    const fields=entries(raw);
    const translation:EnrollmentIntroductionTranslation=parseContent(fields.filter(([key])=>key!=='stages'));
    const stageField=fields.find(([key])=>key==='stages');
    if(stageField){
      const stages:NonNullable<EnrollmentIntroductionTranslation['stages']>={};
      for(const [key,stageContent] of entries(stageField[1])){
        const stage=enrollmentIntroductionStages.find(candidate=>candidate===key);
        if(!stage)throw Error('Invalid course introduction');
        const content=parseContent(entries(stageContent));
        if(Object.keys(content).length)stages[stage]=content;
      }
      if(Object.keys(stages).length)translation.stages=stages;
    }
    if(Object.keys(translation).length)introduction[language]=translation;
  }
  return introduction;
}
