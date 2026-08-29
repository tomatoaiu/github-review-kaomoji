import { beforeEach, describe, expect, it, vi } from "vitest"

type StoredSettings = {
  autoClose: boolean
  autoOpen: boolean
}

const storageMock = vi.hoisted(() => {
  const getValue = vi.fn<() => Promise<StoredSettings>>()
  const setValue = vi.fn<(value: StoredSettings) => Promise<void>>()
  const defineItem = vi.fn<
    (
      key: string,
      options: { fallback: StoredSettings },
    ) => { getValue: typeof getValue; setValue: typeof setValue }
  >(() => ({ getValue, setValue }))
  return { defineItem, getValue, setValue }
})

vi.mock("wxt/utils/storage", () => ({
  storage: { defineItem: storageMock.defineItem },
}))

import {
  DEFAULT_PICKER_SETTINGS,
  loadPickerSettings,
  savePickerSettings,
} from "../src/settings"

beforeEach(() => {
  storageMock.getValue.mockReset()
  storageMock.setValue.mockReset()
})

describe("picker settings", () => {
  it("defines local settings with the requested defaults", () => {
    expect(storageMock.defineItem).toHaveBeenCalledWith(
      "local:pickerSettings",
      { fallback: DEFAULT_PICKER_SETTINGS },
    )
    expect(DEFAULT_PICKER_SETTINGS).toEqual({
      autoClose: false,
      autoOpen: true,
    })
  })

  it("loads stored settings", async () => {
    storageMock.getValue.mockResolvedValue({
      autoClose: true,
      autoOpen: false,
    })

    await expect(loadPickerSettings()).resolves.toEqual({
      autoClose: true,
      autoOpen: false,
    })
  })

  it("falls back when extension storage is unavailable", async () => {
    storageMock.getValue.mockRejectedValue(new Error("unavailable"))

    await expect(loadPickerSettings()).resolves.toEqual(DEFAULT_PICKER_SETTINGS)
  })

  it("saves a settings snapshot", async () => {
    storageMock.setValue.mockResolvedValue(undefined)

    await savePickerSettings({ autoClose: true, autoOpen: false })

    expect(storageMock.setValue).toHaveBeenCalledWith({
      autoClose: true,
      autoOpen: false,
    })
  })
})
