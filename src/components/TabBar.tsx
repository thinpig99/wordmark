import { NavLink, useLocation } from 'react-router-dom'
import { BookIcon, CameraIcon, RepeatIcon, SearchIcon } from './Icons'

export default function TabBar() {
  const { pathname } = useLocation()
  const tabs = [
    { to: '/', label: '검색', icon: SearchIcon, active: pathname === '/' },
    { to: '/translate', label: '번역', icon: CameraIcon, active: pathname.startsWith('/translate') },
    { to: '/wordbook', label: '단어장', icon: BookIcon, active: pathname.startsWith('/wordbook') },
    { to: '/review', label: '복습', icon: RepeatIcon, active: pathname.startsWith('/review') },
  ]
  return (
    <div className="tabbar">
      <nav aria-label="주요 메뉴">
        {tabs.map(({ to, label, icon: Icon, active }) => (
          <NavLink key={to} to={to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
            <Icon size={22} strokeWidth={active ? 1.9 : 1.7} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
