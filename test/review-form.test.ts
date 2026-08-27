import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { findReviewForm } from "../src/github/review-form"

const fixture = readFileSync("test/fixtures/review-dialog.html", "utf8")

afterEach(() => {
  document.body.replaceChildren()
})

describe("findReviewForm", () => {
  it("finds the final review textarea without relying on hashed classes", () => {
    document.body.innerHTML = fixture

    const result = findReviewForm()

    expect(result?.dialog.getAttribute("data-component")).toBe(
      "AnchoredOverlay",
    )
    expect(result?.textarea.id).toBe("review-summary")
    expect(result?.anchor.dataset.component).toBe("ActionBar")
    expect(result?.textarea.id).not.toBe("unrelated")
  })

  it("ignores hidden overlays", () => {
    document.body.innerHTML = fixture
    document
      .querySelector("[data-visibility-visible]")
      ?.removeAttribute("data-visibility-visible")

    expect(findReviewForm()).toBeNull()
  })

  it("requires the markdown toolbar to point at the textarea", () => {
    document.body.innerHTML = fixture
    document
      .querySelector("markdown-toolbar")
      ?.setAttribute("for", "missing-textarea")

    expect(findReviewForm()).toBeNull()
  })
})
