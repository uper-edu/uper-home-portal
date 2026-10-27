/** Only explicitly supplied, applicable answers may enter the questionnaire ledger. */
export const questionnaireOptions = {
  currentStatus: ['Working professional','Fresh graduate','University student','High school student','Teacher or school staff','Other'],
  goal: ['Work in China','Work at a Chinese or China-Indonesia joint venture company in Indonesia','Study in China or scholarship','Prepare for HSK certification','Improve my Mandarin skills','Other'],
  reportedLevel: ['Complete beginner','Beginner','Not sure','HSK 1','HSK 2','HSK 3','HSK 4+'],
  city: ['Jakarta','Other'], mode: ['Offline','Online','Not sure'],
  buyingSignal: ['Asked price','Asked schedule','Which level is right','None yet'],
} as const;
/** Validate supplied answers without filling omitted answers or accepting display labels. */
export function validateQuestionnaireAnswers(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(Error('Invalid questionnaire answers'),{status:400});
  for (const [field, options] of Object.entries(questionnaireOptions)) {
    if (value[field] !== undefined && (typeof value[field] !== 'string' || !(options as readonly string[]).includes(value[field])))
      throw Object.assign(Error('Invalid questionnaire option: '+field),{status:400});
  }
  for (const [field, options] of [['goals',questionnaireOptions.goal],['buyingSignals',questionnaireOptions.buyingSignal]] as const) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].length>8 || value[field].some((v:any)=>typeof v!=='string'||!(options as readonly string[]).includes(v))))
      throw Object.assign(Error('Invalid questionnaire option: '+field),{status:400});
  }
}
export function hasHskQuestionnaireGoal(goal: unknown, goals: unknown): boolean {
  return [goal, ...(Array.isArray(goals) ? goals : [])].includes('Prepare for HSK certification');
}
export function hasInapplicableExamPlan(answers: {goal?:unknown;goals?:unknown;hskExamPlan?:unknown}): boolean {
  return answers.hskExamPlan !== undefined && answers.hskExamPlan !== null && answers.hskExamPlan !== '' && !hasHskQuestionnaireGoal(answers.goal,answers.goals);
}
