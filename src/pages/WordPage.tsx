import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BookmarkIcon, CheckIcon, ChevronLeft, SpeakerIcon } from '../components/Icons'
import { lookupDetail, lookupWord, type LookupResult } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { UserWord, Word } from '../lib/types'

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 문장 속에서 단어(와 변형)를 찾아 강조
function highlight(text: string, terms: string[], render: (s: string, i: number) => ReactNode) {
  const stems = terms.filter(Boolean).map((t) => escapeRe(t.length > 4 ? t.replace(/e$/, '') : t))
  if (!stems.length) return text
  const re = new RegExp(`\\b(${stems.join('|')})[a-z]*`, 'gi')
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(render(m[0], i++))
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    /* 음성 미지원 기기 */
  }
}

export default function WordPage() {
  const { lemma = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userWord, setUserWord] = useState<UserWord | null>(null)
  const [saving, setSaving] = useState(false)
  const [slow, setSlow] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setResult(null)
    setError(null)
    setSlow(false)
    setDetailLoading(false)
    setDetailFailed(false)
    const t = setTimeout(() => alive && setSlow(true), 2500)
    const page = Number(params.get('page'))
    lookupWord(lemma, {
      source: params.get('src') === 'photo' ? 'photo' : 'search',
      page_id: Number.isInteger(page) && page > 0 ? page : undefined,
    })
      .then((r) => {
        if (!alive) return
        setResult(r)
        if (r.notFound) return
        setUserWord(r.userWord)
        if (r.needsDetail) {
          // 뜻을 먼저 보여주고, 어원·구절·예문은 이어서 채움
          setDetailLoading(true)
          lookupDetail(r.word.lemma)
            .then((d) => alive && setResult({ ...r, word: d.word, needsDetail: false }))
            .catch(() => alive && setDetailFailed(true))
            .finally(() => alive && setDetailLoading(false))
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => clearTimeout(t))
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [lemma, params])

  function back() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  async function toggleSave(word: Word) {
    setSaving(true)
    try {
      if (userWord) {
        const { error } = await supabase.from('user_words').delete().eq('id', userWord.id)
        if (!error) setUserWord(null)
      } else {
        const { data } = await supabase.from('user_words').insert({ word_id: word.id }).select().single()
        if (data) setUserWord(data as UserWord)
      }
    } finally {
      setSaving(false)
    }
  }

  const word = result && !result.notFound ? result.word : null
  const terms = word ? [word.lemma, word.etymology?.base_form ?? ''] : []

  return (
    <div className="screen">
      <header className="topbar compact">
        <button type="button" className="icon-btn plain" onClick={back} aria-label="뒤로"><ChevronLeft /></button>
        {word && (
          <button type="button" className="btn btn-outline btn-sm" style={{ height: 36, fontSize: 13 }}
            onClick={() => toggleSave(word)} disabled={saving}
            aria-label={userWord ? '단어장에서 빼기' : '단어장에 저장'}>
            <BookmarkIcon filled={!!userWord} />
            {userWord ? '저장됨' : '저장'}
          </button>
        )}
      </header>

      <main className="content" style={{ gap: 36, padding: '18px 24px 48px' }}>
        {!result && !error && (
          <div className="stack" style={{ gap: 14 }} role="status" aria-live="polite">
            <h1 className="serif" style={{ margin: 0, fontSize: 44, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1, wordBreak: 'break-word' }}>{lemma}</h1>
            <div className="skeleton" style={{ height: 28, width: '60%' }} />
            <div className="skeleton" style={{ height: 80 }} />
            <div className="skeleton" style={{ height: 140 }} />
            <p className="muted small" style={{ margin: 0 }}>
              {slow ? '처음 찾는 단어라 AI가 뜻을 찾고 있어요.' : '찾고 있어요'}
            </p>
          </div>
        )}

        {error && (
          <div className="stack" style={{ gap: 16 }}>
            <h1 className="serif" style={{ margin: 0, fontSize: 40, fontWeight: 600 }}>{lemma}</h1>
            <p className="error" role="alert">{error}</p>
            <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(0)}>다시 시도</button>
          </div>
        )}

        {result?.notFound && (
          <div className="stack" style={{ gap: 16 }}>
            <h1 className="serif" style={{ margin: 0, fontSize: 40, fontWeight: 600 }}>{lemma}</h1>
            <p className="prose">이 단어를 찾지 못했어요. 철자를 한 번 확인해 주세요.</p>
            {result.suggestion && (
              <Link to={`/word/${encodeURIComponent(result.suggestion)}`} replace className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
                혹시 <span className="serif" style={{ fontSize: 17 }}>{result.suggestion}</span> 인가요?
              </Link>
            )}
          </div>
        )}

        {word && (
          <>
            <section className="stack" style={{ gap: 10 }}>
              <h1 className="serif" style={{ margin: 0, fontSize: 44, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1, wordBreak: 'break-word' }}>{word.lemma}</h1>
              <div className="row muted" style={{ gap: 10, flexWrap: 'wrap', fontSize: 14 }}>
                {word.ipa && <span className="serif" style={{ fontSize: 17 }}>{word.ipa}</span>}
                <button type="button" onClick={() => speak(word.lemma)} aria-label="발음 듣기"
                  style={{ width: 36, height: 36, borderRadius: 18, border: 0, background: 'var(--surface)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <SpeakerIcon />
                </button>
                {word.pos && <span className="pill" style={{ color: 'var(--text)' }}>{word.pos}</span>}
                {word.etymology?.base_form && (
                  <Link to={`/word/${encodeURIComponent(word.etymology.base_form)}`} className="pill" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                    기본형 <span className="serif">{word.etymology.base_form}</span>
                  </Link>
                )}
              </div>
            </section>

            <section className="stack" style={{ gap: 10 }}>
              <h2 className="section-label">뜻</h2>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>{word.meaning_ko}</div>
              {word.nuance && <p className="prose">{word.nuance}</p>}
            </section>

            {detailLoading && (
              <div className="stack" style={{ gap: 14 }} role="status" aria-live="polite">
                <div className="skeleton" style={{ height: 70 }} />
                <div className="skeleton" style={{ height: 160 }} />
                <p className="muted small" style={{ margin: 0 }}>어원과 소설 속 구절을 찾고 있어요</p>
              </div>
            )}
            {detailFailed && (
              <p className="muted small" style={{ margin: 0 }}>어원과 예문을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
            )}

            {word.etymology && (word.etymology.parts.length > 0 || word.etymology.note) && (
              <section className="stack" style={{ gap: 14 }}>
                <h2 className="section-label">어원</h2>
                {word.etymology.parts.length > 0 && (
                  <div className="ety">
                    {word.etymology.parts.map((p, i) => (
                      <div key={i} style={{ display: 'contents' }}>
                        {i > 0 && <span className="plus" aria-hidden="true">+</span>}
                        <div className="part">
                          <span className="serif" style={{ fontSize: 19 }}>{p.part}</span>
                          {p.meaning && <span className="muted" style={{ fontSize: 12 }}>{p.meaning}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {word.etymology.note && <p className="prose">{word.etymology.note}</p>}
              </section>
            )}

            {word.quote && (
              <section className="stack" style={{ gap: 14 }}>
                <h2 className="section-label">{word.quote.source ? '소설 속 한 구절' : '소설 속 문장처럼'}</h2>
                <figure className="card" style={{ margin: 0, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <blockquote className="quote">
                    {highlight(word.quote.text, terms, (s, i) => <mark key={i}>{s}</mark>)}
                  </blockquote>
                  {word.quote.translation && <p className="prose">{word.quote.translation}</p>}
                  <figcaption className="muted small">
                    {word.quote.source ?? 'AI가 만든 예문이에요'}
                  </figcaption>
                </figure>
                {word.quote.note && <p className="prose">{word.quote.note}</p>}
              </section>
            )}

            {word.examples.length > 0 && (
              <section className="stack" style={{ gap: 12 }}>
                <h2 className="section-label">이렇게도 써요</h2>
                {word.examples.map((ex, i) => (
                  <div key={i} className="stack" style={{ gap: 4, paddingBottom: 14, borderBottom: i < word.examples.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                    <span className="serif" style={{ fontSize: 18, lineHeight: 1.5 }}>
                      {highlight(ex.en, terms, (s, j) => <b key={j} style={{ fontWeight: 600 }}>{s}</b>)}
                    </span>
                    {ex.ko && <span className="muted" style={{ fontSize: 14 }}>{ex.ko}</span>}
                  </div>
                ))}
              </section>
            )}

            {userWord && (
              <div className="notice">
                <CheckIcon />
                <span>단어장에 담았어요. 복습에서 다시 만나요.</span>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
