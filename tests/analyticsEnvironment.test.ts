import test from "node:test";
import assert from "node:assert/strict";
import mapping from "../src/data/analyticsEnvironments.json";
import { analyticsBuildConfiguration } from "../server/analyticsEnvironment.mjs";
import {
  analyticsDestinationAllowed,
  analyticsInternalTest,
} from "../src/utils/analyticsEnvironment";
import { analyticsContext } from "../src/utils/analyticsPolicy";

test("three exact build targets use two properties and three distinct public measurement IDs", () => {
  const ids = new Set<string>(),
    properties = new Set<string>();
  for (const target of ["dev", "test", "prod"] as const) {
    const config = analyticsBuildConfiguration(target, {
      VITE_UPER_MEASUREMENT_ID: mapping.environments[target].measurementId,
      OPENAI_API_KEY: "PRIVATE",
    });
    ids.add(config.measurementId);
    properties.add(config.propertyId);
    assert.equal(config.target, target);
    assert.doesNotMatch(JSON.stringify(config), /PRIVATE|API_KEY/);
    assert.throws(() => analyticsBuildConfiguration(target, {}), /Missing/);
    const wrong = target === "dev" ? "prod" : "dev";
    assert.throws(
      () =>
        analyticsBuildConfiguration(target, {
          VITE_UPER_MEASUREMENT_ID: mapping.environments[wrong].measurementId,
        }),
      /does not match/,
    );
  }
  assert.equal(properties.size, 2);
  assert.equal(ids.size, 3);
  assert.throws(() => analyticsBuildConfiguration("production", {}), /Unknown/);
});
test("runtime host and build gates prevent development, staging and production packages crossing destinations", () => {
  const configs = Object.fromEntries(
    Object.entries(mapping.environments).map(([target, c]) => [
      target,
      { target, ...c },
    ]),
  );
  const allowed = {
    dev: [
      "http://localhost:3000/chat",
      "http://127.0.0.1:3000/link",
      "http://[::1]:3000/",
      "http://synthetic.localhost:4452/crm",
    ],
    test: ["https://home.prototype.uperedu.com/chat"],
    prod: ["https://uperedu.com/link", "https://www.uperedu.com/crm", "https://home.uperedu.com/chat"],
  };
  for (const [target, urls] of Object.entries(allowed))
    for (const href of urls)
      for (const [build, config] of Object.entries(configs))
        assert.equal(
          analyticsDestinationAllowed(
            config,
            config.measurementId,
            href,
            build,
          ),
          target === build,
          build + " " + href,
        );
  for (const href of [
    "https://evil.example",
    "https://uperedu.com.evil.example",
    "https://localhost.evil.example",
    "file:///crm",
    "not a URL",
  ])
    for (const config of Object.values(configs))
      assert.equal(
        analyticsDestinationAllowed(
          config,
          config.measurementId,
          href,
          config.target,
        ),
        false,
      );
  assert.equal(
    analyticsDestinationAllowed(
      configs.prod,
      configs.prod.measurementId,
      "http://uperedu.com",
      "prod",
    ),
    false,
  );
  assert.equal(
    analyticsDestinationAllowed(
      configs.test,
      configs.test.measurementId,
      "http://home.prototype.uperedu.com",
      "test",
    ),
    false,
  );
  assert.equal(
    analyticsDestinationAllowed(
      configs.dev,
      configs.prod.measurementId,
      "http://localhost:3000",
      "dev",
    ),
    false,
  );
  assert.equal(
    analyticsDestinationAllowed(null, "G-TEST", "http://localhost:3000", "dev"),
    false,
  );
});
test("explicit production QA visits persist only in the tab and can be switched off without exposing URL markers", () => {
  const values = new Map<string, string>(),
    storage = {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    };
  assert.equal(analyticsInternalTest("https://uperedu.com", storage), false);
  assert.equal(
    analyticsInternalTest("https://uperedu.com/link?analytics_test=1", storage),
    true,
  );
  assert.equal(
    analyticsInternalTest("https://uperedu.com/chat", storage),
    true,
  );
  const tested = analyticsContext({
    href: "https://uperedu.com/chat?analytics_test=1&email=private@example.invalid",
    mode: "prod",
    internalTest: true,
  });
  assert.equal(tested.traffic_category, "internal_test");
  assert.equal(tested.traffic_type, "internal");
  assert.equal(tested.page_location, "https://uperedu.com/chat");
  assert.doesNotMatch(JSON.stringify(tested), /private|analytics_test/);
  assert.equal(
    analyticsInternalTest("https://uperedu.com/?analytics_test=0", storage),
    false,
  );
  assert.equal(
    analyticsInternalTest("https://uperedu.com/chat", storage),
    false,
  );
  const blocked = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
    removeItem: () => {
      throw Error("blocked");
    },
  };
  assert.equal(
    analyticsInternalTest("https://uperedu.com/?analytics_test=1", blocked),
    true,
  );
  assert.equal(analyticsInternalTest("https://uperedu.com", blocked), false);
});
test("production staff usage stays distinct from QA traffic and remains available for CRM product analysis", () => {
  const staff = analyticsContext({
    href: "https://uperedu.com/crm?tab=leads&lead=PRIVATE",
    mode: "prod",
  });
  assert.equal(staff.traffic_category, "internal_employee");
  assert.equal(staff.traffic_type, "staff");
  assert.equal(staff.workspace, "crm");
  assert.doesNotMatch(JSON.stringify(staff), /PRIVATE/);
  const customer = analyticsContext({
    href: "https://uperedu.com/chat",
    mode: "prod",
  });
  assert.equal(customer.traffic_category, "customer");
  assert.equal(customer.traffic_type, "external");
  for (const [href, mode] of [
    ["http://qa.localhost:3000/link", "dev"],
    ["https://home.prototype.uperedu.com/chat", "test"],
  ])
    assert.equal(
      analyticsContext({ href, mode }).traffic_category,
      "internal_test",
    );
});
