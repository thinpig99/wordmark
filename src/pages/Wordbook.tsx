import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { CloseIcon, SearchIcon } from '../components/Icons'
import { dueLabel } from '../lib/api'
import { supabase } from '../lib/supabase'

type Row = { id: number; level: number; next_review_at: string; words: { lemma: string; meaning_ko: string } }
type Filter = 'all' | 'learning' | 'done'

export default function Wordbook() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase
      .from('user_words')
      .select('id, level, next_review_at, words(lemma, meaning_ko)')
      .order('added_at', { ascending: false })
      .limit(1000)
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []))
  }, [])

  const total = rows?.length ?? 0
  const mastered = rows?.filter((r) => r.level >= 3).length ?? 0

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => {
      if (filter === 'learning' && r.level >= 3) return false
      if (filter === 'done' && r.level < 3) return false
      if (needle && !r.words.lemma.includes(needle) && !r.words.meaning_ko.includes(needle)) return false
      return true
    })
  }, [rows, filter, q])

  const filters: [Filter, string][] = [['all', '전체'], ['learning', '외우는 중'], ['done', '외운 단어']]

  return (
    <div className="screen with-tabs">
      <header className="stack" style={{ gap: 16, padding: '18px 20px 8px' }}>
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 4 }}>
            <h1 className="page-title">단어장</h1>
            <span className="muted small">모은 단어 {total}개 · 외운 단어 {mastered}개</span>
          </div>
          <button type="button" className="icon-btn" aria-label={searching ? '검색 닫기' : '단어장 검색'}
            onClick={() => { setSearching(!searching); setQ('') }}>
            {searching ? <CloseIcon size={20} /> : <SearchIcon size={20} />}
          </button>
        </div>
        {searching && (
          <div className="field">
            <label htmlFor="wb-q" className="visually-hidden">단어장에서 찾기</label>
            <input id="wb-q" className="input" autoFocus placeholder="단어나 뜻으로 찾기" value={q}
              autoCapitalize="none" autoCorrect="off" onChange={(e) => setQ(e.target.value)} style={{ height: 46 }} />
          </div>
        )}
        <div className="seg" role="group" aria-label="단어 필터">
          {filters.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{ padding: '0 20px 24px' }}>
        <div className="between muted small" style={{ padding: '6px 0 4px' }}>
          <span>{shown.length}개 표시 중</span>
          <span>최근 추가순</span>
        </div>
        {rows === null && <div className="skeleton" style={{ height: 240, marginTop: 8 }} />}
        {rows && rows.length === 0 && (
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, marginTop: 24 }}>
            아직 담은 단어가 없어요. 모르는 단어를 검색하면 여기에 차곡차곡 쌓여요.
          </p>
        )}
        {shown.map((r) => {
          const due = dueLabel(r)
          return (
            <Link key={r.id} to={`/word/${encodeURIComponent(r.words.lemma)}`} className="list-row">
              <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <span className="word">{r.words.lemma}</span>
                <span className="mean">{r.words.meaning_ko}</span>
              </div>
              <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
                <div className="dots" role="img" aria-label={`외운 정도 3단계 중 ${r.level}`}>
                  {[1, 2, 3].map((n) => <span key={n} className={`dot ${r.level >= n ? 'on' : ''}`} />)}
                </div>
                <span style={{ fontSize: 12, color: due.today ? 'var(--due)' : 'var(--sub)' }}>{due.text}</span>
              </div>
            </Link>
          )
        })}
      </main>
      <TabBar />
    </div>
  )
}
