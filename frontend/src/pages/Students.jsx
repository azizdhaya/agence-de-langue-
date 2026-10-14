import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'
import { Plus, Search, Edit, Trash2, Eye, X, Users } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../context/AuthContext'
import { useDemoStore, normalizeLanguageName } from '../data/demoStore'
import { cefrVariant, levelDisplay, mainLevel, CEFR_MAIN_LEVELS, CEFR_NAMES, skillLabel, assessmentMethodLabel, formatScore, ASSESSED_SKILLS } from '../utils/cefr'
import { statusVariant, pedagogyStatusLabel, formatMillimes, distributeDiscount } from '../utils/money'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '-')

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
  languageId: '',
  levelCode: '',
  status: 'active',
  testDone: false,
  testScore: '',
  testLevel: '',
  testDate: ''
}

/**
 * Gestion des Candidats.
 *
 * Table : Candidat | Email | Téléphone | Langue | Niveau (CEFR) | Statut.
 * La langue et le niveau viennent du profil linguistique (student_languages),
 * pas du champ legacy `students.level`.
 * Les langues et niveaux proposés viennent des modules Administration.
 */
export default function Students() {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin'

  const [students, setStudents] = useState([])
  const [profilesMap, setProfilesMap] = useState({})
  const [backendLanguages, setBackendLanguages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [submitError, setSubmitError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [listError, setListError] = useState(null)

  const [viewingId, setViewingId] = useState(null)

  // Langues actives côté démo, matchées par code (les IDs diffèrent).
  const { languages: demoLanguages } = useDemoStore()
  const activeCodes = new Set(
    demoLanguages.filter((l) => l.isActive).map((l) => normalizeLanguageName(l.code))
  )
  const isActiveLanguage = (code) => activeCodes.size === 0 || activeCodes.has(normalizeLanguageName(code))

  const fetchStudents = useCallback(async () => {
    try {
      const response = await api.get('/students')
      const rows = Array.isArray(response.data) ? response.data : response.data?.data || []
      setStudents(rows)
      // Profil principal de chaque candidat (langue + niveau CEFR).
      const entries = await Promise.all(
        rows.map(async (student) => {
          try {
            const res = await api.get(`/students/${student.id}/languages`)
            const profiles = Array.isArray(res.data?.data) ? res.data.data : []
            return [student.id, profiles]
          } catch {
            return [student.id, []]
          }
        })
      )
      setProfilesMap(Object.fromEntries(entries))
    } catch (error) {
      setListError(error.response?.data?.error?.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await api.get('/languages')
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || []
      setBackendLanguages(rows)
    } catch {
      // Optionnel : le formulaire reste utilisable sans la liste
    }
  }, [])

  useEffect(() => {
    fetchStudents()
    fetchLanguages()
  }, [fetchStudents, fetchLanguages])

  const primaryProfile = (student) => (profilesMap[student.id] || [])[0] || null

  const filteredStudents = students.filter((student) => {
    const term = search.trim().toLowerCase()
    const profile = primaryProfile(student)
    const haystack = [
      student.first_name, student.last_name, student.email, student.phone,
      profile?.language_name, profile?.global_level_code
    ].filter(Boolean).join(' ').toLowerCase()
    if (term && !haystack.includes(term)) return false
    if (languageFilter !== 'all' && normalizeLanguageName(profile?.language_code) !== normalizeLanguageName(languageFilter)) return false
    if (levelFilter !== 'all' && mainLevel(profile?.global_level_code) !== levelFilter) return false
    if (statusFilter !== 'all' && student.status !== statusFilter) return false
    return true
  })

  const languageOptions = backendLanguages.filter((l) => isActiveLanguage(l.code))

  const openModal = (student = null) => {
    if (student) {
      setEditingStudent(student)
      const profile = primaryProfile(student)
      const backendId = backendLanguages.find(
        (l) => normalizeLanguageName(l.code) === normalizeLanguageName(profile?.language_code)
      )?.id
      setFormData({
        ...emptyForm,
        firstName: student.first_name,
        lastName: student.last_name,
        email: student.email,
        phone: student.phone || '',
        dateOfBirth: student.date_of_birth || '',
        address: student.address || '',
        emergencyContact: student.emergency_contact || '',
        emergencyPhone: student.emergency_phone || '',
        languageId: backendId || '',
        levelCode: profile?.global_level_code ? mainLevel(profile.global_level_code) : '',
        status: student.status || 'active',
        testDone: profile?.assessment_score != null,
        testScore: profile?.assessment_score ?? '',
        testLevel: profile?.global_level_code || '',
        testDate: profile?.assessed_at ? String(profile.assessed_at).slice(0, 10) : ''
      })
    } else {
      setEditingStudent(null)
      setFormData(emptyForm)
    }
    setSubmitError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingStudent(null)
    setSubmitError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: editingStudent ? undefined : formData.password,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
          address: formData.address,
          emergencyContact: formData.emergencyContact,
          emergencyPhone: formData.emergencyPhone,
          status: formData.status
        }).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      )
      let studentId
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, payload)
        studentId = editingStudent.id
      } else {
        const created = await api.post('/students', payload)
        studentId = created.data?.data?.id
      }

      // Parcours linguistique : crée ou met à jour le profil.
      if (formData.languageId) {
        const profilePayload = {
          languageId: Number(formData.languageId),
          ...(formData.levelCode ? { globalLevelCode: formData.levelCode } : {}),
          method: formData.testDone ? 'placement_test' : 'admin_adjustment',
          ...(formData.testDone && formData.testScore !== ''
            ? { score: Number(formData.testScore) }
            : {}),
          ...(formData.testDone && formData.testDate ? { assessedAt: formData.testDate } : {}),
          ...(formData.testDone && formData.testLevel ? { globalLevelCode: formData.testLevel } : {}),
          reason: editingStudent ? 'Mise à jour de la fiche' : 'Création de la fiche'
        }
        const existing = (profilesMap[studentId] || []).find(
          (p) => p.language_id === Number(formData.languageId)
        )
        if (existing) {
          await api.put(`/students/${studentId}/languages/${formData.languageId}`, profilePayload)
        } else {
          await api.post(`/students/${studentId}/languages`, profilePayload)
        }
      }

      await fetchStudents()
      closeModal()
    } catch (error) {
      setSubmitError(error.response?.data?.error?.message || 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/students/${deleting.id}`)
      setListError(null)
      setDeleting(null)
      await fetchStudents()
    } catch (error) {
      setListError(error.response?.data?.error?.message || 'Suppression impossible')
      setDeleting(null)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Candidats</h1>
          <p className="text-gray-600">{students.length} candidats inscrits</p>
        </div>
        {canEdit && (
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nouveau Candidat
          </button>
        )}
      </div>

      <div className="card">
        {listError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
        )}
        <div className="mb-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un candidat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
              aria-label="Rechercher un candidat"
            />
          </div>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="input md:w-56"
            aria-label="Filtrer par langue"
          >
            <option value="all">Toutes les langues</option>
            {languageOptions.map((language) => (
              <option key={language.id} value={language.code}>
                {language.flag} {language.name}
              </option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="input md:w-56"
            aria-label="Filtrer par niveau"
          >
            <option value="all">Tous les niveaux</option>
            {CEFR_MAIN_LEVELS.map((code) => (
              <option key={code} value={code}>
                {code} — {CEFR_NAMES[code]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input md:w-56"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="graduated">Diplômé</option>
            <option value="suspended">Suspendu</option>
          </select>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun candidat trouvé"
            description="Aucun candidat ne correspond à votre recherche."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Candidat</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Téléphone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Langue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Niveau</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Statut</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const profile = primaryProfile(student)
                  return (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600">
                              {student.first_name[0]}{student.last_name[0]}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{student.first_name} {student.last_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{student.email}</td>
                      <td className="py-3 px-4 text-gray-600">{student.phone || '-'}</td>
                      <td className="py-3 px-4">
                        {profile ? (
                          <span>
                            <span className="mr-1" aria-hidden="true">{profile.language_flag || '🌐'}</span>
                            <span className="font-medium text-gray-900">{profile.language_name}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {profile?.global_level_code ? (
                          <Badge variant={cefrVariant(profile.global_level_code)}>
                            {levelDisplay(profile.global_level_code)}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusVariant(student.status) === 'success' ? 'bg-green-100 text-green-700' :
                          statusVariant(student.status) === 'danger' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {pedagogyStatusLabel(student.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setViewingId(student.id)} aria-label={`Voir ${student.first_name} ${student.last_name}`} className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <>
                              <button onClick={() => openModal(student)} aria-label={`Modifier ${student.first_name} ${student.last_name}`} className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setListError(null); setDeleting(student) }} aria-label={`Supprimer ${student.first_name} ${student.last_name}`} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal création / modification */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingStudent ? 'Modifier le Candidat' : 'Nouveau Candidat'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {submitError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Informations personnelles
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="student-firstname" className="label">Prénom *</label>
                    <input
                      id="student-firstname"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="student-lastname" className="label">Nom *</label>
                    <input
                      id="student-lastname"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="student-email" className="label">Email *</label>
                    <input
                      id="student-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input"
                      required
                      disabled={!!editingStudent}
                    />
                  </div>
                  {!editingStudent && (
                    <div>
                      <label htmlFor="student-password" className="label">Mot de passe initial *</label>
                      <input
                        id="student-password"
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
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="student-phone" className="label">Téléphone</label>
                    <input
                      id="student-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="student-dob" className="label">Date de naissance (optionnel)</label>
                    <input
                      id="student-dob"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="col-span-2">
                    <label htmlFor="student-address" className="label">Adresse</label>
                    <input
                      id="student-address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="student-ec" className="label">Contact d'urgence</label>
                    <input
                      id="student-ec"
                      type="text"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="student-ep" className="label">Téléphone d'urgence</label>
                    <input
                      id="student-ep"
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Parcours linguistique
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="student-language" className="label">Langue *</label>
                    <select
                      id="student-language"
                      value={formData.languageId}
                      onChange={(e) => setFormData({ ...formData, languageId: e.target.value })}
                      className="input"
                      required={!editingStudent}
                    >
                      <option value="">Sélectionner une langue</option>
                      {languageOptions.map((language) => (
                        <option key={language.id} value={language.id}>
                          {language.flag} {language.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="student-level" className="label">Niveau *</label>
                    <select
                      id="student-level"
                      value={formData.levelCode}
                      onChange={(e) => setFormData({ ...formData, levelCode: e.target.value })}
                      className="input"
                      required={!editingStudent}
                    >
                      <option value="">Sélectionner un niveau</option>
                      {CEFR_MAIN_LEVELS.map((code) => (
                        <option key={code} value={code}>
                          {code} — {CEFR_NAMES[code]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="student-status" className="label">Statut</label>
                    <select
                      id="student-status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="input"
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                      <option value="graduated">Diplômé</option>
                      <option value="suspended">Suspendu</option>
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Test de positionnement
                </h3>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={formData.testDone}
                    onChange={(e) => setFormData({ ...formData, testDone: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Test effectué</span>
                </label>
                {formData.testDone && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="student-score" className="label">Score</label>
                      <input
                        id="student-score"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.testScore}
                        onChange={(e) => setFormData({ ...formData, testScore: e.target.value })}
                        className="input"
                        placeholder="Ex : 68"
                      />
                    </div>
                    <div>
                      <label htmlFor="student-testlevel" className="label">Niveau obtenu</label>
                      <select
                        id="student-testlevel"
                        value={formData.testLevel}
                        onChange={(e) => setFormData({ ...formData, testLevel: e.target.value })}
                        className="input"
                      >
                        <option value="">Sélectionner</option>
                        {CEFR_MAIN_LEVELS.map((code) => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="student-testdate" className="label">Date du test</label>
                      <input
                        id="student-testdate"
                        type="date"
                        value={formData.testDate}
                        onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                )}
              </section>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : editingStudent ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fiche candidat */}
      {viewingId && (
        <StudentFiche
          studentId={viewingId}
          onClose={() => setViewingId(null)}
          canEdit={canEdit}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Supprimer ce candidat ?"
        message={deleting ? `Supprimer « ${deleting.first_name} ${deleting.last_name} » ? Cette action est irréversible.` : ''}
        confirmText="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

/**
 * Fiche détaillée d'un candidat : infos, parcours + progression CECRL,
 * test de positionnement, compétences, groupe + affectation.
 */
function StudentFiche({ studentId, onClose, canEdit }) {
  const [student, setStudent] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [history, setHistory] = useState([])
  const [courses, setCourses] = useState([])
  const [compatible, setCompatible] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [studentsRes, profilesRes] = await Promise.all([
          api.get('/students'),
          api.get(`/students/${studentId}/languages`).catch(() => ({ data: { data: [] } }))
        ])
        if (cancelled) return
        const rows = Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data?.data || []
        setStudent(rows.find((s) => s.id === studentId) || null)
        const profs = Array.isArray(profilesRes.data?.data) ? profilesRes.data.data : []
        setProfiles(profs)

        if (profs[0]) {
          const [historyRes, coursesRes, compatRes] = await Promise.all([
            api.get(`/students/${studentId}/languages/${profs[0].language_id}/history`).catch(() => ({ data: { data: [] } })),
            api.get(`/students/${studentId}/courses`).catch(() => ({ data: [] })),
            api.get(`/students/${studentId}/languages/${profs[0].language_id}/compatible-courses`).catch(() => ({ data: { data: [] } }))
          ])
          if (cancelled) return
          setHistory(Array.isArray(historyRes.data?.data) ? historyRes.data.data : [])
          setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : coursesRes.data?.data || [])
          setCompatible(Array.isArray(compatRes.data?.data) ? compatRes.data.data : [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  const primary = profiles[0] || null
  const currentMain = mainLevel(primary?.global_level_code)

  const assign = async () => {
    if (!selectedCourse || !primary) return
    setMessage(null)
    try {
      await api.post(`/courses/${selectedCourse}/enroll`, {
        studentId: primary.student_id,
        confirmed: true
      })
      setMessage({ ok: true, text: 'Candidat affecté au groupe avec succès.' })
      const coursesRes = await api.get(`/students/${studentId}/courses`).catch(() => ({ data: [] }))
      setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : coursesRes.data?.data || [])
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || 'Affectation impossible' })
    }
  }

  const unenroll = async (enrollmentId, courseName) => {
    if (!window.confirm(`Retirer ce candidat de « ${courseName} » ? L'inscription sera supprimée.`)) return
    setMessage(null)
    try {
      await api.delete(`/enrollments/${enrollmentId}`)
      setMessage({ ok: true, text: 'Candidat désinscrit du cours.' })
      setCourses((prev) => prev.filter((c) => c.enrollment_id !== enrollmentId))
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || 'Désinscription impossible' })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Fiche candidat</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : !student ? (
          <p className="text-gray-500">Candidat introuvable.</p>
        ) : (
          <div className="space-y-6">
            {message && (
              <div className={`rounded-lg px-4 py-3 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}

            <section className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-primary-600">
                  {student.first_name[0]}{student.last_name[0]}
                </span>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{student.first_name} {student.last_name}</p>
                <p className="text-sm text-gray-600">{student.email}</p>
                <p className="text-sm text-gray-600">{student.phone || '-'}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant={statusVariant(student.status)}>
                  {pedagogyStatusLabel(student.status)}
                </Badge>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Informations personnelles
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Nom</dt>
                  <dd className="font-medium text-gray-900">{student.first_name} {student.last_name}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-900">{student.email}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Téléphone</dt>
                  <dd className="font-medium text-gray-900">{student.phone || '-'}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Date d'inscription</dt>
                  <dd className="font-medium text-gray-900">{formatDate(student.enrollment_date || student.created_at)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Parcours linguistique
              </h3>
              {!primary ? (
                <p className="text-sm text-gray-500">Aucune langue évaluée pour ce candidat.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-2xl" aria-hidden="true">{primary.language_flag || '🌐'}</span>
                    <span className="font-semibold text-gray-900">{primary.language_name}</span>
                    <Badge variant={cefrVariant(primary.global_level_code)}>
                      {levelDisplay(primary.global_level_code)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mb-2" aria-label={`Progression : niveau ${currentMain}`}>
                    {CEFR_MAIN_LEVELS.map((code, index) => {
                      const reached = currentMain
                        ? CEFR_MAIN_LEVELS.indexOf(currentMain) >= index
                        : false
                      const current = code === currentMain
                      return (
                        <div key={code} className="flex items-center gap-1 flex-1">
                          <div className="flex flex-col items-center gap-1 w-full">
                            <span
                              className={`w-4 h-4 rounded-full ${
                                current ? 'bg-primary-600 ring-4 ring-primary-100' : reached ? 'bg-primary-400' : 'bg-gray-200'
                              }`}
                            />
                            <span className={`text-xs ${current ? 'font-bold text-primary-700' : 'text-gray-500'}`}>
                              {code}
                            </span>
                          </div>
                          {index < CEFR_MAIN_LEVELS.length - 1 && (
                            <div className={`h-0.5 flex-1 mb-5 ${reached ? 'bg-primary-400' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {history.length > 0 && (
                    <ol className="mt-2 space-y-1 text-xs text-gray-500">
                      {history.slice(0, 4).map((entry) => (
                        <li key={entry.id}>
                          {formatDate(entry.created_at)} : {entry.old_level_code || 'création'} → {entry.new_level_code}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </section>

            {primary && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Test de positionnement
                </h3>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-gray-500">Score</dt>
                    <dd className="font-medium text-gray-900">
                      {primary.assessment_score != null ? `${primary.assessment_score} / 100` : '-'}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-gray-500">Niveau recommandé</dt>
                    <dd className="font-medium text-gray-900">{primary.global_level_code || '-'}</dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-gray-500">Date</dt>
                    <dd className="font-medium text-gray-900">{formatDate(primary.assessed_at)}</dd>
                  </div>
                </dl>
              </section>
            )}

            {primary && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Compétences
                </h3>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {ASSESSED_SKILLS.map((skill) => {
                    const code = primary[`${skill}_level_code`]
                    return (
                      <div key={skill} className="rounded-lg bg-gray-50 px-3 py-2">
                        <dt className="text-xs text-gray-500">{skillLabel(skill)}</dt>
                        <dd className="mt-1">
                          {code ? <Badge variant={cefrVariant(code)}>{code}</Badge> : <span className="text-gray-400 text-sm">-</span>}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Groupe
              </h3>
              {courses.length === 0 ? (
                <p className="text-sm text-gray-500 mb-3">Aucun groupe affecté</p>
              ) : (
                <ul className="mb-3 space-y-1 text-sm">
                  {courses.map((course) => (
                    <li key={course.enrollment_id || course.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 font-medium text-gray-900">
                      <span>{course.name}</span>
                      {canEdit && course.enrollment_id && (
                        <button
                          onClick={() => unenroll(course.enrollment_id, course.name)}
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                          aria-label={`Désinscrire de ${course.name}`}
                        >
                          Désinscrire
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && primary && compatible.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="input flex-1"
                    aria-label="Choisir un groupe compatible"
                  >
                    <option value="">Affecter à un groupe…</option>
                    {compatible.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name} ({course.level_match === 'exact' ? 'niveau exact' : 'niveau proche'})
                      </option>
                    ))}
                  </select>
                  <Button onClick={assign} disabled={!selectedCourse}>
                    Affecter
                  </Button>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Situation financière
              </h3>
              <StudentLedger studentId={studentId} canEdit={canEdit} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'card', label: 'Carte' },
  { value: 'transfer', label: 'Virement' },
  { value: 'check', label: 'Chèque' },
  { value: 'other', label: 'Autre' }
]

/**
 * Student financial position and the payment form.
 *
 * The admin builds a "cart" of what to settle — a submodule at its full
 * balance, or a whole module with an optional discount — then records the
 * payment in one call. Amounts are previewed with the same distribution rule as
 * the server; the server remains the authority (it recomputes everything).
 */
function StudentLedger({ studentId, canEdit }) {
  const [ledger, setLedger] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState({})
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [recording, setRecording] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [message, setMessage] = useState(null)

  const load = async () => {
    const res = await api.get(`/students/${studentId}/ledger`).catch(() => ({ data: null }))
    const payload = res.data?.data
    setLedger(payload && !Array.isArray(payload) ? payload : null)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/students/${studentId}/ledger`)
      .then((res) => {
        if (cancelled) return
        const payload = res.data?.data
        setLedger(payload && !Array.isArray(payload) ? payload : null)
      })
      .catch(() => { if (!cancelled) setLedger(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [studentId])

  const toggleModule = (module) => {
    const key = `m:${module.enrollment_module_id}`
    setCart((prev) => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
        return next
      }
      for (const sub of module.submodules) delete next[`s:${sub.enrollment_submodule_id}`]
      next[key] = { discountPercent: String(module.discount_percent ?? 0) }
      return next
    })
  }

  const toggleSubmodule = (sub) => {
    const key = `s:${sub.enrollment_submodule_id}`
    setCart((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = {}
      return next
    })
  }

  const setModuleDiscount = (module, value) => {
    const key = `m:${module.enrollment_module_id}`
    setCart((prev) => ({ ...prev, [key]: { ...prev[key], discountPercent: value } }))
  }

  // Preview the total exactly as the server computes it, and build the payload
  // alongside so the two can never drift (a discount is dropped on a module that
  // already has a paid submodule).
  const preview = { items: [], total: 0, payload: [] }
  for (const enrollment of ledger?.enrollments || []) {
    for (const module of enrollment.modules) {
      const moduleKey = `m:${module.enrollment_module_id}`
      if (cart[moduleKey]) {
        const clean = module.submodules.every((s) => s.status !== 'paid')
        const percent = clean ? Number(cart[moduleKey].discountPercent) || 0 : 0
        const discounts = distributeDiscount(module.submodules.map((s) => s.price_millimes), percent)
        module.submodules.forEach((sub, index) => {
          const amount = Math.max(0, sub.price_millimes - discounts[index] - sub.amount_paid_millimes)
          preview.total += amount
        })
        preview.items.push({ key: moduleKey, label: module.module_name })
        preview.payload.push({ enrollmentModuleId: module.enrollment_module_id, discountPercent: percent })
      }
      for (const sub of module.submodules) {
        const subKey = `s:${sub.enrollment_submodule_id}`
        if (cart[subKey]) {
          preview.total += Math.max(0, sub.balance_millimes)
          preview.items.push({ key: subKey, label: `${module.module_name} · ${sub.name}` })
          preview.payload.push({ enrollmentSubmoduleId: sub.enrollment_submodule_id })
        }
      }
    }
  }

  const recordPayment = async () => {
    if (preview.items.length === 0) return
    setMessage(null)
    setRecording(true)
    try {
      await api.post(`/students/${studentId}/payments`, {
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        items: preview.payload
      })
      setMessage({ ok: true, text: `Paiement enregistré (${formatMillimes(preview.total)}).` })
      setCart({})
      setReference('')
      await load()
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || 'Enregistrement impossible' })
    } finally {
      setRecording(false)
    }
  }

  const confirmVoid = async () => {
    if (!voiding) return
    const payment = voiding
    setVoiding(null)
    setMessage(null)
    try {
      await api.delete(`/payments/${payment.id}`)
      setMessage({ ok: true, text: 'Paiement annulé.' })
      await load()
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || 'Annulation impossible' })
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Chargement…</p>
  }

  if (!ledger || !ledger.enrollments?.length) {
    return (
      <p className="text-sm text-gray-500">
        Aucune échéance. Inscrivez le candidat à un module depuis la fiche du cours.
      </p>
    )
  }

  return (
    <div>
      {message && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <dl className="mb-3 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <dt className="text-gray-500">Total dû</dt>
          <dd className="font-medium text-gray-900">
            {formatMillimes(ledger.totals.price_millimes - ledger.totals.discount_millimes)}
          </dd>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <dt className="text-gray-500">Payé</dt>
          <dd className="font-medium text-green-700">{formatMillimes(ledger.totals.paid_millimes)}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <dt className="text-gray-500">Reste à payer</dt>
          <dd className="font-medium text-red-700">{formatMillimes(ledger.totals.balance_millimes)}</dd>
        </div>
      </dl>

      {ledger.enrollments.map((enrollment) => (
        <div key={enrollment.enrollment_id} className="mb-3">
          <p className="text-sm font-semibold text-gray-900">{enrollment.course_name}</p>
          {enrollment.modules.map((module) => {
            const moduleKey = `m:${module.enrollment_module_id}`
            const selected = Boolean(cart[moduleKey])
            const clean = module.submodules.every((s) => s.status !== 'paid')
            return (
              <div key={module.enrollment_module_id} className="mt-1 rounded-lg border border-gray-200 p-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <label className="flex items-center gap-2 font-medium text-gray-800">
                    {canEdit && (
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={module.paid}
                        onChange={() => toggleModule(module)}
                        aria-label={`Régler le module ${module.module_name}`}
                      />
                    )}
                    {module.module_name}
                    {Number(module.discount_percent) > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        −{module.discount_percent}%
                      </span>
                    )}
                  </label>
                  <span className="text-gray-500">{formatMillimes(module.totals.balance_millimes)}</span>
                </div>

                {selected && canEdit && (
                  <div className="mt-2 flex items-center gap-2 rounded bg-primary-50 px-2 py-1.5 text-xs text-primary-800">
                    <label htmlFor={`disc-${module.enrollment_module_id}`}>Remise module</label>
                    <input
                      id={`disc-${module.enrollment_module_id}`}
                      type="number" min="0" max="100"
                      className="w-16 rounded border border-primary-200 px-1.5 py-0.5"
                      value={cart[moduleKey].discountPercent}
                      disabled={!clean}
                      onChange={(e) => setModuleDiscount(module, e.target.value)}
                      aria-label={`Remise du module ${module.module_name}`}
                    />
                    <span>%</span>
                    {!clean && <span className="text-amber-700">— module déjà entamé : prix plein uniquement</span>}
                  </div>
                )}

                <ul className="mt-1 space-y-0.5">
                  {module.submodules.map((sub) => {
                    const disabled = sub.status === 'paid' || selected
                    return (
                      <li
                        key={sub.enrollment_submodule_id}
                        className="flex items-center justify-between text-xs text-gray-600"
                      >
                        <label className="flex items-center gap-2">
                          {canEdit && (
                            <input
                              type="checkbox"
                              checked={Boolean(cart[`s:${sub.enrollment_submodule_id}`])}
                              disabled={disabled}
                              onChange={() => toggleSubmodule(sub)}
                              aria-label={`Payer ${sub.name}`}
                            />
                          )}
                          <span>{sub.name}</span>
                        </label>
                        <span className="flex items-center gap-2">
                          {formatMillimes(sub.price_millimes - sub.discount_millimes)}
                          <Badge variant={sub.status === 'paid' ? 'success' : 'warning'}>
                            {sub.status === 'paid' ? 'Payé' : 'À payer'}
                          </Badge>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      ))}

      {canEdit && preview.items.length > 0 && (
        <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3">
          <ul className="mb-2 space-y-0.5 text-xs text-primary-900">
            {preview.items.map((item) => (
              <li key={item.key}>• {item.label}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label className="label" htmlFor="payment-method">Moyen de paiement</label>
              <select
                id="payment-method"
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="payment-reference">Référence</label>
              <input
                id="payment-reference"
                className="input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-primary-700">Total à encaisser</p>
              <p className="mb-1 font-semibold text-gray-900">{formatMillimes(preview.total)}</p>
              <button className="btn-primary disabled:opacity-50" onClick={recordPayment} disabled={recording}>
                Encaisser
              </button>
            </div>
          </div>
        </div>
      )}

      {ledger.payments?.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Paiements</p>
          <ul className="space-y-1">
            {ledger.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-gray-900">{formatMillimes(payment.amount_millimes)}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {PAYMENT_METHODS.find((m) => m.value === payment.method)?.label || payment.method}
                    {payment.reference ? ` · ${payment.reference}` : ''}
                    {payment.paid_at ? ` · ${new Date(payment.paid_at).toLocaleDateString('fr-FR')}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Link
                    to={`/payments/${payment.id}/receipt`}
                    className="text-xs font-medium text-primary-600 hover:text-primary-800"
                    aria-label={`Reçu du paiement ${payment.id}`}
                  >
                    Reçu
                  </Link>
                  {canEdit && (
                    <button
                      onClick={() => setVoiding(payment)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                      aria-label={`Annuler le paiement ${payment.id}`}
                    >
                      Annuler
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(voiding)}
        title="Annuler ce paiement ?"
        message={voiding ? `Annuler le paiement de ${formatMillimes(voiding.amount_millimes)} ? Les échéances réglées redeviendront impayées.` : ''}
        confirmText="Annuler le paiement"
        onConfirm={confirmVoid}
        onCancel={() => setVoiding(null)}
      />
    </div>
  )
}
