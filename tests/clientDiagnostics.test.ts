import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {classifyClientFailure,diagnosticFrames,sanitizeClientDiagnostic,clientFailureText} from '../src/utils/clientDiagnostics';
import {ApplicationErrorNotice} from '../src/components/ApplicationErrorBoundary';
import GFormOnboardingModal from '../src/components/GFormOnboardingModal';
import {mountClientDiagnostics} from '../server/clientDiagnostics';
const id='12345678-1234-4234-8234-123456789012';
const input={schema:1,id,kind:'dom-interference',source:'react',errorName:'NotFoundError',route:'/chat',buildId:'test-build',frames:['index-abcd1234.js:33:42','GFormOnboardingModal']};
test('DOM translation interference, chunk load, network and generic runtime errors stay distinct',()=>{
 for(const method of ['insertBefore','removeChild'])assert.equal(classifyClientFailure({name:'NotFoundError',message:`Failed to execute '${method}' on 'Node'`}), 'dom-interference');
 assert.equal(classifyClientFailure(new TypeError('Failed to fetch dynamically imported module: /assets/old.js')),'module-load');
 assert.equal(classifyClientFailure(new Error('anything'),'preload'),'module-load');
 assert.equal(classifyClientFailure(new TypeError('Failed to fetch')),'network');
 assert.equal(classifyClientFailure(new Error('User supplied text')),'runtime');
 assert.equal(classifyClientFailure(new Error('insertBefore is a string in an ordinary message')),'runtime');
});
test('diagnostics strip messages, personal fields, queries, full URLs and free-form stack text',()=>{
 const value=sanitizeClientDiagnostic({...input,message:'maya@example.com +6281212345678',email:'maya@example.com',answers:{name:'Maya'},route:'/chat?email=maya@example.com',stack:'private message',frames:['https://site.test/assets/app.js?token=private','maya@example.com','index-abcd1234.js:33:42']})!;
 assert.equal(value.route,'/other');assert.deepEqual(value.frames,['index-abcd1234.js:33:42']);assert.doesNotMatch(JSON.stringify(value),/maya|62812|token|answers|private/);
 assert.deepEqual(diagnosticFrames('Error: maya@example.com\n    at GFormOnboardingModal (http://localhost:3000/assets/chat-abc12345.js:12:3)\n    at section\n    at invalid /?token=private'),['chat-abc12345.js:12:3','section','invalid']);
 assert.equal(sanitizeClientDiagnostic({...input,kind:'customer-message'}),null);assert.equal(sanitizeClientDiagnostic({...input,id:'maya@example.com'}),null);
 assert.equal(sanitizeClientDiagnostic({...input,errorName:{toString:null}})?.errorName,'Error');
});
function endpoint(){let handler:any;const writes:any[]=[];mountClientDiagnostics({post:(path:string,fn:any)=>{assert.equal(path,'/api/client-diagnostics');handler=fn;}} as any,d=>writes.push(d));return {writes,call:(body:any)=>{let status=200;const response:any={status:(n:number)=>{status=n;return response;},json:()=>response,end:()=>response};handler({body},response);return status;}};}
test('diagnostic receiver only accepts structured records and limits output without touching business storage',()=>{
 const h=endpoint();assert.equal(h.call(input),204);assert.equal(h.writes.length,1);assert.deepEqual(h.writes[0],input);assert.equal(h.call({message:'raw error'}),400);
 for(let i=0;i<18;i++)assert.equal(h.call(input),204);assert.equal(h.call(input),429);assert.equal(h.writes.length,19);
});
test('all error categories have localized notices, reload warning and reference but no raw error text',()=>{
 for(const language of ['zh','en','id'])for(const error of [Object.assign(new Error("Failed to execute 'insertBefore' on 'Node'"),{name:'NotFoundError'}),new Error('Failed to fetch dynamically imported module'),new TypeError('Failed to fetch'),new Error('private-questionnaire-answer')]){
  const html=renderToStaticMarkup(React.createElement(ApplicationErrorNotice,{error,reference:id,language}));assert.match(html,/translate="no"/);assert.match(html,/role="alert"/);assert.match(html,/12345678/);assert.doesNotMatch(html,/private-questionnaire-answer|module sync issue/);assert(clientFailureText(classifyClientFailure(error),language).confirm);
 }
});
test('the whole interactive questionnaire is protected from browser translation while retaining three built-in languages',()=>{
 for(const initialLang of ['en','id','zh'] as const){const html=renderToStaticMarkup(React.createElement(GFormOnboardingModal,{isOpen:true,onComplete:()=>{},initialLang}));assert.match(html,/translate="no"/);assert.match(html,/notranslate/);assert.match(html,/lang="(?:en|id|zh-CN)"/);assert.match(html,/>EN</);assert.match(html,/>ID</);assert.match(html,/>中文</);assert.match(html,/required/);}
});
