import assert from "node:assert/strict"
import test from "node:test"

test("the package exposes an ESM entrypoint", async () => {
  const sdk = await import("../dist/index.js")
  assert.deepEqual(Object.keys(sdk), [])
})

