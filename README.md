# `@preprocess/sdk`

Public TypeScript contracts for authoring versioned Preprocess Processes.

The package deliberately stays small. A Process declares stable identity,
compatibility, requested capabilities, typed metadata, dynamic result schema,
presentation semantics, review plans, fixtures, skills, and scripts. Customer
logic remains ordinary TypeScript, and agent tools are standard Vercel AI SDK
tools used directly—there is no Preprocess tool wrapper.

```ts
import {
  defineProcess,
  defineSchema,
  defineView,
  s,
  type CaseMetadata,
  type RuntimeContext,
} from "@preprocess/sdk"

export default defineProcess({
  projectKey: "fabrication-orders",
  name: "Fabrication order intake",
  sdk: "^1.0.0",
  compatibility: { packageFormat: "^1", runtime: "^1" },
  capabilities: {
    outbound: {
      erp: {
        destinations: ["https://api.example-erp.com"],
        authenticatedFetch: true,
      },
    },
  },
})

type Metadata = CaseMetadata<
  { customerTier: string },
  { plant: string }
>

export async function schema(context: RuntimeContext<Metadata>) {
  const materials = await listMaterials(context.metadata.private.plant)

  return defineSchema({
    orderNumber: s.string(),
    material: s.string().choices(materials),
    quantity: s.number(),
  })
}

export const view = defineView(
  defineSchema({
    orderNumber: s.string(),
    total: s.number(),
    currency: s.string(),
  }),
  {
    fields: {
      "/orderNumber": { role: "identifier", summary: true },
      "/total": { role: "money", format: { currency: "/currency" } },
    },
  },
)
```

Schema and view builders emit versioned, serializable declarations that the
trusted compiler/runtime/application can inspect without executing customer
code. Dynamic choice resolvers stay as normal TypeScript while their provider
key and dependency paths are recorded in the declaration.

The package has no dependency on private platform source, Cloudflare bindings,
WorkOS, CLI presentation, or a runtime test framework.

## Development

```sh
corepack enable
pnpm install
pnpm check
pnpm test
pnpm build
```
