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
import Announcements from '../pages/Announcements'

describe('Grades page — suppression', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/courses') {
        return Promise.resolve({ data: [{ id: 1, name: 'Français Débutant', language: 'Français', status: 'active' }] })
      }
      return Promise.resolve({ data: [] })
    })
    mockApi.delete.mockResolvedValue({ data: { success: true } })
  })

  it('selecting a course lists its grades', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/courses') {
        return Promise.resolve({ data: [{ id: 1, name: 'Français Débutant', language: 'Français', status: 'active' }] })
      }
      if (url === '/grades/course/1') {
        return Promise.resolve({
          data: [{ id: 11, student_id: 1, student_name: 'Pierre Bernard', assessment_type: 'exam', score: 15, max_score: 20, date: '2026-10-01' }]
        })
      }
      return Promise.resolve({ data: [] })
    })
    render(<Grades />)
    await userEvent.selectOptions(await screen.findByLabelText('Cours'), '1')
    expect(await screen.findByText('Pierre Bernard')).toBeInTheDocument()
  })

  it('asks for confirmation before deleting a grade', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/courses') {
        return Promise.resolve({ data: [{ id: 1, name: 'Français Débutant', language: 'Français', status: 'active' }] })
      }
      if (url === '/grades/course/1') {
        return Promise.resolve({
          data: [{ id: 11, student_id: 1, student_name: 'Pierre Bernard', assessment_type: 'exam', score: 15, max_score: 20, date: '2026-10-01' }]
        })
      }
      return Promise.resolve({ data: [] })
    })
    render(<Grades />)
    await userEvent.selectOptions(await screen.findByLabelText('Cours'), '1')
    await userEvent.click(await screen.findByRole('button', { name: /Supprimer la note 11/i }))
    expect(await screen.findByText('Supprimer cette note ?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Supprimer$/i }))
    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/grades/11')
    })
  })
})

describe('Announcements page — suppression', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({
      data: [{ id: 3, title: 'Rentrée', content: 'Bienvenue', target_audience: 'all' }]
    })
    mockApi.delete.mockResolvedValue({ data: { success: true } })
  })

  it('asks for confirmation before deleting', async () => {
    render(<Announcements />)
    expect(await screen.findByText('Rentrée')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Supprimer Rentrée/i }))
    expect(await screen.findByText('Supprimer cette annonce ?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Supprimer$/i }))
    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/announcements/3')
    })
  })
})
