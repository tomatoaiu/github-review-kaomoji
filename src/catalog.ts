import catalogData from "./data/kaomoji.json"

export const ALL_CATEGORIES = "すべて"

export type KaomojiCategory = {
  category: string
  keywords: string[]
  faces: string[]
}

export type KaomojiEntry = {
  category: string
  face: string
}

export const kaomojiCategories = catalogData as KaomojiCategory[]

export const kaomojiCount = kaomojiCategories.reduce(
  (count, category) => count + category.faces.length,
  0,
)

const entries = kaomojiCategories.flatMap(({ category, faces }) =>
  faces.map((face) => ({ category, face })),
)

const searchTermsByCategory = new Map<string, string[]>(
  kaomojiCategories.map(({ category, keywords }) => [
    category,
    [category, ...keywords].map(normalizeSearchText),
  ]),
)

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja-JP")
    .replace(/[ァ-ヶ]/gu, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    )
}

const latinTerm = /^[a-z\d]+$/u

function queryContainsTerm(query: string, term: string): boolean {
  return latinTerm.test(term)
    ? query.split(/[^a-z\d]+/u).includes(term)
    : query.includes(term)
}

function matchesIntentQuery(query: string, terms: string[]): boolean {
  return terms.some(
    (term) =>
      query === term ||
      queryContainsTerm(query, term) ||
      (query.length >= 2 && term.startsWith(query)),
  )
}

export function searchKaomoji(category: string, query: string): KaomojiEntry[] {
  const normalizedQuery = normalizeSearchText(query)
  const matchingCategories = new Set(
    [...searchTermsByCategory]
      .filter(([, terms]) => matchesIntentQuery(normalizedQuery, terms))
      .map(([matchingCategory]) => matchingCategory),
  )

  return entries.filter((entry) => {
    if (category !== ALL_CATEGORIES && entry.category !== category) {
      return false
    }
    if (normalizedQuery.length === 0) {
      return true
    }

    return (
      normalizeSearchText(entry.face).includes(normalizedQuery) ||
      matchingCategories.has(entry.category)
    )
  })
}
