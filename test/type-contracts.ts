import {
  defineProcess,
  defineSchema,
  defineView,
  s,
  type CaseMetadata,
  type InferSchema,
  type ReviewPlanner,
  type RuntimeContext,
  type ProcessFixture,
  type ProcessScript,
  type ProcessSkill,
  type ProcessToolSet,
  type ToolFactory,
  type ValidationFunction,
} from "../src/index.js"

type Metadata = CaseMetadata<
  { customerTier: "standard" | "priority" },
  { plant: string }
>

const context: RuntimeContext<Metadata> = {
  case: {
    id: "case_01",
    rootId: "case_01",
    revision: 1,
    sequence: 2,
    createdAt: "2026-07-27T00:00:00.000Z",
  },
  metadata: {
    agentVisible: { customerTier: "priority" },
    private: { plant: "LON" },
  },
}

context.metadata.agentVisible.customerTier satisfies "standard" | "priority"
context.metadata.private.plant satisfies string

// @ts-expect-error metadata snapshots are immutable
context.metadata.private.plant = "NYC"

const schema = defineSchema({
  orderNumber: s.string(),
  total: s.number(),
  currency: s.string().choices(["USD", "GBP"] as const),
  note: s.string().optional(),
})

type Result = InferSchema<typeof schema>

const result: Result = {
  orderNumber: "FO-100",
  total: 42,
  currency: "USD",
}

result.currency satisfies "USD" | "GBP"

// @ts-expect-error a number field does not accept text
const invalidResult: Result = { ...result, total: "42" }
void invalidResult

const standardAiSdkTool = {
  description: "Look up a part",
  inputSchema: { type: "object" },
  execute: async (input: { partNumber: string }) => input,
}

const tools = { lookupPart: standardAiSdkTool } satisfies ProcessToolSet
const createTools: ToolFactory<Metadata, typeof tools> = () => tools
createTools(context) satisfies typeof tools | Promise<typeof tools>

const process = defineProcess({
  projectKey: "fabrication-orders",
  name: "Fabrication order intake",
  sdk: "^0.0.0",
  entrypoints: ["tools", "schema"],
})

process.entrypoints satisfies readonly ("tools" | "schema")[]

const validate: ValidationFunction<Result, Metadata> = ({ result: value }) => ({
  issues: value.total < 0 ? [{ code: "TOTAL_NEGATIVE", message: "Invalid total" }] : [],
})
void validate

const reviews: ReviewPlanner<Result, Metadata> = ({ result: value }) => ({
  requirements: [
    {
      key: "order",
      label: "Order verification",
      units: [
        {
          key: value.orderNumber,
          label: value.orderNumber,
          subject: { path: "/" },
        },
      ],
    },
  ],
})
void reviews

defineView(schema, {
  fields: {
    "/total": { role: "money", format: { currency: "/currency" } },
  },
})

const script = {
  path: "scripts/normalize-order.ts",
  description: "Normalize an order",
} satisfies ProcessScript
const skill = {
  name: "reconcile-revision",
  description: "Reconcile a revision",
  instructions: "Compare the current and prior revision.",
  scripts: [script],
  tools,
} satisfies ProcessSkill
const fixture = {
  name: "simple order",
  artifacts: [{ path: "fixtures/order.pdf", mediaType: "application/pdf" }],
  metadata: context.metadata,
  assertions: ["result.orderNumber is present"],
} satisfies ProcessFixture<Metadata>
void skill
void fixture
