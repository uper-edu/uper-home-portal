import test from 'node:test';import assert from 'node:assert/strict';
import {containsRemovedProfileMetadata,removeRetiredProfileMetadata} from '../server/portal/removedProfileMetadata';
test('removed metadata is detected in requests, stored profiles and operation snapshots',()=>{
 for(const value of [{nameNote:'retired'},{expectedNameNote:''},{result:{lead:{nameNote:'retired'}}},{changes:[{field:'nameNote',before:'a',after:'b'}]}])assert.equal(containsRemovedProfileMetadata(value),true);
 assert.equal(containsRemovedProfileMetadata({fullName:'Maya Putri',summary:'客户原文提到了nameNote字符串'}),false);
});
test('purge removes only retired metadata, preserves unrelated values and does not mutate input',()=>{
 const value={fullName:'Maya Putri',tier:'Hot',owner:'Sales',nameNote:'retired',changes:[{field:'city',before:'Other',after:'Bandung'},{field:'nameNote',before:'a',after:'b'}],audit:{expectedNameNote:'old',reason:'真实说明'},text:'原文中名字备注几个字保持原样'};
 const before=JSON.stringify(value),clean=removeRetiredProfileMetadata(value);
 assert.deepEqual(clean,{fullName:'Maya Putri',tier:'Hot',owner:'Sales',changes:[{field:'city',before:'Other',after:'Bandung'}],audit:{reason:'真实说明'},text:'原文中名字备注几个字保持原样'});
 assert.equal(containsRemovedProfileMetadata(clean),false);assert.equal(JSON.stringify(value),before);
});
