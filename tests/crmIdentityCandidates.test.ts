import {test} from 'node:test';import assert from 'node:assert/strict';
import {identityCrossConflict} from '../src/utils/crmIdentityCandidates';
test('shared email or shared phone with several people is not a cross-contact conflict',()=>{
 for(const field of ['email','phone'])assert.equal(identityCrossConflict([{id:'A',basis:[field]},{id:'B',basis:[field]}]),false);
});
test('empty contacts do not match; disjoint phone/email targets remain protected',()=>{
 assert.equal(identityCrossConflict([]),false);
 assert.equal(identityCrossConflict([{id:'A',basis:['email']},{id:'B',basis:['phone']}]),true);
 assert.equal(identityCrossConflict([{id:'A',basis:['email','phone']},{id:'B',basis:['email']}]),false);
});
