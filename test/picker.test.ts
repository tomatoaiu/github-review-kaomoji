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

function mountPicker(random = () => 0) {
  const dialog = document.createElement("div")
  const textarea = document.createElement("textarea")
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

  it("expands the review dialog into a two-column layout and restores it", () => {
    const { container, dialog } = mountPicker()
    const toggle = container.querySelector<HTMLButtonElement>(".picker-toggle")
    const panel = container.querySelector<HTMLElement>(".picker-panel")

    toggle?.click()
    expect(dialog.style.width).toBe("1120px")
    expect(dialog.style.maxWidth).toBe("1120px")
    expect(dialog.style.paddingRight).toBe("420px")
    expect(dialog.style.getPropertyPriority("width")).toBe("important")
    expect(panel?.dataset.layout).toBe("integrated")

    toggle?.click()
    expect(dialog.getAttribute("style")).toBeNull()
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
