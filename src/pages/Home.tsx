import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { ArrowUpIcon, BookIcon, CameraIcon, ChevronRight, MoonIcon, SunIcon, UserIcon } from '../components/Icons'
import { getUsage, isValidWord, normalizeWord } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import type { Usage } from '../lib/types'

type Recent = { lemma: string; meaning_ko: string }

export default function Home() {
  const navigate = useNavigate()
  const { resolved, toggle } = useTheme()
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<Recent[] | null>(null)
  const [due, setDue] = useState<{ count: number; words: string[] } | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    const now = new Date().toISOString()
    supabase
      .from('user_words')
      .select('words(lemma, meaning_ko)')
      .order('added_at', { ascending: false })
      .limit(3)
      .then(({ data }) =>
        setRecent((data ?? []).map((r) => r.words as unknown as Recent).filter(Boolean)),
      )
    supabase
      .from('user_words')
      .select('words(lemma)', { count: 'exact' })
      .lt('level', 3)
      .lte('next_review_at', now)
      .order('next_review_at')
      .limit(3)
      .then(({ data, count }) =>
        setDue({
          count: count ?? 0,
          words: (data ?? []).map((r) => (r.words as unknown as { lemma: string })?.lemma).filter(Boolean),
        }),
      )
    getUsage().then(setUsage)
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    const w = normalizeWord(q)
    if (!w) return
    if (!isValidWord(w)) {
      setError('영어 단어나 짧은 표현을 입력해 주세요.')
      return
    }
    navigate(`/word/${encodeURIComponent(w)}`)
  }

  return (
    <div className="screen with-tabs">
      <header className="topbar">
        <div className="brand">Wordmark</div>
        <div className="row">
          <button type="button" className="icon-btn" onClick={toggle}
            aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
            {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/settings" className="icon-btn" aria-label="내 정보와 설정"><UserIcon /></Link>
        </div>
      </header>

      <main className="content">
        <h1 className="h1">어떤 단어가<br />궁금하세요?</h1>

        <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
          <label htmlFor="q" className="section-label">모르는 단어 검색</label>
          <div className="search">
            <input id="q" type="text" placeholder="예: ceaselessly" value={q}
              autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="search"
              onChange={(e) => { setQ(e.target.value); setError(null) }} />
            <button type="submit" className="send" aria-label="검색" disabled={!q.trim()}>
              <ArrowUpIcon />
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {usage && !usage.unlimited && (
            <p className="muted small" style={{ margin: 0 }}>
              오늘 새 단어 {usage.lookups}/{usage.lookup_limit} · 이미 누가 찾아본 단어는 횟수에서 빠져요
            </p>
          )}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link to="/translate" className="chip"><CameraIcon size={16} strokeWidth={1.8} />페이지 사진 번역</Link>
            <Link to="/wordbook" className="chip"><BookIcon size={16} strokeWidth={1.8} />내 단어장</Link>
          </div>
        </form>

        {due && (
          <section className="card row" style={{ gap: 16 }}>
            <div className="stack" style={{ flex: 1, gap: 6, minWidth: 0 }}>
              <div className="muted small">오늘 복습할 단어</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {due.count > 0 ? `${due.count}개 남았어요` : '모두 끝냈어요'}
              </div>
              {due.words.length > 0 && (
                <div className="serif muted" style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {due.words.join(' · ')}
                </div>
              )}
            </div>
            {due.count > 0 && <Link to="/review" className="btn btn-primary btn-sm">복습하기</Link>}
          </section>
        )}

        <section className="stack" style={{ gap: 4 }}>
          <div className="between">
            <h2 className="section-title">최근 찾아본 단어</h2>
            <Link to="/wordbook" className="muted small" style={{ textDecoration: 'none', padding: '8px 0' }}>전체 보기</Link>
          </div>
          {recent === null ? (
            <div className="skeleton" style={{ height: 120, marginTop: 8 }} />
          ) : recent.length === 0 ? (
            <p className="muted small" style={{ margin: '8px 0', lineHeight: 1.7 }}>
              아직 찾아본 단어가 없어요. 책을 읽다 막히는 단어를 위에 입력해 보세요.
            </p>
          ) : (
            recent.map((w) => (
              <Link key={w.lemma} to={`/word/${encodeURIComponent(w.lemma)}`} className="list-row">
                <div className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <span className="word">{w.lemma}</span>
                  <span className="mean">{w.meaning_ko}</span>
                </div>
                <span className="muted"><ChevronRight /></span>
              </Link>
            ))
          )}
        </section>
      </main>
      <TabBar />
    </div>
  )
}
