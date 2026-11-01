import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultPersonalPreferences,normalizePersonalPreferences,personalNotificationAllowed,personalNotificationLanguage,personalNotificationTypes,personalNotificationRequired} from '../src/utils/personalNotificationPreferences.ts';
import {registerHooks} from 'node:module';
const hook=registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context);}});
const {PersonalNotificationPreferencesForm}=await import('../src/components/PersonalNotificationPreferencesForm.tsx');
hook.deregister();
const all=personalNotificationTypes.map(t=>t[0]);
const render=(props:any={})=>renderToStaticMarkup(React.createElement(PersonalNotificationPreferencesForm,{initial:defaultPersonalPreferences(),systemTypes:all,visibleTypes:all,deliveryEnabled:true,bound:true,isLight:true,lang:'zh',onDirty:()=>{},onBusy:()=>{},onCancel:()=>{},...props}));
test('required and operational notices cannot be disabled even by historical preferences',()=>{
 for(const type of all.filter(personalNotificationRequired)){assert.equal(personalNotificationAllowed({revision:1,language:'en',disabledTypes:[type]},type),true);}
 const p=normalizePersonalPreferences({revision:2,language:'id',disabledTypes:['handoff.requested','assessment.completed']});assert.deepEqual(p.disabledTypes,['assessment.completed']);assert.equal(personalNotificationAllowed(p,'assessment.completed'),false);assert.equal(personalNotificationLanguage(p,'en'),'id');assert.equal(personalNotificationLanguage(defaultPersonalPreferences(),'zh'),'zh');
});
test('only optional types have checkboxes; unrelated roles and unavailable types stay inline',()=>{
 const html=render({systemTypes:all.filter(k=>k!=='conversation.updated'),visibleTypes:all.filter(k=>k!=='notification.failed')});
 assert.equal((html.match(/type="checkbox"/g)||[]).length,3);assert.ok(!html.includes('通知发送异常'));assert.ok(html.includes('系统提醒'));assert.ok(html.includes('AI回复失败</span>'));assert.ok(!html.includes('账号与工作异常'));assert.ok(!html.includes('绑定成功通知'));assert.ok(html.includes('可选动态'));assert.ok(!html.includes('暂不可用'));assert.ok(html.includes('暂未开放'));assert.equal((html.match(/role="switch"/g)||[]).length,3);

 assert.ok(!html.includes('检查保存结果'));assert.match(html,/取消<\/button><button[^>]*admin-personal-save-primary/);
});
for(const props of [{deliveryEnabled:false},{bound:false},{visibleTypes:[]}])test('missing binding, delivery or role makes preferences read-only '+JSON.stringify(props),()=>{
 const html=render(props);assert.ok(!/<input type="checkbox" checked/.test(html));assert.match(html,/admin-personal-save-primary[^>]*disabled=""/);if(props.visibleTypes)assert.ok(!html.includes('通知语言'));
});
for(const lang of ['zh','en','id'])test(`fixed notification group labels render in ${lang}`,()=>{const html=render({lang});assert.ok(html.includes('crm-filter-dimension-button'));assert.ok(!html.includes('<select'));assert.ok(!html.includes('ou_'));});
