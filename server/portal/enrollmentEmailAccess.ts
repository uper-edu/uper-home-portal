type Client = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

export async function lockEnrollmentEmail(c: Client, email: string) {
  await c.query('SELECT GET_LOCK(:p1,5)', ['enrollment-email:' + email]);
}
