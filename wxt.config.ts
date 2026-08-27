import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: {
    name: "GitHub Review Kaomoji",
    description:
      "Pick and insert kaomoji into the final GitHub pull request review comment.",
  },
})
