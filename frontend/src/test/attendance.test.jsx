import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

vi.mock('../utils/api', () => ({ default: mockApi }))

vi.mock('../data/demoStore', () => ({
  useDemoStore: () => ({ languages: [] }),
  courseLanguageIsActive: () => true,
  normalizeLanguageName: (name) => name
}))

import Attendance from '../pages/Attendance'

const today = new Date().toISOString().split('T')[0]

function mockAttendanceApi({ rosterUnpaid = [11] } = {}) {
  mockApi.get.mockImplementation((url) => {
    if (url === '/courses') {
      return Promise.resolve({ data: [{ id: 1, name: 'Cours A', language: 'Français', status: 'active' }] })
    }
    if (url === '/courses/1/students') {
      return Promise.resolve({
        data: [
          { id: 11, first_name: 'Pierre', last_name: 'Bernard' },
          { id: 12, first_name: 'Sophie', last_name: 'Leroy' }
        ]
      })
    }
    if (typeof url === 'string' && url.startsWith('/attendance/course/1')) {
      return Promise.resolve({ data: [] })
    }
    if (typeof url === 'string' && url.startsWith('/sessions?courseId=1')) {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            { id: 5, date: today, start_time: '09:00', end_time: '11:00', submodule_id: 100, submodule_name: 'Sons et alphabet' }
          ]
        }
      })
    }
    if (url === '/attendance/session/5/roster') {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            session: { id: 5, submodule_id: 100, submodule_name: 'Sons et alphabet' },
            students: [
              { student_id: 11, name: 'Pierre Bernard', status: rosterUnpaid.includes(11) ? 'unpaid' : 'paid' },
              { student_id: 12, name: 'Sophie Leroy', status: 'paid' }
            ]
          }
        }
      })
    }
    return Promise.resolve({ data: [] })
  })
  mockApi.post.mockResolvedValue({ data: { success: true } })
}

async function openCourse() {
  const selects = await screen.findAllByRole('combobox')
  await userEvent.selectOptions(selects[0], '1')
  await screen.findByText('Pierre Bernard')
}

describe('Attendance — unpaid submodule lock', () => {
  beforeEach(() => {
    mockApi.get.mockReset()
    mockApi.post.mockReset()
  })

  it('locks the rows of students who still owe the séance submodule', async () => {
    mockAttendanceApi({ rosterUnpaid: [11] })
    render(<Attendance />)
    await openCourse()

    await waitFor(() => {
      expect(screen.getByLabelText('Présent — Pierre Bernard')).toBeDisabled()
    })
    expect(screen.getByLabelText('Présent — Sophie Leroy')).not.toBeDisabled()
    expect(await screen.findByText(/impayé pour 1 candidat/i)).toBeInTheDocument()
  })

  it('saves the séance id and leaves the unpaid rows out of the payload', async () => {
    mockAttendanceApi({ rosterUnpaid: [11] })
    render(<Attendance />)
    await openCourse()

    await waitFor(() => expect(screen.getByLabelText('Présent — Pierre Bernard')).toBeDisabled())
    await userEvent.click(screen.getByLabelText('Présent — Sophie Leroy'))
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer les présences/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/attendance/bulk', {
        courseId: 1,
        date: today,
        sessionId: 5,
        attendanceData: [{ studentId: 12, status: 'present' }]
      })
    })
  })

  it('shows the server block message when the save is refused', async () => {
    mockAttendanceApi({ rosterUnpaid: [] })
    mockApi.post.mockRejectedValueOnce({
      response: { data: { error: { message: 'Sous-module impayé : présence impossible.', code: 'SUBMODULE_UNPAID' } } }
    })
    render(<Attendance />)
    await openCourse()

    await userEvent.click(screen.getByLabelText('Présent — Pierre Bernard'))
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer les présences/i }))

    expect(await screen.findByText('Sous-module impayé : présence impossible.')).toBeInTheDocument()
  })
})
