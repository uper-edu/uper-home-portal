import assert from 'node:assert/strict';
import test from 'node:test';
import {crmSaveFailureKind} from '../src/utils/crmOperationResult.ts';

test('CRM preserves distinct failure decisions for writes and receipt reads',()=>{
  for(const status of [400,403,404,409]){
    assert.equal(crmSaveFailureKind(status,false),'rejected');
    assert.equal(crmSaveFailureKind(status,true),status===404?'receipt_missing':'unknown');
  }
  for(const checkingReceipt of [false,true]){
    assert.equal(crmSaveFailureKind(503,checkingReceipt),'unknown');
  }
});
