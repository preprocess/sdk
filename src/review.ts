import type { CaseMetadata, RuntimeContext } from "./runtime.js"
import type { SchemaEvaluation, ValidationIssue } from "./schema.js"

export interface ValidationResult {
  readonly issues: readonly ValidationIssue[]
}

export type ValidationFunction<
  Result,
  Metadata extends CaseMetadata = CaseMetadata,
> = (
  input: {
    readonly result: Readonly<Result>
    readonly context: RuntimeContext<Metadata>
  },
) => ValidationResult | Promise<ValidationResult>

export interface ReviewContext<
  Result,
  Metadata extends CaseMetadata = CaseMetadata,
> {
  readonly result: Readonly<Result>
  readonly metadata: Readonly<Metadata>
  readonly validation: SchemaEvaluation
}

export type ReviewCompletion =
  | { readonly kind: "all" }
  | { readonly kind: "count"; readonly count: number }
  | { readonly kind: "percentage"; readonly percentage: number }

export type ReviewRoute =
  | { readonly role: string }
  | { readonly principals: readonly string[] }

export interface ReviewUnitDefinition {
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly subject: { readonly path: string }
  readonly include?: readonly string[]
  readonly routeTo?: ReviewRoute
  readonly reviewers?: { readonly count: number }
}

export interface ReviewRequirement {
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly instructions?: string
  readonly routeTo?: ReviewRoute
  readonly reviewers?: { readonly count: number }
  readonly completion?: ReviewCompletion
  readonly blocksSuccess?: boolean
  readonly units: readonly ReviewUnitDefinition[]
}

export interface ReviewPlan {
  readonly requirements: readonly ReviewRequirement[]
}

export type ReviewPlanner<
  Result,
  Metadata extends CaseMetadata = CaseMetadata,
> = (
  context: ReviewContext<Result, Metadata>,
) => ReviewPlan | Promise<ReviewPlan>
