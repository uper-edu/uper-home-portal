import mysql from 'mysql2/promise';
/** Call only after this test's servers and pools close; never touch shared business schemas. */
export async function disposeNativeTest(fixture, {restore = false} = {}) {
  const url = new URL(process.env.MYSQL_TRIAL_URL);
  const name = decodeURIComponent(url.pathname.slice(1));
  const user = decodeURIComponent(url.username);
  if (fixture.socket !== '/private/tmp/uper-mysql-native-cleanup.sock' || name !== fixture.name || !/^uper_trial_native_[a-z0-9_]+$/.test(name) || !/^native_[a-f0-9]{12}$/.test(user)) throw Error('Unexpected test cleanup scope');
  const admin = await mysql.createConnection({user:'root',socketPath:fixture.socket});
  try {
    for (const schema of restore ? [name + '_restore', name] : [name]) await admin.query('DROP DATABASE IF EXISTS `' + schema + '`');
    await admin.query('DROP USER IF EXISTS ' + mysql.escape(user) + '@localhost');
    const [schemas] = await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?,?)',[name,name+'_restore']);
    const [users] = await admin.query('SELECT User FROM mysql.user WHERE User=?',[user]);
    if(schemas.length||users.length) throw Error('Test cleanup incomplete');
  } finally {await admin.end();}
}
