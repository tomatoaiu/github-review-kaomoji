import { storage } from "wxt/utils/storage"

export type PickerSettings = {
  autoClose: boolean
  autoOpen: boolean
}

export const DEFAULT_PICKER_SETTINGS: PickerSettings = {
  autoClose: false,
  autoOpen: true,
}

const pickerSettingsItem = storage.defineItem<PickerSettings>(
  "local:pickerSettings",
  { fallback: DEFAULT_PICKER_SETTINGS },
)

export async function loadPickerSettings(): Promise<PickerSettings> {
  try {
    const settings = await pickerSettingsItem.getValue()
    return { ...DEFAULT_PICKER_SETTINGS, ...settings }
  } catch {
    return { ...DEFAULT_PICKER_SETTINGS }
  }
}

export function savePickerSettings(settings: PickerSettings): Promise<void> {
  return pickerSettingsItem.setValue({ ...settings })
}
