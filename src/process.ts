import type { CaseMetadata, RuntimeContext } from "./runtime.js"

export type CompatibilityRange = string & {}

export interface OutboundCapability {
  readonly destinations: readonly string[]
  readonly authenticatedFetch?: boolean
}

export interface ProcessCapabilities {
  readonly outbound?: Readonly<Record<string, OutboundCapability>>
  readonly sandbox?: boolean
}

export type ProcessToolSet = Readonly<Record<string, unknown>>

export type ProcessEntrypointName =
  | "metadata"
  | "system"
  | "schema"
  | "validate"
  | "reviews"
  | "context"
  | "tools"
  | "success"
  | "view"

export interface ProcessManifest {
  readonly projectKey: string
  readonly name: string
  readonly sdk: CompatibilityRange
  readonly compatibility?: {
    readonly packageFormat?: CompatibilityRange
    readonly runtime?: CompatibilityRange
  }
  readonly capabilities?: ProcessCapabilities
  readonly outbound?: Readonly<Record<string, OutboundCapability>>
  readonly entrypoints?: readonly ProcessEntrypointName[]
}

export interface ProcessDefinition extends ProcessManifest {
  readonly kind: "preprocess.process"
  readonly packageFormat: 1
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
}

function assertManifest(manifest: ProcessManifest): void {
  assertNonEmpty(manifest.projectKey, "projectKey")
  assertNonEmpty(manifest.name, "name")
  assertNonEmpty(manifest.sdk, "sdk")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.projectKey)) {
    throw new TypeError("projectKey must be a lowercase kebab-case identifier")
  }
  for (const [name, capability] of Object.entries(
    manifest.capabilities?.outbound ?? manifest.outbound ?? {},
  )) {
    assertNonEmpty(name, "outbound capability name")
    if (capability.destinations.length === 0) {
      throw new TypeError(`outbound capability ${name} must declare a destination`)
    }
    for (const destination of capability.destinations) {
      const url = new URL(destination)
      if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
        throw new TypeError("outbound destinations must be clean HTTPS origins")
      }
    }
  }
}

export function defineProcess<const Manifest extends ProcessManifest>(
  manifest: Manifest,
): ProcessDefinition & Readonly<Manifest> {
  assertManifest(manifest)
  return Object.freeze({
    ...manifest,
    kind: "preprocess.process" as const,
    packageFormat: 1 as const,
  }) as ProcessDefinition & Readonly<Manifest>
}

export type ToolFactory<
  Metadata extends CaseMetadata = CaseMetadata,
  Tools extends ProcessToolSet = ProcessToolSet,
> = (context: RuntimeContext<Metadata>) => Tools | Promise<Tools>
