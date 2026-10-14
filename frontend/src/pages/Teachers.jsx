import { useState, useEffect } from 'react'
import api from '../utils/api'
import { Plus, Search, Edit, Trash2, X, Mail, Phone } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [listError, setListError] = useState(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
    qualifications: '',
    bio: '',
    hourlyRate: ''
  })

  useEffect(() => {
    fetchTeachers()
  }, [])

  const fetchTeachers = async () => {
    try {
      const response = await api.get('/teachers')
      setTeachers(response.data)
    } catch (error) {
      console.error('Error fetching teachers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '' && value !== null)
      )
      if (editingTeacher) {
        await api.put(`/teachers/${editingTeacher.id}`, payload)
      } else {
        await api.post('/teachers', payload)
      }
      fetchTeachers()
      closeModal()
      setSubmitError(null)
    } catch (error) {
      setSubmitError(error.response?.data?.error?.message || 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/teachers/${deleting.id}`)
      setListError(null)
      setDeleting(null)
      fetchTeachers()
    } catch (error) {
      setListError(error.response?.data?.error?.message || 'Suppression impossible')
      setDeleting(null)
    }
  }

  const openModal = (teacher = null) => {
    if (teacher) {
      setEditingTeacher(teacher)
      setFormData({
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        email: teacher.email,
        phone: teacher.phone || '',
        specialization: teacher.specialization || '',
        qualifications: teacher.qualifications || '',
        bio: teacher.bio || '',
        hourlyRate: teacher.hourly_rate || ''
      })
    } else {
      setEditingTeacher(null)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        specialization: '',
        qualifications: '',
        bio: '',
        hourlyRate: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTeacher(null)
    setSubmitError(null)
  }

  const filteredTeachers = teachers.filter(teacher =>
    `${teacher.first_name} ${teacher.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    teacher.email.toLowerCase().includes(search.toLowerCase()) ||
    (teacher.specialization || '').toLowerCase().includes(search.toLowerCase())
  )

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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Professeurs</h1>
          <p className="text-gray-600">{teachers.length} professeurs</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nouveau Professeur
        </button>
      </div>

      <div className="card">
        {listError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
        )}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un professeur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => (
            <div key={teacher.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-primary-600">
                      {teacher.first_name[0]}{teacher.last_name[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{teacher.first_name} {teacher.last_name}</h3>
                    <p className="text-sm text-gray-500">{teacher.specialization || 'Professeur'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openModal(teacher)} className="p-1 text-gray-400 hover:text-primary-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setListError(null); setDeleting(teacher) }} aria-label={`Supprimer ${teacher.first_name} ${teacher.last_name}`} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{teacher.email}</span>
                </div>
                {teacher.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{teacher.phone}</span>
                  </div>
                )}
              </div>

              {teacher.qualifications && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">{teacher.qualifications}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTeacher ? 'Modifier le Professeur' : 'Nouveau Professeur'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="teacher-firstname" className="label">Prénom</label>
                  <input
                    id="teacher-firstname"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="teacher-lastname" className="label">Nom</label>
                  <input
                    id="teacher-lastname"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="teacher-email" className="label">Email</label>
                <input
                  id="teacher-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  required
                  disabled={!!editingTeacher}
                />
              </div>

              {!editingTeacher && (
                <div>
                  <label htmlFor="teacher-password" className="label">Mot de passe initial</label>
                  <input
                    id="teacher-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input"
                    required
                    minLength={6}
                    placeholder="6 caractères minimum"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Taux horaire (TND)</label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Spécialisation</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="input"
                  placeholder="Ex: Français, Anglais, Espagnol..."
                />
              </div>

              <div>
                <label className="label">Qualifications</label>
                <textarea
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Diplômes, certifications..."
                />
              </div>

              <div>
                <label className="label">Biographie</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Expérience, expertise..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : editingTeacher ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Supprimer ce professeur ?"
        message={deleting ? `Supprimer « ${deleting.first_name} ${deleting.last_name} » ? Cette action est irréversible.` : ''}
        confirmText="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
