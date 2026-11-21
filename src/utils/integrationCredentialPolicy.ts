export const usesDirectCredentialSetup = (kind: string) =>
  ['smtp', 'ai', 'lark-group', 'lark-app', 'ga'].includes(kind);

export const canReplaceCurrentCredential = (kind: string) => kind === 'lark-app';
