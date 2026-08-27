// oxlint-disable-next-line import/no-unassigned-import -- WXT extracts this import into the Shadow Root stylesheet.
import "./style.css"

import { createShadowRootUi, defineContentScript } from "#imports"
import type { ShadowRootContentScriptUi } from "wxt/utils/content-script-ui/shadow-root"

import { findReviewForm } from "../../github/review-form"
import type { ReviewFormElements } from "../../github/review-form"
import { isPullRequestRoute } from "../../github/route"
import { createKaomojiPicker } from "../../ui/picker"
import type { KaomojiPicker } from "../../ui/picker"

type PickerSession = {
  elements: ReviewFormElements
  host: HTMLElement
  ui: ShadowRootContentScriptUi<KaomojiPicker>
}

export default defineContentScript({
  matches: ["https://github.com/*"],
  cssInjectionMode: "ui",
  runAt: "document_idle",

  main(ctx) {
    let disposed = false
    let generation = 0
    let observer: MutationObserver | null = null
    let reconcileQueued = false
    let session: PickerSession | null = null

    const removeSession = (): void => {
      session?.ui.remove()
      session = null
    }

    const reconcile = async (): Promise<void> => {
      reconcileQueued = false
      if (observer === null) {
        return
      }

      const currentGeneration = ++generation
      const elements = findReviewForm()

      if (
        session !== null &&
        elements !== null &&
        session.elements.dialog === elements.dialog &&
        session.elements.textarea === elements.textarea &&
        session.elements.anchor === elements.anchor &&
        session.host.isConnected
      ) {
        return
      }

      removeSession()
      if (elements === null || disposed) {
        return
      }

      let host: HTMLElement | null = null
      try {
        const ui = await createShadowRootUi<KaomojiPicker>(ctx, {
          name: "github-review-kaomoji",
          position: "inline",
          anchor: elements.anchor,
          append: "last",
          isolateEvents: true,
          onMount(container, _shadow, shadowHost) {
            host = shadowHost
            return createKaomojiPicker(container, {
              dialog: elements.dialog,
              host: shadowHost,
              textarea: elements.textarea,
            })
          },
          onRemove(mountedPicker) {
            mountedPicker?.dispose()
          },
        })

        if (
          disposed ||
          currentGeneration !== generation ||
          !elements.dialog.isConnected ||
          !elements.anchor.isConnected
        ) {
          ui.remove()
          return
        }

        ui.mount()
        if (host === null) {
          ui.remove()
          return
        }
        session = { elements, host, ui }
      } catch {
        // GitHub remains fully usable when its review markup changes.
      }
    }

    const scheduleReconcile = (): void => {
      if (disposed || observer === null || reconcileQueued) {
        return
      }
      reconcileQueued = true
      queueMicrotask(() => void reconcile())
    }

    const handleRoute = (url: URL): void => {
      generation += 1
      observer?.disconnect()
      observer = null
      reconcileQueued = false
      removeSession()

      if (disposed || !isPullRequestRoute(url)) {
        return
      }

      observer = new MutationObserver(scheduleReconcile)
      observer.observe(document.documentElement, {
        attributeFilter: ["aria-selected", "data-visibility-visible"],
        attributes: true,
        childList: true,
        subtree: true,
      })
      scheduleReconcile()
    }

    handleRoute(new URL(window.location.href))
    ctx.addEventListener(window, "wxt:locationchange", ({ newUrl }) => {
      handleRoute(newUrl)
    })

    ctx.onInvalidated(() => {
      disposed = true
      generation += 1
      observer?.disconnect()
      observer = null
      removeSession()
    })
  },
})
