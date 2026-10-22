import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export type ThemeMode = 'light' | 'dark' | 'system'

type Ctx = {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (m: ThemeMode) => void
  toggle: () => void
}

const ThemeContext = createContext<Ctx | null>(null)
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem('wm-theme')
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStored)
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const m = media()
    const onChange = () => setSystemDark(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) =>
      el.setAttribute('content', resolved === 'dark' ? '#171717' : '#ffffff'),
    )
  }, [resolved])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    try {
      localStorage.setItem('wm-theme', m)
    } catch {
      /* 저장 못 해도 화면은 바뀜 */
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) supabase.from('profiles').update({ theme: m }).eq('id', data.user.id).then(() => {})
    })
  }, [])

  const toggle = useCallback(() => setMode(resolved === 'dark' ? 'light' : 'dark'), [resolved, setMode])

  return <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
