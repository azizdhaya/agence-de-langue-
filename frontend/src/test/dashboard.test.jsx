import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../utils/api', () => ({ default: mockApi }))

const mockUseAuth = vi.fn()
// The component destructures { user }, so the mock must return { user: {...} }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}))

import Dashboard from '../pages/Dashboard'

const studentPayload = {
  data: {
    success: true,
    data: {
      level: 'B1',
      activeCourses: 2,
      attendanceRate: 88,
      averageScore: 81.5,
      certificates: 1,
      unreadNotifications: 0,
      upcomingSessions: [
        {
          id: 10,
          date: '2026-10-10',
          start_time: '09:00',
          end_time: '11:00',
          room: 'Salle 102',
          group_name: 'Groupe B1-1',
          course_name: 'Français Intermédiaire'
        }
      ],
      recentGrades: [
        {
          id: 5,
          assessment_type: 'exam',
          score: 85,
          max_score: 100,
          course_name: 'Français Intermédiaire',
          skill_name: 'Listening'
        }
      ]
    }
  }
}

const teacherPayload = {
  data: {
    success: true,
    data: {
      activeGroups: 2,
      upcomingSessions: 1,
      totalStudents: 4,
      attendanceRecords: 3,
      totalGrades: 3,
      sessions: [
        {
          id: 11,
          date: '2026-10-12',
          start_time: '14:00',
          end_time: '16:00',
          room: 'Salle 201',
          status: 'scheduled',
          group_name: 'Groupe C1-1',
          course_name: 'Anglais Business',
          language: 'Anglais'
        }
      ],
      groups: [
        { group_id: 1, group_name: 'Groupe A1-1', student_count: 6, grade_count: 4, average_score: 72.5 }
      ]
    }
  }
}

// /dashboard/stats returns the figures directly (no success wrapper),
// so the axios response shape is { data: { total_students, ... } }
const adminStatsResponse = {
  data: {
    total_students: 3,
    total_teachers: 2,
    active_courses: 3,
    active_enrollments: 3
  }
}

describe('Dashboard page', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { role: 'student', id: 4 } })
  })

  describe('student role', () => {
    beforeEach(() => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/dashboard/student') return Promise.resolve(studentPayload)
        return Promise.resolve({ data: [] })
      })
    })

    it('requests the student dashboard endpoint', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Mon Espace')).toBeInTheDocument()
      expect(mockApi.get).toHaveBeenCalledWith('/dashboard/student')
    })

    it('shows the real course count from the API', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Cours actifs')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('shows the attendance rate returned by the API', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Assiduité')).toBeInTheDocument()
      expect(screen.getByText('88%')).toBeInTheDocument()
    })

    it('shows the average score returned by the API', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Moyenne')).toBeInTheDocument()
      expect(screen.getByText('81.5%')).toBeInTheDocument()
    })

    it('shows the level returned by the API', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Niveau actuel')).toBeInTheDocument()
      expect(screen.getByText('B1')).toBeInTheDocument()
    })

    it('lists upcoming sessions from the API', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Groupe B1-1')).toBeInTheDocument()
      expect(screen.getByText(/Salle 102/)).toBeInTheDocument()
    })

    it('lists recent grades from the API', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('exam')).toBeInTheDocument()
      expect(screen.getByText(/Listening/)).toBeInTheDocument()
    })

    it('does not hardcode a progression value', async () => {
      render(<Dashboard />)
      await screen.findByText('Mon Espace')
      expect(screen.queryByText('75%')).not.toBeInTheDocument()
    })
  })

  describe('teacher role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { role: 'teacher', id: 2 } })
      mockApi.get.mockImplementation((url) => {
        if (url === '/dashboard/teacher') return Promise.resolve(teacherPayload)
        return Promise.resolve({ data: [] })
      })
    })

    it('requests the teacher dashboard endpoint', async () => {
      render(<Dashboard />)
      await screen.findByText('Mon Espace')
      expect(mockApi.get).toHaveBeenCalledWith('/dashboard/teacher')
    })

    it('shows group and student counts from the API', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Groupes actifs')).toBeInTheDocument()
      expect(screen.getByText('Mes étudiants')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('lists the teacher groups with averages', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Groupe A1-1')).toBeInTheDocument()
      expect(screen.getByText('Moy. 72.5%')).toBeInTheDocument()
    })
  })

  describe('admin role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { role: 'admin', id: 1 } })
      mockApi.get.mockImplementation((url) => {
        if (url === '/dashboard/stats') return Promise.resolve(adminStatsResponse)
        if (url === '/dashboard/enrollments') return Promise.resolve({ data: [] })
        if (url === '/dashboard/recent') return Promise.resolve({ data: [] })
        return Promise.resolve({ data: [] })
      })
    })

    it('renders the admin overview', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Vue d\'ensemble de votre centre de langue')).toBeInTheDocument()
      expect(screen.getByText('Total Candidats')).toBeInTheDocument()
      expect(screen.getByText('Professeurs')).toBeInTheDocument()
    })

    it('handles an empty activity feed without crashing', async () => {
      render(<Dashboard />)
      expect(await screen.findByText('Activités Récentes')).toBeInTheDocument()
      expect(screen.getByText('Aucune activité récente')).toBeInTheDocument()
    })
  })

  it('shows an error state when the request fails', async () => {
    mockApi.get.mockRejectedValue({ response: { data: { error: { message: 'Serveur indisponible' } } } })

    render(<Dashboard />)
    expect(await screen.findByText('Erreur')).toBeInTheDocument()
    expect(screen.getByText('Serveur indisponible')).toBeInTheDocument()
  })
})
