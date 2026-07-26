# `@preprocess/sdk`

Public TypeScript SDK for authoring Preprocess Processes.

The SDK will contain only the customer-facing contracts and builders that must
compile into runtime-inspectable artifacts. Agent tools use the Vercel AI SDK
directly; validation, context, reviews, success checks, and integrations remain
ordinary TypeScript.

## Development

```sh
corepack enable
pnpm install
pnpm check
pnpm test
pnpm build
```

The implementation will be driven by the executable authoring contracts in the
private `preprocess/platform` repository. This repository must not depend on
Cloudflare bindings, platform databases, CLI presentation, or a test runner at
runtime.

