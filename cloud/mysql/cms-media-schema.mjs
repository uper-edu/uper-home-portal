export async function verifyCmsMediaSchema(connection){
 const [columns]=await connection.query('SHOW FULL COLUMNS FROM cms_media');
 const expected={content:['mediumblob','YES'],storage_type:['varchar(16)','NO'],cos_url:['varchar(1024)','YES'],object_key:['varchar(255)','YES'],byte_size:['bigint unsigned','YES']};
 for(const [name,[type,nullable]] of Object.entries(expected)){
  const column=columns.find(row=>row.Field===name);
  if(!column||column.Type.toLowerCase()!==type||column.Null!==nullable)throw Error('CMS COS schema mismatch: '+name);
 }
 const [indexes]=await connection.query('SHOW INDEX FROM cms_media');
 if(!indexes.some(row=>row.Key_name==='idx_cms_media_storage'&&row.Column_name==='storage_type'&&Number(row.Seq_in_index)===1))throw Error('CMS COS storage index missing');
}
