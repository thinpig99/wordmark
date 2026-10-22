export type Word = {
  id: number
  lemma: string
  ipa: string | null
  pos: string | null
  meaning_ko: string
  nuance: string | null
  etymology: {
    parts: { part: string; meaning: string | null }[]
    note: string | null
    base_form?: string | null
  } | null
  quote: { text: string; translation: string | null; source: string | null; note: string | null } | null
  examples: { en: string; ko: string | null }[]
}

export type UserWord = {
  id: number
  word_id: number
  level: number
  next_review_at: string
  review_count: number
  source: 'search' | 'photo'
  page_id: number | null
  added_at: string
}

export type Page = {
  id: number
  book_title: string | null
  chapter: string | null
  sentences: { orig: string; trans: string | null }[]
  hard_words: { word: string; meaning: string | null }[]
  created_at: string
}

export type Usage = {
  lookups: number
  photos: number
  lookup_limit: number
  photo_limit: number
  unlimited: boolean
}
