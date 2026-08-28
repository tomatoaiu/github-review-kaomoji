import { describe, expect, it } from "vitest"

import { calculatePanelLayout } from "../src/ui/panel-position"
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

describe("calculatePanelLayout", () => {
  it("uses the open side of the review dialog", () => {
    expect(
      calculatePanelLayout(
        rectangle(200, 40, 700, 600),
        rectangle(800, 100, 80, 30),
        { height: 900, width: 1440 },
      ),
    ).toMatchObject({ kind: "side-right", left: 900, width: 420 })

    expect(
      calculatePanelLayout(
        rectangle(600, 40, 700, 600),
        rectangle(1200, 100, 80, 30),
        { height: 900, width: 1440 },
      ),
    ).toMatchObject({ kind: "side-left", left: 180, width: 420 })
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
