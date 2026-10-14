/** Native MySQL SQL with bound, reusable named parameters (:p1, :p2, ...). */
export function validateSql(sql) {
  if (
    /\$\d+|\bDISTINCT ON\b|\bpg_|\bjsonb\b|::\w|\bON CONFLICT\b|\bRETURNING\b|AT TIME ZONE|\bANY\s*\(/i.test(
      sql,
    )
  )
    throw Error("Non-MySQL SQL is forbidden");
  return sql;
}
export function bindSql(sql, values = []) {
  validateSql(sql);
  const parameters = [];
  const result = sql.replace(
    /'(?:''|[^'])*'|`[^`]*`|:p(\d+)/g,
    (token, index) => {
      if (!index) return token;
      const position = Number(index) - 1;
      if (position >= values.length) throw Error("Missing query parameter");
      const value = values[position],
        array = Array.isArray(value) ? value : [value];
      if (!array.length) return "NULL";
      for (const item of array)
        parameters.push(
          item === undefined
            ? null
            : item !== null &&
                typeof item === "object" &&
                !(item instanceof Date)
              ? JSON.stringify(item)
              : item,
        );
      return array.map(() => "?").join(",");
    },
  );
  return { sql: result, parameters };
}
