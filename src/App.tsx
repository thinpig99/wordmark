import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import WordPage from './pages/WordPage'
import Wordbook from './pages/Wordbook'
import Review from './pages/Review'
import TranslateHome from './pages/TranslateHome'
import TranslateResult from './pages/TranslateResult'
import Settings from './pages/Settings'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/word/:lemma" element={<WordPage />} />
      <Route path="/wordbook" element={<Wordbook />} />
      <Route path="/review" element={<Review />} />
      <Route path="/translate" element={<TranslateHome />} />
      <Route path="/translate/:id" element={<TranslateResult />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
