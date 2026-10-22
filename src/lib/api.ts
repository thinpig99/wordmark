import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Page, Usage, UserWord, Word } from './types'

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error ?? '잠시 문제가 생겼어요. 다시 시도해 주세요.')
    }
    throw new Error('인터넷 연결을 확인해 주세요.')
  }
  return data as T
}

export type LookupResult =
  | { word: Word; userWord: UserWord | null; cached: boolean; needsDetail?: boolean; notFound?: undefined }
  | { notFound: true; suggestion: string | null }

export function lookupWord(word: string, opts: { source?: 'search' | 'photo'; page_id?: number } = {}) {
  return invoke<LookupResult>('lookup-word', { word, ...opts })
}

export function lookupDetail(word: string) {
  return invoke<{ word: Word }>('lookup-word', { word, stage: 'detail' })
}

export function translatePage(image: string, mime = 'image/jpeg') {
  return invoke<{ page: Page } | { unreadable: true; message: string }>('translate-page', { image, mime })
}

export async function getUsage(): Promise<Usage | null> {
  const { data } = await supabase.rpc('get_my_usage')
  return (Array.isArray(data) ? data[0] : data) ?? null
}

// 사진을 1600px 이내 JPEG로 줄여서 base64로 변환
export async function fileToJpegBase64(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('사진을 처리하지 못했어요.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
  } catch {
    throw new Error('사진을 열지 못했어요. 다른 사진으로 시도해 주세요.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function normalizeWord(input: string) {
  return input.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
}

export function isValidWord(w: string) {
  return /^[a-z][a-z' -]{0,63}$/.test(w)
}

export function dueLabel(uw: Pick<UserWord, 'level' | 'next_review_at'>) {
  if (uw.level >= 3) return { text: '외운 단어', today: false }
  const next = new Date(uw.next_review_at)
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(next) - startOf(new Date())) / 86400000)
  if (next.getTime() <= Date.now() || days <= 0) return { text: '오늘 복습', today: true }
  if (days === 1) return { text: '내일 복습', today: false }
  return { text: `${days}일 뒤`, today: false }
}

export function relativeDate(iso: string) {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000)
  if (days === 0) {
    const h = d.getHours()
    return `오늘 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (days === 1) return '어제'
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
