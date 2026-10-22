import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from '../components/Icons'
import { getUsage } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useTheme, type ThemeMode } from '../lib/theme'
import type { Usage } from '../lib/types'

const ROLE_LABEL: Record<string, string> = { user: '일반', super: '슈퍼', admin: '관리자' }

export default function Settings() {
  const navigate = useNavigate()
  const { mode, setMode } = useTheme()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
      if (data.user) {
        supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
          .then(({ data: p }) => setRole(p?.role ?? 'user'))
      }
    })
    getUsage().then(setUsage)
  }, [])

  const modes: [ThemeMode, string][] = [['system', '기기 설정'], ['light', '라이트'], ['dark', '다크']]

  return (
    <div className="screen">
      <header className="topbar compact">
        <div className="row" style={{ gap: 2 }}>
          <button type="button" className="icon-btn plain" aria-label="뒤로" onClick={() => navigate(-1)}><ChevronLeft /></button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>내 정보</h1>
        </div>
      </header>
      <main className="content" style={{ gap: 28 }}>
        <section className="card stack" style={{ gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 600, wordBreak: 'break-all' }}>{email}</span>
          {role && (
            <span className="muted small">
              {ROLE_LABEL[role] ?? '일반'} 계정{role !== 'user' ? ' · 사용량 제한 없음' : ''}
            </span>
          )}
        </section>

        {usage && !usage.unlimited && (
          <section className="stack" style={{ gap: 10 }}>
            <h2 className="section-label">오늘 사용량</h2>
            <div className="between" style={{ fontSize: 15 }}><span>새 단어 검색</span><span>{usage.lookups} / {usage.lookup_limit}</span></div>
            <div className="between" style={{ fontSize: 15 }}><span>사진 번역</span><span>{usage.photos} / {usage.photo_limit}</span></div>
            <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>매일 자정(한국 시간)에 다시 채워져요.</p>
          </section>
        )}

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="section-label">화면 모드</h2>
          <div className="seg" role="group" aria-label="화면 모드">
            {modes.map(([m, label]) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>
            ))}
          </div>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="section-label">홈 화면에 추가하기</h2>
          <p className="prose">아이폰 Safari에서 아래쪽 공유 버튼을 누르고 '홈 화면에 추가'를 고르면 앱처럼 쓸 수 있어요.</p>
        </section>

        <button type="button" className="btn btn-outline" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
          단어 설명과 번역은 AI(Google Gemini)가 만들어요. 가끔 틀릴 수 있어요.
        </p>
      </main>
    </div>
  )
}
