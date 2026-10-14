import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  UsersRound,
  CalendarClock,
  MessageSquare,
  ClipboardCheck,
  ClipboardList,
  Megaphone,
  Bell,
  LogOut,
  Globe,
  Languages,
  Layers
} from 'lucide-react'

const menuSections = [
  {
    label: null,
    items: [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', roles: ['admin'] }
    ]
  },
  {
    label: 'Pédagogie',
    items: [
      { path: '/students', icon: Users, label: 'Candidats', roles: ['admin', 'teacher'] },
      { path: '/teachers', icon: GraduationCap, label: 'Professeurs', roles: ['admin', 'teacher'] },
      { path: '/courses', icon: BookOpen, label: 'Cours', roles: ['admin', 'teacher', 'student'] },
      { path: '/groups', icon: UsersRound, label: 'Groupes', roles: ['admin', 'teacher', 'student'] },
      { path: '/sessions', icon: CalendarClock, label: 'Sessions', roles: ['admin', 'teacher', 'student'] },
      { path: '/attendance', icon: ClipboardCheck, label: 'Présences', roles: ['admin', 'teacher'] },
      { path: '/grades', icon: ClipboardList, label: 'Notes', roles: ['admin', 'teacher', 'student'] }
    ]
  },
  {
    label: 'Administration',
    items: [
      { path: '/languages', icon: Languages, label: 'Langues', roles: ['admin'] },
      { path: '/levels', icon: Layers, label: 'Niveaux', roles: ['admin'] }
    ]
  },
  {
    label: 'Communication',
    items: [
      { path: '/messages', icon: MessageSquare, label: 'Messages', roles: ['admin', 'teacher', 'student'] },
      { path: '/announcements', icon: Megaphone, label: 'Annonces', roles: ['admin', 'teacher', 'student'] },
      { path: '/notifications', icon: Bell, label: 'Notifications', roles: ['admin', 'teacher', 'student'] }
    ]
  }
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const role = user?.role

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900">Centre de Langue</h1>
            <p className="text-xs text-gray-500">Plateforme de gestion</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {menuSections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(role))

          if (visibleItems.length === 0) return null

          return (
            <div key={sectionIndex}>
              {section.label && (
                <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  )
}