import type { JsonValue } from "./runtime.js"
import type {
  Expression,
  SchemaDefinition,
  SchemaNode,
  SchemaNodeDeclaration,
} from "./schema.js"

export type FieldRole = "identifier" | "money" | "quantity" | "status" | "timestamp" | "text"

export interface FieldAnnotation {
  readonly label?: string
  readonly description?: string
  readonly helpText?: string
  readonly role?: FieldRole
  readonly format?: {
    readonly currency?: string
    readonly unit?: string
    readonly system?: string
    readonly precision?: number
    readonly date?: "short" | "medium" | "long" | "full"
    readonly percentage?: boolean
    readonly duration?: boolean
  }
  readonly emptyText?: string
  readonly widget?: string
  readonly emphasis?: boolean
  readonly summary?: boolean
  readonly sensitivity?: "internal" | "confidential" | "restricted"
  readonly badge?: Readonly<Record<string, "neutral" | "warning" | "critical" | "positive">>
}

export interface ArrayAnnotation extends FieldAnnotation {
  readonly display?: "table" | "cards" | "list" | "accordion" | "worklist"
  readonly identity?: readonly string[]
  readonly columns?: readonly {
    readonly path: string
    readonly width?: "auto" | number
    readonly sticky?: boolean
    readonly align?: "left" | "center" | "right"
  }[]
  readonly order?: "attention" | "document" | string
  readonly sortable?: readonly string[]
  readonly groupBy?: string
  readonly rowCollapsible?: boolean
  readonly summaryRow?: Readonly<Record<string, "sum" | "count" | "min" | "max" | "avg">>
  readonly emptyState?: string
}

export interface PresentationSection {
  readonly id: string
  readonly title: string
  readonly order: number
  readonly columns?: number
  readonly collapsible?: boolean
  readonly defaultCollapsed?: boolean
  readonly when?: Expression
  readonly fields: readonly string[]
  readonly sections?: readonly PresentationSection[]
}

export interface PresentationAttribute {
  readonly source?: "result" | "metadata"
  readonly path: string
  readonly type: "date" | "string" | "money" | "number" | "count"
  readonly label?: string
  readonly facet?: boolean
}

export interface ViewDeclaration {
  readonly kind: "preprocess.view"
  readonly format: 1
  readonly fields: Readonly<Record<string, FieldAnnotation | ArrayAnnotation>>
  readonly sections: readonly PresentationSection[]
  readonly attributes: Readonly<Record<string, PresentationAttribute>>
}

export interface ViewDefinition {
  readonly declaration: ViewDeclaration
}

function decodePointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~")
}

function pathExists(
  shape: Readonly<Record<string, SchemaNodeDeclaration>>,
  pointer: string,
): boolean {
  if (pointer === "/") return true
  if (!pointer.startsWith("/")) return false
  const segments = pointer.slice(1).split("/").map(decodePointerSegment)
  let candidates: readonly SchemaNodeDeclaration[] = [
    { type: "object", properties: shape },
  ]

  for (const segment of segments) {
    const next: SchemaNodeDeclaration[] = []
    for (const candidate of candidates) {
      if (candidate.type === "array" && candidate.items && (segment === "*" || /^\d+$/.test(segment))) {
        next.push(candidate.items)
      } else if (candidate.type === "object" && candidate.properties) {
        if (segment === "*") {
          next.push(...Object.values(candidate.properties))
        } else {
          const property = candidate.properties[segment]
          if (property) next.push(property)
        }
      } else if (candidate.type === "discriminatedUnion" && candidate.variants) {
        for (const variant of Object.values(candidate.variants)) {
          if (variant.properties) {
            const property = variant.properties[segment]
            if (property) next.push(property)
          }
        }
      }
    }
    if (next.length === 0) return false
    candidates = next
  }
  return candidates.length > 0
}

function assertResultPath(
  shape: Readonly<Record<string, SchemaNodeDeclaration>>,
  path: string,
): void {
  if (!pathExists(shape, path)) {
    throw new TypeError(`presentation path does not exist in the schema: ${path}`)
  }
}

export function defineView<
  Shape extends Readonly<Record<string, SchemaNode<unknown>>>,
>(
  _schema: SchemaDefinition<Shape>,
  input: {
    readonly fields?: Readonly<Record<string, FieldAnnotation | ArrayAnnotation>>
    readonly sections?: readonly PresentationSection[]
    readonly attributes?: Readonly<Record<string, PresentationAttribute>>
  },
): ViewDefinition {
  const shape = _schema.declaration.shape
  for (const path of Object.keys(input.fields ?? {})) {
    assertResultPath(shape, path)
    const annotation = input.fields?.[path]
    const currency = annotation?.format?.currency
    const system = annotation?.format?.system
    if (currency?.startsWith("/")) assertResultPath(shape, currency)
    if (system?.startsWith("/")) assertResultPath(shape, system)
  }
  const visitSections = (sections: readonly PresentationSection[]): void => {
    for (const section of sections) {
      for (const path of section.fields) assertResultPath(shape, path)
      visitSections(section.sections ?? [])
    }
  }
  visitSections(input.sections ?? [])
  for (const attribute of Object.values(input.attributes ?? {})) {
    if ((attribute.source ?? "result") === "result") {
      assertResultPath(shape, attribute.path)
    }
  }
  return {
    declaration: {
      kind: "preprocess.view",
      format: 1,
      fields: input.fields ?? {},
      sections: input.sections ?? [],
      attributes: input.attributes ?? {},
    },
  }
}

export type PresentationValue = JsonValue
