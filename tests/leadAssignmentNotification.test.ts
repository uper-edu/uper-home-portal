import test from 'node:test';
import assert from 'node:assert/strict';
import { changeLeadOwner, ownerReceiptSql } from '../server/portal/ownerAssignment.ts';
import { defaultRules, validate } from '../server/portal/policy.ts';
import { resolveRecipients, standardLarkCard } from '../server/portal/notificationDelivery.ts';
import { inboxTarget } from '../server/portal/inappInbox.ts';
import { assignmentNoticeTargets, currentAssignmentRecipient, LEAD_ASSIGNED_EVENT } from '../src/utils/leadAssignmentNotification.ts';
import { inappNoticeTitle } from '../src/utils/inappNotifications.ts';
import type { Employee } from '../server/portal/identity.ts';

const manager: Employee = {
  id: 'manager', active: true, scope: 'all', teams: ['sales'],
  roles: ['crm_leader'], permissions: ['crm.read', 'crm.assign'],
};
function salesperson(id: string): Employee {
  return {
    id, active: true, scope: 'own', teams: ['sales'],
    roles: ['sales'], permissions: ['crm.read', 'crm.followup', 'crm.own'],
    grants: { 'crm.read': ['own'], 'crm.followup': ['own'] },
  };
}
const newOwner = salesperson('sales-new');
const priorOwner = salesperson('sales-prior');
const rule = defaultRules.find(rule => rule.event === LEAD_ASSIGNED_EVENT)!;

test('manual assignment and transfer record one private event tied to the saved ownership fact', async () => {
  for (const previous of [null, priorOwner.id]) {
    let saved: any;
    const facts: any[][] = [], events: any[][] = [];
    const db = { async query(sql: string, args: any[]) {
      if (sql === ownerReceiptSql) return { rows: saved ? [{ data: saved }] : [] };
      if (sql.startsWith('INSERT INTO portal_audit')) saved = args[2];
      return { rows: [] };
    }};
    const current = { id: 'lead-synthetic', owner: previous, ownerChangedAt: null };
    const input = {
      actor: manager, current,
      body: {
        owner: newOwner.id, expectedOwner: previous, expectedOwnerChangedAt: null,
        ownerChangeReason: previous ? 'Test handover' : '', ownerChangeRequestId: 'TEST-ASSIGNMENT',
      },
      directory: [manager, newOwner, priorOwner],
      fact: async (...args: any[]) => { facts.push(args); },
      event: async (...args: any[]) => { events.push(args); },
    };
    const first = await changeLeadOwner(db, input);
    assert.deepEqual((await changeLeadOwner(db, { ...input, current: first.lead })).receipt, first.receipt);
    assert.equal(facts.length, 1);
    assert.equal(events.length, 1);
    const [[, event, leadId, payload]] = events;
    assert.equal(event, LEAD_ASSIGNED_EVENT);
    assert.equal(leadId, current.id);
    assert.equal(payload.factId, facts[0][5]);
    assert.equal(currentAssignmentRecipient(first.lead, payload), newOwner.id);
    assert.equal(currentAssignmentRecipient({ ...first.lead, owner: priorOwner.id }, payload), undefined);
    assert.equal(currentAssignmentRecipient({ ...first.lead, ownerChangedAt: '2030-01-01T00:00:00Z' }, payload), undefined);
    assert.deepEqual(inboxTarget({ event, payload }), { kind: 'fact', id: payload.factId });
    const card = standardLarkCard({ kind: event, language: 'zh', name: '模拟客户', target: inboxTarget({ event, payload }) }, leadId, undefined, new Date());
    const button = card.card.elements[1].actions[0];
    const url = new URL(button.url);
    assert.equal(button.text.content, '查看分配记录');
    assert.equal(url.searchParams.get('lead'), current.id);
    assert.equal(url.searchParams.get('leadView'), 'activities');
    assert.equal(url.searchParams.get('targetId'), payload.factId);
    assert.match(card.card.header.title.content, /客户已分配/);
  }
});

test('assignment routing never falls back to former owner, manager or group', () => {
  assert.deepEqual(rule.channels, ['inapp', 'lark_personal']);
  assert.doesNotThrow(() => validate(rule));
  assert.throws(() => validate({ ...rule, group: 'sales' }), /only for the new owner/);
  assert.throws(() => validate({ ...rule, recipient: 'managers' }), /only for the new owner/);
  const lead = { owner: newOwner.id };
  const route = (employee: Employee) => resolveRecipients(rule, lead, [manager, priorOwner, employee], 'lead-synthetic').ids;
  const [owner] = route(newOwner);
  assert.equal(owner, newOwner.id);
  assert.deepEqual(assignmentNoticeTargets('inapp', owner, false), [newOwner.id]);
  assert.deepEqual(assignmentNoticeTargets('lark', owner, true), ['personal:' + newOwner.id]);
  assert.deepEqual(assignmentNoticeTargets('lark', owner, false), []);
  assert.deepEqual(assignmentNoticeTargets('inapp', undefined, false), []);
  assert.deepEqual(assignmentNoticeTargets('lark', undefined, true), []);
  assert.deepEqual(route({ ...newOwner, active: false }), []);
  assert.deepEqual(route({ ...newOwner, permissions: ['crm.read', 'crm.own'] }), []);
  assert.deepEqual(resolveRecipients(rule, {}, [manager]).ids, []);
  assert.deepEqual(['zh', 'en', 'id'].map((lang: 'zh'|'en'|'id') => inappNoticeTitle(LEAD_ASSIGNED_EVENT, lang)),
    ['客户已分配', 'Customer assigned', 'Pelanggan ditugaskan']);
});
