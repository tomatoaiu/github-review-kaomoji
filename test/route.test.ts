import { describe, expect, it } from "vitest"

import { isPullRequestRoute } from "../src/github/route"

describe("isPullRequestRoute", () => {
  it.each([
    "https://github.com/octo/repo/pull/1",
    "https://github.com/octo/repo/pull/123/files",
    "https://github.com/octo/repo/pull/123/commits/abc",
  ])("accepts pull request routes: %s", (url) => {
    expect(isPullRequestRoute(new URL(url))).toBe(true)
  })

  it.each([
    "https://github.com/octo/repo",
    "https://github.com/octo/repo/issues/1",
    "https://github.com/octo/repo/pulls",
    "https://github.com/octo/repo/pull/new",
    "https://example.com/octo/repo/pull/1",
  ])("rejects non-pull-request routes: %s", (url) => {
    expect(isPullRequestRoute(new URL(url))).toBe(false)
  })
})
