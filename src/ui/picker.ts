import {
  ALL_CATEGORIES,
  kaomojiCategories,
  kaomojiCount,
  searchKaomoji,
} from "../catalog"
import type { KaomojiEntry } from "../catalog"
import { insertKaomoji } from "../github/insert-kaomoji"
import type { PickerSettings } from "../settings"
import { calculatePanelLayout } from "./panel-position"

export type KaomojiPickerOptions = {
  dialog: HTMLElement
  host: HTMLElement
  random?: () => number
  saveSettings: (settings: PickerSettings) => Promise<void>
  settings: PickerSettings
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
  let dialogJoinSnapshot: Array<{
    name: string
    priority: string
    value: string
  }> | null = null
  let disposed = false
  let pickerSettings = { ...options.settings }
  let previousRandomFace: string | null = null
  let visibleEntries: KaomojiEntry[] = []

  const root = element("div", "kaomoji-picker")
  const reviewFontFamily = window
    .getComputedStyle(options.textarea)
    .fontFamily.trim()
  if (reviewFontFamily.length > 0) {
    root.style.setProperty("--kaomoji-review-font-family", reviewFontFamily)
  }
  const syncDialogAppearance = (): void => {
    const style = window.getComputedStyle(options.dialog)
    const border = (side: "Bottom" | "Left" | "Right" | "Top") =>
      `${style[`border${side}Width`]} ${style[`border${side}Style`]} ${style[`border${side}Color`]}`
    root.style.setProperty("--kaomoji-dialog-background", style.backgroundColor)
    root.style.setProperty("--kaomoji-dialog-border-bottom", border("Bottom"))
    root.style.setProperty("--kaomoji-dialog-border-left", border("Left"))
    root.style.setProperty("--kaomoji-dialog-border-right", border("Right"))
    root.style.setProperty("--kaomoji-dialog-border-top", border("Top"))
    root.style.setProperty(
      "--kaomoji-dialog-border-bottom-left-radius",
      style.borderBottomLeftRadius,
    )
    root.style.setProperty(
      "--kaomoji-dialog-border-bottom-right-radius",
      style.borderBottomRightRadius,
    )
    root.style.setProperty(
      "--kaomoji-dialog-border-top-left-radius",
      style.borderTopLeftRadius,
    )
    root.style.setProperty(
      "--kaomoji-dialog-border-top-right-radius",
      style.borderTopRightRadius,
    )
    root.style.setProperty("--kaomoji-dialog-box-shadow", style.boxShadow)
  }
  syncDialogAppearance()
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
  const settingsButton = button("settings-button", "⚙")
  settingsButton.title = "設定"
  settingsButton.setAttribute("aria-controls", "github-review-kaomoji-settings")
  settingsButton.setAttribute("aria-expanded", "false")
  settingsButton.setAttribute("aria-label", "顔文字ピッカーの設定")
  const randomButton = button("random-button", "↻")
  randomButton.append(element("span", "random-label", " ランダム"))
  randomButton.title = "表示中の候補からランダムに選択"
  randomButton.setAttribute("aria-label", "ランダムに選択")
  const count = element("span", "result-count")
  count.setAttribute("aria-live", "polite")
  headerActions.append(settingsButton, randomButton, count)
  header.append(title, headerActions)

  const settingsPanel = element("div", "picker-settings")
  settingsPanel.id = "github-review-kaomoji-settings"
  settingsPanel.hidden = true
  const autoOpenOption = element("label", "setting-option")
  const autoOpenCheckbox = element("input")
  autoOpenCheckbox.type = "checkbox"
  autoOpenCheckbox.checked = pickerSettings.autoOpen
  autoOpenOption.append(
    autoOpenCheckbox,
    element("span", "setting-label", "自動で開く"),
  )
  const autoCloseOption = element("label", "setting-option")
  const autoCloseCheckbox = element("input")
  autoCloseCheckbox.type = "checkbox"
  autoCloseCheckbox.checked = pickerSettings.autoClose
  autoCloseOption.append(
    autoCloseCheckbox,
    element("span", "setting-label", "自動で閉じる"),
  )
  settingsPanel.append(autoOpenOption, autoCloseOption)

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
  panel.append(header, settingsPanel, search, hint, body, status)
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

  const compositeProperties = [
    "--kaomoji-composite-height",
    "--kaomoji-composite-left",
    "--kaomoji-composite-top",
    "--kaomoji-composite-width",
  ] as const
  const dialogJoinProperties = [
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "border-top-left-radius",
    "border-top-right-radius",
    "box-shadow",
  ] as const

  const applyDialogJoinSnapshot = (): void => {
    if (dialogJoinSnapshot === null) {
      return
    }
    for (const { name, priority, value } of dialogJoinSnapshot) {
      if (value.length === 0) {
        options.dialog.style.removeProperty(name)
      } else {
        options.dialog.style.setProperty(name, value, priority)
      }
    }
  }

  const restoreDialogJoinStyles = (): void => {
    applyDialogJoinSnapshot()
    dialogJoinSnapshot = null
  }

  const joinDialogEdge = (
    layout: "popover" | "side-left" | "side-right",
  ): void => {
    if (layout === "popover") {
      restoreDialogJoinStyles()
      return
    }
    if (dialogJoinSnapshot === null) {
      dialogJoinSnapshot = dialogJoinProperties.map((name) => ({
        name,
        priority: options.dialog.style.getPropertyPriority(name),
        value: options.dialog.style.getPropertyValue(name),
      }))
    } else {
      applyDialogJoinSnapshot()
    }

    const joinedCorners =
      layout === "side-right"
        ? ["border-bottom-right-radius", "border-top-right-radius"]
        : ["border-bottom-left-radius", "border-top-left-radius"]
    for (const name of joinedCorners) {
      options.dialog.style.setProperty(name, "0", "important")
    }
    options.dialog.style.setProperty("box-shadow", "none", "important")
  }

  const updatePosition = (): void => {
    if (!state.open || disposed) {
      return
    }

    const viewport = options.viewport?.() ?? {
      height: window.innerHeight,
      width: window.innerWidth,
    }
    applyDialogJoinSnapshot()
    syncDialogAppearance()
    const dialogRect = options.dialog.getBoundingClientRect()
    const layout = calculatePanelLayout(
      dialogRect,
      toggle.getBoundingClientRect(),
      viewport,
    )
    joinDialogEdge(layout.kind)
    panel.dataset.layout = layout.kind
    panel.style.height = `${layout.height}px`
    panel.style.left = `${layout.left}px`
    panel.style.top = `${layout.top}px`
    panel.style.width = `${layout.width}px`

    if (layout.kind === "popover") {
      for (const property of compositeProperties) {
        panel.style.removeProperty(property)
      }
      return
    }
    const compositeLeft = Math.min(dialogRect.left, layout.left)
    const compositeRight = Math.max(
      dialogRect.right,
      layout.left + layout.width,
    )
    const compositeTop = Math.min(dialogRect.top, layout.top)
    const compositeBottom = Math.max(
      dialogRect.bottom,
      layout.top + layout.height,
    )
    panel.style.setProperty(
      "--kaomoji-composite-height",
      `${compositeBottom - compositeTop}px`,
    )
    panel.style.setProperty("--kaomoji-composite-left", `${compositeLeft}px`)
    panel.style.setProperty("--kaomoji-composite-top", `${compositeTop}px`)
    panel.style.setProperty(
      "--kaomoji-composite-width",
      `${compositeRight - compositeLeft}px`,
    )
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
    settingsPanel.hidden = true
    settingsButton.setAttribute("aria-expanded", "false")
    restoreDialogJoinStyles()
    toggle.setAttribute("aria-expanded", "false")
    if (focusToggle) {
      toggle.focus({ preventScroll: true })
    }
  }

  const open = (focusSearch: boolean): void => {
    if (state.open) {
      return
    }
    state.open = true
    refresh()
    panel.hidden = false
    if (usesPopover) {
      panel.showPopover()
    }
    toggle.setAttribute("aria-expanded", "true")
    updatePosition()
    if (focusSearch) {
      queueMicrotask(() => {
        if (state.open && !disposed) {
          search.focus({ preventScroll: true })
        }
      })
    }
  }

  const entryForButton = (
    faceButton: HTMLButtonElement,
  ): KaomojiEntry | null => {
    const index = Number(faceButton.dataset.faceIndex)
    return Number.isInteger(index) ? (visibleEntries[index] ?? null) : null
  }

  const updatePickerSettings = (settings: Partial<PickerSettings>): void => {
    pickerSettings = { ...pickerSettings, ...settings }
    void options.saveSettings({ ...pickerSettings }).catch(() => {
      status.textContent = "設定を保存できませんでした"
    })
  }

  settingsButton.addEventListener("click", () => {
    settingsPanel.hidden = !settingsPanel.hidden
    settingsButton.setAttribute("aria-expanded", String(!settingsPanel.hidden))
  })
  autoOpenCheckbox.addEventListener("change", () => {
    updatePickerSettings({ autoOpen: autoOpenCheckbox.checked })
  })
  autoCloseCheckbox.addEventListener("change", () => {
    updatePickerSettings({ autoClose: autoCloseCheckbox.checked })
  })

  toggle.addEventListener("click", () => {
    if (state.open) {
      close(true)
    } else {
      open(true)
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
      if (pickerSettings.autoClose) {
        close(false)
      }
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

  if (pickerSettings.autoOpen) {
    open(false)
  }

  return {
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      restoreDialogJoinStyles()
      resizeObserver?.disconnect()
      document.removeEventListener("pointerdown", onDocumentPointerDown, true)
      window.removeEventListener("resize", onViewportChange)
      window.removeEventListener("scroll", onViewportChange, true)
      root.remove()
    },
  }
}
