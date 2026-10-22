import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

function koreanAuthError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return '이메일 또는 비밀번호가 맞지 않아요.'
  if (m.includes('email not confirmed')) return '메일 인증을 먼저 마쳐 주세요. 받은편지함을 확인해 주세요.'
  if (m.includes('already registered') || m.includes('already been registered')) return '이미 가입된 이메일이에요. 로그인해 주세요.'
  if (m.includes('password') && m.includes('6')) return '비밀번호는 6자 이상이어야 해요.'
  if (m.includes('rate limit') || m.includes('security purposes')) return '요청이 많아요. 잠시 뒤 다시 시도해 주세요.'
  if (m.includes('invalid') && m.includes('email')) return '이메일 주소를 확인해 주세요.'
  return '잠시 문제가 생겼어요. 다시 시도해 주세요.'
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) setError(koreanAuthError(error.message))
      } else {
        if (password.length < 8) {
          setError('비밀번호는 8자 이상으로 정해 주세요.')
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: invite.trim() ? { invite_code: invite.trim() } : {},
          },
        })
        if (error) setError(koreanAuthError(error.message))
        else if (!data.session) setInfo('가입 확인 메일을 보냈어요. 메일의 링크를 누르면 바로 시작할 수 있어요.')
      }
    } finally {
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <div className="screen" style={{ padding: '0 24px', paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40, padding: '48px 0 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="serif" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -0.6 }}>Wordmark</div>
          <p className="lede" style={{ fontSize: 15 }}>어려운 영어 원서 읽기, Wordmark로 쉽게</p>
        </div>

        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email"
              placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pw">비밀번호</label>
            <input id="pw" className="input" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={isSignup ? '8자 이상' : ''} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {isSignup && (
            <div className="field">
              <label htmlFor="invite">추천인 코드 (선택)</label>
              <input id="invite" className="input" type="text" autoCapitalize="none" autoCorrect="off"
                value={invite} onChange={(e) => setInvite(e.target.value)} />
            </div>
          )}

          {error && <p className="error" role="alert">{error}</p>}
          {info && <p className="notice" role="status">{info}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? '잠시만요' : isSignup ? '가입하기' : '로그인'}
          </button>
          <div className="row" style={{ justifyContent: 'center', fontSize: 14 }}>
            <span className="muted">{isSignup ? '이미 계정이 있나요?' : '처음이신가요?'}</span>
            <button type="button" onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(null); setInfo(null) }}
              style={{ border: 0, background: 'none', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', padding: '10px 4px' }}>
              {isSignup ? '로그인' : '회원가입'}
            </button>
          </div>
        </form>
      </div>
      <p className="muted" style={{ margin: '0 0 calc(24px + env(safe-area-inset-bottom))', fontSize: 12, lineHeight: 1.6, textAlign: 'center' }}>
        단어 설명과 번역은 AI가 만들어요. 입력한 단어와 사진은<br />AI 서비스 개선에 쓰일 수 있어요.
      </p>
    </div>
  )
}
