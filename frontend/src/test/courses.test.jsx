import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../utils/api', () => ({ default: mockApi }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin', firstName: 'Admin', lastName: 'User' } })
}))

import { MemoryRouter } from 'react-router-dom'
import Courses from '../pages/Courses'

const backendCourses = [
  { id: 1, name: 'Français Débutant', language: 'Français', level: 'beginner', price: 500, status: 'active', max_students: 15, enrolled_students: 1 },
  { id: 2, name: 'Anglais Business', language: 'Anglais', level: 'advanced', price: 700, status: 'active', max_students: 10, enrolled_students: 1 }
]

function mockCoursesApi(groups = []) {
  mockApi.get.mockImplementation((url) => {
    if (url === '/courses') {
      return Promise.resolve({ data: { success: true, data: backendCourses } })
    }
    if (typeof url === 'string' && url.startsWith('/groups')) {
      return Promise.resolve({ data: { success: true, data: groups } })
    }
    return Promise.resolve({ data: [] })
  })
}

describe('Courses page — règle des langues actives', () => {
  beforeEach(() => {
    localStorage.clear()
    mockCoursesApi()
  })

  it('shows every course when all languages are active', async () => {
    render(<MemoryRouter><Courses /></MemoryRouter>)
    expect(await screen.findByText('Français Débutant')).toBeInTheDocument()
    expect(screen.getByText('Anglais Business')).toBeInTheDocument()
  })

  it('hides courses of a deactivated language with a note', async () => {
    localStorage.setItem(
      'demo.administration.v1',
      JSON.stringify({
        languages: [
          { id: 1, name: 'Anglais', code: 'EN', flag: '🇬🇧', description: '', isActive: true },
          { id: 2, name: 'Français', code: 'FR', flag: '🇫🇷', description: '', isActive: false }
        ],
        levels: []
      })
    )
    render(<MemoryRouter><Courses /></MemoryRouter>)
    expect(await screen.findByText('Anglais Business')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Français Débutant')).not.toBeInTheDocument()
    })
    expect(screen.getByText(/1 cours masqué/)).toBeInTheDocument()
  })

  it('matches languages ignoring case and accents', async () => {
    localStorage.setItem(
      'demo.administration.v1',
      JSON.stringify({
        languages: [
          { id: 2, name: 'Francais', code: 'FR', flag: '🇫🇷', description: '', isActive: false }
        ],
        levels: []
      })
    )
    render(<MemoryRouter><Courses /></MemoryRouter>)
    await waitFor(() => {
      // 'Francais' (sans accent) masque bien 'Français' (avec accent)
      expect(screen.queryByText('Français Débutant')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Anglais Business')).toBeInTheDocument()
  })

  it('creates a course without sending empty optionals', async () => {
    // Non-régression : le formulaire envoyait teacherId: '' et autres champs
    // vides, refusés par la validation backend. Les vides sont exclus.
    render(<MemoryRouter><Courses /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau cours/i }))
    // La modale Cours est un markup custom (pas de role="dialog") : on repère un champ
    expect(await screen.findByText('Formateur responsable')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nom du cours *'), 'Allemand A1')
    await userEvent.selectOptions(screen.getByLabelText('Langue *'), 'Allemand')
    await userEvent.selectOptions(screen.getByLabelText('Type de formation'), 'intensive')
    await userEvent.selectOptions(screen.getByLabelText('Mode de formation'), 'hybride')
    await userEvent.type(screen.getByLabelText(/Prix/), '340')
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/courses',
        expect.objectContaining({ name: 'Allemand A1', language: 'Allemand', price: '340', courseType: 'intensive', mode: 'hybride' })
      )
    })
    const payload = mockApi.post.mock.calls[0][1]
    expect(payload.teacherId).toBeUndefined()
    expect(payload.levelCode).toBeUndefined()
    expect(payload.description).toBeUndefined()
  }, 15000)

  it('shows the groups linked to each course', async () => {
    mockCoursesApi([
      { id: 11, name: 'A1.1', course_id: 1, enrolled_students: 2, max_students: 15 },
      { id: 12, name: 'A1.2', course_id: 1, enrolled_students: 0, max_students: 15 }
    ])
    render(<MemoryRouter><Courses /></MemoryRouter>)
    expect(await screen.findByText(/A1\.1 · 2\/15/)).toBeInTheDocument()
    expect(screen.getByText(/A1\.2 · 0\/15/)).toBeInTheDocument()
  })

  it('states when a course has no linked group', async () => {
    mockCoursesApi([])
    render(<MemoryRouter><Courses /></MemoryRouter>)
    expect(await screen.findAllByText('Aucun groupe relié')).toHaveLength(2)
  })

  it('shows stats and filters the list by status', async () => {
    mockCoursesApi([])
    render(<MemoryRouter><Courses /></MemoryRouter>)
    expect(await screen.findByText(/2 cours/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Filtrer par statut'), 'completed')
    expect(screen.queryByText('Anglais Business')).not.toBeInTheDocument()
    expect(screen.queryByText('Français Débutant')).not.toBeInTheDocument()
    expect(screen.getByText("Aucun cours ne correspond à ces critères.")).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Filtrer par statut'), 'active')
    expect(screen.getByText('Anglais Business')).toBeInTheDocument()
  })

  it('refuses an end date before the start date without calling the API', async () => {
    mockCoursesApi([])
    render(<MemoryRouter><Courses /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau cours/i }))
    await userEvent.type(screen.getByLabelText('Nom du cours *'), 'Cours Inversé')
    await userEvent.selectOptions(screen.getByLabelText('Langue *'), 'Allemand')
    const start = document.getElementById('course-start-date')
    const end = document.getElementById('course-end-date')
    fireEvent.change(start, { target: { value: '2026-06-01' } })
    fireEvent.change(end, { target: { value: '2026-05-01' } })
    await userEvent.type(screen.getByLabelText(/Prix/), '100')
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/i }))
    expect(await screen.findByText(/postérieure à la date de début/)).toBeInTheDocument()
    expect(mockApi.post).not.toHaveBeenCalled()
  })

  it('opens a detail drawer with students and sessions', async () => {    mockApi.get.mockImplementation((url) => {
      if (url === '/courses') {
        return Promise.resolve({ data: { success: true, data: backendCourses } })
      }
      if (typeof url === 'string' && url.startsWith('/groups')) {
        return Promise.resolve({ data: { success: true, data: [] } })
      }
      if (url === '/courses/1/students') {
        return Promise.resolve({ data: [{ id: 4, first_name: 'Pierre', last_name: 'B', email: 'p@x.com' }] })
      }
      if (url === '/students') {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })
    render(<MemoryRouter><Courses /></MemoryRouter>)
    const buttons = await screen.findAllByRole('button', { name: /Consulter Français Débutant/ })
    await userEvent.click(buttons[0])
    expect(await screen.findByText('Fiche cours')).toBeInTheDocument()
    expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument()
    expect(screen.getByText(/Pierre/)).toBeInTheDocument()
    expect(screen.getByText('Planning et séances (0)')).toBeInTheDocument()
  })

  it('composes per-day hours into the schedule text', async () => {
    mockCoursesApi([])
    render(<MemoryRouter><Courses /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau cours/i }))
    await userEvent.type(screen.getByLabelText('Nom du cours *'), 'Cours Planifié')
    await userEvent.selectOptions(screen.getByLabelText('Langue *'), 'Allemand')
    await userEvent.click(screen.getByRole('button', { name: 'Lun' }))
    const setTime = (id, value) => fireEvent.change(document.getElementById(id), { target: { value } })
    setTime('course-start-Lun', '14:00')
    setTime('course-end-Lun', '16:00')
    // Mer reprend les heures de Lun, puis on les change : créneau unique.
    await userEvent.click(screen.getByRole('button', { name: 'Mer' }))
    setTime('course-start-Mer', '18:00')
    setTime('course-end-Mer', '20:00')
    expect(screen.getByLabelText('Jours et horaires (texte composé)').value).toBe('Lun 14h-16h, Mer 18h-20h')
    // Ven reprend les heures de Lun : regroupé avec Lun.
    await userEvent.click(screen.getByRole('button', { name: 'Ven' }))
    setTime('course-start-Ven', '14:00')
    setTime('course-end-Ven', '16:00')
    expect(screen.getByLabelText('Jours et horaires (texte composé)').value).toBe('Lun-Ven 14h-16h, Mer 18h-20h')
    await userEvent.type(screen.getByLabelText(/Prix/), '100')
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/i }))
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/courses',
        expect.objectContaining({ schedule: 'Lun-Ven 14h-16h, Mer 18h-20h' })
      )
    })
  })
})
