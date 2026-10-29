import test from "node:test";
import assert from "node:assert/strict";
import {
  CRM_DIMENSION_CATALOG_VERSION,
  systemProfileDimensions,
  protectedDimensions,
  systemDimension,
  buildDimensionCatalog,
  extractionDimensionCatalog,
  validateAiDimensionRecord,
  validateDimensionValue,
  aiInsightDefinition,
  assertAiInsightKey,
} from "../src/utils/crmDimensionCatalog";
import {
  aiProfileFieldLabels,
  aiProtectedFieldLabels,
  assertAiProfileUpdates,
} from "../src/utils/crmAiProfilePolicy";
import { validateProfileUpdates } from "../src/utils/crmDynamicProfile";
import { customerDimensionCatalog } from "../server/portal/customerInsights";
import { mountTrustRoutes } from "../server/portal/trustRoutes";
const ai = () =>
  validateAiDimensionRecord(
    {
      labels: {
        en: "Learning equipment",
        id: "Perangkat belajar",
        zh: "学习设备",
      },
      definition: {
        en: "Equipment for learning",
        id: "Perangkat untuk belajar",
        zh: "学习使用的设备",
      },
    },
    "learning_resource_context",
  );
test("one read-only catalog declares all preset field types, protected categories and translations", () => {
  assert.equal(CRM_DIMENSION_CATALOG_VERSION, "crm-dimensions-v1");
  assert.equal(systemProfileDimensions.length, 12);
  assert.equal(protectedDimensions.length, 20);
  assert.deepEqual(
    systemProfileDimensions.map((d) => d.key),
    Object.keys(aiProfileFieldLabels),
  );
  assert.deepEqual(
    protectedDimensions.map((d) => d.key),
    Object.keys(aiProtectedFieldLabels),
  );
  for (const d of buildDimensionCatalog()) {
    assert.equal(d.origin, "system");
    assert.ok(Object.isFrozen(d));
    assert.ok(Object.isFrozen(d.protection));
    for (const lang of ["en", "id", "zh"] as const) {
      assert.ok(d.labels[lang]);
      assert.ok(d.definition[lang]);
    }
  }
  assert.equal(systemDimension("budgetAmount")?.valueType, "number");
  assert.equal(systemDimension("goals")?.valueType, "text_list");
  assert.equal(systemDimension("mode")?.valueType, "enum");
  // A time preference remains text, not an invented date or timestamp.
  assert.equal(systemDimension("preferredStart")?.valueType, "text");
  assert.equal(systemDimension("availability")?.valueType, "text");
  assert.throws(() => {
    (systemDimension("email")!.protection as any).aiWrite = "profile";
  });
});
test("preset validation preserves numeric, enum, list, null and whitespace behavior", () => {
  assert.deepEqual(
    validateProfileUpdates({
      city: " Jakarta ",
      budgetAmount: 0,
      goals: [" 工作 ", "工作"],
      mode: " Online ",
      communicationLanguage: " id ",
      preferredStart: "节后再定",
    }),
    {
      city: "Jakarta",
      budgetAmount: 0,
      goals: ["工作"],
      mode: "Online",
      communicationLanguage: "id",
      preferredStart: "节后再定",
    },
  );
  assert.deepEqual(
    validateProfileUpdates(
      Object.fromEntries(systemProfileDimensions.map((d) => [d.key, null])),
    ),
    Object.fromEntries(systemProfileDimensions.map((d) => [d.key, null])),
  );
  assert.equal(
    validateProfileUpdates({ budgetAmount: 1e12 }).budgetAmount,
    1e12,
  );
  for (const value of [-1, 1e12 + 1, Infinity, NaN, "1000000"])
    assert.throws(() => validateProfileUpdates({ budgetAmount: value }));
  for (const value of ["online", "Remote", "未知"])
    assert.throws(() => validateProfileUpdates({ mode: value }));
  assert.throws(() => validateProfileUpdates({ communicationLanguage: "fr" }));
  assert.throws(() => validateProfileUpdates({ goals: Array(9).fill("目标") }));
  assert.throws(() => validateProfileUpdates({ concerns: ["x".repeat(301)] }));
  assert.throws(() => validateProfileUpdates({ city: "x".repeat(501) }));
  assert.equal(
    validateProfileUpdates({ fullName: " TEST " }, true).fullName,
    "TEST",
  );
  assert.throws(() => validateProfileUpdates({ fullName: null }, true));
  assert.throws(() =>
    validateProfileUpdates({ email: "fake@example.invalid" }, true),
  );
});
test("AI-created definitions receive server-owned text type and cannot supply policy or business bindings", () => {
  const d = aiInsightDefinition(ai());
  assert.equal(d.valueType, "text");
  assert.equal(d.protection.aiWrite, "insight");
  assert.equal(d.constraints.maxLength, 2000);
  assert.equal(d.storage.kind, "insight");
  assert.equal(validateDimensionValue(d, "  原文内容  "), "  原文内容  ");
  for (const value of [null, 10, [], {}, "", "x".repeat(2001)])
    assert.throws(() => validateDimensionValue(d, value));
  for (const key of [
    "valueType",
    "constraints",
    "protection",
    "storage",
    "origin",
    "version",
  ])
    assert.throws(() =>
      validateAiDimensionRecord(
        {
          ...ai(),
          [key]: key === "protection" ? { aiWrite: "profile" } : "override",
        },
        "new_dimension",
      ),
    );
  for (const d of [...systemProfileDimensions, ...protectedDimensions]) {
    assert.throws(() => assertAiInsightKey(d.key));
    for (const label of Object.values(d.labels))
      assert.throws(() =>
        validateAiDimensionRecord(
          { ...ai(), labels: { ...ai().labels, zh: label } },
          "alias_dimension",
        ),
      );
  }
  for (const key of ["constructor", "prototype", "__proto__", "invalid-key"])
    assert.throws(() => assertAiInsightKey(key));
});
test("core write authorization rejects every protected/unknown field and exposes no mutable policy override", () => {
  for (const d of protectedDimensions) {
    assert.equal(d.protection.aiWrite, "evidence_only");
    assert.throws(() => assertAiProfileUpdates({ [d.key]: "new value" }));
    assert.throws(() => validateDimensionValue(d, "new value"));
  }
  assert.throws(() => assertAiProfileUpdates({ unknownFutureField: "x" }));
  for (const d of systemProfileDimensions)
    assert.doesNotThrow(() => assertAiProfileUpdates({ [d.key]: null }));
});
test("catalog joins preset and existing AI definitions without changing persisted records or exposing customer values", async () => {
  const definition = ai(),
    row = { id: "definition-id", data: { dimension: definition } },
    source = JSON.stringify(row),
    queries: any[] = [];
  const c = {
    query: async (sql: string) => {
      queries.push(sql);
      return { rows: [row] };
    },
  };
  const catalog = await customerDimensionCatalog(c);
  assert.equal(catalog.length, 33);
  assert.equal(catalog.at(-1)?.key, "learning_resource_context");
  assert.equal(JSON.stringify(row), source);
  assert.ok(queries.every((q) => q.startsWith("SELECT")));
  assert.equal(JSON.stringify(catalog).includes("definition-id"), false);
  assert.equal(buildDimensionCatalog([definition, definition]).length, 33);
  const model = extractionDimensionCatalog(catalog);
  assert.equal(model.find((d) => d.key === "city")?.aiWrite, "profile");
  assert.equal(model.find((d) => d.key === "email")?.aiWrite, "evidence_only");
  assert.equal(
    model.find((d) => d.key === "learning_resource_context")?.aiWrite,
    "insight",
  );
  assert.ok(
    model.every(
      (d) => !("storage" in d) && !("value" in d) && !("leadId" in d),
    ),
  );
  assert.throws(() => buildDimensionCatalog([{ ...definition, key: "city" }]));
});
test("catalog HTTP reader requires staff authentication and existing CRM read capability before database access", async () => {
  const routes = new Map<string, any>();
  const app = {
    get: (path: string, fn: any) => routes.set(path, fn),
    post: () => {},
    patch: () => {},
    delete: () => {},
    put: () => {},
  };
  mountTrustRoutes(app, {
    wrap: (f: any) => f,
    staff: async () => {
      throw Object.assign(Error("Sign in"), { status: 401 });
    },
  });
  const read = routes.get("/api/crm/dimensions");
  assert.ok(read);
  await assert.rejects(read({}, {}), (e: any) => e.status === 401);
  mountTrustRoutes(app, {
    wrap: (f: any) => f,
    staff: async () => ({ permissions: ["cms.read"] }),
  });
  await assert.rejects(
    routes.get("/api/crm/dimensions")({}, {}),
    (e: any) => e.status === 403,
  );
});
