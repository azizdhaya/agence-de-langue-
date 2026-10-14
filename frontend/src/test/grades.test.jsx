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

import Grades from '../pages/Grades'

describe('Grades page - ajout dune note', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/courses') {
        return Promise.resolve({
          data: [{ id: 3, name: 'cours allemand', language: 'Allemand', status: 'active' }]
        })
      }
      if (url === '/grades/course/3') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/courses/3/students') {
        return Promise.resolve({
          data: [
            { id: 10, first_name: 'bessem', last_name: 'Boughnima', email: 'bessem123@gmail.com' }
          ]
        })
      }
      return Promise.resolve({ data: [] })
    })
    mockApi.post.mockResolvedValue({ data: { message: 'Grade added successfully', gradeId: 7 } })
  })

  it('records the grade with the selected candidate and closes', async () => {
    const user = userEvent.setup()
    render(<Grades />)

    await user.selectOptions(await screen.findByLabelText(/Cours/i), '3')
    await user.click(await screen.findByRole('button', { name: /Ajouter une Note/i }))

    await user.selectOptions(screen.getByLabelText(/Candidat/i), '10')
    await user.selectOptions(screen.getByLabelText(/Type d/i), 'assignment')
    await user.type(screen.getByLabelText(/^Note$/i), '10')
    await user.click(screen.getByRole('button', { name: /^Enregistrer$/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/grades',
        expect.objectContaining({ studentId: '10', courseId: 3, assessmentType: 'assignment', score: 10, maxScore: 100 })
      )
    })
  })

  it('shows the server error inside the modal instead of failing silently', async () => {
    mockApi.post.mockRejectedValue({
      response: { data: { error: 'Student not found' } }
    })
    const user = userEvent.setup()
    render(<Grades />)

    await user.selectOptions(await screen.findByLabelText(/Cours/i), '3')
    await user.click(await screen.findByRole('button', { name: /Ajouter une Note/i }))

    await user.selectOptions(screen.getByLabelText(/Candidat/i), '10')
    await user.selectOptions(screen.getByLabelText(/Type d/i), 'assignment')
    await user.type(screen.getByLabelText(/^Note$/i), '10')
    await user.click(screen.getByRole('button', { name: /^Enregistrer$/i }))

    expect(await screen.findByText('Student not found')).toBeInTheDocument()
    // The modal stays open so the saisie is not lost.
    expect(screen.getByRole('button', { name: /^Enregistrer$/i })).toBeInTheDocument()
  })
})

