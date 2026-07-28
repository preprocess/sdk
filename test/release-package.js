import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const expectedPackageFiles = [
  "package/README.md",
  "package/dist/index.d.ts",
  "package/dist/index.js",
  "package/dist/presentation.d.ts",
  "package/dist/presentation.js",
  "package/dist/process.d.ts",
  "package/dist/process.js",
  "package/dist/resources.d.ts",
  "package/dist/resources.js",
  "package/dist/review.d.ts",
  "package/dist/review.js",
  "package/dist/runtime.d.ts",
  "package/dist/runtime.js",
  "package/dist/schema.d.ts",
  "package/dist/schema.js",
  "package/package.json",
]

function isolatedEnvironment(cleanNpmConfig) {
  const environment = {
    ...process.env,
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_USERCONFIG: cleanNpmConfig,
  }

  delete environment.NODE_AUTH_TOKEN
  delete environment.NPM_TOKEN
  delete environment.NPM_CONFIG_TOKEN
  return environment
}

function run(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
}

export function createPackedTarball() {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "preprocess-sdk-pack-"))
  const cleanNpmConfig = join(temporaryDirectory, ".npmrc")
  writeFileSync(cleanNpmConfig, "")

  const result = JSON.parse(
    run(
      "npm",
      ["pack", "--json", "--pack-destination", temporaryDirectory],
      { env: isolatedEnvironment(cleanNpmConfig) },
    ),
  )
  assert.equal(result.length, 1)

  return join(temporaryDirectory, result[0].filename)
}

export function verifyReleasePackage(tarball) {
  const absoluteTarball = resolve(tarball)
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "preprocess-sdk-consumer-"),
  )
  const cleanNpmConfig = join(temporaryDirectory, ".npmrc")
  writeFileSync(cleanNpmConfig, "")
  const environment = isolatedEnvironment(cleanNpmConfig)

  const inventory = run("tar", ["-tzf", absoluteTarball])
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort()
  assert.deepEqual(inventory, [...expectedPackageFiles].sort())

  const extractedDirectory = join(temporaryDirectory, "extracted")
  run("mkdir", ["-p", extractedDirectory])
  run("tar", ["-xzf", absoluteTarball, "-C", extractedDirectory])
  const packedManifestPath = join(extractedDirectory, "package", "package.json")
  const packedManifestText = readFileSync(packedManifestPath, "utf8")
  const packedManifest = JSON.parse(packedManifestText)

  assert.equal(packedManifest.name, "@preprocess/sdk")
  assert.equal(packedManifest.version, "1.0.0")
  assert.equal(packedManifest.license, "UNLICENSED")
  assert.equal(packedManifest.private, undefined)
  assert.equal(packedManifest.dependencies, undefined)
  assert.equal(packedManifest.optionalDependencies, undefined)
  assert.equal(packedManifest.peerDependencies, undefined)
  assert.equal(packedManifest.scripts?.preinstall, undefined)
  assert.equal(packedManifest.scripts?.install, undefined)
  assert.equal(packedManifest.scripts?.postinstall, undefined)
  assert.equal(packedManifest.publishConfig?.access, "public")
  assert.equal(
    packedManifest.publishConfig?.registry,
    "https://registry.npmjs.org/",
  )
  assert.doesNotMatch(packedManifestText, /(?:workspace|file|link):/)
  assert.doesNotMatch(packedManifestText, /Users\/|home\/runner|[A-Z]:\\/)

  const consumerDirectory = join(temporaryDirectory, "consumer")
  run("mkdir", ["-p", consumerDirectory])
  writeFileSync(
    join(consumerDirectory, "package.json"),
    JSON.stringify({ name: "sdk-release-probe", private: true, type: "module" }),
  )
  run(
    "npm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      absoluteTarball,
    ],
    { cwd: consumerDirectory, env: environment },
  )

  writeFileSync(
    join(consumerDirectory, "runtime-probe.mjs"),
    `import assert from "node:assert/strict"
import * as sdk from "@preprocess/sdk"

assert.deepEqual(Object.keys(sdk).sort(), [
  "defineProcess",
  "defineSchema",
  "defineView",
  "expression",
  "s",
])
const process = sdk.defineProcess({
  projectKey: "release-probe",
  name: "Release probe",
  sdk: "^1.0.0",
})
assert.equal(process.kind, "preprocess.process")
`,
  )
  run(process.execPath, ["runtime-probe.mjs"], { cwd: consumerDirectory })

  writeFileSync(
    join(consumerDirectory, "type-probe.ts"),
    `import {
  defineProcess,
  defineSchema,
  s,
  type InferSchema,
} from "@preprocess/sdk"

const process = defineProcess({
  projectKey: "release-probe",
  name: "Release probe",
  sdk: "^1.0.0",
})
const schema = defineSchema({
  orderNumber: s.string(),
  quantity: s.number(),
})
type Result = InferSchema<typeof schema>
const result: Result = { orderNumber: "FO-1", quantity: 1 }
process.kind satisfies "preprocess.process"
result.quantity satisfies number
`,
  )
  writeFileSync(
    join(consumerDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        strict: true,
        target: "ES2022",
      },
      include: ["type-probe.ts"],
    }),
  )
  run(
    process.execPath,
    [join(repositoryRoot, "node_modules/typescript/lib/tsc.js"), "-p", "."],
    { cwd: consumerDirectory },
  )

  return {
    name: packedManifest.name,
    version: packedManifest.version,
    inventory,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tarball = process.argv[2] ?? createPackedTarball()
  process.stdout.write(`${JSON.stringify(verifyReleasePackage(tarball), null, 2)}\n`)
}
