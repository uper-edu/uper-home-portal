import {transaction} from './database.mjs';
import {cmsMediaUrl,mediaDigest} from './cms-media-storage.mjs';

const auditSql="SELECT data FROM portal_audit WHERE actor=? AND action='cms.upload' AND data->>'$.requestId'=?";
function completedResponse(row,inputHash){
 const data=typeof row.data==='string'?JSON.parse(row.data):row.data;
 if(data.inputHash!==inputHash)throw Object.assign(Error('Request ID conflict'),{status:409});
 return data.response;
}
export async function uploadCmsMedia(db,storage,{actor,key,inputHash,content}){
 const [completed]=await db.execute(auditSql,[actor,key]);
 if(completed[0])return completedResponse(completed[0],inputHash);
 const hash=mediaDigest(content),uploaded=await storage.upload(content);
 if(uploaded.digest!==hash||uploaded.url!==cmsMediaUrl(hash)||uploaded.objectKey!=='cms/'+hash+'.webp'||uploaded.size!==content.length)throw Error('Media storage verification failed');
 return transaction(db,async c=>{
  await c.execute('SELECT id FROM crm_users WHERE id=? FOR UPDATE',[actor]);
  const [old]=await c.execute(auditSql,[actor,key]);
  if(old[0])return completedResponse(old[0],inputHash);
  await c.execute("INSERT INTO cms_media(id,mime,content,uploaded_by,storage_type,cos_url,object_key,byte_size) VALUES(?,'image/webp',NULL,?,'cos',?,?,?) ON DUPLICATE KEY UPDATE storage_type='cos',cos_url=VALUES(cos_url),object_key=VALUES(object_key),byte_size=VALUES(byte_size)",[hash,actor,uploaded.url,uploaded.objectKey,content.length]);
  const response={success:true,url:uploaded.url,digest:hash,mime:'image/webp',size:content.length};
  await c.execute("INSERT INTO portal_audit(actor,action,data) VALUES(?,'cms.upload',?)",[actor,JSON.stringify({requestId:key,inputHash,response})]);
  return response;
 });
}
