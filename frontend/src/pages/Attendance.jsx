import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useDemoStore, courseLanguageIsActive } from '../data/demoStore'
import { Calendar, Check, X, Clock, AlertCircle, Lock } from 'lucide-react'

const apiError = (error, fallback) =>
  error.response?.data?.error?.message || error.response?.data?.error || fallback

export default function Attendance() {
  const [courses, setCourses] = useState([])
  // Seuls les cours des langues actives sont proposés.
  const { languages: demoLanguages } = useDemoStore()
  const visibleCourses = courses.filter((c) => courseLanguageIsActive(demoLanguages, c.language))
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [roster, setRoster] = useState({})
  const [attendance, setAttendance] = useState({})
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      fetchStudents()
      fetchSessions()
    }
  }, [selectedCourse, date])

  // The séance of the chosen date teaches a submodule: it drives the lock.
  const sessionsForDate = sessions.filter((session) => session.date === date)
  useEffect(() => {
    if (!selectedCourse) return
    setSelectedSession(sessionsForDate[0] || null)
  }, [selectedCourse, date, sessions])

  useEffect(() => {
    if (selectedSession) fetchRoster()
    else setRoster({})
  }, [selectedSession])

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses')
      const rows = Array.isArray(response.data) ? response.data : response.data?.data || []
      setCourses(rows.filter(c => c.status === 'active'))
    } catch (error) {
      console.error('Error fetching courses:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSessions = async () => {
    try {
      const response = await api.get(`/sessions?courseId=${selectedCourse.id}&limit=100`)
      setSessions(response.data?.data || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
      setSessions([])
    }
  }

  const fetchStudents = async () => {
    try {
      const response = await api.get(`/courses/${selectedCourse.id}/students`)
      setStudents(Array.isArray(response.data) ? response.data : response.data?.data || [])

      // Existing attendance for this date, keyed by the UI (users) id.
      const attendanceRes = await api.get(`/attendance/course/${selectedCourse.id}?date=${date}`)
      const rows = Array.isArray(attendanceRes.data) ? attendanceRes.data : attendanceRes.data?.data || []
      const attendanceMap = {}
      rows.forEach(record => {
        attendanceMap[record.user_id] = record.status
      })
      setAttendance(attendanceMap)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchRoster = async () => {
    try {
      const response = await api.get(`/attendance/session/${selectedSession.id}/roster`)
      const list = response.data?.data?.students || []
      const map = {}
      list.forEach((line) => { map[line.student_id] = line.status })
      setRoster(map)
    } catch (error) {
      console.error('Error fetching roster:', error)
      setRoster({})
    }
  }

  const isLocked = (studentId) => roster[studentId] === 'unpaid'

  const handleAttendanceChange = (studentId, status) => {
    if (isLocked(studentId)) return
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }))
  }

  const handleSaveAttendance = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const attendanceData = Object.entries(attendance)
        // An unpaid submodule cannot be marked present: leave those rows out.
        .filter(([studentId]) => !isLocked(parseInt(studentId)))
        .map(([studentId, status]) => ({
          studentId: parseInt(studentId),
          status
        }))

      if (attendanceData.length === 0) {
        setFeedback({ ok: false, text: 'Aucune présence à enregistrer.' })
        return
      }

      await api.post('/attendance/bulk', {
        courseId: selectedCourse.id,
        date,
        ...(selectedSession ? { sessionId: selectedSession.id } : {}),
        attendanceData
      })

      setFeedback({ ok: true, text: 'Présences enregistrées avec succès.' })
    } catch (error) {
      setFeedback({ ok: false, text: apiError(error, "Erreur lors de l'enregistrement") })
    } finally {
      setSaving(false)
    }
  }

  const lockedCount = students.filter((student) => isLocked(student.id)).length

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return <Check className="w-5 h-5 text-green-600" />
      case 'absent':
        return <X className="w-5 h-5 text-red-600" />
      case 'late':
        return <Clock className="w-5 h-5 text-yellow-600" />
      case 'excused':
        return <AlertCircle className="w-5 h-5 text-blue-600" />
      default:
        return null
    }
  }

  const statusButton = (student, status, Icon, activeClass, label) => (
    <button
      onClick={() => handleAttendanceChange(student.id, status)}
      disabled={isLocked(student.id)}
      aria-label={`${label} — ${student.first_name} ${student.last_name}`}
      className={`p-2 rounded-lg transition-colors ${
        attendance[student.id] === status
          ? activeClass
          : 'hover:bg-gray-100 text-gray-400'
      } ${isLocked(student.id) ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-5 h-5" />
    </button>
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestion des Présences</h1>
        <p className="text-gray-600">Enregistrez et suivez les présences des candidats</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="label">Cours</label>
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => setSelectedCourse(visibleCourses.find(c => c.id === parseInt(e.target.value)))}
              className="input"
            >
              <option value="">Sélectionner un cours</option>
              {visibleCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} - {course.language}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Séance</label>
            <select
              value={selectedSession?.id || ''}
              onChange={(e) => {
                const next = sessions.find(s => s.id === parseInt(e.target.value)) || null
                setSelectedSession(next)
              }}
              className="input"
              disabled={!selectedCourse || sessionsForDate.length === 0}
            >
              <option value="">
                {selectedCourse && sessionsForDate.length === 0 ? 'Aucune séance ce jour' : 'Sélectionner une séance'}
              </option>
              {sessionsForDate.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.start_time}–{session.end_time}
                  {session.submodule_name ? ` · ${session.submodule_name}` : ' · sans sous-module'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSession?.submodule_id && lockedCount > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Lock className="w-4 h-4" />
            Sous-module « {selectedSession.submodule_name} » impayé pour {lockedCount} candidat(s) :
            la présence est verrouillée jusqu'au règlement.
          </div>
        )}

        {selectedCourse && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Candidat</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Statut</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const locked = isLocked(student.id)
                    return (
                      <tr key={student.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-600">
                                {student.first_name[0]}{student.last_name[0]}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">
                              {student.first_name} {student.last_name}
                            </span>
                            {locked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                <Lock className="w-3 h-3" /> Impayé
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(attendance[student.id])}
                            <span className="capitalize text-gray-600">
                              {attendance[student.id] || 'Non marqué'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {statusButton(student, 'present', Check, 'bg-green-100 text-green-600', 'Présent')}
                            {statusButton(student, 'absent', X, 'bg-red-100 text-red-600', 'Absent')}
                            {statusButton(student, 'late', Clock, 'bg-yellow-100 text-yellow-600', 'En retard')}
                            {statusButton(student, 'excused', AlertCircle, 'bg-blue-100 text-blue-600', 'Excusé')}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col items-end gap-3">
              {feedback && (
                <div className={`w-full rounded-lg px-4 py-3 text-sm ${feedback.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {feedback.text}
                </div>
              )}
              <button
                onClick={handleSaveAttendance}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Calendar className="w-5 h-5" />
                )}
                Enregistrer les présences
              </button>
            </div>
          </>
        )}

        {!selectedCourse && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sélectionnez un cours</h3>
            <p className="text-gray-500">Choisissez un cours pour gérer les présences</p>
          </div>
        )}
      </div>
    </div>
  )
}
