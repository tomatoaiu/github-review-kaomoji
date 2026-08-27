import {
  ALL_CATEGORIES,
  kaomojiCategories,
  kaomojiCount,
  searchKaomoji,
} from "../catalog"
import type { KaomojiEntry } from "../catalog"
import { insertKaomoji } from "../github/insert-kaomoji"
import {
  calculateDialogExpansion,
  calculatePanelLayout,
} from "./panel-position"

export type KaomojiPickerOptions = {
  dialog: HTMLElement
  host: HTMLElement
  random?: () => number
  textarea: HTMLTextAreaElement
  viewport?: () => { height: number; width: number }
}

export type KaomojiPicker = {
  dispose: () => void
}

type PickerState = {
  category: string
  open: boolean
  query: string
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tagName)
  if (className !== undefined) {
    result.className = className
  }
  if (text !== undefined) {
    result.textContent = text
  }
  return result
}

function button(className: string, text: string): HTMLButtonElement {
  const result = element("button", className, text)
  result.type = "button"
  return result
}

export function createKaomojiPicker(
  container: HTMLElement,
  options: KaomojiPickerOptions,
): KaomojiPicker {
  const random = options.random ?? Math.random
  const state: PickerState = {
    category: ALL_CATEGORIES,
    open: false,
    query: "",
  }
  let dialogHadStyleAttribute = false
  let dialogStyleSnapshot: Array<{
    name: string
    priority: string
    value: string
  }> | null = null
  let dialogTranslateX = 0
  let dialogWidthBeforeOpen: number | null = null
  let disposed = false
  let previousRandomFace: string | null = null
  let visibleEntries: KaomojiEntry[] = []

  const root = element("div", "kaomoji-picker")
  const toggle = button("picker-toggle", "(*´ω｀*) 顔文字")
  toggle.setAttribute("aria-controls", "github-review-kaomoji-panel")
  toggle.setAttribute("aria-expanded", "false")
  toggle.setAttribute("aria-haspopup", "dialog")

  const panel = element("section", "picker-panel")
  panel.id = "github-review-kaomoji-panel"
  panel.setAttribute("aria-label", "顔文字ピッカー")
  panel.setAttribute("popover", "manual")
  panel.setAttribute("role", "dialog")
  panel.hidden = true
  const usesPopover =
    typeof panel.showPopover === "function" &&
    typeof panel.hidePopover === "function"

  const header = element("header", "picker-header")
  const title = element("strong", "picker-title", "顔文字")
  const headerActions = element("div", "picker-header-actions")
  const randomButton = button("random-button", "↻ ランダム")
  randomButton.title = "表示中の候補からランダムに選択"
  const count = element("span", "result-count")
  count.setAttribute("aria-live", "polite")
  headerActions.append(randomButton, count)
  header.append(title, headerActions)

  const search = element("input", "picker-search")
  search.type = "search"
  search.placeholder = "顔文字を検索…"
  search.autocomplete = "off"
  search.spellcheck = false
  search.setAttribute("aria-label", "顔文字を検索")
  search.setAttribute("aria-keyshortcuts", "ArrowDown ArrowUp")

  const hint = element(
    "div",
    "keyboard-hint",
    "↓で候補へ · Tabでカテゴリ · 矢印キーで移動 · Enterで挿入",
  )
  const body = element("div", "picker-body")
  const categoryRail = element("nav", "category-rail")
  categoryRail.setAttribute("aria-label", "顔文字カテゴリ")
  categoryRail.setAttribute("aria-orientation", "vertical")
  categoryRail.setAttribute("role", "toolbar")
  const results = element("div", "face-grid")
  results.setAttribute("aria-label", "顔文字の検索結果")
  results.setAttribute("role", "group")
  body.append(categoryRail, results)

  const status = element("div", "visually-hidden")
  status.setAttribute("aria-live", "polite")
  status.setAttribute("role", "status")
  panel.append(header, search, hint, body, status)
  root.append(toggle, panel)
  container.replaceChildren(root)

  const categoryButtons = [
    { category: ALL_CATEGORIES, count: kaomojiCount },
    ...kaomojiCategories.map(({ category, faces }) => ({
      category,
      count: faces.length,
    })),
  ].map(({ category, count: categoryCount }) => {
    const categoryButton = button("category-button", category)
    categoryButton.dataset.category = category
    categoryButton.append(
      element("span", "category-count", String(categoryCount)),
    )
    categoryRail.append(categoryButton)
    return categoryButton
  })

  const faceButtons = (): HTMLButtonElement[] => [
    ...results.querySelectorAll<HTMLButtonElement>("[data-face-index]"),
  ]

  const focusFace = (faceButton: HTMLButtonElement): void => {
    for (const candidate of faceButtons()) {
      candidate.tabIndex = candidate === faceButton ? 0 : -1
    }
    faceButton.focus({ preventScroll: true })
    faceButton.scrollIntoView?.({ block: "nearest" })
  }

  const activeCategoryButton = (): HTMLButtonElement | null =>
    categoryButtons.find(
      (categoryButton) => categoryButton.dataset.category === state.category,
    ) ?? null

  const refresh = (): void => {
    visibleEntries = searchKaomoji(state.category, state.query)
    count.textContent = `${visibleEntries.length} / ${kaomojiCount}件`

    for (const categoryButton of categoryButtons) {
      const active = categoryButton.dataset.category === state.category
      categoryButton.classList.toggle("active", active)
      categoryButton.setAttribute("aria-pressed", String(active))
      categoryButton.tabIndex = active ? 0 : -1
    }

    const fragment = document.createDocumentFragment()
    for (const [index, entry] of visibleEntries.entries()) {
      const faceButton = button("face-button", entry.face)
      faceButton.dataset.faceIndex = String(index)
      faceButton.tabIndex = index === 0 ? 0 : -1
      faceButton.title = `${entry.category}: ${entry.face}`
      fragment.append(faceButton)
    }
    if (visibleEntries.length === 0) {
      fragment.append(
        element("div", "empty-message", "一致する顔文字がありません"),
      )
    }
    results.replaceChildren(fragment)
  }

  const expandedDialogProperties = [
    "box-sizing",
    "max-width",
    "padding-right",
    "translate",
    "width",
  ] as const

  const expandDialog = (
    width: number,
    left: number,
    panelWidth: number,
  ): DOMRect => {
    if (dialogStyleSnapshot === null) {
      dialogHadStyleAttribute = options.dialog.hasAttribute("style")
      dialogStyleSnapshot = expandedDialogProperties.map((name) => ({
        name,
        priority: options.dialog.style.getPropertyPriority(name),
        value: options.dialog.style.getPropertyValue(name),
      }))
    }

    options.dialog.style.setProperty("box-sizing", "border-box", "important")
    options.dialog.style.setProperty("max-width", `${width}px`, "important")
    options.dialog.style.setProperty(
      "padding-right",
      `${panelWidth}px`,
      "important",
    )
    options.dialog.style.setProperty("width", `${width}px`, "important")
    options.dialog.style.setProperty(
      "translate",
      `${dialogTranslateX}px 0`,
      "important",
    )

    let dialogRect = options.dialog.getBoundingClientRect()
    const correction = left - dialogRect.left
    if (Math.abs(correction) >= 0.5) {
      dialogTranslateX += correction
      options.dialog.style.setProperty(
        "translate",
        `${dialogTranslateX}px 0`,
        "important",
      )
      dialogRect = options.dialog.getBoundingClientRect()
    }
    return dialogRect
  }

  const restoreDialog = (): void => {
    if (dialogStyleSnapshot === null) {
      return
    }
    for (const { name, priority, value } of dialogStyleSnapshot) {
      if (value.length === 0) {
        options.dialog.style.removeProperty(name)
      } else {
        options.dialog.style.setProperty(name, value, priority)
      }
    }
    if (!dialogHadStyleAttribute && options.dialog.style.length === 0) {
      options.dialog.removeAttribute("style")
    }
    dialogStyleSnapshot = null
    dialogTranslateX = 0
  }

  const updatePosition = (): void => {
    if (!state.open || disposed) {
      return
    }

    const viewport = options.viewport?.() ?? {
      height: window.innerHeight,
      width: window.innerWidth,
    }
    const dialogRect = options.dialog.getBoundingClientRect()
    const expansion = calculateDialogExpansion(
      dialogWidthBeforeOpen ?? dialogRect.width,
      viewport.width,
    )

    if (expansion !== null) {
      const expandedDialog = expandDialog(
        expansion.width,
        expansion.left,
        expansion.panelWidth,
      )
      panel.dataset.layout = "integrated"
      panel.style.height = `${expandedDialog.height}px`
      panel.style.left = `${expandedDialog.right - expansion.panelWidth}px`
      panel.style.top = `${expandedDialog.top}px`
      panel.style.width = `${expansion.panelWidth}px`
      return
    }

    restoreDialog()
    const layout = calculatePanelLayout(
      options.dialog.getBoundingClientRect(),
      toggle.getBoundingClientRect(),
      viewport,
    )
    panel.dataset.layout = layout.kind
    panel.style.height = `${layout.height}px`
    panel.style.left = `${layout.left}px`
    panel.style.top = `${layout.top}px`
    panel.style.width = `${layout.width}px`
  }

  const close = (focusToggle: boolean): void => {
    if (!state.open) {
      return
    }
    state.open = false
    if (usesPopover) {
      panel.hidePopover()
    }
    panel.hidden = true
    restoreDialog()
    dialogWidthBeforeOpen = null
    toggle.setAttribute("aria-expanded", "false")
    if (focusToggle) {
      toggle.focus({ preventScroll: true })
    }
  }

  const open = (): void => {
    if (state.open) {
      return
    }
    dialogWidthBeforeOpen = options.dialog.getBoundingClientRect().width
    state.open = true
    refresh()
    panel.hidden = false
    if (usesPopover) {
      panel.showPopover()
    }
    toggle.setAttribute("aria-expanded", "true")
    updatePosition()
    queueMicrotask(() => {
      if (state.open && !disposed) {
        search.focus({ preventScroll: true })
      }
    })
  }

  const entryForButton = (
    faceButton: HTMLButtonElement,
  ): KaomojiEntry | null => {
    const index = Number(faceButton.dataset.faceIndex)
    return Number.isInteger(index) ? (visibleEntries[index] ?? null) : null
  }

  toggle.addEventListener("click", () => {
    if (state.open) {
      close(true)
    } else {
      open()
    }
  })

  search.addEventListener("input", () => {
    state.query = search.value
    refresh()
  })
  search.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return
    }
    const buttons = faceButtons()
    const destination = event.key === "ArrowDown" ? buttons[0] : buttons.at(-1)
    if (destination === undefined) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    focusFace(destination)
  })

  categoryRail.addEventListener("click", (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-category]")
        : null
    if (target === null || !categoryRail.contains(target)) {
      return
    }
    state.category = target.dataset.category ?? ALL_CATEGORIES
    refresh()
  })
  categoryRail.addEventListener("keydown", (event) => {
    const target =
      event.target instanceof HTMLButtonElement &&
      event.target.dataset.category !== undefined
        ? event.target
        : null
    if (
      target === null ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    if (event.key === "ArrowLeft") {
      search.focus({ preventScroll: true })
      return
    }
    if (event.key === "ArrowRight") {
      const firstFace = faceButtons()[0]
      if (firstFace !== undefined) {
        focusFace(firstFace)
      }
      return
    }

    const index = categoryButtons.indexOf(target)
    const direction = event.key === "ArrowDown" ? 1 : -1
    const nextIndex =
      (index + direction + categoryButtons.length) % categoryButtons.length
    const next = categoryButtons[nextIndex]
    if (next === undefined) {
      return
    }
    state.category = next.dataset.category ?? ALL_CATEGORIES
    refresh()
    next.focus({ preventScroll: true })
  })

  results.addEventListener("click", (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-face-index]")
        : null
    if (target === null || !results.contains(target)) {
      return
    }
    const entry = entryForButton(target)
    if (entry !== null && insertKaomoji(options.textarea, entry.face)) {
      close(false)
    }
  })
  results.addEventListener("keydown", (event) => {
    const target =
      event.target instanceof HTMLButtonElement &&
      event.target.dataset.faceIndex !== undefined
        ? event.target
        : null
    if (
      target === null ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return
    }

    const buttons = faceButtons()
    const index = buttons.indexOf(target)
    if (index < 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    if (event.key === "ArrowLeft" && index % 2 === 0) {
      activeCategoryButton()?.focus({ preventScroll: true })
      return
    }
    if (event.key === "ArrowUp" && index < 2) {
      search.focus({ preventScroll: true })
      return
    }

    let nextIndex = index
    if (event.key === "ArrowLeft") {
      nextIndex = Math.max(0, index - 1)
    } else if (event.key === "ArrowRight") {
      nextIndex = Math.min(buttons.length - 1, index + 1)
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(0, index - 2)
    } else if (event.key === "ArrowDown") {
      nextIndex = Math.min(buttons.length - 1, index + 2)
    }
    const destination = buttons[nextIndex]
    if (destination !== undefined) {
      focusFace(destination)
    }
  })

  randomButton.addEventListener("click", () => {
    if (visibleEntries.length === 0) {
      status.textContent = "選択できる顔文字がありません"
      return
    }

    const candidates = visibleEntries
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          visibleEntries.length === 1 || entry.face !== previousRandomFace,
      )
    const randomIndex = Math.min(
      candidates.length - 1,
      Math.floor(random() * candidates.length),
    )
    const selected = candidates[randomIndex]
    const selectedButton =
      selected === undefined ? undefined : faceButtons()[selected.index]
    if (selected === undefined || selectedButton === undefined) {
      return
    }

    previousRandomFace = selected.entry.face
    for (const faceButton of faceButtons()) {
      faceButton.classList.toggle(
        "random-selected",
        faceButton === selectedButton,
      )
    }
    focusFace(selectedButton)
    status.textContent = `${selected.entry.face} をランダム選択しました`
  })

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    close(true)
  })

  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (state.open && !event.composedPath().includes(options.host)) {
      close(false)
    }
  }
  const onViewportChange = (): void => updatePosition()
  document.addEventListener("pointerdown", onDocumentPointerDown, true)
  window.addEventListener("resize", onViewportChange)
  window.addEventListener("scroll", onViewportChange, true)

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updatePosition)
  resizeObserver?.observe(options.dialog)

  return {
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      restoreDialog()
      dialogWidthBeforeOpen = null
      resizeObserver?.disconnect()
      document.removeEventListener("pointerdown", onDocumentPointerDown, true)
      window.removeEventListener("resize", onViewportChange)
      window.removeEventListener("scroll", onViewportChange, true)
      root.remove()
    },
  }
}
