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

import Sessions from '../pages/Sessions'

const sessionRow = {
  id: 1,
  name: 'Groupe A1-1',
  group_name: 'Groupe A1-1',
  date: '2024-01-15',
  start_time: '09:00',
  end_time: '11:00',
  room: 'Salle 101',
  teacher_name: 'Marie Dupont',
  status: 'completed'
}

describe('Sessions page', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url.startsWith('/sessions')) {
        return Promise.resolve({
          data: { success: true, data: [sessionRow], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }
        })
      }
      if (url === '/groups') {
        return Promise.resolve({ data: [{ id: 1, name: 'Groupe A1-1' }] })
      }
      if (url === '/teachers') {
        return Promise.resolve({
          data: [{ id: 9, teacher_id: 5, first_name: 'Bessem', last_name: 'Boughnima' }]
        })
      }
      return Promise.resolve({ data: [] })
    })
    mockApi.post.mockResolvedValue({ data: { success: true, data: { id: 2 } } })
  })

  it('renders stored dates formatted, not raw', async () => {
    const { container } = render(<Sessions />)
    // Ni le brut ISO, ni un "Invalid Date" : une date localisée quelconque.
    await waitFor(
      () => {
        expect(container.querySelector('tbody')).not.toBeNull()
        expect(screen.getByText('Marie Dupont')).toBeInTheDocument()
      },
      { timeout: 5000 }
    )
    expect(screen.queryByText('2024-01-15')).not.toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
  })

  it('offers the teacher table id in the form', async () => {
    render(<Sessions />)
    await userEvent.click(await screen.findByRole('button', { name: /Nouvelle session/i }))
    const options = screen.getByLabelText('Professeur').querySelectorAll('option')
    const values = [...options].map((o) => o.value)
    // ID table professeur (5), pas l'ID utilisateur (9)
    expect(values).toContain('5')
    expect(values).not.toContain('9')
  })

  it('shows a dash instead of "Invalid Date" for garbage dates', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url.startsWith('/sessions')) {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ ...sessionRow, date: 'not-a-date' }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
          }
        })
      }
      return Promise.resolve({ data: [] })
    })
    render(<Sessions />)
    expect(await screen.findByText('-')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
  })

  it('fills teacher and room from the selected group', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url.startsWith('/sessions')) {
        return Promise.resolve({
          data: { success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }
        })
      }
      if (url === '/groups') {
        return Promise.resolve({
          data: [{ id: 1, name: 'Groupe A1-1', teacher_id: 5, room: 'Salle 101' }]
        })
      }
      if (url === '/teachers') {
        return Promise.resolve({
          data: [{ id: 9, teacher_id: 5, first_name: 'Bessem', last_name: 'Boughnima' }]
        })
      }
      return Promise.resolve({ data: [] })
    })
    render(<Sessions />)
    await userEvent.click(await screen.findByRole('button', { name: /Nouvelle session/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Groupe'), '1')
    expect(screen.getByLabelText('Professeur').value).toBe('5')
    expect(screen.getByLabelText('Salle').value).toBe('Salle 101')
  })
})
