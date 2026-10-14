import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

import Groups from '../pages/Groups'

describe('Groups page — création', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url.startsWith('/groups')) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 1, name: 'Groupe A1-1', course_id: 6, course_name: 'Allemand A1',
                teacher_id: 5, teacher_name: 'Bessem Boughnima', room: 'Salle 101',
                max_students: 15, enrolled_students: 3, status: 'active'
              }
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
          }
        })
      }
      if (url === '/courses') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 6, name: 'Allemand A1', language: 'Allemand',
                teacher_id: 5, room: 'Salle 101', max_students: 15,
                start_date: '2026-01-05', end_date: '2026-06-05',
                schedule: 'Lun-Mer 9h-11h'
              }
            ]
          }
        })
      }
      if (url === '/teachers') {
        // ID utilisateur (9) volontairement différent de l'ID professeur (5) :
        // le formulaire doit envoyer l'ID de la table teachers.
        return Promise.resolve({
          data: [{ id: 9, teacher_id: 5, first_name: 'Bessem', last_name: 'Boughnima' }]
        })
      }
      return Promise.resolve({ data: [] })
    })
    mockApi.post.mockResolvedValue({ data: { success: true, data: { id: 1 } } })
  })

  it('sends the teacher table id, not the user id', async () => {
    render(<Groups />)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau groupe/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nom du groupe'), 'A1-1')
    await userEvent.selectOptions(screen.getByLabelText('Cours'), '6')
    await userEvent.selectOptions(screen.getByLabelText('Professeur'), '5')
    await userEvent.click(screen.getByRole('button', { name: /^Enregistrer$/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/groups',
        expect.objectContaining({ name: 'A1-1', courseId: '6', teacherId: '5' })
      )
    })
  }, 15000)

  it('fills the form from the selected course', async () => {
    render(<Groups />)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau groupe/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nom du groupe'), 'A1-2')
    await userEvent.selectOptions(screen.getByLabelText('Cours'), '6')

    // Professeur, salle, capacité, dates et horaires repris du cours.
    expect(screen.getByLabelText('Professeur').value).toBe('5')
    expect(screen.getByLabelText('Salle').value).toBe('Salle 101')
    expect(screen.getByLabelText('Capacité').value).toBe('15')
    expect(screen.getByLabelText('Date de début').value).toBe('2026-01-05')
    expect(screen.getByLabelText('Date de fin').value).toBe('2026-06-05')
    expect(screen.getByLabelText('Horaires').value).toBe('Lun-Mer 9h-11h')
  }, 15000)

  it('shows the server error instead of failing silently', async () => {    mockApi.post.mockRejectedValue({
      response: { data: { error: { message: 'Salle déjà occupée' } } }
    })
    render(<Groups />)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau groupe/i }))
    await userEvent.type(await screen.findByLabelText('Nom du groupe'), 'A1-2')
    await userEvent.selectOptions(screen.getByLabelText('Cours'), '6')
    await userEvent.click(screen.getByRole('button', { name: /^Enregistrer$/i }))

    expect(await screen.findByText('Salle déjà occupée')).toBeInTheDocument()
  }, 15000)

  it('maps snake_case rows to the table (cours, professeur, effectif)', async () => {
    render(<Groups />)
    expect(await screen.findByText('Allemand A1')).toBeInTheDocument()
    expect(screen.getByText('Bessem Boughnima')).toBeInTheDocument()
    expect(screen.getByText('3/15')).toBeInTheDocument()
  })
})

describe('Groups page — candidats du groupe', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/groups/1/students') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { user_id: 4, student_id: 1, first_name: 'Pierre', last_name: 'Bernard', email: 'pierre@example.com', enrollment_date: '2026-10-01' }
            ]
          }
        })
      }
      if (url.startsWith('/groups')) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 1, name: 'Groupe A1-1', course_id: 6, course_name: 'Allemand A1',
                teacher_id: 5, teacher_name: 'Bessem Boughnima', room: 'Salle 101',
                max_students: 15, enrolled_students: 1, status: 'active'
              }
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
          }
        })
      }
      if (url === '/courses') {
        return Promise.resolve({ data: [{ id: 6, name: 'Allemand A1', language: 'Allemand' }] })
      }
      if (url === '/teachers') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/students') {
        return Promise.resolve({
          data: [
            { id: 4, first_name: 'Pierre', last_name: 'Bernard', email: 'pierre@example.com' },
            { id: 5, first_name: 'Sophie', last_name: 'Leroy', email: 'sophie@example.com' }
          ]
        })
      }
      return Promise.resolve({ data: [] })
    })
    mockApi.post.mockResolvedValue({ data: { success: true, data: { enrollmentId: 9 } } })
    mockApi.delete.mockResolvedValue({ data: { success: true } })
  })

  it('opens the members modal and adds a candidate to the group', async () => {
    const user = userEvent.setup()
    render(<Groups />)

    await user.click(await screen.findByRole('button', { name: /Gérer les candidats du groupe Groupe A1-1/i }))

    expect(await screen.findByText('Pierre Bernard')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Candidat à ajouter/i), '5')
    await user.click(screen.getByRole('button', { name: /Ajouter/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/courses/6/enroll',
        expect.objectContaining({ studentId: 5, groupId: 1, confirmed: true })
      )
    })
    expect(await screen.findByText(/Candidat ajouté au groupe/i)).toBeInTheDocument()
  })

  it('removes a candidate through a confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<Groups />)

    await user.click(await screen.findByRole('button', { name: /Gérer les candidats du groupe Groupe A1-1/i }))
    await user.click(await screen.findByRole('button', { name: /Retirer Pierre Bernard du groupe/i }))

    expect(await screen.findByText(/restera inscrit au cours/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retirer' }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/groups/1/students/4')
    })
  })

  it('shows the server error when the group is full', async () => {
    mockApi.post.mockRejectedValue({
      response: { data: { error: { message: 'Group Groupe A1-1 is full (15 seats).', code: 'GROUP_FULL' } } }
    })
    const user = userEvent.setup()
    render(<Groups />)

    await user.click(await screen.findByRole('button', { name: /Gérer les candidats du groupe Groupe A1-1/i }))
    await user.selectOptions(await screen.findByLabelText(/Candidat à ajouter/i), '5')
    await user.click(screen.getByRole('button', { name: /Ajouter/i }))

    expect(await screen.findByText(/is full \(15 seats\)/i)).toBeInTheDocument()
  })
})
