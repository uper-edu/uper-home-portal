import './helpers/mockPortalDatabase.mjs';

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {chatCourseContentReply,normalizeChatCourseContent} from '../server/portal/chatCourseContent.ts';
import {parseEnrollmentCourseIntroduction} from '../src/utils/enrollmentCourseIntroduction.ts';

function intro(level:number){
  return parseEnrollmentCourseIntroduction(JSON.parse(readFileSync(new URL(
    `../src/data/system-defaults/hsk${level}-course-introduction.json`,import.meta.url,
  ),'utf8')));
}

function request(value:unknown){
  const parsed=normalizeChatCourseContent(value);
  assert.ok(parsed);
  return parsed;
}

test('course content answers the selected fields in the response language, without requiring a published class',async()=>{
  const client={query:async(sql:string,args:unknown[])=>{
    assert.match(sql,/FROM crm_courses/);
    assert.match(sql,/JSON_EXTRACT\(value,'\$\.active'\)=true/);
    assert.deepEqual(args,[['HSK 2']]);
    return {rows:[{level:'HSK 2',introduction:intro(2)}]};
  }};
  const scope=request({scope:'level',levels:['HSK 2','HSK 2'],fields:['practice','practice','unrecognized']});
  for(const [lang,heading] of [['zh','怎么学、怎么练'],['id','Cara belajar dan berlatih'],['en','How you’ll practise']] as const){
    const reply=await chatCourseContentReply(client,scope,lang);
    assert.ok(reply.includes(heading));
    assert.ok(reply.includes(intro(2)[lang]!.practice!.split('\n').at(-1)!));
    assert.doesNotMatch(reply,/适合谁|What you’ll study|Cocok untuk siapa/);
  }
});

test('an HSK 4 part uses its own topics and common practice resources, and mixed requests retain order',async()=>{
  const client={query:async(_sql:string,args:unknown[])=>{
    assert.deepEqual(args,[['HSK 4','HSK 1']]);
    return {rows:[{level:'HSK 1',introduction:intro(1)},{level:'HSK 4',introduction:intro(4)}]};
  }};
  const reply=await chatCourseContentReply(client,request({
    scope:'level',levels:['HSK 4B','HSK 1','HSK 5'],fields:['topics','practice'],
  }),'en');
  const part=reply.split('### HSK 1')[0];
  assert.match(part,/^### HSK 4B/);
  assert.doesNotMatch(part,/HSK 4A/);
  assert.ok(part.includes(intro(4).en!.stages!['4B']!.topics!.split('\n')[0]));
  assert.match(part,/Class recordings/);
  assert.match(reply,/### HSK 5\n\nThis part of the course overview is currently unavailable/);
});

test('class references are limited to known IDs and load the currently linked published course',async()=>{
  const query=async(sql:string,args:unknown[])=>{
    assert.match(sql,/JOIN crm_courses c ON c.id=e.course_id/);
    assert.match(sql,/e.state='published'/);
    assert.deepEqual(args,[1,['current-class'],0,0]);
    return {rows:[{id:'current-class',data:{level:'HSK 3'},teaching:{level:'HSK 3',introduction:intro(3)},opened:0,seats:null}]};
  };
  const current=await chatCourseContentReply({query},request({scope:'class',fields:['outcomes']}),'zh',{openedClassId:'current-class'});
  assert.match(current,/HSK 3/);
  assert.ok(current.includes(intro(3).zh!.outcomes!.split('\n')[0]));
  const blocked=await chatCourseContentReply({query:async()=>assert.fail('An unrelated class must not be queried')},
    request({scope:'class',referenceIds:['unrelated-class'],fields:['outcomes']}),'zh',{openedClassId:'current-class'});
  assert.match(blocked,/无法核实/);
});

test('ambiguous levels prompt for clarification and missing translations are not filled with another course',async()=>{
  const missing=await chatCourseContentReply({query:async()=>assert.fail('No level is known')},
    request({scope:'level',levels:[],fields:['audience']}),'id');
  assert.match(missing,/level berapa/);
  const reply=await chatCourseContentReply({query:async()=>({rows:[{level:'HSK 1',introduction:{en:{audience:'English only'}}}]})},
    request({scope:'level',levels:['HSK 1'],fields:['audience']}),'id');
  assert.match(reply,/belum tersedia/);
  assert.doesNotMatch(reply,/English only/);
});

test('HSK 4 overview includes both stages and does not repeat their common resources',async()=>{
  const query=async()=>({rows:[{level:'HSK 4',introduction:intro(4)}]});
  const reply=await chatCourseContentReply({query},request({scope:'level',levels:['HSK 4'],fields:['practice']}),'en');
  assert.match(reply,/### HSK 4A/);
  assert.match(reply,/### HSK 4B/);
  assert.equal(reply.match(/Class recordings/g)?.length,1);
});
