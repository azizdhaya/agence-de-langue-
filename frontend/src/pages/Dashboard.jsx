import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import {
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Calendar,
  Award,
  ClipboardCheck
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (user.role === 'admin') {
        const [statsRes, enrollmentsRes, recentRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/enrollments'),
          api.get('/dashboard/recent')
        ])
        setData({
          stats: statsRes.data,
          enrollments: enrollmentsRes.data,
          activities: recentRes.data
        })
      } else if (user.role === 'student') {
        const res = await api.get('/dashboard/student')
        setData({ student: res.data.data })
      } else if (user.role === 'teacher') {
        const res = await api.get('/dashboard/teacher')
        setData({ teacher: res.data.data })
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [user.role])

  const [data, setData] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboardData} />
  }

  if (user.role === 'admin') {
    return <AdminDashboard data={data} />
  }
  if (user.role === 'teacher') {
    return <TeacherDashboard data={data?.teacher} />
  }
  return <StudentDashboard data={data?.student} />
}

function AdminDashboard({ data }) {
  if (!data?.stats) return null

  const { stats, enrollments = [], activities = [] } = data

  const statCards = [
    { label: 'Total Candidats', value: stats.total_students, icon: Users, color: 'bg-blue-500' },
    { label: 'Professeurs', value: stats.total_teachers, icon: GraduationCap, color: 'bg-green-500' },
    { label: 'Cours Actifs', value: stats.active_courses, icon: BookOpen, color: 'bg-purple-500' }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600">Vue d'ensemble de votre centre de langue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {enrollments.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inscriptions par Cours</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={enrollments}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="enrolled_count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activités Récentes</h3>
        {activities.length === 0 ? (
          <p className="text-gray-500">Aucune activité récente</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary-100">
                  {activity.type === 'enrollment' ? (
                    <BookOpen className="w-5 h-5 text-primary-600" />
                  ) : (
                    <Calendar className="w-5 h-5 text-primary-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.person}</p>
                  <p className="text-sm text-gray-600">{activity.detail}</p>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(activity.date).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function StudentDashboard({ data }) {
  if (!data) return null

  const {
    level,
    activeCourses,
    attendanceRate,
    averageScore,
    certificates,
    upcomingSessions,
    recentGrades
  } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon Espace</h1>
        <p className="text-gray-600">Votre suivi de formation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cours actifs</p>
              <p className="text-2xl font-bold text-gray-900">{activeCourses}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Assiduité</p>
              <p className="text-2xl font-bold text-gray-900">
                {attendanceRate != null ? `${attendanceRate}%` : '-'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Moyenne</p>
              <p className="text-2xl font-bold text-gray-900">
                {averageScore ? `${averageScore}%` : '-'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Certificats</p>
              <p className="text-2xl font-bold text-gray-900">{certificates}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Prochaines Sessions</h3>
          {upcomingSessions.length === 0 ? (
            <p className="text-gray-500">Aucune session planifiée</p>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{session.group_name}</p>
                    <p className="text-sm text-gray-600">
                      {session.course_name} - {session.room || 'Salle à définir'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(session.date).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.start_time} - {session.end_time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dernières Notes</h3>
          {recentGrades.length === 0 ? (
            <p className="text-gray-500">Aucune note pour le moment</p>
          ) : (
            <div className="space-y-2">
              {recentGrades.map((grade) => {
                const pct = Math.round((grade.score / grade.max_score) * 100)
                return (
                  <div key={grade.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{grade.assessment_type}</p>
                      <p className="text-sm text-gray-600">
                        {grade.course_name}
                        {grade.skill_name ? ` - ${grade.skill_name}` : ''}
                      </p>
                    </div>
                    <Badge variant={pct >= 60 ? 'success' : 'danger'}>
                      {grade.score}/{grade.max_score}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ma Formation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Niveau actuel</p>
            <p className="text-lg font-bold text-gray-900 uppercase">{level}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Certificats obtenus</p>
            <p className="text-lg font-bold text-gray-900">{certificates}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function TeacherDashboard({ data }) {
  if (!data) return null

  const { activeGroups, upcomingSessions, totalStudents, totalGrades, sessions, groups } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon Espace</h1>
        <p className="text-gray-600">Vos groupes et vos séances</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Groupes actifs</p>
              <p className="text-2xl font-bold text-gray-900">{activeGroups}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Mes étudiants</p>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sessions à venir</p>
              <p className="text-2xl font-bold text-gray-900">{upcomingSessions}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Notes saisies</p>
              <p className="text-2xl font-bold text-gray-900">{totalGrades}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Prochaines Sessions</h3>
          {sessions.length === 0 ? (
            <p className="text-gray-500">Aucune session planifiée</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{session.group_name}</p>
                    <p className="text-sm text-gray-600">
                      {session.course_name} - {session.room || 'Salle à définir'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(session.date).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.start_time} - {session.end_time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mes Groupes</h3>
          {groups.length === 0 ? (
            <EmptyState icon={Users} title="Aucun groupe" description="Vous n'avez pas encore de groupe assigné." />
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.group_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{group.group_name}</p>
                    <p className="text-sm text-gray-600">{group.student_count} étudiant(s)</p>
                  </div>
                  {group.average_score != null && (
                    <Badge variant={group.average_score >= 60 ? 'success' : 'warning'}>
                      Moy. {group.average_score}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}