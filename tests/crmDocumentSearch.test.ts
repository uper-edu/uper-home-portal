import test from 'node:test';import assert from 'node:assert/strict';
import {documentSearchExcerpt} from '../src/utils/crmDocumentSearch';
test('search context retains exact source wording, strips HTML and surrounds an internal match',()=>{
 const text='<p>'+ '前文'.repeat(50)+' tasks.ownerId 责任员工引用，空值表示未分配'+ '后文'.repeat(50)+'</p>';
 const result=documentSearchExcerpt(text,'OWNERID',20);assert.ok(result.includes('tasks.ownerId 责任员工引用'));assert.ok(result.startsWith('…')&&result.endsWith('…'));assert.ok(!result.includes('<p>'));
});
test('no match produces no fabricated snippet; Chinese and Indonesian keep their source text',()=>{
 assert.equal(documentSearchExcerpt('Exact original','absent'),'');assert.equal(documentSearchExcerpt('客户约定保留原文','约定'),'客户约定保留原文');assert.equal(documentSearchExcerpt('Jadwal pelanggan disepakati','pelanggan'),'Jadwal pelanggan disepakati');
});

import{followupReadingParagraphs}from'../src/utils/crmDocumentSearch';import{guideLessons}from'../src/components/crm/CrmGuideLearning';
test('editorial paragraph breaks preserve complete original instructions in every language',()=>{for(let col=0;col<3;col++){const original=guideLessons.followup.value[col];const parts=followupReadingParagraphs(original,col);assert.equal(parts.length,5);assert.equal(parts.join(''),original);}});
