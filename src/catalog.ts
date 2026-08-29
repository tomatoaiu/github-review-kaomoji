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

function intentMatchScore(query: string, terms: string[]): number {
  let score = 0
  for (const term of terms) {
    if (query === term) {
      return 3
    }
    if (queryContainsTerm(query, term)) {
      score = Math.max(score, 2)
    } else if (query.length >= 2 && term.startsWith(query)) {
      score = Math.max(score, 1)
    }
  }
  return score
}

const normalizedFaces = entries.map(({ face }) => normalizeSearchText(face))

export function searchKaomoji(category: string, query: string): KaomojiEntry[] {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery.length === 0) {
    return entries.filter(
      (entry) => category === ALL_CATEGORIES || entry.category === category,
    )
  }

  const categoryScores = new Map(
    [...searchTermsByCategory].map(([searchCategory, terms]) => [
      searchCategory,
      intentMatchScore(normalizedQuery, terms),
    ]),
  )

  return entries
    .map((entry, index) => ({
      entry,
      index,
      score: Math.max(
        normalizedFaces[index]?.includes(normalizedQuery) === true ? 4 : 0,
        categoryScores.get(entry.category) ?? 0,
      ),
    }))
    .filter(
      ({ entry, score }) =>
        score > 0 &&
        (category === ALL_CATEGORIES || entry.category === category),
    )
    .toSorted(
      (left, right) => right.score - left.score || left.index - right.index,
    )
    .map(({ entry }) => entry)
}
