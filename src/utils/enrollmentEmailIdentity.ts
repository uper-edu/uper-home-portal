export function maskEnrollmentEmail(email: string) {
  const [local,domain]=email.split('@');
  return local.slice(0,1)+'•••@'+domain;
}
