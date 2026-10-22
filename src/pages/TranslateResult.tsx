import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { CameraIcon, ChevronLeft } from '../components/Icons'
import { CaptureInput, TranslatingOverlay, useTranslateUpload } from '../components/CaptureInput'
import { lookupWord } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Page } from '../lib/types'
import { pageTitle } from './TranslateHome'

type Mode = 'both' | 'orig' | 'trans'

export default function TranslateResult() {
  const { id } = useParams()
  const navigate = useNavigate()
  const upload = useTranslateUpload()
  const [page, setPage] = useState<Page | null | undefined>(undefined)
  const [mode, setMode] = useState<Mode>('both')
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPage(undefined)
    supabase.from('pages').select('*').eq('id', Number(id)).maybeSingle().then(async ({ data }) => {
      const p = data as Page | null
      setPage(p)
      if (p?.hard_words.length) {
        const { data: saved } = await supabase
          .from('user_words')
          .select('words!inner(lemma)')
          .in('words.lemma', p.hard_words.map((w) => w.word))
        const map: Record<string, boolean> = {}
        ;(saved ?? []).forEach((r) => { map[(r.words as unknown as { lemma: string }).lemma] = true })
        setAdded(map)
      }
    })
  }, [id])

  const hardSet = useMemo(() => new Set(page?.hard_words.map((w) => w.word) ?? []), [page])

  async function add(word: string) {
    if (!page || added[word] || adding[word]) return
    setError(null)
    setAdding((a) => ({ ...a, [word]: true }))
    try {
      const r = await lookupWord(word, { source: 'photo', page_id: page.id })
      if (!r.notFound) setAdded((a) => ({ ...a, [word]: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '담지 못했어요.')
    } finally {
      setAdding((a) => ({ ...a, [word]: false }))
    }
  }

  async function addAll() {
    if (!page) return
    for (const w of page.hard_words) {
      if (!added[w.word]) await add(w.word)
    }
  }

  function openWord(token: string) {
    const w = token.toLowerCase().replace(/[’‘]/g, "'").replace(/^'+|'+$/g, '').replace(/'s$/, '')
    if (w.length < 2) return
    navigate(`/word/${encodeURIComponent(w)}?src=photo&page=${page?.id ?? ''}`)
  }

  function renderOrig(text: string) {
    return text.split(/([A-Za-z’‘']+)/).map((tok, i) =>
      /^[A-Za-z]/.test(tok) ? (
        <button key={i} type="button" className={`word-tok ${hardSet.has(tok.toLowerCase()) ? 'hard' : ''}`} onClick={() => openWord(tok)}>
          {tok}
        </button>
      ) : (
        <Fragment key={i}>{tok}</Fragment>
      ),
    )
  }

  const allAdded = page ? page.hard_words.every((w) => added[w.word]) : false

  return (
    <div className="screen with-tabs">
      {upload.busy && <TranslatingOverlay />}
      <header className="topbar compact" style={{ paddingRight: 20 }}>
        <div className="row" style={{ gap: 2 }}>
          <Link to="/translate" className="icon-btn plain" aria-label="번역 처음으로"><ChevronLeft /></Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>번역 결과</h1>
        </div>
        <CaptureInput camera onFile={upload.handleFile} disabled={upload.busy}>
          <span className="btn btn-outline btn-sm"><CameraIcon size={16} strokeWidth={1.8} />새로 촬영</span>
        </CaptureInput>
      </header>

      <main className="content" style={{ gap: 22 }}>
        {upload.error && <p className="error" role="alert">{upload.error}</p>}
        {page === undefined && <div className="skeleton" style={{ height: 300 }} />}
        {page === null && <p className="muted">이 페이지를 찾을 수 없어요.</p>}
        {page && (
          <>
            <div className="row" style={{ gap: 14 }}>
              <div className="paper-thumb" aria-hidden="true" style={{ width: 56, height: 74, padding: '10px 8px', gap: 5 }}>
                <span style={{ width: '100%' }} /><span style={{ width: '92%' }} /><span style={{ width: '100%' }} />
                <span style={{ width: '70%' }} /><span style={{ width: '96%' }} /><span style={{ width: '60%' }} />
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{pageTitle(page)}</span>
                <span className="muted small">문장 {page.sentences.length}개 · 단어를 누르면 바로 뜻을 볼 수 있어요</span>
              </div>
            </div>

            <div className="seg" role="group" aria-label="보기 방식">
              {([['both', '함께 보기'], ['orig', '원문'], ['trans', '번역']] as [Mode, string][]).map(([m, label]) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>
              ))}
            </div>

            <article className="stack" style={{ gap: 22 }}>
              {page.sentences.map((s, i) => (
                <div key={i} className="stack" style={{ gap: 8, paddingBottom: 22, borderBottom: i < page.sentences.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                  {mode !== 'trans' && <p className="serif" style={{ margin: 0, fontSize: 19, lineHeight: 1.6 }}>{renderOrig(s.orig)}</p>}
                  {mode !== 'orig' && s.trans && <p className="prose">{s.trans}</p>}
                </div>
              ))}
            </article>

            {page.hard_words.length > 0 && (
              <section className="card stack" style={{ gap: 12, padding: 18 }}>
                <div className="between">
                  <h2 className="section-title">이 페이지의 어려운 단어</h2>
                  <button type="button" className="btn btn-primary btn-sm" style={{ height: 36, fontSize: 13 }} onClick={addAll} disabled={allAdded}>
                    {allAdded ? '모두 담음' : '모두 담기'}
                  </button>
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {page.hard_words.map((w) => (
                    <button key={w.word} type="button" className={`chip ${added[w.word] ? 'on' : ''}`} style={{ height: 36, fontSize: 13 }}
                      aria-pressed={!!added[w.word]} onClick={() => (added[w.word] ? openWord(w.word) : add(w.word))}>
                      {adding[w.word] ? '담는 중' : added[w.word] ? '✓' : '+'} <span className="serif" style={{ fontSize: 15 }}>{w.word}</span>
                      {w.meaning && <span style={{ opacity: 0.75 }}>· {w.meaning}</span>}
                    </button>
                  ))}
                </div>
                {error && <p className="error">{error}</p>}
                <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
                  담은 단어를 다시 누르면 자세한 설명을 볼 수 있어요.
                </p>
              </section>
            )}
          </>
        )}
      </main>
      <TabBar />
    </div>
  )
}
