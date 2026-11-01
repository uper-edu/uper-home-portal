import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {registerHooks} from 'node:module';
const hook=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context);}});
const {AccessUserCard}=await import('../src/components/AccessRecordCard.tsx');
hook.deregister();
test('employee card shows only saved Lark status without binding identifiers',()=>{
 for(const larkBound of [true,false]){
 const html=renderToStaticMarkup(React.createElement(AccessUserCard,{name:'Maya Putri',loginId:'maya',active:true,current:false,lang:'zh',roles:[],larkBound}));
 assert.ok(html.includes(larkBound?'Lark账号已绑定':'Lark账号未绑定'));
 assert.ok(!html.includes('ou_'));assert.ok(!html.includes('查询账号'));assert.ok(!html.includes('确认绑定'));
 }
});
