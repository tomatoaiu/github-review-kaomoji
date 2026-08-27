export type Rectangle = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export type Viewport = {
  height: number
  width: number
}

export type PanelLayout = {
  height: number
  kind: "popover" | "side"
  left: number
  top: number
  width: number
}

export type DialogExpansion = {
  left: number
  panelWidth: number
  width: number
}

const MARGIN = 8
const DIALOG_MARGIN = 16
const GAP = 8
const SIDE_WIDTH = 420
const MIN_SIDE_WIDTH = 320
const MIN_REVIEW_WIDTH = 400
const MAX_HEIGHT = 620

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum))
}

export function calculateDialogExpansion(
  dialogWidth: number,
  viewportWidth: number,
): DialogExpansion | null {
  const availableWidth = viewportWidth - DIALOG_MARGIN * 2
  if (availableWidth < MIN_REVIEW_WIDTH + MIN_SIDE_WIDTH) {
    return null
  }

  const width = Math.min(
    Math.max(dialogWidth, MIN_REVIEW_WIDTH) + SIDE_WIDTH,
    availableWidth,
  )
  const panelWidth = Math.min(SIDE_WIDTH, width - MIN_REVIEW_WIDTH)

  return {
    left: (viewportWidth - width) / 2,
    panelWidth,
    width,
  }
}

export function calculatePanelLayout(
  dialog: Rectangle,
  toggle: Rectangle,
  viewport: Viewport,
): PanelLayout {
  const rightSpace = viewport.width - dialog.right - GAP - MARGIN
  const leftSpace = dialog.left - GAP - MARGIN
  const bestSideSpace = Math.max(rightSpace, leftSpace)

  if (bestSideSpace >= MIN_SIDE_WIDTH) {
    const width = Math.min(SIDE_WIDTH, bestSideSpace)
    const top = clamp(dialog.top, MARGIN, viewport.height - MARGIN - 240)
    const availableHeight = viewport.height - top - MARGIN
    const height = Math.min(
      Math.max(420, Math.min(dialog.height, MAX_HEIGHT)),
      availableHeight,
    )
    const left =
      rightSpace >= leftSpace ? dialog.right + GAP : dialog.left - GAP - width

    return { height, kind: "side", left, top, width }
  }

  const width = Math.min(SIDE_WIDTH, viewport.width - MARGIN * 2)
  const height = Math.min(520, viewport.height - MARGIN * 2)
  const left = clamp(
    toggle.right - width,
    MARGIN,
    viewport.width - MARGIN - width,
  )
  const below = toggle.bottom + GAP
  const top =
    below + height <= viewport.height - MARGIN
      ? below
      : Math.max(MARGIN, toggle.top - GAP - height)

  return { height, kind: "popover", left, top, width }
}
