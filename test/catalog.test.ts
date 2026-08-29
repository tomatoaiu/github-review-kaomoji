import { describe, expect, it } from "vitest"

import {
  ALL_CATEGORIES,
  kaomojiCategories,
  kaomojiCount,
  normalizeSearchText,
  searchKaomoji,
} from "../src/catalog"

const expectedCategories = [
  "感謝",
  "承認",
  "喜び",
  "拍手",
  "応援",
  "祝福",
  "挨拶",
  "謝罪",
  "困惑",
  "驚き",
  "悲しみ",
  "怒り",
]

const forbiddenText =
  /ありが|感謝|おめ|ﾊﾟﾁ|パチ|拍手|ﾌｧｲ|fight|頑張|がんば|ｶﾞﾝ|ごめ|すみま|こんに|こんばん|おはよ|おやす|ただい|おかえ|よろしく|バイバイ|やった|わ[ーぁ]|ﾜｧ|おー|う[～~ー-]*ん|う[～~ー-]+|ｳ[ｯｰ]|ガーン|ゔ|ちゎ|ﾝｰ|ほぇ|オウ|ぷい|ムッ|嬉|悲|怒|祝/iu
const forbiddenContent =
  /凸|尻|糞|乳|股|ちん|まん|sex|fuck|セックス|うんこ|死ね|殺す/iu

function includesEmoji(face: string): boolean {
  return [...face].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return (
      (codePoint >= 0x1f_000 && codePoint <= 0x1fa_ff) ||
      character === "\uFE0F" ||
      character === "\u20E3"
    )
  })
}

describe("kaomoji catalog", () => {
  it("contains 1,000 unique faces in the approved categories", () => {
    const faces = kaomojiCategories.flatMap((category) => category.faces)

    expect(kaomojiCategories.map((category) => category.category)).toEqual(
      expectedCategories,
    )
    expect(kaomojiCount).toBe(1000)
    expect(faces).toHaveLength(1000)
    expect(new Set(faces).size).toBe(1000)
  })

  it("contains only normalized face strings", () => {
    for (const { faces } of kaomojiCategories) {
      for (const face of faces) {
        expect(face).toBe(face.normalize("NFC").trim())
        expect(face).not.toMatch(/&(?:#\d+|#x[\da-f]+|[a-z]+);/iu)
        expect(face).not.toContain("�")
        expect(face).not.toMatch(forbiddenText)
        expect(face).not.toMatch(forbiddenContent)
        expect(face).not.toMatch(/^\((?:ﾉ|ヾ)\)$/u)
        expect(includesEmoji(face)).toBe(false)
        expect(face).not.toMatch(/\p{Emoji_Presentation}/u)
        expect(face.length).toBeLessThanOrEqual(48)
      }
    }
  })

  it.each([
    [" ＬＧＴＭ ", "lgtm"],
    ["ビックリ", "びっくり"],
    ["ﾋﾞｯｸﾘ", "びっくり"],
  ])("normalizes search text: %s", (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected)
  })

  it.each([
    ["ありがとうございます", "感謝"],
    ["承認します", "承認"],
    ["了解です", "承認"],
    ["うれしい", "喜び"],
    ["おめでとうございます", "祝福"],
    ["すみませんでした", "謝罪"],
    ["どうして？", "困惑"],
    ["ビックリした", "驚き"],
    ["かなしい", "悲しみ"],
    ["むかつく", "怒り"],
  ])("matches a natural Japanese query: %s", (query, category) => {
    const results = searchKaomoji(ALL_CATEGORIES, query)

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((entry) => entry.category === category)).toBe(true)
  })

  it("searches category keywords and face text", () => {
    const approvals = searchKaomoji(ALL_CATEGORIES, "lgtm")
    const partialThanks = searchKaomoji(ALL_CATEGORIES, "ありが")
    const omegaFaces = searchKaomoji(ALL_CATEGORIES, "ω")

    expect(approvals).toHaveLength(90)
    expect(approvals.every((entry) => entry.category === "承認")).toBe(true)
    expect(partialThanks).toHaveLength(60)
    expect(partialThanks.every((entry) => entry.category === "感謝")).toBe(true)
    expect(omegaFaces.length).toBeGreaterThan(0)
    expect(omegaFaces.every((entry) => entry.face.includes("ω"))).toBe(true)
    expect(searchKaomoji(ALL_CATEGORIES, "あ")).toEqual([])
    expect(searchKaomoji(ALL_CATEGORIES, "smoke")).toEqual([])
    expect(searchKaomoji("感謝", "not-found")).toEqual([])
  })
})
