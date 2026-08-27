export type ReviewFormElements = {
  anchor: HTMLElement
  dialog: HTMLElement
  textarea: HTMLTextAreaElement
}

const REVIEW_DIALOG_SELECTOR =
  'div[role="dialog"][data-component="AnchoredOverlay"]' +
  '[data-responsive="fullscreen"][aria-modal="true"]' +
  '[aria-labelledby="anchored-review-title"][data-visibility-visible]'

export function findReviewForm(
  root: ParentNode = document,
): ReviewFormElements | null {
  const dialogs = root.querySelectorAll<HTMLElement>(REVIEW_DIALOG_SELECTOR)

  for (const dialog of dialogs) {
    const title = dialog.querySelector("#anchored-review-title")
    if (!(title instanceof HTMLHeadingElement)) {
      continue
    }

    const toolbars = dialog.querySelectorAll<HTMLElement>(
      "fieldset markdown-toolbar[for]",
    )
    for (const markdownToolbar of toolbars) {
      const textareaId = markdownToolbar.getAttribute("for")
      if (textareaId === null) {
        continue
      }

      const textarea = [...dialog.querySelectorAll("textarea")].find(
        (candidate) => candidate.id === textareaId,
      )
      const fieldset = markdownToolbar.closest("fieldset")
      const formattingToolbar =
        fieldset?.querySelector<HTMLElement>('div[role="toolbar"]') ?? null
      const anchor =
        formattingToolbar?.closest<HTMLElement>(
          '[data-component="ActionBar"]',
        ) ?? formattingToolbar

      if (
        textarea instanceof HTMLTextAreaElement &&
        textarea.dataset.component === "Textarea" &&
        anchor !== null
      ) {
        return { anchor, dialog, textarea }
      }
    }
  }

  return null
}
