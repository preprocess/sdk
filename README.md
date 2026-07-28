# `@preprocess/sdk`

Public TypeScript contracts for authoring versioned Preprocess Processes.

```sh
npm install @preprocess/sdk@^1.0.0
```

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

## Release

Releases are built from version-matching `v*.*.*` tags by the repository's
GitHub-hosted publish workflow. The workflow verifies the frozen dependency
graph, public contracts, exact package inventory, and an isolated tarball
consumer before publishing that same tarball to the public npm registry through
npm trusted publishing with provenance. The npm trusted publisher must identify
the `preprocess/sdk` repository and `publish.yml` workflow.

The release evidence artifact records the source commit, package identity,
SHA-256 digest, npm integrity, exact file inventory, toolchain, verification
commands, registry, and publish result. The package remains `UNLICENSED`.

## Development

```sh
corepack enable
pnpm install
pnpm check
pnpm test
pnpm build
```
