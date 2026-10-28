import test from 'node:test';import assert from 'node:assert/strict';import{chatLanguage}from'../src/utils/chatLanguage';
test('explicit supported chat language overrides saved language; invalid queries cannot select arbitrary language',()=>{
 for(const lang of ['en','id','zh'] as const){assert.equal(chatLanguage('en','?c=TEST&lang='+lang),lang);assert.equal(chatLanguage(lang,''),lang);assert.equal(chatLanguage(lang,'?lang=invalid'),lang);}assert.equal(chatLanguage(undefined,''),'en');assert.equal(chatLanguage('unknown','?lang=<script>'),'en');
});
