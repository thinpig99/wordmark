import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { CameraIcon, ChevronRight, PhotoIcon } from '../components/Icons'
import { CaptureInput, TranslatingOverlay, useTranslateUpload } from '../components/CaptureInput'
import { getUsage, relativeDate } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Usage } from '../lib/types'

type PageRow = { id: number; book_title: string | null; chapter: string | null; sentences: unknown[]; created_at: string }

export function pageTitle(p: { book_title: string | null; chapter: string | null }) {
  const t = p.book_title ?? '제목 없는 페이지'
  return p.chapter ? `${t} · ${p.chapter}` : t
}

export default function TranslateHome() {
  const { busy, error, handleFile } = useTranslateUpload()
  const [pages, setPages] = useState<PageRow[] | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    supabase
      .from('pages')
      .select('id, book_title, chapter, sentences, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setPages((data as PageRow[]) ?? []))
    getUsage().then(setUsage)
  }, [error])

  const left = usage ? usage.photo_limit - usage.photos : null
  const outOfQuota = usage && !usage.unlimited && left !== null && left <= 0

  return (
    <div className="screen with-tabs">
      {busy && <TranslatingOverlay />}
      <header className="stack" style={{ gap: 6, padding: '18px 20px 8px' }}>
        <h1 className="page-title">페이지 번역</h1>
        <p className="lede">원서 페이지를 찍으면 문장 그대로 번역해 드려요</p>
      </header>

      <main className="content" style={{ gap: 28 }}>
        <div className="stack" style={{ gap: 10 }}>
          <CaptureInput camera onFile={handleFile} disabled={busy || !!outOfQuota}>
            <span className="btn btn-primary" style={{ height: 132, borderRadius: 24, flexDirection: 'column', gap: 10, width: '100%', opacity: outOfQuota ? 0.5 : 1 }}>
              <CameraIcon size={34} strokeWidth={1.6} />
              <span className="stack" style={{ alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 18 }}>촬영하기</span>
                <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.75 }}>후면 카메라가 바로 켜져요</span>
              </span>
            </span>
          </CaptureInput>
          <CaptureInput camera={false} onFile={handleFile} disabled={busy || !!outOfQuota}>
            <span className="btn btn-outline" style={{ width: '100%', height: 56, borderRadius: 18, fontSize: 15, opacity: outOfQuota ? 0.5 : 1 }}>
              <PhotoIcon />앨범에서 선택
            </span>
          </CaptureInput>
          <div className="between muted" style={{ fontSize: 12, padding: '2px 4px 0' }}>
            <span>페이지를 평평하게, 그림자 없이 찍어주세요</span>
            {usage && <span>{usage.unlimited ? '무제한' : `오늘 ${Math.max(left ?? 0, 0)}/${usage.photo_limit}회 남음`}</span>}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {outOfQuota && <p className="error">오늘 사진 번역을 모두 썼어요. 내일 다시 이용해 주세요.</p>}
        </div>

        <section className="stack" style={{ gap: 4 }}>
          <h2 className="section-title" style={{ marginBottom: 6 }}>최근 번역한 페이지</h2>
          {pages === null && <div className="skeleton" style={{ height: 120 }} />}
          {pages && pages.length === 0 && (
            <p className="muted small" style={{ margin: 0, lineHeight: 1.7 }}>아직 번역한 페이지가 없어요.</p>
          )}
          {pages?.map((p) => (
            <Link key={p.id} to={`/translate/${p.id}`} className="list-row" style={{ gap: 14, padding: '10px 0' }}>
              <div className="paper-thumb" aria-hidden="true" style={{ width: 40, height: 54 }}>
                <span style={{ width: '100%' }} /><span style={{ width: '85%' }} /><span style={{ width: '100%' }} /><span style={{ width: '60%' }} />
              </div>
              <div className="stack" style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <span className="serif" style={{ fontSize: 17 }}>{pageTitle(p)}</span>
                <span className="muted small">{relativeDate(p.created_at)} · 문장 {p.sentences.length}개</span>
              </div>
              <span className="muted"><ChevronRight /></span>
            </Link>
          ))}
        </section>
      </main>
      <TabBar />
    </div>
  )
}
