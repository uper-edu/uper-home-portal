import assert from 'node:assert/strict';
import test from 'node:test';
import {enrollmentPhoneDisplay} from '../src/utils/enrollmentInterests';

test('an enrollment contact displays only the dialing code and final four digits',()=>{
  assert.equal(enrollmentPhoneDisplay('0812 3456 7890'),'+62 •••• 7890');
  assert.equal(enrollmentPhoneDisplay('+1 (604) 555-0123'),'+1 •••• 0123');
  assert.equal(enrollmentPhoneDisplay('999-1234'),'•••• 1234');
  for(const unavailable of [undefined,null,'','bad number 7890','1234']){
    assert.equal(enrollmentPhoneDisplay(unavailable),undefined);
  }
});
