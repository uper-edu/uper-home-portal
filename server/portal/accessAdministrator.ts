export const administratorPermissions = [
  "access.read",
  "access.users",
  "access.roles",
  "access.sessions",
  "access.audit",
];
export const fullAdministrator = (e: any) =>
  !!e?.active &&
  administratorPermissions.every((p) => e.permissions.includes(p));
