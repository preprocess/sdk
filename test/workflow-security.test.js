import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const workflow = readFileSync(
  new URL("../.github/workflows/publish.yml", import.meta.url),
  "utf8",
)
const githubPackagesWorkflow = readFileSync(
  new URL(
    "../.github/workflows/publish-github-packages.yml",
    import.meta.url,
  ),
  "utf8",
)

test("the publish workflow is tag-only, least-privilege, and immutable", () => {
  assert.match(workflow, /tags:\s*\n\s+- "v\*\.\*\.\*"/)
  assert.doesNotMatch(workflow, /pull_request_target|workflow_run|self-hosted/)
  assert.match(workflow, /runs-on: ubuntu-latest/)
  assert.match(workflow, /contents: read/)
  assert.match(workflow, /id-token: write/)
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./)

  const actions = [...workflow.matchAll(/uses:\s+([^\s#]+)/g)].map(
    (match) => match[1],
  )
  assert.ok(actions.length > 0)
  for (const action of actions) {
    assert.match(action, /^[^@]+@[a-f0-9]{40}$/)
  }

  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /node-version: 24/)
  assert.match(workflow, /npm@11\.11\.0/)
  assert.match(
    workflow,
    /npm publish "\$RELEASE_TARBALL" --access public --provenance/,
  )
})

test("the GitHub Packages mirror is repository-scoped and credentialless", () => {
  assert.match(githubPackagesWorkflow, /workflow_dispatch:/)
  assert.match(githubPackagesWorkflow, /tags:\s*\n\s+- "v\*\.\*\.\*"/)
  assert.match(githubPackagesWorkflow, /contents: read/)
  assert.match(githubPackagesWorkflow, /packages: write/)
  assert.doesNotMatch(githubPackagesWorkflow, /id-token: write/)
  assert.doesNotMatch(
    githubPackagesWorkflow,
    /NPM_TOKEN|github_pat_|npm_[A-Za-z0-9]/,
  )
  assert.match(
    githubPackagesWorkflow,
    /NODE_AUTH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/,
  )
  assert.match(
    githubPackagesWorkflow,
    /--registry=https:\/\/npm\.pkg\.github\.com/,
  )
  assert.match(githubPackagesWorkflow, /--provenance=false/)
  assert.match(githubPackagesWorkflow, /git merge-base --is-ancestor/)
  assert.match(githubPackagesWorkflow, /node test\/release-package\.js/)

  const actions = [
    ...githubPackagesWorkflow.matchAll(/uses:\s+([^\s#]+)/g),
  ].map((match) => match[1])
  assert.ok(actions.length > 0)
  for (const action of actions) {
    assert.match(action, /^[^@]+@[a-f0-9]{40}$/)
  }
})
