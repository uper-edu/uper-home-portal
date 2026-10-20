import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { workTimeErrors, policyMessage, policySaveResponseError } from "../src/utils/crmPolicyValidation.ts";
import { CrmPolicySettings } from "../src/components/crm/CrmPolicySettings.tsx";
import { DEFAULT_CRM_POLICY_CONFIG } from "../src/types/crmPolicyConfig.ts";

test("same-day policy hours reject reverse, equal, missing and malformed input without treating empty as a default", () => {
  for (const [startTime, endTime] of [["22:00", "20:00"], ["20:00", "20:00"]]) {
    assert.deepEqual(workTimeErrors({ startTime, endTime }), { endTime: "policy_time_order" });
  }
  for (const startTime of ["", null, undefined, "9:00", "24:00", "09:60", 900]) {
    assert.equal(workTimeErrors({ startTime, endTime: "20:00" }).startTime, "policy_start_time_invalid");
  }
  for (const endTime of ["", null, undefined, "20:99", "25:00", false]) {
    assert.equal(workTimeErrors({ startTime: "09:00", endTime }).endTime, "policy_end_time_invalid");
  }
  for (const [startTime, endTime] of [["00:00", "23:59"], ["09:00", "20:00"], ["09:00", "09:01"]]) {
    assert.deepEqual(workTimeErrors({ startTime, endTime }), {});
  }
});

test("policy save feedback distinguishes field, access, session and service failures without exposing raw server text", () => {
  const rejected = policySaveResponseError(400, { error: "secret raw storage text", fieldErrors: { endTime: "policy_time_order", startTime: "untrusted text" } });
  assert.deepEqual(rejected.fields, { endTime: "policy_time_order" });
  assert.equal(policySaveResponseError(401, null).code, "policy_save_login");
  assert.equal(policySaveResponseError(403, null).code, "policy_save_forbidden");
  assert.equal(policySaveResponseError(503, {}).code, "policy_save_failed");
  assert.equal(policySaveResponseError(200, null).code, "policy_save_failed");
  for (const lang of ["en", "id", "zh"] as const) {
    assert.ok(policyMessage("policy_time_order", lang));
    assert.ok(policyMessage("policy_save_failed", lang));
    assert.ok(!policyMessage(rejected.code, lang).includes("secret"));
  }
});

test("invalid work hours render a localized preview boundary, never negative work totals or an active calling window", () => {
  for (const lang of ["en", "id", "zh"] as const) {
    const config = structuredClone(DEFAULT_CRM_POLICY_CONFIG);
    config.businessHours.startTime = "22:00";
    config.businessHours.endTime = "20:00";
    const html = renderToStaticMarkup(React.createElement(CrmPolicySettings, { isLight: true, lang, policyConfig: config, onSavePolicy: async () => true, onResetPolicy: async () => true }));
    assert.ok(html.includes(policyMessage("policy_calendar_invalid", lang)));
    assert.doesNotMatch(html.replace(/<[^>]*>/g, " "), /-2\.0|-12|● Active Calling/);
    assert.match(html, /aria-label=/);
  }
});
