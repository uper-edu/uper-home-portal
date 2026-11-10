export function larkTestDeliveryRestriction(
  env: NodeJS.ProcessEnv,
  recipient: string,
  personalEmployee: string | null,
): 'group' | 'personal' | undefined {
  const restricted = env.PORTAL_DEPLOYMENT === 'company-trial'
    || env.PLATFORM_MODE === 'mock'
    || env.APP_ENV === 'test'
    || env.NODE_ENV !== 'production';
  if (!restricted) return;

  if (personalEmployee !== null) {
    const allowedEmployees = (env.LARK_TEST_PERSONAL_EMPLOYEE_IDS || '').split(',').map(id => id.trim());
    if (!personalEmployee || !allowedEmployees.includes(personalEmployee)) return 'personal';
    return;
  }

  if (!recipient || recipient !== env.LARK_TEST_GROUP) return 'group';
}
