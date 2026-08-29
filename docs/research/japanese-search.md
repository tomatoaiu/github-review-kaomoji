# Japanese Search for the Kaomoji Picker

## Current limitation

`src/catalog.ts` applies NFKC, trims, lowercases, and then performs one literal
substring check against either the face or one category-wide string. The data
contains only one Japanese keyword for most categories. As a result, a keyword
such as `ありがとう` matches, while natural variants such as
`ありがとうございます`, kana variants, synonyms, and more specific visual
concepts often do not.

This is primarily a metadata and matching problem, not a tokenizer or
performance problem. The corpus has only 1,000 faces and 12 top-level intents.

## Findings

- NFKC is useful for compatibility matching, including many width differences,
  but does not provide Japanese segmentation, readings, inflection handling, or
  synonyms. [Unicode UAX #15](https://www.unicode.org/reports/tr15/)
- `Intl.Segmenter("ja", { granularity: "word" })` supplies locale-sensitive word
  boundaries and is available in current major browsers. It is not a
  morphological analyzer and does not provide stemming, aliases, or ranking.
  [MDN: Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
- ICU and WanaKana support kana or romaji transformations, but transformation
  alone does not provide semantic search.
  [ICU transforms](https://unicode-org.github.io/icu/userguide/transforms/general/),
  [WanaKana](https://github.com/wanikani/wanakana)
- Kuromoji provides dictionary-based Japanese morphological analysis,
  decompounding, base forms, stop-word processing, and other search-engine
  features. That is far beyond a 12-intent offline picker.
  [Elasticsearch Kuromoji analyzer](https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-kuromoji-analyzer)
- Fuse.js and MiniSearch add typo tolerance, indexing, and ranking, but neither
  can infer that `助かりました` means 感謝 without suitable metadata. Adding one
  now would move complexity without fixing the root cause.
  [Fuse.js](https://www.fusejs.io/fuzzy-search.html),
  [MiniSearch](https://github.com/lucaong/minisearch)
- The pinned upstream kaomoji collection stores faces under 535 fine-grained
  category keys such as `dogeza`, `niconico`, `mukatsuku`, and `sumimasen`.
  These can be inverted into derived per-face tags, although the upstream model
  does not store explicit face records.
  [Pinned upstream data](https://raw.githubusercontent.com/kaomojiya-collection/kaomoji-collection/2ca1b394345a437bbec9e9b9445d1dd75ae3f7d4/kaomoji.json),
  [pinned search implementation](https://raw.githubusercontent.com/kaomojiya-collection/kaomoji-collection/2ca1b394345a437bbec9e9b9445d1dd75ae3f7d4/index.js)

A one-off local comparison using NFKC and HTML-entity decoding linked 680 of the
current 1,000 faces to 272 upstream category keys. The matched faces had a
median of two upstream tags. Tags should preferably be retained during catalog
curation rather than reconstructed afterward, because curation changed some
source strings.

## Recommended minimal design

Do not add a search dependency yet. Use two deterministic search layers.

### 1. Natural-language intent matching

1. Keep NFKC and lowercase normalization.
2. Fold katakana to hiragana with a small local transform.
3. Expand each of the 12 categories with reviewed Japanese aliases and common
   phrase stems, for example:
   - 感謝: `ありがとう`, `ありがと`, `感謝`, `助か`
   - 承認: `承認`, `了解`, `賛成`, `問題ない`, `いいね`
   - 謝罪: `ごめん`, `すみません`, `申し訳`
   - 困惑: `わから`, `分から`, `なぜ`, `どうして`, `なんで`
4. Match an alias contained in the normalized query, so
   `ありがとうございます` matches `ありがとう`.
5. Preserve alias-prefix matching for search-as-you-type, but require at least
   two characters to avoid noisy one-character intent matches.

### 2. Existing face-character matching

Keep literal face substring matching separate and give it the highest rank.
Kaomoji punctuation must not be removed by the natural-language normalizer.

A small score is sufficient:

1. literal face substring;
2. exact category or alias;
3. query contains alias;
4. alias prefix for autocomplete.

This remains a linear scan over 1,000 entries and requires no index.

## Optional granular search

If users need queries such as `土下座`, `にこにこ`, or `むかつく` to return a
subset rather than an entire top-level category, retain the pinned upstream
category keys as per-face tags during catalog generation. Add reviewed Japanese
aliases or precomputed readings for only the tags present in the curated 1,000
faces.

Do not ship the 41,000-face upstream dataset or a runtime transliteration
library merely to generate these tags. Precompute the compact metadata once.

## Tests to add first

Use table-driven expectations for at least:

- `ありがとうございます` → 感謝
- `承認します` and `了解です` → 承認
- `うれしい` → 喜び
- `おめでとうございます` → 祝福
- `すみませんでした` → 謝罪
- `どうして？` → 困惑
- `びっくりした` → 驚き
- `かなしい` → 悲しみ
- `むかつく` → 怒り
- `ω` → only faces containing `ω`
- unrelated text → no results

Add fuzzy matching only after real failed queries show that typo tolerance—not
missing aliases or tags—is the remaining problem.
