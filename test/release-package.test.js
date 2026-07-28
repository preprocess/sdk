import test from "node:test"

import {
  createPackedTarball,
  verifyReleasePackage,
} from "./release-package.js"

test("the exact release tarball installs and exposes the v1 type/runtime contract", () => {
  verifyReleasePackage(createPackedTarball())
})
