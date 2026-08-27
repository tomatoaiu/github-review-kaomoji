export function insertKaomoji(
  textarea: HTMLTextAreaElement,
  kaomoji: string,
): boolean {
  if (
    !textarea.isConnected ||
    textarea.disabled ||
    textarea.readOnly ||
    kaomoji.length === 0
  ) {
    return false
  }

  const start = textarea.selectionStart ?? textarea.value.length
  const end = textarea.selectionEnd ?? start
  textarea.focus({ preventScroll: true })
  textarea.setRangeText(kaomoji, start, end, "end")
  textarea.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: kaomoji,
      inputType: "insertText",
    }),
  )
  return true
}
