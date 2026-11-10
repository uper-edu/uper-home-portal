export function larkTestGroupDisallowed(env: NodeJS.ProcessEnv, recipient: string): boolean {
  const restricted = env.PORTAL_DEPLOYMENT === 'company-trial'
    || env.PLATFORM_MODE === 'mock'
    || env.APP_ENV === 'test'
    || env.NODE_ENV !== 'production';
  return restricted && (!recipient || recipient !== env.LARK_TEST_GROUP);
}
