import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import {
  linkedProfileEvidence,
  fieldEvidenceDetails,
  visibleProfileNeedsGroups,
  profileChangeReason,
} from "../src/utils/crmProfileEvidence";
import {
  CrmProfileSourceContent,
  CrmProfileEditor,
  CrmCurrentField,
} from "../src/components/crm/CrmProfileFields";
const event = (eventId: string, payload: any, extra = {}) => ({
  eventId,
  leadId: "arif",
  payload,
  actor: "Robert",
  recordedAt: "2026-10-26T12:00:00Z",
  ...extra,
});
test("empty needs groups are omitted, while zero, explicit clearing and conflict-only records remain available", () => {
  assert.deepEqual(
    visibleProfileNeedsGroups({ goal: " ", goals: [], concerns: [] }),
    [],
  );
  assert.deepEqual(
    visibleProfileNeedsGroups({ budgetAmount: 0 }).map((g) => g.fields),
    [["budgetAmount"]],
  );
  assert.deepEqual(
    visibleProfileNeedsGroups({
      profileFieldMeta: {
        goal: { valueState: "sourced" },
        city: { pendingDifferences: [{ value: "Bandung" }] },
      },
    }).map((g) => g.fields),
    [["goal"]],
  );
  const html = render(
    React.createElement(CrmProfileEditor, {
      lead: { id: "arif", goal: "工作交流", reportedLevel: "Beginner" },
      timezone: "Asia/Jakarta",
      isLight: true,
    }),
  );
  assert.match(html, /主要学习目标|工作交流/);
  assert.match(html, /客户自报水平/);
  assert.doesNotMatch(html, /预算与顾虑|学习安排|暂无记录/);
});
test("linked evidence traverses cycles and all explicit roots, refuses other customers, preserves original content", () => {
  const events = [
    event("change", { basisFactIds: ["ai", "wrong"] }),
    event("ai", { basisFactIds: ["change"], sourceRoot: { id: "record" } }),
    event("record", {}, { original: "原文 A" }),
    event("related", {}, { sourceRecordId: "record", original: "原文 B" }),
    event("wrong", {}, { leadId: "other", original: "不得泄漏" }),
  ];
  const before = JSON.stringify(events),
    rows = linkedProfileEvidence(events, ["change"], "arif");
  assert.deepEqual(
    rows.map((r) => r.eventId),
    ["change", "ai", "record", "related"],
  );
  assert.equal(JSON.stringify(events), before);
});
test("field focus uses only the selected original answer, exact extraction quote and saved adoption reason", () => {
  const data = [
    event("questionnaire", { answers: { city: "其他地区", goal: "旅游" } }),
    event("change", {
      changes: [
        { field: "city", before: "其他地区", after: "Bandung", applied: true },
      ],
      basisFactIds: ["ai"],
    }),
    event(
      "ai",
      {
        observations: [
          {
            kind: "field",
            field: "city",
            value: "Bandung",
            quote: "我现在住在万隆",
            decision: "apply",
            reason: "将其他地区补充为具体城市；保留原问卷与对话依据",
          },
          {
            kind: "field",
            field: "goal",
            value: "工作",
            quote: "工作学习",
            decision: "difference",
            reason: "目标冲突",
          },
        ],
      },
      { original: "我现在住在万隆，希望为了工作学习中文。" },
    ),
  ];
  const before = JSON.stringify(data),
    html = render(
      React.createElement(CrmProfileSourceContent, { data, field: "city" }),
    ),
    focus = html.split("<details")[0];
  assert.match(focus, /原始答案.*其他地区/);
  assert.match(focus, /我现在住在万隆/);
  assert.match(focus, /当次已采用/);
  assert.match(focus, /将其他地区补充/);
  assert.doesNotMatch(focus, /旅游|工作学习|目标冲突/);
  assert.match(html, /查看完整原始记录/);
  assert.doesNotMatch(html, /完整原文与关联记录|我现在住在万隆，希望为了工作学习中文。|旅游/);
  assert.equal(JSON.stringify(data), before);
  assert.equal(fieldEvidenceDetails(data, "availability").length, 0);
});
test("different records retain non-adoption cause; old sources do not acquire a fabricated reason or answer", () => {
  const data = [
    event("x", {
      changes: [
        {
          field: "goal",
          before: "工作",
          observation: "旅游",
          applied: false,
          reason: "较早或时间不明的信息，不覆盖当前值",
        },
      ],
    }),
  ];
  const html = render(
    React.createElement(CrmProfileSourceContent, { data, field: "goal" }),
  );
  assert.match(html, /当次未采用/);
  assert.match(html, /不覆盖当前值/);
  assert.equal(
    profileChangeReason({ field: "goal", applied: true }, event("old", {}), []),
    "",
  );
  const missing = render(
    React.createElement(CrmProfileSourceContent, {
      data,
      field: "availability",
    }),
  );
  assert.match(missing, /未单独保存此字段/);
  assert.doesNotMatch(missing.split("<details")[0], /当次已采用|旅游/);
});
test("field source controls identify the field and retain shared disclosure accessibility", () => {
  const lead = {
    id: "arif",
    city: "Bandung",
    profileFieldMeta: {
      city: { sourceType: "questionnaire", sourceFactIds: ["q"] },
    },
  };
  const html = render(
    React.createElement(CrmCurrentField, { lead, field: "city" }),
  );
  assert.match(html, /aria-label="查看城市的原始依据"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /role="tooltip"/);
});

test('identical answer, extracted value and exact quote appear once; empty extra evidence is omitted',()=>{
 const data=[event('single',{answers:{availability:'周六晚上'},changes:[{field:'availability',before:null,after:'周六晚上',applied:true}],observations:[{kind:'field',field:'availability',value:'周六晚上',quote:'周六晚上',decision:'apply',reason:'明确的当前信息；按来源时间和字段版本采用'}]},{original:'周六晚上'})],before=JSON.stringify(data);
 const html=render(React.createElement(CrmProfileSourceContent,{data,field:'availability'}));
 assert.equal(html.split('周六晚上').length-1,1);assert.match(html,/当次已采用/);assert.doesNotMatch(html,/按来源时间和字段版本|完整原文与关联记录|未填写.*→/);assert.equal(JSON.stringify(data),before);
});

test('old values, non-adoption causes and different independent records survive presentation deduplication',()=>{
 const data=[event('change',{changes:[{field:'city',before:'Jakarta',observation:'Bandung',applied:false,reason:'与已保存城市不同，请对照原文'}]}),event('independent',{observations:[{kind:'field',field:'city',value:'Bandung',quote:'我住在万隆',decision:'difference',reason:'来源不同，保留两条记录'}]})],before=JSON.stringify(data);
 const html=render(React.createElement(CrmProfileSourceContent,{data,field:'city'}));
 assert.match(html,/雅加达|Jakarta/);assert.match(html,/万隆|Bandung/);assert.match(html,/与已保存城市不同/);assert.match(html,/来源不同/);assert.equal((html.match(/当次未采用/g)||[]).length,2);assert.equal(JSON.stringify(data),before);
});

test('single course budget uses the common evidence control and retains conflicts',()=>{
 const lead={id:'arif',budgetAmount:1500000,profileFieldMeta:{budgetAmount:{sourceType:'ai_customer_text',effectiveAt:'2026-10-26T12:00:00Z',sourceFactIds:['budget-source'],pendingDifferences:[{value:1800000,sourceType:'sales_contact',effective:true}]}}},before=JSON.stringify(lead);
 const html=render(React.createElement(CrmCurrentField,{lead,field:'budgetAmount'}));
 assert.match(html,/课程总预算/);assert.match(html,/Rp1,500,000/);assert.match(html,/查看课程总预算的原始依据/);assert.match(html,/有不同记录/);assert.match(html,/Rp1,800,000/);assert.doesNotMatch(html,/预算来源与调整|币种|周期/);assert.equal(JSON.stringify(lead),before);
});
