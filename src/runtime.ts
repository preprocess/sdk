export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

export type DeepReadonly<Value> = Value extends (...args: never[]) => unknown
  ? Value
  : Value extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value

export interface CaseMetadata<
  AgentVisible extends Record<string, unknown> = Record<string, unknown>,
  Private extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly agentVisible: AgentVisible
  readonly private: Private
}

export interface CaseReference {
  readonly id: string
  readonly rootId: string
  readonly revision: number
  readonly sequence: number
  readonly createdAt: string
}

export interface RuntimeContext<Metadata extends CaseMetadata = CaseMetadata> {
  readonly case: Readonly<CaseReference>
  readonly metadata: DeepReadonly<Metadata>
}

export interface ContextBlock {
  readonly key: string
  readonly title?: string
  readonly classification: "internal" | "confidential" | "restricted"
  readonly data: JsonValue
}

export type ContextProvider<Metadata extends CaseMetadata = CaseMetadata> = (
  context: RuntimeContext<Metadata>,
) => ContextBlock | readonly ContextBlock[] | Promise<ContextBlock | readonly ContextBlock[]>

export interface SystemInstructionBlock {
  readonly key: string
  readonly instructions: string
}

export type SystemInstructionProvider<Metadata extends CaseMetadata = CaseMetadata> = (
  context: RuntimeContext<Metadata>,
) =>
  | SystemInstructionBlock
  | readonly SystemInstructionBlock[]
  | Promise<SystemInstructionBlock | readonly SystemInstructionBlock[]>
