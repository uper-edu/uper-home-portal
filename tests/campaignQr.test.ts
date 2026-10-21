import {test} from "node:test";
import assert from "node:assert/strict";
import {campaignQrReducer, generateCampaignQr, type CampaignQrState} from "../src/utils/campaignQr";

const start = (key: string, request: number): CampaignQrState => ({key, request, status: "loading", dataUrl: ""});
const tick = () => new Promise(resolve => setImmediate(resolve));

test("printing is not ready until the generated image reports loaded", () => {
  const loading = start("A", 1);
  assert.equal(campaignQrReducer(loading, {type: "loaded", request: 1}).status, "loading");
  const generated = campaignQrReducer(loading, {type: "generated", request: 1, dataUrl: "qr-A"});
  assert.equal(generated.status, "generated");
  assert.equal(campaignQrReducer(generated, {type: "loaded", request: 1}).status, "ready");
});

test("switching campaigns and retrying reject obsolete generation and image callbacks", () => {
  let state = campaignQrReducer(start("A", 1), {type: "start", key: "B", request: 2});
  for (const type of ["generated", "loaded", "failed"] as const) {
    assert.equal(campaignQrReducer(state, {type, request: 1, dataUrl: "qr-A"}), state);
  }
  state = campaignQrReducer(state, {type: "failed", request: 2});
  assert.equal(state.dataUrl, "");
  state = campaignQrReducer(state, {type: "start", key: "B-retry", request: 3});
  assert.equal(campaignQrReducer(state, {type: "loaded", request: 2}), state);
  assert.equal(state.status, "loading");
});

test("image failure removes printable pixels and late load does not undo failure", () => {
  const generated = campaignQrReducer(start("A", 1), {type: "generated", request: 1, dataUrl: "bad-image"});
  const failed = campaignQrReducer(generated, {type: "failed", request: 1});
  assert.equal(failed.status, "error");
  assert.equal(failed.dataUrl, "");
  assert.equal(campaignQrReducer(failed, {type: "loaded", request: 1}), failed);
});

test("closing/switching cancels a late generation while independent surface still resolves", async () => {
  const received: string[] = [];
  let finishA!: (value: string) => void;
  const cancelA = generateCampaignQr("A", () => new Promise(resolve => {finishA = resolve;}), value => received.push(value), () => assert.fail());
  generateCampaignQr("B", async url => "qr-" + url, value => received.push(value), () => assert.fail());
  await tick();
  cancelA();
  finishA("obsolete-A");
  await tick();
  assert.deepEqual(received, ["qr-B"]);
});

test("generator errors and empty results are visible failures, and retry can succeed", async () => {
  let failures = 0;
  const received: string[] = [];
  for (const generate of [() => {throw Error("sync");}, async () => {throw Error("async");}, async () => ""]) {
    generateCampaignQr("A", generate, value => received.push(value), () => failures++);
    await tick();
  }
  assert.equal(failures, 3);
  generateCampaignQr("A", async () => "retry-success", value => received.push(value), () => failures++);
  await tick();
  assert.deepEqual(received, ["retry-success"]);
  assert.equal(failures, 3);
});
