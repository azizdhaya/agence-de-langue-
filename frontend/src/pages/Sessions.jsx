import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import CrudPage from '../components/CrudPage'
import Badge from '../components/ui/Badge'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { statusVariant, pedagogyStatusLabel } from '../utils/money'

export default function Sessions() {
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'teacher'
  const [groups, setGroups] = useState([])
  const [teachers, setTeachers] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [groupsRes, teachersRes] = await Promise.all([
          api.get('/groups', { params: { page: 1, limit: 200 } }),
          api.get('/teachers')
        ])
        const groupRows = Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data.data || []
        setGroups(groupRows)
        const teacherRows = Array.isArray(teachersRes.data) ? teachersRes.data : teachersRes.data.data || []
        setTeachers(teacherRows)
      } catch {
        // Optional: form still renders without options
      }
    }
    load()
  }, [])

  // Choisir un groupe remplit automatiquement la séance avec les données du
  // groupe (professeur, salle). Date et heures restent manuelles : chaque
  // séance a son propre créneau (le contrôle de conflit s'applique).
  const fillFromGroup = (name, value) => {
    if (name !== 'groupId' || !value) return null
    const group = groups.find((g) => String(g.id) === String(value))
    if (!group) return null
    return {
      teacherId: group.teacher_id ?? '',
      room: group.room || ''
    }
  }

  const fields = [
    {
      name: 'groupId',
      label: 'Groupe',
      type: 'select',
      required: true,
      options: groups.map((g) => ({ value: g.id, label: g.name }))
    },
    { name: 'room', label: 'Salle', placeholder: 'Ex: Salle 101' },
    {
      name: 'teacherId',
      label: 'Professeur',
      type: 'select',
      options: teachers.map((t) => ({
        value: t.teacher_id ?? t.id,
        label: `${t.firstName || t.first_name} ${t.lastName || t.last_name}`
      }))
    },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'startTime', label: 'Heure début', type: 'time', required: true },
    { name: 'endTime', label: 'Heure fin', type: 'time', required: true },
    {
      name: 'status',
      label: 'Statut',
      type: 'select',
      defaultValue: 'scheduled',
      options: [
        { value: 'scheduled', label: 'Planifiée' },
        { value: 'completed', label: 'Terminée' },
        { value: 'cancelled', label: 'Annulée' },
        { value: 'postponed', label: 'Reportée' }
      ]
    },
    { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
  ]

  return (
    <CrudPage
      title="Sessions"
      subtitle="Séances de cours planifiées"
      createLabel="Nouvelle session"
      searchPlaceholder="Rechercher une session..."
      emptyIcon={CalendarClock}
      canCreate={() => canManage}
      canEdit={() => canManage}
      canDelete={() => user?.role === 'admin'}
      fetchData={async ({ page, limit, search }) => {
        const params = new URLSearchParams({ page, limit })
        if (search) params.set('search', search)
        const res = await api.get(`/sessions?${params}`)
        // L'API renvoie du snake_case : mapping vers les clés camelCase.
        const data = (res.data.data || []).map((row) => ({
          ...row,
          groupName: row.group_name ?? row.groupName,
          teacherName: row.teacher_name ?? row.teacherName,
          startTime: row.start_time ?? row.startTime,
          endTime: row.end_time ?? row.endTime,
          groupId: row.group_id ?? row.groupId,
          teacherId: row.teacher_id ?? row.teacherId
        }))
        return { data, pagination: res.data.pagination }
      }}
      onCreate={(values) => api.post('/sessions', values)}
      onUpdate={(id, values) => api.put(`/sessions/${id}`, values)}
      onDelete={(id) => api.delete(`/sessions/${id}`)}
      formFieldChange={fillFromGroup}
      fields={fields}
      columns={[
        { key: 'groupName', label: 'Groupe', render: (item) => <span className="font-medium">{item.groupName}</span> },
        {
          key: 'date',
          label: 'Date',
          render: (item) => {
            const time = new Date(item.date).getTime()
            return Number.isNaN(time) ? '-' : new Date(time).toLocaleDateString('fr-FR')
          }
        },
        {
          key: 'startTime',
          label: 'Horaire',
          render: (item) => `${item.startTime} - ${item.endTime}`
        },
        { key: 'room', label: 'Salle', render: (item) => item.room || '-' },
        {
          key: 'teacherName',
          label: 'Professeur',
          render: (item) => item.teacherName || '-'
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
  )
}