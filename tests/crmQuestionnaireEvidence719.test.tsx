import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmQuestionnaireEvidence } from "../src/components/crm/CrmQuestionnaireEvidence";
import {
  CrmProgressSourceBody,
  progressSourceTiming,
} from "../src/components/crm/CrmSalesProgressHistory";
import {
  questionnaireAnswers,
  questionnaireTimes,
} from "../src/utils/crmQuestionnaireEvidence";
const answers = {
  fullName: "TEST Original Name",
  whatsapp: "+12025550199",
  email: "test@example.invalid",
  city: "Jakarta",
  currentStatus: "Working professional",
  goal: "Work in China",
  goals: ["Work in China", "Study in China"],
  reportedLevel: "Beginner",
  mode: "Online",
  buyingSignal: "Asked price",
  buyingSignals: ["Asked price", "Asked schedule"],
  campaignId: "PRIVATE-CAMPAIGN-ID",
  promotionLinkId: "PRIVATE-PROMOTION-ID",
  tier: "Hot",
  nullKey: null,
  submittedAt: "2026-10-27T09:00:00+07:00",
};
const source = {
  type: "fact",
  label: "客户问卷",
  text: JSON.stringify(answers),
  receivedAt: "2026-10-27T02:01:00Z",
};
test("719 questionnaire uses allowlist, real list arrays and deduplicated signals; original is immutable", () => {
  const before = JSON.stringify(source);
  const html = renderToStaticMarkup(
    <CrmProgressSourceBody source={source} lang="zh" />,
  );
  assert.match(html, /TEST Original Name/);
  assert.match(html, /<ul>/);
  assert.match(html, /客户提交时间（问卷上报）/);
  assert.match(html, /系统接收时间/);
  assert.doesNotMatch(
    html,
    /PRIVATE-|promotionLinkId|campaignId|buyingSignals|currentStatus|&quot;|原始JSON|实际发生时间未知/,
  );
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(questionnaireAnswers(source).buyingSignals, [
    "Asked price",
    "Asked schedule",
  ]);
});
test("719 old stage snapshots and ledger group payload use same display; unknown and malformed times are not guessed", () => {
  assert.equal(
    questionnaireTimes(source).submittedAt,
    "2026-10-27T02:00:00.000Z",
  );
  assert.equal(
    questionnaireTimes({ answers: { submittedAt: "nonsense" } }).submittedAt,
    null,
  );
  assert.equal(
    questionnaireTimes({ answers: { submittedAt: "2026-10-27 10:00:00" } })
      .submittedAt,
    null,
  );
  const group = {
    category: "questionnaire",
    root: { payload: { answers }, recordedAt: "2026-10-27T02:01:00Z" },
  };
  const html = renderToStaticMarkup(
    <CrmQuestionnaireEvidence source={group} />,
  );
  assert.match(html, /TEST Original Name/);
  assert.doesNotMatch(html, /PRIVATE-|promotionLinkId/);
  assert.doesNotMatch(progressSourceTiming(source), /实际发生时间未知/);
  assert.match(
    renderToStaticMarkup(<CrmQuestionnaireEvidence source={{}} />),
    /未记录/,
  );
});
test("719 customer messages are original text, including code-like quotations", () => {
  const text = "Customer said {keep my exact words}";
  assert.match(
    renderToStaticMarkup(
      <CrmProgressSourceBody
        source={{ type: "customer_message", text }}
        lang="zh"
      />,
    ),
    /Customer said \{keep my exact words\}/,
  );
});

test('719 known city enum uses Chinese business name',()=>{assert.match(renderToStaticMarkup(<CrmQuestionnaireEvidence source={source} lang="zh"/>),/雅加达/);});
