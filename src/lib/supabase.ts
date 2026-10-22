import { createClient } from '@supabase/supabase-js'

// 공개용 키라 앱 코드에 들어가도 안전해요 (데이터 보호는 DB 보안 규칙이 담당)
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://cynprgcjvrvqbivusxhh.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_dqW_STIOZkQH1QNH6D2ytA_-CK7GEas'

export const supabase = createClient(url, key)
