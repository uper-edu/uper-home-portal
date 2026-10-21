import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CrmSaveFeedback} from '../src/components/crm/CrmDetailWorkspace';
test('draft feedback uses the chosen interface language',()=>{
 for(const [lang,label] of [['en','Unsaved changes'],['zh','有未保存修改'],['id','Perubahan belum disimpan']] as const){
  const html=renderToStaticMarkup(React.createElement(CrmSaveFeedback,{lang,state:"dirty"}));
  assert.ok(html.includes(label),html);
 }
});
