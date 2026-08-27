import { describe, expect, it } from "vitest"

import {
  calculateDialogExpansion,
  calculatePanelLayout,
} from "../src/ui/panel-position"
import type { Rectangle } from "../src/ui/panel-position"

function rectangle(
  left: number,
  top: number,
  width: number,
  height: number,
): Rectangle {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}

describe("calculateDialogExpansion", () => {
  it("preserves a 640px review column when the viewport has room", () => {
    expect(calculateDialogExpansion(640, 1200)).toEqual({
      left: 70,
      panelWidth: 420,
      width: 1060,
    })
  })

  it("shrinks the panel before falling back on constrained viewports", () => {
    expect(calculateDialogExpansion(640, 794)).toEqual({
      left: 16,
      panelWidth: 362,
      width: 762,
    })
    expect(calculateDialogExpansion(640, 751)).toBeNull()
  })
})

describe("calculatePanelLayout", () => {
  it("uses the open side of the review dialog", () => {
    expect(
      calculatePanelLayout(
        rectangle(200, 40, 700, 600),
        rectangle(800, 100, 80, 30),
        { height: 900, width: 1440 },
      ),
    ).toMatchObject({ kind: "side", left: 908, width: 420 })

    expect(
      calculatePanelLayout(
        rectangle(600, 40, 700, 600),
        rectangle(1200, 100, 80, 30),
        { height: 900, width: 1440 },
      ),
    ).toMatchObject({ kind: "side", left: 172, width: 420 })
  })

  it("falls back to a compact popover on narrow viewports", () => {
    const layout = calculatePanelLayout(
      rectangle(100, 40, 700, 600),
      rectangle(700, 100, 80, 30),
      { height: 700, width: 900 },
    )

    expect(layout.kind).toBe("popover")
    expect(layout.left).toBeGreaterThanOrEqual(8)
    expect(layout.left + layout.width).toBeLessThanOrEqual(892)
    expect(layout.top + layout.height).toBeLessThanOrEqual(692)
  })
})
