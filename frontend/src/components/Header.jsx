import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { User, Bell } from 'lucide-react'
import api from '../utils/api'

export default function Header() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadUnread = async () => {
      try {
        const res = await api.get('/notifications/mine')
        if (!cancelled) setUnreadCount(res.data.unreadCount || 0)
      } catch {
        // Notifications are non-critical: keep the badge hidden on failure
      }
    }

    loadUnread()
    const interval = setInterval(loadUnread, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user])

  const roleLabel = {
    admin: 'Administrateur',
    teacher: 'Professeur',
    student: 'Candidat'
  }[user?.role] || ''

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Bonjour, {user?.firstName} {user?.lastName}
        </h2>
        <p className="text-sm text-gray-500">{roleLabel}</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={`Notifications (${unreadCount} non lues)`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <Link
          to="/profile"
          className="flex items-center gap-3 pl-4 border-l border-gray-200 hover:opacity-80 transition-opacity"
        >
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </Link>
      </div>
    </header>
  )
}