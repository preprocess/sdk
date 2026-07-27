import type { CaseMetadata } from "./runtime.js"

export interface ProcessScript {
  readonly path: string
  readonly description?: string
}

export interface ProcessSkill {
  readonly name: string
  readonly description: string
  readonly instructions: string
  readonly scripts?: readonly ProcessScript[]
  readonly references?: readonly string[]
  readonly tools?: Readonly<Record<string, unknown>>
}

export interface ProcessFixture<Metadata extends CaseMetadata = CaseMetadata> {
  readonly name: string
  readonly artifacts: readonly {
    readonly path: string
    readonly mediaType: string
  }[]
  readonly metadata: Metadata
  readonly assertions?: readonly string[]
}
