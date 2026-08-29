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
  const horizontalMargin = Math.min(MARGIN, viewport.width / 2)
  const verticalMargin = Math.min(MARGIN, viewport.height / 2)
  const rightSpace = viewport.width - dialog.right - horizontalMargin
  const leftSpace = dialog.left - horizontalMargin
  const bestSideSpace = Math.max(rightSpace, leftSpace)

  if (bestSideSpace >= MIN_SIDE_WIDTH) {
    const width = Math.min(SIDE_WIDTH, bestSideSpace)
    const top = clamp(
      dialog.top,
      verticalMargin,
      viewport.height - verticalMargin - 240,
    )
    const availableHeight = viewport.height - top - verticalMargin
    const height = Math.min(
      Math.max(420, Math.min(dialog.height, MAX_HEIGHT)),
      availableHeight,
    )
    const useRightSide = rightSpace >= leftSpace
    const left = useRightSide ? dialog.right : dialog.left - width
    const kind = useRightSide ? "side-right" : "side-left"

    return { height, kind, left, top, width }
  }

  const width = Math.min(SIDE_WIDTH, viewport.width - horizontalMargin * 2)
  const height = Math.min(520, viewport.height - verticalMargin * 2)
  const left = clamp(
    toggle.right - width,
    horizontalMargin,
    viewport.width - horizontalMargin - width,
  )
  const below = toggle.bottom + POPOVER_GAP
  const preferredTop =
    below + height <= viewport.height - verticalMargin
      ? below
      : toggle.top - POPOVER_GAP - height
  const top = clamp(
    preferredTop,
    verticalMargin,
    viewport.height - verticalMargin - height,
  )

  return { height, kind: "popover", left, top, width }
}
