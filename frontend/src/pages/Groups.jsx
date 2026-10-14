import { useEffect, useState } from 'react'
import { Users, UserPlus, UserMinus, X } from 'lucide-react'
import CrudPage from '../components/CrudPage'
import Badge from '../components/ui/Badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useDemoStore, courseLanguageIsActive } from '../data/demoStore'
import { statusVariant, pedagogyStatusLabel } from '../utils/money'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '-')

export default function Groups() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [courses, setCourses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [managing, setManaging] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // Seuls les cours des langues actives sont proposés.
  const { languages: demoLanguages } = useDemoStore()
  const visibleCourses = courses.filter((c) => courseLanguageIsActive(demoLanguages, c.language))

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [coursesRes, teachersRes] = await Promise.all([
          api.get('/courses', { params: { page: 1, limit: 200 } }),
          api.get('/teachers')
        ])
        const courseRows = Array.isArray(coursesRes.data) ? coursesRes.data : coursesRes.data.data || []
        setCourses(courseRows)
        setTeachers(Array.isArray(teachersRes.data) ? teachersRes.data : teachersRes.data.data || [])
      } catch {
        // Options are optional: the form still renders without them
      }
    }
    loadOptions()
  }, [])

  // Choisir un cours remplit automatiquement le formulaire du groupe avec les
  // données du cours (professeur, salle, capacité, dates, horaires).
  const fillFromCourse = (name, value) => {
    if (name !== 'courseId' || !value) return null
    const course = courses.find((c) => String(c.id) === String(value))
    if (!course) return null
    const day = (v) => (v ? String(v).slice(0, 10) : '')
    return {
      teacherId: course.teacher_id ?? '',
      room: course.room || '',
      maxStudents: course.max_students ?? '',
      startDate: day(course.start_date),
      endDate: day(course.end_date),
      schedule: course.schedule || ''
    }
  }

  const fields = [
    { name: 'name', label: 'Nom du groupe', required: true, placeholder: 'Ex: Groupe A1-1' },
    {
      name: 'courseId',
      label: 'Cours',
      type: 'select',
      required: true,
      options: visibleCourses.map((c) => ({ value: c.id, label: c.name }))
    },
    {
      name: 'teacherId',
      label: 'Professeur',
      type: 'select',
      options: teachers.map((t) => ({ value: t.teacher_id ?? t.id, label: `${t.firstName || t.first_name} ${t.lastName || t.last_name}` }))
    },
    { name: 'room', label: 'Salle', placeholder: 'Ex: Salle 101' },
    { name: 'maxStudents', label: 'Capacité', type: 'number', required: true, defaultValue: 15 },
    { name: 'startDate', label: 'Date de début', type: 'date' },
    { name: 'endDate', label: 'Date de fin', type: 'date' },
    { name: 'schedule', label: 'Horaires', placeholder: 'Ex: Lun-Mer 9h-11h', colSpan: 2 },
    {
      name: 'status',
      label: 'Statut',
      type: 'select',
      defaultValue: 'active',
      options: [
        { value: 'active', label: 'Actif' },
        { value: 'inactive', label: 'Inactif' },
        { value: 'completed', label: 'Terminé' },
        { value: 'cancelled', label: 'Annulé' }
      ]
    }
  ]

  return (
    <>
    <CrudPage
      key={refreshKey}
      title="Groupes"
      subtitle="Groupes et classes"
      createLabel="Nouveau groupe"
      searchPlaceholder="Rechercher un groupe..."
      emptyIcon={Users}
      canCreate={() => isAdmin}
      canEdit={() => isAdmin}
      canDelete={() => isAdmin}
      rowActions={(item) => isAdmin && (
        <button
          onClick={() => setManaging(item)}
          aria-label={`Gérer les candidats du groupe ${item.name}`}
          title="Gérer les candidats"
          className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
        >
          <Users className="w-4 h-4" />
        </button>
      )}
      fetchData={async ({ page, limit, search }) => {
        const params = new URLSearchParams({ page, limit })
        if (search) params.set('search', search)
        const res = await api.get(`/groups?${params}`)
        // L'API renvoie du snake_case : on mappe vers les clés camelCase
        // lues par les colonnes et le formulaire d'édition.
        const data = (res.data.data || []).map((row) => ({
          ...row,
          courseName: row.course_name ?? row.courseName,
          teacherName: row.teacher_name ?? row.teacherName,
          enrolledStudents: row.enrolled_students ?? row.enrolledStudents,
          maxStudents: row.max_students ?? row.maxStudents,
          courseId: row.course_id ?? row.courseId,
          teacherId: row.teacher_id ?? row.teacherId,
          startDate: row.start_date ?? row.startDate,
          endDate: row.end_date ?? row.endDate
        }))
        return { data, pagination: res.data.pagination }
      }}
      onCreate={(values) => api.post('/groups', values)}
      onUpdate={(id, values) => api.put(`/groups/${id}`, values)}
      onDelete={(id) => api.delete(`/groups/${id}`)}
      formFieldChange={fillFromCourse}
      fields={fields}
      columns={[
        { key: 'name', label: 'Groupe', render: (item) => <span className="font-medium">{item.name}</span> },
        { key: 'courseName', label: 'Cours' },
        {
          key: 'teacherName',
          label: 'Professeur',
          render: (item) => item.teacherName || '-'
        },
        { key: 'room', label: 'Salle', render: (item) => item.room || '-' },
        {
          key: 'enrolledStudents',
          label: 'Effectif',
          render: (item) => `${item.enrolledStudents ?? 0}/${item.maxStudents ?? '-'}`
        },
        {
          key: 'status',
          label: 'Statut',
          render: (item) => (
            <Badge variant={statusVariant(item.status)}>
              {pedagogyStatusLabel(item.status)}
            </Badge>
          )
        }
      ]}
      />
      {managing && (
        <GroupMembers
          group={managing}
          onClose={() => {
            setManaging(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </>
  )
}

/**
 * Candidats d'un groupe : ajout (inscription au cours + affectation) et
 * retrait (le candidat est aussi désinscrit du cours, compteur à jour).
 * Toutes les règles (cours du groupe, capacité, doublons) sont
 * appliquées par le serveur ; ses messages d'erreur sont affichés tels quels.
 */
function GroupMembers({ group, onClose }) {
  const courseId = group.course_id ?? group.courseId
  const capacity = group.max_students ?? group.maxStudents
  const [members, setMembers] = useState([])
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [removing, setRemoving] = useState(null)

  const load = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [membersRes, studentsRes] = await Promise.all([
        api.get(`/groups/${group.id}/students`),
        api.get('/students')
      ])
      setMembers(Array.isArray(membersRes.data?.data) ? membersRes.data.data : [])
      const rows = Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data?.data || []
      setStudents(rows)
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id])

  const memberIds = new Set(members.map((m) => String(m.user_id)))
  const candidates = students.filter((s) => !memberIds.has(String(s.id)))
  const full = capacity && members.length >= capacity

  const add = async () => {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    try {
      await api.post(`/courses/${courseId}/enroll`, {
        studentId: Number(selected),
        groupId: group.id,
        confirmed: true
      })
      setSelected('')
      await load()
      setMessage({ ok: true, text: 'Candidat ajouté au groupe.' })
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || "Ajout impossible" })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    try {
      await api.delete(`/groups/${group.id}/students/${removing.user_id}`)
      setRemoving(null)
      await load()
      setMessage({ ok: true, text: 'Candidat retiré du groupe et désinscrit du cours.' })
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error?.message || 'Retrait impossible' })
      setRemoving(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-900">
            {group.name} — Candidats ({members.length}{capacity ? `/${capacity}` : ''})
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Cours : {group.courseName || group.course_name || '-'}. L'ajout inscrit le candidat au cours
          et l'affecte au groupe ; le retrait le désinscrit aussi du cours.
        </p>

        {message && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="input flex-1"
            aria-label="Candidat à ajouter"
            disabled={full}
          >
            <option value="">Sélectionner un candidat…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName || s.first_name} {s.lastName || s.last_name} — {s.email}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={!selected || saving || full}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
        {full && (
          <p className="mb-4 text-sm text-amber-600">Groupe complet ({capacity} places).</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Aucun candidat dans ce groupe pour le moment.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((member) => (
              <li key={member.user_id} className="py-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary-600">
                    {(member.first_name?.[0] || '?')}{(member.last_name?.[0] || '')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                  <p className="text-sm text-gray-500 truncate">{member.email} — inscrit le {formatDate(member.enrollment_date)}</p>
                </div>
                <button
                  onClick={() => setRemoving(member)}
                  aria-label={`Retirer ${member.first_name} ${member.last_name} du groupe`}
                  title="Retirer du groupe"
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">
            Fermer
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        title="Retirer ce candidat du groupe ?"
        message={removing ? `${removing.first_name} ${removing.last_name} restera inscrit au cours.` : ''}
        confirmText="Retirer"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}