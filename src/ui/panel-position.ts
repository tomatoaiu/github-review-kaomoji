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
  kind: "popover" | "side-left" | "side-right"
  left: number
  top: number
  width: number
}

const MARGIN = 8
const POPOVER_GAP = 8
const SIDE_WIDTH = 420
const MIN_SIDE_WIDTH = 320
const MAX_HEIGHT = 620

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum))
}

export function calculatePanelLayout(
  dialog: Rectangle,
  toggle: Rectangle,
  viewport: Viewport,
): PanelLayout {
  const rightSpace = viewport.width - dialog.right - MARGIN
  const leftSpace = dialog.left - MARGIN
  const bestSideSpace = Math.max(rightSpace, leftSpace)

  if (bestSideSpace >= MIN_SIDE_WIDTH) {
    const width = Math.min(SIDE_WIDTH, bestSideSpace)
    const top = clamp(dialog.top, MARGIN, viewport.height - MARGIN - 240)
    const availableHeight = viewport.height - top - MARGIN
    const height = Math.min(
      Math.max(420, Math.min(dialog.height, MAX_HEIGHT)),
      availableHeight,
    )
    const useRightSide = rightSpace >= leftSpace
    const left = useRightSide ? dialog.right : dialog.left - width
    const kind = useRightSide ? "side-right" : "side-left"

    return { height, kind, left, top, width }
  }

  const width = Math.min(SIDE_WIDTH, viewport.width - MARGIN * 2)
  const height = Math.min(520, viewport.height - MARGIN * 2)
  const left = clamp(
    toggle.right - width,
    MARGIN,
    viewport.width - MARGIN - width,
  )
  const below = toggle.bottom + POPOVER_GAP
  const top =
    below + height <= viewport.height - MARGIN
      ? below
      : Math.max(MARGIN, toggle.top - POPOVER_GAP - height)

  return { height, kind: "popover", left, top, width }
}
