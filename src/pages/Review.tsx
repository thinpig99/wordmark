import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { CloseIcon, SpeakerIcon } from '../components/Icons'
import { supabase } from '../lib/supabase'
import type { Word } from '../lib/types'

type Card = { id: number; level: number; words: Pick<Word, 'lemma' | 'ipa' | 'meaning_ko' | 'examples' | 'quote'> }
type Result = 'again' | 'hard' | 'good'

export default function Review() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [nextDue, setNextDue] = useState<string | null>(null)
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tally, setTally] = useState({ again: 0, hard: 0, good: 0 })

  useEffect(() => {
    supabase
      .from('user_words')
      .select('id, level, words(lemma, ipa, meaning_ko, examples, quote)')
      .lt('level', 3)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at')
      .limit(50)
      .then(({ data }) => setCards((data as unknown as Card[]) ?? []))
    supabase
      .from('user_words')
      .select('next_review_at')
      .lt('level', 3)
      .gt('next_review_at', new Date().toISOString())
      .order('next_review_at')
      .limit(1)
      .then(({ data }) => setNextDue(data?.[0]?.next_review_at ?? null))
  }, [])

  async function answer(result: Result) {
    if (!cards || busy) return
    setBusy(true)
    const { error } = await supabase.rpc('review_word', { p_user_word_id: cards[i].id, p_result: result })
    setBusy(false)
    if (error) return
    setTally((t) => ({ ...t, [result]: t[result] + 1 }))
    setRevealed(false)
    setI(i + 1)
  }

  function speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      u.rate = 0.9
      speechSynthesis.cancel()
      speechSynthesis.speak(u)
    } catch { /* 미지원 */ }
  }

  if (cards === null) return <div className="screen" />

  if (cards.length === 0 || i >= cards.length) {
    const finished = cards.length > 0
    return (
      <div className="screen with-tabs">
        <main className="content" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <h1 className="h1">{finished ? '오늘 복습을 마쳤어요' : '지금 복습할 단어가 없어요'}</h1>
          {finished ? (
            <p className="prose muted">알아요 {tally.good} · 헷갈려요 {tally.hard} · 몰라요 {tally.again}<br />모르는 단어는 내일 다시 나와요.</p>
          ) : (
            <p className="prose muted">
              {nextDue
                ? `다음 복습은 ${new Date(nextDue).getMonth() + 1}월 ${new Date(nextDue).getDate()}일이에요.`
                : '단어를 검색해서 단어장에 담으면, 다음 날부터 여기서 복습할 수 있어요.'}
            </p>
          )}
          <Link to="/" className="btn btn-primary" style={{ marginTop: 10 }}>홈으로</Link>
        </main>
        <TabBar />
      </div>
    )
  }

  const card = cards[i]
  const w = card.words
  const ex = w.examples?.[0] ?? (w.quote ? { en: w.quote.text, ko: w.quote.translation } : null)

  return (
    <div className="screen" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="row" style={{ gap: 12, padding: '8px 12px 0' }}>
        <Link to="/" className="icon-btn plain" aria-label="복습 닫기"><CloseIcon /></Link>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--divider)', overflow: 'hidden' }}
          role="progressbar" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={i + 1}>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--text)', width: `${((i + 1) / cards.length) * 100}%`, transition: 'width .2s' }} />
        </div>
        <span className="muted" style={{ fontSize: 14, minWidth: 48, textAlign: 'right', paddingRight: 8 }}>{i + 1} / {cards.length}</span>
      </header>

      <main className="content" style={{ gap: 20, paddingTop: 20 }}>
        <div className="muted" style={{ fontSize: 14 }}>이 단어, 기억나세요?</div>

        <section style={{ flex: 1, minHeight: 360, border: '1px solid var(--border)', borderRadius: 24, padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 46, fontWeight: 600, letterSpacing: -0.8, wordBreak: 'break-word' }}>{w.lemma}</div>
          <div className="row muted">
            {w.ipa && <span className="serif" style={{ fontSize: 17 }}>{w.ipa}</span>}
            <button type="button" onClick={() => speak(w.lemma)} aria-label="발음 듣기"
              style={{ width: 36, height: 36, borderRadius: 18, border: 0, background: 'var(--surface)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <SpeakerIcon />
            </button>
          </div>
          {!revealed ? (
            <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 20, height: 44 }} onClick={() => setRevealed(true)}>뜻 보기</button>
          ) : (
            <div className="stack" style={{ marginTop: 16, gap: 16, alignItems: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{w.meaning_ko}</div>
              {ex && (
                <>
                  <div style={{ width: 40, height: 1, background: 'var(--border)' }} />
                  <div className="serif" style={{ fontStyle: 'italic', fontSize: 18, lineHeight: 1.5 }}>{ex.en}</div>
                  {ex.ko && <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{ex.ko}</div>}
                </>
              )}
              <Link to={`/word/${encodeURIComponent(w.lemma)}`} className="muted small">자세히 보기</Link>
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, paddingBottom: 20 }}>
          {([
            ['again', '몰라요', '내일 다시'],
            ['hard', '헷갈려요', '3일 뒤'],
            ['good', '알아요', card.level >= 2 ? '외운 단어로' : '7일 뒤'],
          ] as [Result, string, string][]).map(([id, label, sub]) => (
            <button key={id} type="button" disabled={busy} onClick={() => answer(id)}
              className={`btn ${id === 'good' ? 'btn-primary' : 'btn-outline'}`}
              style={{ height: 64, borderRadius: 16, flexDirection: 'column', gap: 2, padding: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 400 }}>{sub}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
