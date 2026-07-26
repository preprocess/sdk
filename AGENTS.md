# SDK agent guide

This repository is the public `@preprocess/sdk` package. Read the Process
authoring specifications in `preprocess/platform` before changing a customer
contract.

- Keep the runtime dependency surface minimal.
- Do not depend on Cloudflare bindings, WorkOS, CLI presentation, or private
  platform source.
- Use standard Vercel AI SDK tools directly; do not invent a Preprocess tool
  wrapper.
- Add APIs only from executable authoring contracts and cover them with tests.
- Treat backwards compatibility, emitted declarations, and package exports as
  public contracts.
- Run `pnpm check`, `pnpm test`, and `pnpm build` before handoff.

