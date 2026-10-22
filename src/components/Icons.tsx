type P = { size?: number; strokeWidth?: number; filled?: boolean }

const base = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const SearchIcon = ({ size = 22, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
)
export const CameraIcon = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const BookIcon = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></svg>
)
export const RepeatIcon = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></svg>
)
export const ArrowUpIcon = ({ size = 20, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
)
export const ChevronRight = ({ size = 18, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M9 6l6 6-6 6" /></svg>
)
export const ChevronLeft = ({ size = 22, strokeWidth = 1.9 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M15 6l-6 6 6 6" /></svg>
)
export const CloseIcon = ({ size = 22, strokeWidth = 1.9 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const CheckIcon = ({ size = 18, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M5 12l5 5 9-10" /></svg>
)
export const MoonIcon = ({ size = 20, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)
export const SunIcon = ({ size = 20, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const UserIcon = ({ size = 20, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
export const SpeakerIcon = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 10v4h4l5 4V6L8 10z" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>
)
export const PhotoIcon = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
)
export const BookmarkIcon = ({ size = 16, strokeWidth = 1.8, filled = false }: P) => (
  <svg {...base(size, strokeWidth)} fill={filled ? 'currentColor' : 'none'}><path d="M6 3h12v18l-6-4-6 4z" /></svg>
)
