import assert from "node:assert/strict"
import test from "node:test"

import {
  defineProcess,
  defineSchema,
  defineView,
  expression,
  s,
} from "../dist/index.js"

test("the package exposes only the public authoring builders at runtime", async () => {
  const sdk = await import("../dist/index.js")
  assert.deepEqual(Object.keys(sdk).sort(), [
    "defineProcess",
    "defineSchema",
    "defineView",
    "expression",
    "s",
  ])
})

test("defineProcess records identity, compatibility, capabilities, and entrypoints", () => {
  const process = defineProcess({
    projectKey: "fabrication-orders",
    name: "Fabrication order intake",
    sdk: "^0.0.0",
    compatibility: { packageFormat: "^1", runtime: "^1" },
    capabilities: {
      outbound: {
        erp: {
          destinations: ["https://api.example-erp.com"],
          authenticatedFetch: true,
        },
      },
    },
    entrypoints: ["schema", "validate", "reviews", "tools"],
  })

  assert.equal(process.kind, "preprocess.process")
  assert.equal(process.packageFormat, 1)
  assert.deepEqual(process.entrypoints, ["schema", "validate", "reviews", "tools"])
  assert.throws(
    () =>
      defineProcess({
        projectKey: "unsafe",
        name: "Unsafe",
        sdk: "^1",
        outbound: { erp: { destinations: ["http://localhost:8787/path"] } },
      }),
    /clean HTTPS origins/,
  )
})

test("schema and presentation builders emit inspectable serializable declarations", async () => {
  const materials = s.string().choicesFrom({
    key: "erp.materials.v1",
    dependsOn: ["/metadata/private/plant"],
    resolve: async () => [{ value: "aluminum", label: "Aluminum" }],
  })
  const schema = defineSchema({
    header: s.object({ currency: s.string().choices(["USD", "GBP"]) }),
    lineItems: s.array(
      s.object({
        partNumber: s.string(),
        material: materials,
        finish: s.string(),
        finishSpec: s.string().optional(),
      }),
    ),
  }).rules((r) => [
    r.each("/lineItems", (item) => [
      item
        .require("finishSpec")
        .when(expression.compare("/lineItems/*/finish", "neq", "none"))
        .issue("MISSING_FINISH_SPEC", "A finish specification is required."),
      item.requireEvidence(
        ["partNumber", "material"],
        ["document_region", "tool_response"],
      ),
    ]),
  ])
  const view = defineView(schema, {
    fields: {
      "/lineItems": {
        display: "worklist",
        identity: ["partNumber"],
        order: "attention",
      },
      "/lineItems/*/material": { label: "Material", role: "text" },
    },
    sections: [
      { id: "items", title: "Line items", order: 1, fields: ["/lineItems"] },
    ],
    attributes: {
      lineCount: { path: "/lineItems", type: "count" },
    },
  })

  assert.deepEqual(
    schema.declaration.shape.lineItems.items.properties.material.dynamicChoices,
    {
      key: "erp.materials.v1",
      dependsOn: ["/metadata/private/plant"],
    },
  )
  assert.equal(schema.declaration.rules[0].kind, "each")
  assert.equal(typeof schema.dynamicChoices.get("erp.materials.v1"), "function")
  assert.equal(view.declaration.fields["/lineItems"].display, "worklist")
  assert.equal(
    JSON.parse(JSON.stringify(schema.declaration)).kind,
    "preprocess.schema",
  )
  assert.deepEqual(await materials.resolveChoices({}), [
    { value: "aluminum", label: "Aluminum" },
  ])

  assert.throws(
    () =>
      defineView(schema, {
        fields: { "/lineItems/*/missing": { label: "Missing" } },
      }),
    /does not exist/,
  )
})
