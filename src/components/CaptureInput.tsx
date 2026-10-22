import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { fileToJpegBase64, translatePage } from '../lib/api'

// 카메라(또는 앨범)를 여는 버튼 + 사진을 번역까지 처리하는 훅
export function useTranslateUpload() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const image = await fileToJpegBase64(file)
      const res = await translatePage(image)
      if ('unreadable' in res) {
        setError(res.message)
        return
      }
      navigate(`/translate/${res.page.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '번역하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, handleFile }
}

export function CaptureInput({
  camera,
  onFile,
  className,
  children,
  disabled,
}: {
  camera: boolean
  onFile: (f: File | undefined) => void
  className?: string
  children: ReactNode
  disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <label className={`capture-label ${className ?? ''}`} aria-disabled={disabled}>
      <input
        ref={ref}
        className="visually-hidden"
        type="file"
        accept="image/*"
        {...(camera ? { capture: 'environment' as const } : {})}
        disabled={disabled}
        onChange={(e) => {
          onFile(e.target.files?.[0])
          if (ref.current) ref.current.value = ''
        }}
      />
      {children}
    </label>
  )
}

export function TranslatingOverlay() {
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="spinner" />
      <div style={{ fontSize: 17, fontWeight: 600 }}>페이지를 읽고 있어요</div>
      <div className="muted small">문장을 하나씩 번역하는 중이라 10~20초쯤 걸려요</div>
    </div>
  )
}
