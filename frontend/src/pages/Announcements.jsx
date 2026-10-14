import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { Plus, Megaphone, Calendar, AlertTriangle, Info, X } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export default function Announcements() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetAudience: 'all',
    priority: 'normal',
    expiresAt: ''
  })

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get('/announcements')
      setAnnouncements(response.data)
    } catch (error) {
      console.error('Error fetching announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setSubmitError(null)
    try {
      await api.post('/announcements', formData)
      await fetchAnnouncements()
      closeModal()
    } catch (error) {
      // Visible dans la modale au lieu d'un échec silencieux.
      setSubmitError(error.response?.data?.error || error.message || 'Publication impossible')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/announcements/${deleting.id}`)
      setDeleting(null)
      fetchAnnouncements()
    } catch {
      setDeleting(null)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setSubmitError(null)
    setFormData({
      title: '',
      content: '',
      targetAudience: 'all',
      priority: 'normal',
      expiresAt: ''
    })
  }

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />
      case 'normal':
        return <Info className="w-5 h-5 text-blue-600" />
      default:
        return <Info className="w-5 h-5 text-gray-600" />
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-200 bg-red-50'
      case 'high':
        return 'border-orange-200 bg-orange-50'
      case 'normal':
        return 'border-blue-200 bg-blue-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annonces</h1>
          <p className="text-gray-600">Communications et informations importantes</p>
        </div>
        {user.role === 'admin' && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nouvelle Annonce
          </button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.length > 0 ? (
          announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`card border-l-4 ${getPriorityColor(announcement.priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getPriorityIcon(announcement.priority)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {announcement.title}
                    </h3>
                    <p className="text-gray-600 mb-3">{announcement.content}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Megaphone className="w-4 h-4" />
                        <span>{announcement.author_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(announcement.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                        {announcement.target_audience === 'all' ? 'Tous' :
                         announcement.target_audience === 'students' ? 'Candidats' : 'Professeurs'}
                      </span>
                    </div>
                  </div>
                </div>
                {user.role === 'admin' && (
                  <button
                    onClick={() => setDeleting(announcement)}
                    aria-label={`Supprimer ${announcement.title}`}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="card text-center py-12">
            <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune annonce</h3>
            <p className="text-gray-500">Les annonces apparaîtront ici</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nouvelle Annonce</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}
              <div>
                <label className="label" htmlFor="announcement-title">Titre</label>
                <input
                  id="announcement-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="announcement-content">Contenu</label>
                <textarea
                  id="announcement-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="announcement-audience">Audience</label>
                  <select
                    id="announcement-audience"
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    className="input"
                  >
                    <option value="all">Tous</option>
                    <option value="students">Candidats</option>
                    <option value="teachers">Professeurs</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="announcement-priority">Priorité</label>
                  <select
                    id="announcement-priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="input"
                  >
                    <option value="low">Basse</option>
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="announcement-expiry">Date d'expiration (optionnel, jour inclus)</label>
                <input
                  id="announcement-expiry"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Publication…' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Supprimer cette annonce ?"
        message={deleting ? `Supprimer « ${deleting.title} » ? Cette action est irréversible.` : ''}
        confirmText="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
