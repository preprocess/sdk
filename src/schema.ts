import type { CaseMetadata, JsonValue, RuntimeContext } from "./runtime.js"

export type FieldState =
  | "inactive"
  | "indeterminate"
  | "optional"
  | "required"
  | "resolved"
  | "invalid"

export type EvidenceKind =
  | "document_region"
  | "spreadsheet_region"
  | "tool_response"
  | "customer_code"
  | "external_call"

export interface ValidationIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
  readonly severity?: "info" | "warning" | "error"
}

export interface DynamicChoice {
  readonly value: string
  readonly label?: string
}

export interface DynamicChoices<
  Metadata extends CaseMetadata = CaseMetadata,
> {
  readonly key: string
  readonly dependsOn: readonly string[]
  readonly resolve: (
    context: RuntimeContext<Metadata>,
  ) => readonly DynamicChoice[] | Promise<readonly DynamicChoice[]>
}

export interface SchemaNodeDeclaration {
  readonly type:
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "object"
    | "array"
    | "discriminatedUnion"
  readonly optional?: boolean
  readonly choices?: readonly DynamicChoice[]
  readonly dynamicChoices?: {
    readonly key: string
    readonly dependsOn: readonly string[]
  }
  readonly properties?: Readonly<Record<string, SchemaNodeDeclaration>>
  readonly items?: SchemaNodeDeclaration
  readonly discriminator?: string
  readonly variants?: Readonly<Record<string, SchemaNodeDeclaration>>
}

export interface SchemaNode<Value> {
  readonly declaration: SchemaNodeDeclaration
  readonly resolveChoices?: DynamicChoices["resolve"]
  readonly dynamicChoices: ReadonlyMap<string, DynamicChoices["resolve"]>
  optional(): SchemaNode<Value | undefined>
  choices<const Choice extends string>(
    values: readonly (Choice | DynamicChoice)[],
  ): SchemaNode<Choice>
  choicesFrom<Metadata extends CaseMetadata>(
    source: DynamicChoices<Metadata>,
  ): SchemaNode<Value>
}

export type InferNode<Node> = Node extends SchemaNode<infer Value> ? Value : never
export type InferShape<Shape extends Readonly<Record<string, SchemaNode<unknown>>>> = {
  readonly [Key in keyof Shape as undefined extends InferNode<Shape[Key]>
    ? never
    : Key]: InferNode<Shape[Key]>
} & {
  readonly [Key in keyof Shape as undefined extends InferNode<Shape[Key]>
    ? Key
    : never]?: Exclude<InferNode<Shape[Key]>, undefined>
}

function node<Value>(
  declaration: SchemaNodeDeclaration,
  resolveChoices?: DynamicChoices["resolve"],
  dynamicChoices: ReadonlyMap<string, DynamicChoices["resolve"]> = new Map(),
): SchemaNode<Value> {
  return {
    declaration,
    ...(resolveChoices ? { resolveChoices } : {}),
    dynamicChoices,
    optional(): SchemaNode<Value | undefined> {
      return node<Value | undefined>(
        { ...declaration, optional: true },
        resolveChoices,
        dynamicChoices,
      )
    },
    choices<const Choice extends string>(
      values: readonly (Choice | DynamicChoice)[],
    ): SchemaNode<Choice> {
      const normalized = values.map((choice) =>
        typeof choice === "string" ? { value: choice } : choice,
      )
      return node<Choice>(
        { ...declaration, choices: normalized },
        resolveChoices,
        dynamicChoices,
      )
    },
    choicesFrom<Metadata extends CaseMetadata>(
      source: DynamicChoices<Metadata>,
    ): SchemaNode<Value> {
      const resolvers = new Map(dynamicChoices)
      resolvers.set(source.key, source.resolve as DynamicChoices["resolve"])
      return node<Value>(
        {
          ...declaration,
          dynamicChoices: { key: source.key, dependsOn: [...source.dependsOn] },
        },
        source.resolve as DynamicChoices["resolve"],
        resolvers,
      )
    },
  }
}

export const s = {
  string(): SchemaNode<string> {
    return node<string>({ type: "string" })
  },
  number(): SchemaNode<number> {
    return node<number>({ type: "number" })
  },
  boolean(): SchemaNode<boolean> {
    return node<boolean>({ type: "boolean" })
  },
  date(): SchemaNode<string> {
    return node<string>({ type: "date" })
  },
  object<const Shape extends Readonly<Record<string, SchemaNode<unknown>>>>(
    shape: Shape,
  ): SchemaNode<InferShape<Shape>> {
    return node<InferShape<Shape>>(
      {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(shape).map(([key, value]) => [key, value.declaration]),
        ),
      },
      undefined,
      new Map(
        Object.values(shape).flatMap((value) => [...value.dynamicChoices]),
      ),
    )
  },
  array<const Item>(item: SchemaNode<Item>): SchemaNode<readonly Item[]> {
    return node<readonly Item[]>(
      { type: "array", items: item.declaration },
      undefined,
      item.dynamicChoices,
    )
  },
  discriminatedUnion<
    const Discriminator extends string,
    const Variants extends Readonly<Record<string, SchemaNode<unknown>>>,
  >(
    discriminator: Discriminator,
    variants: Variants,
  ): SchemaNode<InferNode<Variants[keyof Variants]>> {
    return node<InferNode<Variants[keyof Variants]>>(
      {
        type: "discriminatedUnion",
        discriminator,
        variants: Object.fromEntries(
          Object.entries(variants).map(([key, value]) => [key, value.declaration]),
        ),
      },
      undefined,
      new Map(
        Object.values(variants).flatMap((value) => [...value.dynamicChoices]),
      ),
    )
  },
}

export interface Expression {
  readonly kind: "comparison" | "presence" | "and" | "or" | "not"
  readonly path?: string
  readonly operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  readonly value?: JsonValue
  readonly operands?: readonly Expression[]
}

export const expression = {
  compare(
    path: string,
    operator: NonNullable<Expression["operator"]>,
    value: JsonValue,
  ): Expression {
    return { kind: "comparison", path, operator, value }
  },
  present(path: string): Expression {
    return { kind: "presence", path }
  },
  and(...operands: readonly Expression[]): Expression {
    return { kind: "and", operands }
  },
  or(...operands: readonly Expression[]): Expression {
    return { kind: "or", operands }
  },
  not(operand: Expression): Expression {
    return { kind: "not", operands: [operand] }
  },
}

export type RuleDeclaration =
  | {
      readonly kind: "require"
      readonly path: string
      readonly when?: Expression
      readonly issue?: ValidationIssue
    }
  | {
      readonly kind: "evidence"
      readonly paths: readonly string[]
      readonly evidence: readonly EvidenceKind[]
    }
  | {
      readonly kind: "each"
      readonly path: string
      readonly rules: readonly RuleDeclaration[]
    }

interface PendingRequiredRule {
  when(condition: Expression): PendingRequiredRule
  issue(code: string, message: string): RuleDeclaration
  build(): RuleDeclaration
}

interface ScopedRuleBuilder {
  require(path: string): PendingRequiredRule
  requireEvidence(paths: readonly string[], evidence: readonly EvidenceKind[]): RuleDeclaration
}

export interface RuleBuilder extends ScopedRuleBuilder {
  each(path: string, build: (item: ScopedRuleBuilder) => readonly RuleDeclaration[]): RuleDeclaration
}

function joinPath(scope: string | undefined, path: string): string {
  if (path.startsWith("/")) return path
  return `${scope ?? ""}/${path}`.replaceAll("//", "/")
}

function scopedRuleBuilder(scope?: string): ScopedRuleBuilder {
  return {
    require(path: string): PendingRequiredRule {
      const fullPath = joinPath(scope, path)
      let condition: Expression | undefined
      return {
        when(value: Expression): PendingRequiredRule {
          condition = value
          return this
        },
        issue(code: string, message: string): RuleDeclaration {
          return {
            kind: "require",
            path: fullPath,
            ...(condition ? { when: condition } : {}),
            issue: { code, message, path: fullPath, severity: "error" },
          }
        },
        build(): RuleDeclaration {
          return {
            kind: "require",
            path: fullPath,
            ...(condition ? { when: condition } : {}),
          }
        },
      }
    },
    requireEvidence(
      paths: readonly string[],
      evidence: readonly EvidenceKind[],
    ): RuleDeclaration {
      return {
        kind: "evidence",
        paths: paths.map((path) => joinPath(scope, path)),
        evidence: [...evidence],
      }
    },
  }
}

function ruleBuilder(): RuleBuilder {
  return {
    ...scopedRuleBuilder(),
    each(
      path: string,
      build: (item: ScopedRuleBuilder) => readonly RuleDeclaration[],
    ): RuleDeclaration {
      return {
        kind: "each",
        path,
        rules: build(scopedRuleBuilder(`${path}/*`)),
      }
    },
  }
}

export interface SchemaDeclaration {
  readonly kind: "preprocess.schema"
  readonly format: 1
  readonly shape: Readonly<Record<string, SchemaNodeDeclaration>>
  readonly rules: readonly RuleDeclaration[]
}

export interface SchemaDefinition<
  Shape extends Readonly<Record<string, SchemaNode<unknown>>>,
> {
  readonly declaration: SchemaDeclaration
  readonly dynamicChoices: ReadonlyMap<string, DynamicChoices["resolve"]>
  rules(build: (rules: RuleBuilder) => readonly RuleDeclaration[]): SchemaDefinition<Shape>
}

export type InferSchema<Definition> =
  Definition extends SchemaDefinition<infer Shape> ? InferShape<Shape> : never

function schemaDefinition<
  Shape extends Readonly<Record<string, SchemaNode<unknown>>>,
>(
  shape: Shape,
  rules: readonly RuleDeclaration[],
): SchemaDefinition<Shape> {
  const dynamicChoices = new Map(
    Object.values(shape).flatMap((value) => [...value.dynamicChoices]),
  )
  return {
    declaration: {
      kind: "preprocess.schema",
      format: 1,
      shape: Object.fromEntries(
        Object.entries(shape).map(([key, value]) => [key, value.declaration]),
      ),
      rules,
    },
    dynamicChoices,
    rules(build): SchemaDefinition<Shape> {
      return schemaDefinition(shape, build(ruleBuilder()))
    },
  }
}

export function defineSchema<
  const Shape extends Readonly<Record<string, SchemaNode<unknown>>>,
>(shape: Shape): SchemaDefinition<Shape> {
  return schemaDefinition(shape, [])
}

export interface SchemaEvaluation {
  readonly schemaSnapshotId: string
  readonly fieldStates: Readonly<Record<string, FieldState>>
  readonly reasons: Readonly<Record<string, readonly string[]>>
  readonly dependencies: Readonly<Record<string, readonly string[]>>
  readonly requiredPaths: readonly string[]
  readonly prohibitedPaths: readonly string[]
  readonly indeterminatePaths: readonly string[]
  readonly validationIssues: readonly ValidationIssue[]
  readonly canComplete: boolean
}
