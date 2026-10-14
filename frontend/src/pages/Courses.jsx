import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useDemoStore, courseLanguageIsActive } from '../data/demoStore'
import { formatMoney, formatMillimes, getDefaultCode, statusVariant, pedagogyStatusLabel } from '../utils/money'
import { Plus, Search, Edit, Trash2, X, Users, Calendar, MapPin, Eye } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const courseTypeLabel = (value) => ({
  generale: 'Générale', intensive: 'Intensive', examen: 'Préparation examen', professionnelle: 'Professionnelle'
}[value] || value)

const modeLabel = (value) => ({
  presentiel: 'Présentiel', en_ligne: 'En ligne', hybride: 'Hybride'
}[value] || value)

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const formatHour = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':')
  if (h === undefined || h === '') return ''
  return m && m !== '00' ? `${Number(h)}h${m}` : `${Number(h)}h`
}

const composeSchedule = (slots) => {
  const ordered = [...slots].sort(
    (a, b) => WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day)
  )
  const groups = []
  for (const slot of ordered) {
    const key = `${slot.start}|${slot.end}`
    const found = groups.find((g) => g.key === key)
    if (found) found.days.push(slot.day)
    else groups.push({ key, start: slot.start, end: slot.end, days: [slot.day] })
  }
  return groups.map((g) => {
    const head = g.days.join('-')
    if (g.start && g.end) return `${head} ${formatHour(g.start)}-${formatHour(g.end)}`
    if (g.start || g.end) return `${head} ${formatHour(g.start || g.end)}`
    return head
  }).join(', ')
}

const parseSchedule = (value) => {
  const slots = []
  for (const segment of String(value || '').split(',')) {
    const match = segment.trim().match(
      /^((?:Lun|Mar|Mer|Jeu|Ven|Sam|Dim)(?:-(?:Lun|Mar|Mer|Jeu|Ven|Sam|Dim))*)?\s*(?:(\d{1,2})h(\d{2})?\s*-\s*(\d{1,2})h(\d{2})?)?$/
    )
    if (!match || (!match[1] && !match[2])) continue
    const pad = (h, m) => `${String(h).padStart(2, '0')}:${m || '00'}`
    const start = match[2] ? pad(match[2], match[3]) : ''
    const end = match[4] ? pad(match[4], match[5]) : ''
    for (const day of (match[1] ? match[1].split('-') : [])) {
      if (!slots.some((s) => s.day === day)) slots.push({ day, start, end })
    }
  }
  return slots
}

export default function Courses() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // Course prices are shown in the centre's default currency.
  const defaultCurrency = getDefaultCode()
  // Les cours des langues inactives sont masqués partout (même règle que Niveaux).
  const { languages: demoLanguages } = useDemoStore()
  const [courses, setCourses] = useState([])
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [listError, setListError] = useState(null)
  const [search, setSearch] = useState('')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [success, setSuccess] = useState(null)
  const [viewing, setViewing] = useState(null)
  // Jours et heures du planning indicatif : chaque jour a ses propres heures,
  // les jours aux mêmes heures sont regroupés dans le texte schedule.
  const [schedSlots, setSchedSlots] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [groupsByCourse, setGroupsByCourse] = useState({})
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    language: '',
    level: 'beginner',
    levelCode: '',
    courseType: '',
    mode: '',
    status: 'active',
    teacherId: '',
    maxStudents: 20,
    startDate: '',
    endDate: '',
    schedule: '',
    room: '',
    price: ''
  })

  useEffect(() => {
    fetchCourses()
    fetchLevels()
    fetchGroupsByCourse()
    if (user?.role === 'admin') {
      fetchTeachers()
    }
  }, [user?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  // Groupes reliés à chaque cours : affichés sur la carte du cours pour
  // vérifier la liaison cours ↔ groupes d'un coup d'œil.
  const fetchGroupsByCourse = async () => {
    try {
      const response = await api.get('/groups', { params: { page: 1, limit: 200 } })
      const rows = Array.isArray(response.data) ? response.data : response.data?.data || []
      const map = {}
      for (const row of rows) {
        const key = row.course_id ?? row.courseId
        if (key == null) continue
        if (!map[key]) map[key] = []
        map[key].push({
          id: row.id,
          name: row.name,
          enrolled: row.enrolled_students ?? row.enrolledStudents ?? 0,
          max: row.max_students ?? row.maxStudents ?? null
        })
      }
      setGroupsByCourse(map)
    } catch {
      // Optionnel : les cartes restent utilisables sans les groupes.
    }
  }

  const fetchLevels = async () => {
    try {
      const response = await api.get('/levels')
      setLevels(Array.isArray(response.data?.data) ? response.data.data : [])
    } catch {
      // Optional: the CEFR picker simply stays empty.
    }
  }

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses', { params: { page: 1, limit: 200 } })
      // The API answers { success, data, pagination }; tolerate a raw array too.
      const rows = Array.isArray(response.data) ? response.data : response.data?.data || []
      setCourses(rows)
    } catch (error) {
      console.error('Error fetching courses:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeachers = async () => {
    try {
      const response = await api.get('/teachers')
      setTeachers(response.data)
    } catch (error) {
      console.error('Error fetching teachers:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    // Retour immédiat côté client ; le serveur reste la source de vérité.
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      setSubmitError('La date de fin doit être postérieure à la date de début.')
      return
    }
    setSaving(true)
    try {
      // Normalise le formulaire : les champs vides deviennent absents, sinon
      // la validation backend refuse '' (ex. teacherId doit être un nombre).
      const payload = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '' && value !== null)
      )
      if (editingCourse) {
        await api.put(`/courses/${editingCourse.id}`, payload)
        setSuccess(`Cours « ${payload.name || editingCourse.name} » mis à jour.`)
      } else {
        await api.post('/courses', payload)
        setSuccess(`Cours « ${payload.name} » créé.`)
      }
      fetchCourses()
      fetchGroupsByCourse()
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
      await api.delete(`/courses/${deleting.id}`)
      setListError(null)
      setSuccess(`Cours « ${deleting.name} » supprimé.`)
      setDeleting(null)
      fetchCourses()
      fetchGroupsByCourse()
    } catch (error) {
      setListError(error.response?.data?.error?.message || 'Suppression impossible')
      setDeleting(null)
    }
  }

  const applyScheduleSlots = (slots) => {
    setSchedSlots(slots)
    setFormData((prev) => ({ ...prev, schedule: composeSchedule(slots) }))
  }

  const toggleSchedDay = (day) => {
    if (schedSlots.some((s) => s.day === day)) {
      applyScheduleSlots(schedSlots.filter((s) => s.day !== day))
    } else {
      // Le nouveau jour reprend les heures du premier créneau s'il existe.
      const first = [...schedSlots].sort(
        (a, b) => WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day)
      )[0]
      applyScheduleSlots([
        ...schedSlots,
        { day, start: first?.start || '', end: first?.end || '' }
      ])
    }
  }

  const setSlotTime = (day, which, value) => {
    applyScheduleSlots(
      schedSlots.map((s) => (s.day === day ? { ...s, [which]: value } : s))
    )
  }

  const openModal = (course = null) => {
    setSchedSlots(parseSchedule(course?.schedule || ''))
    if (course) {
      setEditingCourse(course)
      setFormData({
        name: course.name,
        description: course.description || '',
        language: course.language,
        level: course.level,
        levelCode: course.level_code || '',
        courseType: course.course_type || '',
        mode: course.mode || '',
        status: course.status || 'active',
        teacherId: course.teacher_id || '',
        maxStudents: course.max_students,
        startDate: course.start_date || '',
        endDate: course.end_date || '',
        schedule: course.schedule || '',
        room: course.room || '',
        price: course.price
      })
    } else {
      setEditingCourse(null)
      setFormData({
        name: '',
        description: '',
        language: '',
        level: 'beginner',
        levelCode: '',
        courseType: '',
        mode: '',
        status: 'active',
        teacherId: '',
        maxStudents: 20,
        startDate: '',
        endDate: '',
        schedule: '',
        room: '',
        price: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCourse(null)
    setSubmitError(null)
  }

  const visibleCourses = courses.filter((course) =>
    courseLanguageIsActive(demoLanguages, course.language)
  )
  const hiddenCount = courses.length - visibleCourses.length

  // Liste des langues proposées à la création : uniquement les actives.
  const activeCourseLanguages = demoLanguages
    .filter((l) => l.isActive)
    .map((l) => l.name)

  const filteredCourses = visibleCourses.filter(course => {
    if (search) {
      const term = search.toLowerCase()
      const haystack = `${course.name} ${course.language} ${course.teacher_name || ''}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }
    if (languageFilter !== 'all' && course.language !== languageFilter) return false
    if (levelFilter !== 'all' && course.level !== levelFilter && (course.level_code || '') !== levelFilter) return false
    if (teacherFilter !== 'all' && String(course.teacher_id || '') !== String(teacherFilter)) return false
    if (statusFilter !== 'all' && course.status !== statusFilter) return false
    return true
  })

  const stats = {
    total: visibleCourses.length,
    active: visibleCourses.filter((c) => c.status === 'active').length,
    inactive: visibleCourses.filter((c) => c.status === 'inactive').length,
    completed: visibleCourses.filter((c) => c.status === 'completed').length
  }
  const languageOptions = [...new Set(visibleCourses.map((c) => c.language).filter(Boolean))].sort()
  const levelOptions = [...new Set(visibleCourses.map((c) => c.level).filter(Boolean))].sort()

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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des cours</h1>
          <p className="text-gray-600">
            {stats.total} cours · {stats.active} en cours · {stats.inactive} planifiés · {stats.completed} terminés
          </p>
        </div>
        {user.role === 'admin' && (
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nouveau cours
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'En cours', value: stats.active },
          { label: 'Planifiés', value: stats.inactive },
          { label: 'Terminés', value: stats.completed }
        ].map((stat) => (
          <div key={stat.label} className="card !py-3">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card">
        {listError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
        )}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un cours..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
              aria-label="Rechercher un cours"
            />
          </div>
          <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className="input" aria-label="Filtrer par langue">
            <option value="all">Toutes les langues</option>
            {languageOptions.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="input" aria-label="Filtrer par niveau">
            <option value="all">Tous les niveaux</option>
            {levelOptions.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input" aria-label="Filtrer par statut">
            <option value="all">Tous les statuts</option>
            <option value="active">En cours</option>
            <option value="inactive">Planifié</option>
            <option value="completed">Terminé</option>
            <option value="cancelled">Annulé</option>
          </select>
          {user.role === 'admin' && teachers.length > 0 && (
            <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="input" aria-label="Filtrer par formateur">
              <option value="all">Tous les formateurs</option>
              {teachers.map((teacher) => (
                <option key={teacher.teacher_id ?? teacher.id} value={teacher.teacher_id ?? teacher.id}>
                  {teacher.first_name} {teacher.last_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {filteredCourses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Aucun cours ne correspond à ces critères.</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => (
            <div key={course.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{course.name}</h3>
                  <p className="text-sm text-gray-500">
                    {course.language} - {course.level}
                    {course.level_code ? ` · ${course.level_code}` : ''}
                  </p>
                </div>
                {user.role === 'admin' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewing(course)} aria-label={`Consulter ${course.name}`} title="Consulter" className="p-1 text-gray-400 hover:text-primary-600">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openModal(course)} aria-label={`Modifier ${course.name}`} title="Modifier" className="p-1 text-gray-400 hover:text-primary-600">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setListError(null); setDeleting(course) }} aria-label={`Supprimer ${course.name}`} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {user.role !== 'admin' && (
                  <button onClick={() => setViewing(course)} aria-label={`Consulter ${course.name}`} title="Consulter" className="p-1 text-gray-400 hover:text-primary-600">
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>

              {course.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{course.description}</p>
              )}

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{course.enrolled_students}/{course.max_students} étudiants</span>
                </div>
                {(course.start_date || course.end_date) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {course.start_date ? new Date(course.start_date).toLocaleDateString('fr-FR') : '…'}
                      {' → '}
                      {course.end_date ? new Date(course.end_date).toLocaleDateString('fr-FR') : '…'}
                    </span>
                  </div>
                )}
                {(course.course_type || course.mode) && (
                  <div className="flex items-center gap-2 text-xs">
                    {course.course_type && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                        {courseTypeLabel(course.course_type)}
                      </span>
                    )}
                    {course.mode && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                        {modeLabel(course.mode)}
                      </span>
                    )}
                  </div>
                )}
                {course.teacher_name && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Prof:</span>
                    <span>{course.teacher_name}</span>
                  </div>
                )}
                {course.schedule && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{course.schedule}</span>
                  </div>
                )}
                {course.room && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{course.room}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-lg font-bold text-primary-600">
                  {formatMoney(course.price, defaultCurrency)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  statusVariant(course.status) === 'success' ? 'bg-green-100 text-green-700' :
                  statusVariant(course.status) === 'danger' ? 'bg-red-100 text-red-700' :
                  statusVariant(course.status) === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {pedagogyStatusLabel(course.status)}
                </span>
              </div>

              <div className="mt-2 text-sm">
                {(groupsByCourse[course.id] || []).length === 0 ? (
                  <p className="text-gray-400">Aucun groupe relié</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5" aria-label={`Groupes du cours ${course.name}`}>
                    {groupsByCourse[course.id].map((group) => (
                      <li
                        key={group.id}
                        className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700"
                        title={`${group.enrolled}${group.max != null ? `/${group.max}` : ''} inscrits`}
                      >
                        {group.name} · {group.enrolled}{group.max != null ? `/${group.max}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
        {hiddenCount > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {hiddenCount} cours masqué{hiddenCount > 1 ? 's' : ''} :{' '}
            leur langue est inactive. Réactivez la langue pour les afficher.
          </p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingCourse ? 'Modifier le Cours' : 'Nouveau Cours'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {submitError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Informations générales
                </h3>
                <div>
                  <label htmlFor="course-name" className="label">Nom du cours *</label>
                  <input
                    type="text"
                    id="course-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="course-description" className="label">Description et objectifs pédagogiques</label>
                  <textarea
                    id="course-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="course-language" className="label">Langue *</label>
                    <select
                      id="course-language"
                    value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Sélectionner une langue</option>
                      {activeCourseLanguages.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      {!activeCourseLanguages.includes(formData.language) && formData.language && (
                        <option value={formData.language}>
                          {formData.language} (inactive)
                        </option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="course-level" className="label">Niveau *</label>
                    <select
                      id="course-level"
                    value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                      className="input"
                    >
                      <option value="beginner">Débutant</option>
                      <option value="elementary">Élémentaire</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="upper-intermediate">Intermédiaire supérieur</option>
                      <option value="advanced">Avancé</option>
                      <option value="proficient">Compétent</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="course-level-code" className="label">Niveau CEFR (optionnel)</label>
                    <select
                      id="course-level-code"
                    value={formData.levelCode}
                      onChange={(e) => setFormData({ ...formData, levelCode: e.target.value })}
                      className="input"
                    >
                      <option value="">Non classé</option>
                      {levels.map((level) => (
                        <option key={level.id} value={level.code}>
                          {level.code} — {level.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="course-type" className="label">Type de formation</label>
                    <select
                      id="course-type"
                      value={formData.courseType}
                      onChange={(e) => setFormData({ ...formData, courseType: e.target.value })}
                      className="input"
                    >
                      <option value="">Non précisé</option>
                      <option value="generale">Générale</option>
                      <option value="intensive">Intensive</option>
                      <option value="examen">Préparation à un examen</option>
                      <option value="professionnelle">Professionnelle</option>
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Organisation et planning
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Le planning détaillé (séances, salles, horaires) vit dans les groupes du cours, page Groupes.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="course-teacher" className="label">Formateur responsable</label>
                    <select
                      id="course-teacher"
                    value={formData.teacherId}
                      onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                      className="input"
                    >
                      <option value="">Sélectionner un professeur</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.teacher_id ?? teacher.id} value={teacher.teacher_id ?? teacher.id}>
                          {teacher.first_name} {teacher.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="course-max-students" className="label">Capacité maximale *</label>
                    <input
                      type="number"
                      id="course-max-students"
                    value={formData.maxStudents}
                      onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) })}
                      className="input"
                      min={1}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="course-start-date" className="label">Date de début</label>
                    <input
                      type="date"
                      id="course-start-date"
                    value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="course-end-date" className="label">Date de fin</label>
                    <input
                      type="date"
                      id="course-end-date"
                    value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="course-mode" className="label">Mode de formation</label>
                    <select
                      id="course-mode"
                      value={formData.mode}
                      onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                      className="input"
                    >
                      <option value="">Non précisé</option>
                      <option value="presentiel">Présentiel</option>
                      <option value="en_ligne">En ligne</option>
                      <option value="hybride">Hybride</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="course-room" className="label">Salle de formation</label>
                    <input
                      type="text"
                      id="course-room"
                    value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="input"
                      placeholder="Ex: Salle 101"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <span className="label">Jours et horaires (indicatif)</span>
                  <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="Jours de formation">
                    {WEEK_DAYS.map((day) => {
                      const selected = schedSlots.some((s) => s.day === day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleSchedDay(day)}
                          aria-pressed={selected}
                          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                            selected
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                  {[...schedSlots]
                    .sort((a, b) => WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day))
                    .map((slot) => (
                      <div key={slot.day} className="grid grid-cols-[4rem_1fr_1fr] items-end gap-2 mb-2">
                        <span className="pb-2 text-sm font-medium text-gray-700">{slot.day}</span>
                        <div>
                          <label htmlFor={`course-start-${slot.day}`} className="label">Début</label>
                          <input
                            type="time"
                            id={`course-start-${slot.day}`}
                            value={slot.start}
                            onChange={(e) => setSlotTime(slot.day, 'start', e.target.value)}
                            className="input"
                          />
                        </div>
                        <div>
                          <label htmlFor={`course-end-${slot.day}`} className="label">Fin</label>
                          <input
                            type="time"
                            id={`course-end-${slot.day}`}
                            value={slot.end}
                            onChange={(e) => setSlotTime(slot.day, 'end', e.target.value)}
                            className="input"
                          />
                        </div>
                      </div>
                    ))}
                  <input
                    type="text"
                    id="course-schedule"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="input"
                    placeholder="Ex: Lun-Ven 14h-16h, Mer 18h-20h"
                    aria-label="Jours et horaires (texte composé)"
                  />
                </div>

                <div className="mt-4">
                  <label htmlFor="course-status" className="label">Statut</label>
                  <select
                    id="course-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input"
                  >
                    <option value="active">En cours</option>
                    <option value="inactive">Planifié</option>
                    <option value="completed">Terminé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Tarification
                </h3>
                <div>
                  <label htmlFor="course-price" className="label">Prix ({defaultCurrency}) *</label>
                  <input
                    id="course-price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </section>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : editingCourse ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Supprimer ce cours ?"
        message={deleting ? `Supprimer « ${deleting.name} » ? Les membres sont désinscrits automatiquement ; les groupes liés doivent être supprimés d'abord. Cette action est irréversible.` : ''}
        confirmText="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      {viewing && (
        <CourseDetail
          course={viewing}
          groups={groupsByCourse[viewing.id] || []}
          user={user}
          onClose={() => {
            setViewing(null)
            fetchCourses()
            fetchGroupsByCourse()
          }}
        />
      )}
    </div>
  )
}

/**
 * Fiche d'un cours : vue d'ensemble, groupes reliés, étudiants (inscription /
 * désinscription via les endpoints existants) et séances des groupes.
 * Aucune section décorative : chaque bloc lit une vraie route API.
 */
function CourseDetail({ course, groups, user, onClose }) {
  const navigate = useNavigate()
  const defaultCurrency = getDefaultCode()
  const isAdmin = user?.role === 'admin'
  const canSeeStudents = isAdmin || user?.role === 'teacher'
  const [students, setStudents] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [programme, setProgramme] = useState([])
  const [selectedModules, setSelectedModules] = useState([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProgramme = async () => {
    const res = await api.get(`/courses/${course.id}/modules`).catch(() => ({ data: [] }))
    const payload = res.data?.data ?? res.data
    setProgramme(Array.isArray(payload) ? payload : [])
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const tasks = []
        if (canSeeStudents) {
          tasks.push(
            api.get(`/courses/${course.id}/students`).catch(() => ({ data: [] }))
              .then((res) => { if (!cancelled) setStudents(Array.isArray(res.data) ? res.data : res.data?.data || []) })
          )
        }
        if (isAdmin) {
          tasks.push(
            api.get('/students').catch(() => ({ data: [] }))
              .then((res) => { if (!cancelled) setAllStudents(Array.isArray(res.data) ? res.data : res.data?.data || []) })
          )
        }
        tasks.push(
          api.get(`/courses/${course.id}/modules`).catch(() => ({ data: [] }))
            .then((res) => {
              const payload = res.data?.data ?? res.data
              if (!cancelled) setProgramme(Array.isArray(payload) ? payload : [])
            })
        )
        tasks.push(
          Promise.all(
            groups.map((group) =>
              api.get('/sessions', { params: { groupId: group.id, limit: 200 } })
                .catch(() => ({ data: { data: [] } }))
                .then((res) => {
                  const rows = Array.isArray(res.data) ? res.data : res.data?.data || []
                  return rows.map((s) => ({ ...s, groupName: group.name }))
                })
            )
          ).then((lists) => {
            if (!cancelled) {
              setSessions(lists.flat().sort((a, b) => String(a.date).localeCompare(String(b.date))))
            }
          })
        )
        await Promise.all(tasks)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [course.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const reloadStudents = async () => {
    const res = await api.get(`/courses/${course.id}/students`).catch(() => ({ data: [] }))
    setStudents(Array.isArray(res.data) ? res.data : res.data?.data || [])
  }

  const enroll = async () => {
    if (!selectedStudent) return
    setMessage(null)
    try {
      await api.post(`/courses/${course.id}/enroll`, {
        studentId: Number(selectedStudent),
        ...(selectedGroup ? { groupId: Number(selectedGroup) } : {}),
        ...(selectedModules.length ? { moduleIds: selectedModules } : {}),
        confirmed: true
      })
      setMessage({ ok: true, text: 'Étudiant inscrit.' })
      setSelectedStudent('')
      setSelectedGroup('')
      setSelectedModules([])
      await reloadStudents()
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || 'Inscription impossible' })
    }
  }

  const toggleModule = (moduleId) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    )
  }

  // Programme actions. They throw on failure so CourseProgramme can show the
  // server message; on success they reload the catalogue.
  const createModule = async (payload) => {
    await api.post(`/courses/${course.id}/modules`, payload)
    await loadProgramme()
  }
  const updateModule = async (id, payload) => {
    await api.put(`/modules/${id}`, payload)
    await loadProgramme()
  }
  const deleteModule = async (id) => {
    await api.delete(`/modules/${id}`)
    await loadProgramme()
  }
  const createSubmodule = async (moduleId, payload) => {
    await api.post(`/modules/${moduleId}/submodules`, payload)
    await loadProgramme()
  }
  const updateSubmodule = async (id, payload) => {
    await api.put(`/submodules/${id}`, payload)
    await loadProgramme()
  }
  const deleteSubmodule = async (id) => {
    await api.delete(`/submodules/${id}`)
    await loadProgramme()
  }

  const unenroll = async (studentUserId, studentName) => {
    if (!window.confirm(`Désinscrire ${studentName} de « ${course.name} » ?`)) return
    setMessage(null)
    try {
      const res = await api.get(`/students/${studentUserId}/courses`).catch(() => ({ data: [] }))
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || []
      const row = rows.find((c) => Number(c.id) === Number(course.id))
      if (!row?.enrollment_id) {
        setMessage({ ok: false, text: 'Inscription introuvable.' })
        return
      }
      await api.delete(`/enrollments/${row.enrollment_id}`)
      setMessage({ ok: true, text: 'Étudiant désinscrit.' })
      await reloadStudents()
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || 'Désinscription impossible' })
    }
  }

  const occupied = students.length
  const remaining = course.max_students != null ? Math.max(0, course.max_students - occupied) : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Fiche cours</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {message && (
              <div className={`rounded-lg px-4 py-3 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Vue d'ensemble</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Nom</dt>
                  <dd className="font-medium text-gray-900">{course.name}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Langue · Niveau</dt>
                  <dd className="font-medium text-gray-900">
                    {course.language} · {course.level}{course.level_code ? ` (${course.level_code})` : ''}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Type · Mode</dt>
                  <dd className="font-medium text-gray-900">
                    {[course.course_type ? courseTypeLabel(course.course_type) : null, course.mode ? modeLabel(course.mode) : null].filter(Boolean).join(' · ') || '-'}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Formateur</dt>
                  <dd className="font-medium text-gray-900">{course.teacher_name || '-'}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Période</dt>
                  <dd className="font-medium text-gray-900">
                    {course.start_date ? new Date(course.start_date).toLocaleDateString('fr-FR') : '…'}
                    {' → '}
                    {course.end_date ? new Date(course.end_date).toLocaleDateString('fr-FR') : '…'}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <dt className="text-gray-500">Places</dt>
                  <dd className="font-medium text-gray-900">
                    {occupied}/{course.max_students}{remaining != null ? ` (${remaining} restantes)` : ''}
                  </dd>
                </div>
              </dl>
              {course.description && (
                <p className="mt-3 text-sm text-gray-600">{course.description}</p>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Groupes ({groups.length})
              </h3>
              {groups.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun groupe relié à ce cours.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {groups.map((group) => (
                    <li key={group.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <span className="font-medium text-gray-900">{group.name}</span>
                      <span className="text-gray-500">{group.enrolled}/{group.max ?? '-'}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => navigate('/groups')} className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700">
                Gérer les groupes →
              </button>
            </section>

            <CourseProgramme
              modules={programme}
              isAdmin={isAdmin}
              onCreateModule={createModule}
              onUpdateModule={updateModule}
              onDeleteModule={deleteModule}
              onCreateSubmodule={createSubmodule}
              onUpdateSubmodule={updateSubmodule}
              onDeleteSubmodule={deleteSubmodule}
            />

            {canSeeStudents && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Étudiants ({students.length})
                </h3>
                {students.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-3">Aucun étudiant inscrit.</p>
                ) : (
                  <ul className="mb-3 space-y-1 text-sm">
                    {students.map((student) => (
                      <li key={student.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                        <span className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                          <span className="ml-2 font-normal text-gray-500">{student.email}</span>
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => unenroll(student.id, `${student.first_name} ${student.last_name}`)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                            aria-label={`Désinscrire ${student.first_name} ${student.last_name}`}
                          >
                            Désinscrire
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {isAdmin && (
                  <>
                    {programme.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">
                          Modules à inscrire (leurs sous-modules deviennent des échéances)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {programme.map((m) => (
                            <label key={m.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedModules.includes(m.id)}
                                onChange={() => toggleModule(m.id)}
                                aria-label={`Inscrire au module ${m.name}`}
                              />
                              <span className="font-medium text-gray-900">{m.name}</span>
                              <span className="text-gray-500">{formatMillimes(m.price_millimes, defaultCurrency)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedStudent}
                        onChange={(e) => setSelectedStudent(e.target.value)}
                        className="input flex-1"
                        aria-label="Choisir un étudiant à inscrire"
                      >
                        <option value="">Inscrire un étudiant…</option>
                        {allStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                        ))}
                      </select>
                      {groups.length > 0 && (
                        <select
                          value={selectedGroup}
                          onChange={(e) => setSelectedGroup(e.target.value)}
                          className="input flex-1"
                          aria-label="Choisir un groupe"
                        >
                          <option value="">Sans groupe</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                          ))}
                        </select>
                      )}
                      <button onClick={enroll} disabled={!selectedStudent} className="btn-primary disabled:opacity-50">
                        Inscrire
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Planning et séances ({sessions.length})
              </h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune séance planifiée dans les groupes de ce cours.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {sessions.slice(0, 10).map((session) => (
                    <li key={session.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <span className="font-medium text-gray-900">
                        {new Date(session.date).toLocaleDateString('fr-FR')} · {session.start_time}–{session.end_time}
                      </span>
                      <span className="text-gray-500">{session.groupName}{session.room ? ` · ${session.room}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sessions.length > 10 && (
                <p className="mt-1 text-xs text-gray-500">… et {sessions.length - 10} autres.</p>
              )}
              <div className="mt-2 flex gap-4 text-sm font-medium text-primary-600">
                <button onClick={() => navigate('/sessions')} className="hover:text-primary-700">Voir les séances →</button>
                <button onClick={() => navigate('/attendance')} className="hover:text-primary-700">Présences →</button>
                <button onClick={() => navigate('/grades')} className="hover:text-primary-700">Résultats →</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Programme of a course: ordered modules, each made of ordered submodules.
 * The module has no price; its total is the sum of its submodules. Admins edit
 * it inline — every action calls back to CourseDetail, which owns the data and
 * reloads it after a successful write.
 */
function CourseProgramme({
  modules,
  isAdmin,
  onCreateModule,
  onUpdateModule,
  onDeleteModule,
  onCreateSubmodule,
  onUpdateSubmodule,
  onDeleteSubmodule
}) {
  const defaultCurrency = getDefaultCode()
  const [newModule, setNewModule] = useState({ name: '', discountPercent: '' })
  const [moduleDrafts, setModuleDrafts] = useState({})
  const [subDrafts, setSubDrafts] = useState({})
  const [subEdits, setSubEdits] = useState({})
  const [message, setMessage] = useState(null)

  const fail = (err) => setMessage({
    ok: false,
    text: err.response?.data?.error?.message || err.message || 'Action impossible'
  })
  const done = (text) => setMessage({ ok: true, text })

  const addModule = async () => {
    if (!newModule.name.trim()) return
    try {
      const payload = { name: newModule.name.trim() }
      if (newModule.discountPercent !== '') payload.discountPercent = Number(newModule.discountPercent)
      await onCreateModule(payload)
      setNewModule({ name: '', discountPercent: '' })
      done('Module ajouté.')
    } catch (err) { fail(err) }
  }

  const editModule = (module, patch) => setModuleDrafts((state) => ({
    ...state,
    [module.id]: { ...state[module.id], ...patch }
  }))
  const startModule = (module) => setModuleDrafts((state) => ({
    ...state,
    [module.id]: { name: module.name, discountPercent: String(module.discount_percent ?? '') }
  }))
  const cancelModule = (id) => setModuleDrafts((state) => {
    const next = { ...state }
    delete next[id]
    return next
  })

  const saveModule = async (id) => {
    const draft = moduleDrafts[id]
    if (!draft) return
    try {
      await onUpdateModule(id, {
        name: draft.name,
        discountPercent: draft.discountPercent === '' ? 0 : Number(draft.discountPercent)
      })
      cancelModule(id)
      done('Module mis à jour.')
    } catch (err) { fail(err) }
  }

  const removeModule = async (module) => {
    if (!window.confirm(`Supprimer le module « ${module.name} » et ses sous-modules ?`)) return
    try {
      await onDeleteModule(module.id)
      done('Module supprimé.')
    } catch (err) { fail(err) }
  }

  const subDraftFor = (id) => subDrafts[id] || { name: '', price: '' }
  const editSubDraft = (id, patch) => setSubDrafts((state) => ({
    ...state,
    [id]: { ...subDraftFor(id), ...patch }
  }))

  const addSubmodule = async (module) => {
    const draft = subDraftFor(module.id)
    if (!draft.name.trim() || draft.price === '') return
    try {
      await onCreateSubmodule(module.id, { name: draft.name.trim(), price: Number(draft.price) })
      setSubDrafts((state) => ({ ...state, [module.id]: { name: '', price: '' } }))
      done('Sous-module ajouté.')
    } catch (err) { fail(err) }
  }

  const startSub = (sub) => setSubEdits((state) => ({
    ...state,
    [sub.id]: { name: sub.name, price: String(sub.price ?? '') }
  }))
  const editSub = (id, patch) => setSubEdits((state) => ({ ...state, [id]: { ...state[id], ...patch } }))
  const cancelSub = (id) => setSubEdits((state) => {
    const next = { ...state }
    delete next[id]
    return next
  })

  const saveSub = async (id) => {
    const draft = subEdits[id]
    if (!draft) return
    try {
      await onUpdateSubmodule(id, { name: draft.name, price: draft.price === '' ? 0 : Number(draft.price) })
      cancelSub(id)
      done('Sous-module mis à jour.')
    } catch (err) { fail(err) }
  }

  const removeSub = async (sub) => {
    if (!window.confirm(`Supprimer le sous-module « ${sub.name} » ?`)) return
    try {
      await onDeleteSubmodule(sub.id)
      done('Sous-module supprimé.')
    } catch (err) { fail(err) }
  }

  const grandTotal = modules.reduce((sum, module) => sum + Number(module.price_millimes || 0), 0)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Programme — modules et sous-modules
        </h3>
        {modules.length > 0 && (
          <span className="text-sm text-gray-500">Total : {formatMillimes(grandTotal, defaultCurrency)}</span>
        )}
      </div>

      {message && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {modules.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">
          Aucun module. Le prix d'un module est la somme de ses sous-modules.
        </p>
      ) : (
        <ul className="space-y-3 mb-3">
          {modules.map((module) => {
            const draft = moduleDrafts[module.id]
            const subDraft = subDraftFor(module.id)
            return (
              <li key={module.id} className="rounded-lg border border-gray-200 p-3">
                {draft ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="input flex-1"
                      aria-label="Nom du module"
                      value={draft.name}
                      onChange={(e) => editModule(module, { name: e.target.value })}
                    />
                    <input
                      className="input w-28"
                      type="number" min="0" max="100"
                      aria-label="Remise du module en pourcentage"
                      value={draft.discountPercent}
                      onChange={(e) => editModule(module, { discountPercent: e.target.value })}
                    />
                    <button className="btn-primary" onClick={() => saveModule(module.id)}>Enregistrer</button>
                    <button className="btn-secondary" onClick={() => cancelModule(module.id)}>Annuler</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{module.name}</span>
                      {Number(module.discount_percent) > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                          −{module.discount_percent}% si payé en une fois
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">{formatMillimes(module.price_millimes, defaultCurrency)}</span>
                      {isAdmin && (
                        <>
                          <button onClick={() => startModule(module)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                            Modifier
                          </button>
                          <button onClick={() => removeModule(module)} className="text-xs font-medium text-red-600 hover:text-red-800">
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <ul className="mt-2 space-y-1">
                  {(module.submodules || []).map((sub) => {
                    const subEdit = subEdits[sub.id]
                    return (
                      <li key={sub.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-3 py-1.5 text-sm">
                        {subEdit ? (
                          <div className="flex w-full flex-col sm:flex-row gap-2">
                            <input
                              className="input flex-1"
                              aria-label="Nom du sous-module"
                              value={subEdit.name}
                              onChange={(e) => editSub(sub.id, { name: e.target.value })}
                            />
                            <input
                              className="input w-28"
                              type="number" min="0" step="0.001"
                              aria-label="Prix du sous-module"
                              value={subEdit.price}
                              onChange={(e) => editSub(sub.id, { price: e.target.value })}
                            />
                            <button className="btn-primary" onClick={() => saveSub(sub.id)}>Enregistrer</button>
                            <button className="btn-secondary" onClick={() => cancelSub(sub.id)}>Annuler</button>
                          </div>
                        ) : (
                          <>
                            <span className="text-gray-800">{sub.name}</span>
                            <span className="flex items-center gap-3">
                              <span className="text-gray-600">{formatMillimes(sub.price_millimes, defaultCurrency)}</span>
                              {isAdmin && (
                                <>
                                  <button onClick={() => startSub(sub)} className="text-xs font-medium text-primary-600 hover:text-primary-700" aria-label={`Modifier ${sub.name}`}>
                                    Modifier
                                  </button>
                                  <button onClick={() => removeSub(sub)} className="text-xs font-medium text-red-600 hover:text-red-800" aria-label={`Supprimer ${sub.name}`}>
                                    Supprimer
                                  </button>
                                </>
                              )}
                            </span>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {isAdmin && (
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Nouveau sous-module…"
                      aria-label={`Nouveau sous-module de ${module.name}`}
                      value={subDraft.name}
                      onChange={(e) => editSubDraft(module.id, { name: e.target.value })}
                    />
                    <input
                      className="input w-28"
                      type="number" min="0" step="0.001"
                      placeholder="Prix"
                      aria-label={`Prix du sous-module de ${module.name}`}
                      value={subDraft.price}
                      onChange={(e) => editSubDraft(module.id, { price: e.target.value })}
                    />
                    <button
                      className="btn-secondary"
                      onClick={() => addSubmodule(module)}
                      disabled={!subDraft.name.trim() || subDraft.price === ''}
                    >
                      Ajouter
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {isAdmin && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1"
            placeholder="Nouveau module…"
            aria-label="Nom du nouveau module"
            value={newModule.name}
            onChange={(e) => setNewModule((state) => ({ ...state, name: e.target.value }))}
          />
          <input
            className="input w-28"
            type="number" min="0" max="100"
            placeholder="Remise %"
            aria-label="Remise du nouveau module"
            value={newModule.discountPercent}
            onChange={(e) => setNewModule((state) => ({ ...state, discountPercent: e.target.value }))}
          />
          <button className="btn-primary disabled:opacity-50" onClick={addModule} disabled={!newModule.name.trim()}>
            Ajouter un module
          </button>
        </div>
      )}
    </section>
  )
}
