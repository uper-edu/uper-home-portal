export const paymentAnalyticsSchemaVersion = 20;

export async function verifyPaymentAnalyticsSchema(connection, version = paymentAnalyticsSchemaVersion) {
  const [ddl] = await connection.query('SHOW CREATE TABLE crm_payment_analytics');
  const definition = ddl[0]?.['Create Table'];
  if (!definition || !/\bENGINE=InnoDB\b/i.test(definition) || /\bFOREIGN KEY\b/i.test(definition))
    throw Error('Payment analytics requires InnoDB and application-managed relations');
  const [columns] = await connection.query('SHOW FULL COLUMNS FROM crm_payment_analytics');
  const expected = {
    id: 'char(64)', environment: "enum('dev','test','prod')", project_id: 'varchar(191)',
    source_entry_id: 'char(36)', kind: "enum('purchase','refund')", sequence_no: 'int unsigned',
    amount: 'bigint unsigned', course_id: 'varchar(191)', state: "enum('held','cancelled')",
    created_at: 'datetime(6)',
  };
  for (const [name, type] of Object.entries(expected)) {
    const column = columns.find(row => row.Field === name);
    if (!column || column.Type.toLowerCase() !== type || column.Null !== 'NO')
      throw Error('Payment analytics schema mismatch: ' + name);
    if ((name === 'state' && column.Default !== 'held') ||
        (name === 'created_at' && String(column.Default).toLowerCase() !== 'current_timestamp(6)'))
      throw Error('Payment analytics default mismatch: ' + name);
  }
  for (const [name,type] of [
    ['attempted_at','datetime(6)'],
    ['dispatch_state',"enum('sending','accepted','rejected','unknown','blocked')"],
  ]) {
    const column = columns.find(row => row.Field === name);
    if (version >= 20 ? !column || column.Type.toLowerCase() !== type || column.Null !== 'YES' || column.Default !== null : column)
      throw Error('Payment analytics schema mismatch: ' + name);
  }
  const [indexes] = await connection.query('SHOW INDEX FROM crm_payment_analytics');
  const required = [
    ['PRIMARY', 0, ['id']],
    ['payment_analytics_order', 0, ['environment', 'project_id', 'sequence_no']],
    ['payment_analytics_queue', 1, ['environment', 'state', 'created_at']],
  ];
  if (version >= 20) required.push(['payment_analytics_dispatch', 1, ['environment', 'dispatch_state', 'created_at']]);
  for (const [key, nonUnique, names] of required) {
    const actual = indexes.filter(row => row.Key_name === key).sort((a,b) => a.Seq_in_index-b.Seq_in_index);
    if (actual.length !== names.length || actual.some((row,i) =>
      Number(row.Non_unique) !== nonUnique || row.Column_name !== names[i] ||
      Number(row.Seq_in_index) !== i+1 || row.Sub_part != null))
      throw Error('Payment analytics index mismatch: ' + key);
  }
}
