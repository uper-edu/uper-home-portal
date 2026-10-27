/** Only explicitly supplied, applicable answers may enter the questionnaire ledger. */
export function hasHskQuestionnaireGoal(goal: unknown, goals: unknown): boolean {
  return [goal, ...(Array.isArray(goals) ? goals : [])].includes('Prepare for HSK certification');
}
export function hasInapplicableExamPlan(answers: {goal?:unknown;goals?:unknown;hskExamPlan?:unknown}): boolean {
  return answers.hskExamPlan !== undefined && answers.hskExamPlan !== null && answers.hskExamPlan !== '' && !hasHskQuestionnaireGoal(answers.goal,answers.goals);
}
