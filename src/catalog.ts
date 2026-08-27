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

const searchTermsByCategory = new Map(
  kaomojiCategories.map(({ category, keywords }) => [
    category,
    normalizeSearchText(`${category} ${keywords.join(" ")}`),
  ]),
)

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP")
}

export function searchKaomoji(category: string, query: string): KaomojiEntry[] {
  const normalizedQuery = normalizeSearchText(query)

  return entries.filter((entry) => {
    if (category !== ALL_CATEGORIES && entry.category !== category) {
      return false
    }
    if (normalizedQuery.length === 0) {
      return true
    }

    const categoryTerms = searchTermsByCategory.get(entry.category) ?? ""
    return (
      normalizeSearchText(entry.face).includes(normalizedQuery) ||
      categoryTerms.includes(normalizedQuery)
    )
  })
}
