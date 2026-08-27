import { afterEach, describe, expect, it, vi } from "vitest"

import { insertKaomoji } from "../src/github/insert-kaomoji"

afterEach(() => {
  document.body.replaceChildren()
})

describe("insertKaomoji", () => {
  it.each([
    { end: 0, expected: "(*´ω｀*)review", start: 0 },
    { end: 3, expected: "rev(*´ω｀*)iew", start: 3 },
    { end: 6, expected: "review(*´ω｀*)", start: 6 },
    { end: 5, expected: "r(*´ω｀*)w", start: 1 },
  ])("inserts at the current selection", ({ end, expected, start }) => {
    const textarea = document.createElement("textarea")
    textarea.value = "review"
    document.body.append(textarea)
    textarea.setSelectionRange(start, end)

    expect(insertKaomoji(textarea, "(*´ω｀*)")).toBe(true)
    expect(textarea.value).toBe(expected)
    expect(textarea.selectionStart).toBe(start + "(*´ω｀*)".length)
    expect(textarea.selectionEnd).toBe(textarea.selectionStart)
  })

  it("dispatches a bubbling input event for GitHub", () => {
    const textarea = document.createElement("textarea")
    document.body.append(textarea)
    const listener = vi.fn<(event: Event) => void>()
    document.body.addEventListener("input", listener)

    insertKaomoji(textarea, "m(_ _)m")

    expect(listener).toHaveBeenCalledOnce()
    const event = listener.mock.calls[0]?.[0]
    expect(event).toBeInstanceOf(InputEvent)
    expect((event as InputEvent).data).toBe("m(_ _)m")
    expect((event as InputEvent).inputType).toBe("insertText")
  })

  it("does not change unavailable textareas", () => {
    const textarea = document.createElement("textarea")
    textarea.value = "review"
    textarea.disabled = true
    document.body.append(textarea)

    expect(insertKaomoji(textarea, "(*´ω｀*)")).toBe(false)
    expect(textarea.value).toBe("review")
    textarea.disabled = false
    textarea.remove()
    expect(insertKaomoji(textarea, "(*´ω｀*)")).toBe(false)
  })
})
