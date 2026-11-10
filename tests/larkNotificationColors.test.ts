import test from 'node:test';import assert from 'node:assert/strict';
import {larkNotificationColor} from '../src/utils/larkNotificationColors';
import {standardLarkCard,dailyDigestCard,larkCard} from '../server/portal/notificationDelivery';
import {standardLarkKinds} from '../src/utils/larkNotificationPresentation';
test('all event headers use semantic categories independently of language, grade and conversion',()=>{
 const expected:Record<string,string>={'commitment.due':'blue','lead.created':'blue','lead.assigned':'blue','conversation.reactivated':'blue','handoff.requested':'blue','booking.requested':'blue','enrollment.requested':'blue','assessment.completed':'turquoise','task.overdue':'orange','ai.failed':'red','notification.failed':'red'};
 for(const language of ['zh','en','id'] as const)for(const kind of standardLarkKinds){const card=standardLarkCard({kind,language,name:'Maya',score:0,maxScore:100},'lead-a',undefined,new Date());assert.equal(card.card.header.template,expected[kind]);assert.ok(card.card.header.title.content);assert.equal(card.card.elements[1].actions[0].tag,'button');}
 for(const language of ['zh','en','id'] as const)assert.equal(dailyDigestCard({language,date:'2030-01-06',counts:[]},undefined,new Date()).card.header.template,'grey');
 assert.equal(larkNotificationColor('unknown').template,'blue');
 for(const kind of ['commitment.due','task.appointment_due'])assert.equal(larkCard('text','a',undefined,new Date(),undefined,kind).card.header.template,'blue');
 assert.equal(larkNotificationColor('assessment.completed').foreground,'var(--admin-quote)');
});

test('unknown delivery stays amber and explicitly unconfirmed, never a definite red failure',()=>{for(const language of ['zh','en','id'] as const){const c=standardLarkCard({kind:'notification.failed',language,name:'',failure:'delivery_unknown'},undefined,undefined,new Date());assert.equal(c.card.header.template,'orange');assert.notEqual(c.card.header.title.content,standardLarkCard({kind:'notification.failed',language,name:'',failure:'delivery_failed'},undefined,undefined,new Date()).card.header.title.content);}});
