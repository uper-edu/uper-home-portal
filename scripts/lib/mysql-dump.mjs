import {createHash} from 'node:crypto';

// Parse dump boundaries without executing its directives, expressions or stored code.
export function splitSql(text){
 const statements=[];let start=0,quote='',comment='',parts=[];
 const flush=end=>{parts.push(text.slice(start,end));const sql=parts.join('').trim();if(sql)statements.push(sql);parts=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(comment){if(comment==='line'&&c==='\n'){comment='';start=i;}else if(comment==='block'&&c==='*'&&n==='/'){comment='';i++;start=i+1;}continue;}
  if(quote){if(c==='\\'&&quote!=='`'){i++;continue;}if(c===quote){if(n===quote)i++;else quote='';}continue;}
  if(c==='\''||c==='"'||c==='`'){quote=c;continue;}
  if((c==='-'&&n==='-'&&/\s/.test(text[i+2]??''))||c==='#'){parts.push(text.slice(start,i),' ');comment='line';if(c==='-')i++;continue;}
  if(c==='/'&&n==='*'){parts.push(text.slice(start,i),' ');comment='block';i++;continue;}
  if(c===';'){flush(i);start=i+1;}
 }
 if(quote||comment==='block')throw Error('Incomplete SQL literal or comment');
 if(!comment)flush(text.length);
 return statements;
}

function scalar(raw){
 const s=raw.trim();
 if(/^NULL$/i.test(s))return null;
 if(/^0x[0-9a-f]*$/i.test(s))return Buffer.from(s.slice(2),'hex');
 if(/^-?\d+(?:\.\d+)?$/.test(s)){const n=Number(s);if(!Number.isSafeInteger(n)&&!s.includes('.'))return s;return n;}
 if(s.startsWith("'")&&s.endsWith("'")){
  let out='';const inner=s.slice(1,-1),esc={'0':'\0',b:'\b',n:'\n',r:'\r',t:'\t',Z:'\x1a'};
  for(let i=0;i<inner.length;i++){
   if(inner[i]==='\\'){const next=inner[++i];out+=esc[next]??next;}
   else if(inner[i]==="'"&&inner[i+1]==="'"){out+="'";i++;}else out+=inner[i];
  }return out;
 }
 throw Error('Unsupported dump value; no SQL expressions are allowed');
}

export function parseInsert(sql){
 const m=/^INSERT\s+INTO\s+`([a-zA-Z0-9_]+)`\s*\(([^)]+)\)\s*VALUES\s*/i.exec(sql);
 if(!m)throw Error('Expected INSERT with explicit columns');
 const columns=m[2].split(',').map(x=>{const c=/^\s*`([a-zA-Z0-9_]+)`\s*$/.exec(x);if(!c)throw Error('Invalid column');return c[1];});
 const values=sql.slice(m[0].length);let quote=false,depth=0,cell='',row=[],rows=[];
 for(let i=0;i<values.length;i++){
  const c=values[i];
  if(quote){cell+=c;if(c==='\\'){cell+=values[++i]??'';}else if(c==="'"){if(values[i+1]==="'")cell+=values[++i];else quote=false;}continue;}
  if(c==="'"){quote=true;cell+=c;}else if(c==='('){if(depth)throw Error('SQL expression rejected');depth=1;row=[];cell='';}
  else if(c===')'){if(depth!==1)throw Error('Unbalanced tuple');row.push(scalar(cell));if(row.length!==columns.length)throw Error('Column/value count mismatch');rows.push(Object.fromEntries(columns.map((k,j)=>[k,row[j]])));depth=0;cell='';}
  else if(c===','&&depth){row.push(scalar(cell));cell='';}
  else if(depth)cell+=c;
  else if(c!==','&&!/\s/.test(c))throw Error('Unexpected INSERT suffix');
 }
 if(quote||depth||!rows.length)throw Error('Incomplete INSERT');
 return {table:m[1],columns,rows};
}

export function canonical(value){
 if(Buffer.isBuffer(value))return {hex:value.toString('hex')};
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function withoutForeignKeys(ddl){
 return ddl.split('\n').filter(line=>!/^\s*(?:CONSTRAINT\s+`[^`]+`\s+)?FOREIGN KEY\b/i.test(line)).join('\n').replace(/,\s*\)/g,'\n)').replace(/ AUTO_INCREMENT=\d+/g,'');
}
