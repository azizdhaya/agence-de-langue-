import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const variantByType = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info'
}

export default function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/notifications/mine')
      // L'API renvoie du snake_case : mapping vers les clés camelCase.
      setNotifications((res.data.data || []).map((row) => ({
        ...row,
        isRead: row.is_read ?? row.isRead,
        createdAt: row.created_at ?? row.createdAt
      })))
      setUnreadCount(res.data.unreadCount || 0)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      await load()
    } catch {
      // Keep the list as-is if the request fails
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all')
      await load()
    } catch {
      // Keep the list as-is if the request fails
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">
            {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Toutes vos notifications sont lues'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllRead}>
            <CheckCheck className="w-5 h-5" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Aucune notification"
            description="Vous n'avez aucune notification pour le moment."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  item.isRead ? 'border-gray-200 bg-white' : 'border-primary-200 bg-primary-50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <Badge variant={variantByType[item.type] || 'default'}>
                      {item.type}
                    </Badge>
                    {!item.isRead && (
                      <span className="w-2 h-2 bg-primary-600 rounded-full" aria-label="Non lue" />
                    )}
                  </div>
                  <p className="text-gray-600 mt-1">{item.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(item.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {!item.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkRead(item.id)}
                    aria-label={`Marquer ${item.title} comme lue`}
                  >
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}