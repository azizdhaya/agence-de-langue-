import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useDemoStore, courseLanguageIsActive } from '../data/demoStore'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, X, Award, TrendingUp } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export default function Grades() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  // Seuls les cours des langues actives sont proposés.
  const { languages: demoLanguages } = useDemoStore()
  const visibleCourses = courses.filter((c) => courseLanguageIsActive(demoLanguages, c.language))
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [grades, setGrades] = useState([])
  const [students, setStudents] = useState([])
  const [deleting, setDeleting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [formData, setFormData] = useState({
    studentId: '',
    assessmentType: '',
    score: '',
    maxScore: 100,
    notes: ''
  })

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      fetchGrades()
      fetchStudents()
    }
  }, [selectedCourse])

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

  const fetchGrades = async () => {
    try {
      const response = await api.get(`/grades/course/${selectedCourse.id}`)
      setGrades(response.data)
    } catch (error) {
      console.error('Error fetching grades:', error)
    }
  }

  const fetchStudents = async () => {
    try {
      const response = await api.get(`/courses/${selectedCourse.id}/students`)
      setStudents(Array.isArray(response.data) ? response.data : response.data?.data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    try {
      await api.post('/grades', {
        ...formData,
        courseId: selectedCourse.id,
        score: parseFloat(formData.score),
        maxScore: parseFloat(formData.maxScore)
      })
      fetchGrades()
      closeModal()
    } catch (error) {
      // Visible dans la modale au lieu d'un échec silencieux.
      setSubmitError(error.response?.data?.error || error.message || 'Enregistrement impossible')
    }
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/grades/${deleting.id}`)
      setDeleting(null)
      fetchGrades()
    } catch {
      setDeleting(null)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setSubmitError(null)
    setFormData({
      studentId: '',
      assessmentType: '',
      score: '',
      maxScore: 100,
      notes: ''
    })
  }

  const getGradeColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600 bg-green-100'
    if (percentage >= 60) return 'text-blue-600 bg-blue-100'
    if (percentage >= 40) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Notes</h1>
          <p className="text-gray-600">Suivi des évaluations et de la progression</p>
        </div>
        {user.role !== 'student' && selectedCourse && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Ajouter une Note
          </button>
        )}
      </div>

      <div className="card">
        <div className="mb-6">
          <label htmlFor="grades-course" className="label">Cours</label>
          <select
            id="grades-course"
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

        {selectedCourse && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-blue-600">Total Évaluations</p>
                    <p className="text-2xl font-bold text-blue-900">{grades.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-green-600">Moyenne Générale</p>
                    <p className="text-2xl font-bold text-green-900">
                      {grades.length > 0
                        ? Math.round(grades.reduce((acc, g) => acc + (g.score * 100 / g.max_score), 0) / grades.length)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-sm text-purple-600">Candidats</p>
                    <p className="text-2xl font-bold text-purple-900">{students.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Grades Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Candidat</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Type d'évaluation</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Note</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Pourcentage</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                    {user.role !== 'student' && (
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade) => {
                    const percentage = Math.round(grade.score * 100 / grade.max_score)
                    return (
                      <tr key={grade.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-600">
                                {grade.student_name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">{grade.student_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{grade.assessment_type}</td>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {grade.score}/{grade.max_score}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGradeColor(percentage)}`}>
                            {percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(grade.date).toLocaleDateString('fr-FR')}
                        </td>
                        {user.role !== 'student' && (
                          <td className="py-3 px-4">
                            <button
                              onClick={() => setDeleting(grade)}
                              aria-label={`Supprimer la note ${grade.id}`}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {grades.length === 0 && (
              <div className="text-center py-12">
                <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune note</h3>
                <p className="text-gray-500">Commencez par ajouter une évaluation</p>
              </div>
            )}
          </>
        )}

        {!selectedCourse && (
          <div className="text-center py-12">
            <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sélectionnez un cours</h3>
            <p className="text-gray-500">Choisissez un cours pour voir les notes</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Ajouter une Note</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}
              <div>
                <label className="label" htmlFor="grade-student">Candidat</label>
                <select
                  id="grade-student"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Sélectionner un candidat</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="grade-type">Type d'évaluation</label>
                <select
                  id="grade-type"
                  value={formData.assessmentType}
                  onChange={(e) => setFormData({ ...formData, assessmentType: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Sélectionner le type</option>
                  <option value="exam">Examen</option>
                  <option value="quiz">Quiz</option>
                  <option value="assignment">Devoir</option>
                  <option value="participation">Participation</option>
                  <option value="oral">Expression orale</option>
                  <option value="project">Projet</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="grade-score">Note</label>
                  <input
                    id="grade-score"
                    type="number"
                    step="0.5"
                    value={formData.score}
                    onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="grade-max">Note maximale</label>
                  <input
                    id="grade-max"
                    type="number"
                    value={formData.maxScore}
                    onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Supprimer cette note ?"
        message="Cette action est irréversible."
        confirmText="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
