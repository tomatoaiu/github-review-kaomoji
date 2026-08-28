import { afterEach, describe, expect, it } from "vitest"

import { createKaomojiPicker } from "../src/ui/picker"
import type { KaomojiPicker } from "../src/ui/picker"

const mountedPickers: KaomojiPicker[] = []

function pressKey(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
  })
  target.dispatchEvent(event)
  return event
}

function mountPicker(
  random = () => 0,
  textareaFontFamily?: string,
  dialogCssText?: string,
) {
  const dialog = document.createElement("div")
  if (dialogCssText !== undefined) {
    dialog.style.cssText = dialogCssText
  }
  const textarea = document.createElement("textarea")
  if (textareaFontFamily !== undefined) {
    textarea.style.fontFamily = textareaFontFamily
  }
  const host = document.createElement("div")
  const container = document.createElement("div")
  host.append(container)
  dialog.append(textarea, host)
  document.body.append(dialog)
  dialog.getBoundingClientRect = () =>
    ({
      bottom: 640,
      height: 600,
      left: 200,
      right: 900,
      top: 40,
      width: 700,
      x: 200,
      y: 40,
      toJSON: () => ({}),
    }) as DOMRect

  const picker = createKaomojiPicker(container, {
    dialog,
    host,
    random,
    textarea,
    viewport: () => ({ height: 900, width: 1440 }),
  })
  mountedPickers.push(picker)
  return { container, dialog, textarea }
}

afterEach(() => {
  for (const picker of mountedPickers.splice(0)) {
    picker.dispose()
  }
  document.body.replaceChildren()
})

describe("createKaomojiPicker", () => {
  it("focuses search and filters all 1,000 faces", async () => {
    const { container } = mountPicker()
    container.querySelector<HTMLButtonElement>(".picker-toggle")?.click()
    await Promise.resolve()

    const search = container.querySelector<HTMLInputElement>(".picker-search")
    const results = container.querySelectorAll("[data-face-index]")
    expect(document.activeElement).toBe(search)
    expect(results).toHaveLength(1000)

    if (search === null) {
      throw new TypeError("Expected a search input")
    }
    search.value = "lgtm"
    search.dispatchEvent(new InputEvent("input", { bubbles: true }))
    expect(container.querySelectorAll("[data-face-index]")).toHaveLength(90)
  })

  it("moves between categories, search, and the face grid", async () => {
    const { container } = mountPicker()
    container.querySelector<HTMLButtonElement>(".picker-toggle")?.click()
    await Promise.resolve()

    const search = container.querySelector<HTMLInputElement>(".picker-search")
    const allCategory = container.querySelector<HTMLButtonElement>(
      '[data-category="すべて"]',
    )
    if (search === null || allCategory === null) {
      throw new TypeError("Expected keyboard controls")
    }

    allCategory.focus()
    expect(pressKey(allCategory, "ArrowDown").defaultPrevented).toBe(true)
    const thanksCategory = container.querySelector<HTMLButtonElement>(
      '[data-category="感謝"]',
    )
    expect(document.activeElement).toBe(thanksCategory)
    expect(container.querySelectorAll("[data-face-index]")).toHaveLength(60)

    if (thanksCategory === null) {
      throw new TypeError("Expected the thanks category")
    }
    pressKey(thanksCategory, "ArrowRight")
    let activeFace = document.activeElement
    expect((activeFace as HTMLElement | null)?.dataset.faceIndex).toBe("0")
    pressKey(activeFace as Element, "ArrowRight")
    activeFace = document.activeElement
    expect((activeFace as HTMLElement | null)?.dataset.faceIndex).toBe("1")
    pressKey(activeFace as Element, "ArrowLeft")
    pressKey(document.activeElement as Element, "ArrowLeft")
    expect(document.activeElement).toBe(thanksCategory)
    pressKey(thanksCategory, "ArrowLeft")
    expect(document.activeElement).toBe(search)
    pressKey(search, "ArrowDown")
    expect(
      (document.activeElement as HTMLElement | null)?.dataset.faceIndex,
    ).toBe("0")
  })

  it("selects a new random candidate on each click", async () => {
    const { container } = mountPicker(() => 0)
    container.querySelector<HTMLButtonElement>(".picker-toggle")?.click()
    await Promise.resolve()

    const randomButton =
      container.querySelector<HTMLButtonElement>(".random-button")
    randomButton?.click()
    const first = container.querySelector<HTMLButtonElement>(".random-selected")
    expect(first?.dataset.faceIndex).toBe("0")
    expect(document.activeElement).toBe(first)

    randomButton?.click()
    const second =
      container.querySelector<HTMLButtonElement>(".random-selected")
    expect(second?.dataset.faceIndex).toBe("1")
    expect(document.activeElement).toBe(second)
  })

  it("places the picker beside the review dialog without moving it", () => {
    const { container, dialog } = mountPicker()
    const toggle = container.querySelector<HTMLButtonElement>(".picker-toggle")
    const panel = container.querySelector<HTMLElement>(".picker-panel")
    dialog.style.setProperty("translate", "12px 0")
    const originalStyle = dialog.getAttribute("style")
    const originalTranslate = dialog.style.getPropertyValue("translate")

    toggle?.click()

    expect(dialog.style.getPropertyValue("translate")).toBe(originalTranslate)
    expect(dialog.style.width).toBe("")
    expect(dialog.style.borderTopRightRadius).toBe("0px")
    expect(dialog.style.borderBottomRightRadius).toBe("0px")
    expect(dialog.style.boxShadow).toBe("none")
    expect(dialog.style.getPropertyPriority("border-top-right-radius")).toBe(
      "important",
    )
    expect(dialog.style.getPropertyPriority("box-shadow")).toBe("important")
    expect(panel?.dataset.layout).toBe("side-right")
    expect(panel?.style.left).toBe("900px")
    expect(panel?.style.top).toBe("40px")
    expect(panel?.style.getPropertyValue("--kaomoji-composite-left")).toBe(
      "200px",
    )
    expect(panel?.style.getPropertyValue("--kaomoji-composite-width")).toBe(
      "1120px",
    )

    toggle?.click()
    expect(dialog.getAttribute("style")).toBe(originalStyle)
  })

  it("includes the review textarea font stack in face rendering", () => {
    const { container, textarea } = mountPicker(
      () => 0,
      '"GitHub Review Font", monospace',
    )
    const root = container.querySelector<HTMLElement>(".kaomoji-picker")

    expect(root?.style.getPropertyValue("--kaomoji-review-font-family")).toBe(
      window.getComputedStyle(textarea).fontFamily,
    )
  })

  it("matches the review dialog border, corners, and shadow", () => {
    const { container, dialog } = mountPicker(
      () => 0,
      undefined,
      "background-color: rgb(250, 251, 252); border: 2px solid rgb(1, 2, 3); border-radius: 16px; box-shadow: 0 12px 32px rgba(1, 2, 3, 0.25)",
    )
    const root = container.querySelector<HTMLElement>(".kaomoji-picker")
    const dialogStyle = window.getComputedStyle(dialog)

    expect(root?.style.getPropertyValue("--kaomoji-dialog-background")).toBe(
      dialogStyle.backgroundColor,
    )
    expect(root?.style.getPropertyValue("--kaomoji-dialog-border-top")).toBe(
      `${dialogStyle.borderTopWidth} ${dialogStyle.borderTopStyle} ${dialogStyle.borderTopColor}`,
    )
    expect(
      root?.style.getPropertyValue("--kaomoji-dialog-border-top-left-radius"),
    ).toBe(dialogStyle.borderTopLeftRadius)
    expect(root?.style.getPropertyValue("--kaomoji-dialog-box-shadow")).toBe(
      dialogStyle.boxShadow,
    )
  })

  it("uses the browser top layer when the Popover API is available", () => {
    let showCalls = 0
    let hideCalls = 0
    Object.defineProperties(HTMLElement.prototype, {
      hidePopover: {
        configurable: true,
        value() {
          hideCalls += 1
        },
      },
      showPopover: {
        configurable: true,
        value() {
          showCalls += 1
        },
      },
    })

    try {
      const { container } = mountPicker()
      const toggle =
        container.querySelector<HTMLButtonElement>(".picker-toggle")
      const panel = container.querySelector<HTMLElement>(".picker-panel")
      expect(panel?.hidden).toBe(true)

      toggle?.click()
      expect(panel?.hidden).toBe(false)
      toggle?.click()

      expect(panel?.getAttribute("popover")).toBe("manual")
      expect(panel?.hidden).toBe(true)
      expect(showCalls).toBe(1)
      expect(hideCalls).toBe(1)
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "hidePopover")
      Reflect.deleteProperty(HTMLElement.prototype, "showPopover")
    }
  })

  it("inserts the chosen face and closes the panel", async () => {
    const { container, textarea } = mountPicker()
    container.querySelector<HTMLButtonElement>(".picker-toggle")?.click()
    await Promise.resolve()

    const firstFace =
      container.querySelector<HTMLButtonElement>("[data-face-index]")
    const face = firstFace?.textContent ?? ""
    firstFace?.click()

    expect(textarea.value).toBe(face)
    expect(document.activeElement).toBe(textarea)
    expect(container.querySelector<HTMLElement>(".picker-panel")?.hidden).toBe(
      true,
    )
  })
})
