import { useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import CrudPage from '../components/CrudPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDemoStore, courseLanguageIsActive } from '../data/demoStore'
import { statusVariant, pedagogyStatusLabel } from '../utils/money'

export default function Certificates() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const toast = useToast()
  const [students, setStudents] = useState([])
  const [courses, setCourses] = useState([])
  const [levels, setLevels] = useState([])
  // Seuls les cours des langues actives sont proposés.
  const { languages: demoLanguages } = useDemoStore()
  const visibleCourses = courses.filter((c) => courseLanguageIsActive(demoLanguages, c.language))

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsRes, coursesRes, levelsRes] = await Promise.all([
          api.get('/students'),
          api.get('/courses'),
          api.get('/levels')
        ])
        setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data.data || [])
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : coursesRes.data.data || [])
        setLevels(levelsRes.data?.data || [])
      } catch {
        // Optional
      }
    }
    if (isAdmin) load()
  }, [isAdmin])

  const handleVerify = async (certificate) => {
    try {
      const res = await api.get(`/certificates/verify/${certificate.certificateNumber}`)
      toast.success(`Certificat valide : ${certificate.certificateNumber}`)
      return res
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Certificat invalide')
      throw err
    }
  }

  const fields = [
    {
      name: 'studentId',
      label: 'Candidat',
      type: 'select',
      required: true,
      options: students.map((s) => ({
        value: s.id,
        label: `${s.firstName || s.first_name} ${s.lastName || s.last_name}`
      }))
    },
    {
      name: 'courseId',
      label: 'Cours',
      type: 'select',
      options: visibleCourses.map((c) => ({ value: c.id, label: c.name }))
    },
    {
      name: 'level',
      label: 'Niveau',
      type: 'select',
      required: true,
      options: levels.map((l) => ({ value: l.code, label: `${l.code} - ${l.name}` }))
    },
    { name: 'score', label: 'Score', type: 'number', step: '0.01' },
    { name: 'expiryDate', label: "Date d'expiration", type: 'date' }
  ]

  return (
    <CrudPage
      title="Certificats"
      subtitle="Certificats de réussite délivrés"
      createLabel="Nouveau certificat"
      searchPlaceholder="Rechercher un certificat..."
      emptyIcon={Award}
      canCreate={() => isAdmin}
      canEdit={() => isAdmin}
      canDelete={() => isAdmin}
      fetchData={async ({ page, limit, search }) => {
        const params = new URLSearchParams({ page, limit })
        if (search) params.set('search', search)
        const res = await api.get(`/certificates?${params}`)
        // L'API renvoie du snake_case : mapping vers les clés camelCase.
        const data = (res.data.data || []).map((row) => ({
          ...row,
          certificateNumber: row.certificate_number ?? row.certificateNumber,
          studentName: row.student_name ?? row.studentName,
          courseName: row.course_name ?? row.courseName,
          issueDate: row.issue_date ?? row.issueDate,
          expiryDate: row.expiry_date ?? row.expiryDate,
          studentId: row.student_id ?? row.studentId,
          courseId: row.course_id ?? row.courseId
        }))
        return { data, pagination: res.data.pagination }
      }}
      onCreate={(values) => api.post('/certificates', values)}
      onUpdate={(id, values) => api.put(`/certificates/${id}`, values)}
      onDelete={(id) => api.delete(`/certificates/${id}`)}
      fields={fields}
      columns={[
        {
          key: 'certificateNumber',
          label: 'Numéro',
          render: (item) => <span className="font-mono font-semibold">{item.certificateNumber}</span>
        },
        { key: 'studentName', label: 'Candidat' },
        { key: 'level', label: 'Niveau', render: (item) => <Badge variant="primary">{item.level}</Badge> },
        {
          key: 'score',
          label: 'Score',
          render: (item) => (item.score != null ? item.score : '-')
        },
        {
          key: 'issueDate',
          label: 'Délivré le',
          render: (item) => (item.issueDate ? new Date(item.issueDate).toLocaleDateString('fr-FR') : '-')
        },
        {
          key: 'status',
          label: 'Statut',
          render: (item) => (
            <Badge variant={statusVariant(item.status)}>
              {pedagogyStatusLabel(item.status)}
            </Badge>
          )
        },
        {
          key: 'actions',
          label: 'Vérifier',
          render: (item) => (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleVerify(item)}
              aria-label={`Vérifier ${item.certificateNumber}`}
            >
              Vérifier
            </Button>
          )
        }
      ]}
    />
  )
}