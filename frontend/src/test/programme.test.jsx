import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

vi.mock('../utils/api', () => ({ default: mockApi }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin', firstName: 'Admin', lastName: 'User' } })
}))

import Courses from '../pages/Courses'

const backendCourses = [
  { id: 1, name: 'Français Débutant', language: 'Français', level: 'beginner', price: 500, status: 'active', max_students: 15, enrolled_students: 0 }
]

const modules = [
  {
    id: 10,
    name: 'Module 1',
    discount_percent: 10,
    price_millimes: 250000,
    submodule_count: 2,
    submodules: [
      { id: 100, name: 'Sous A', price_millimes: 120000, price: 120 },
      { id: 101, name: 'Sous B', price_millimes: 130000, price: 130 }
    ]
  }
]

function mockProgrammeApi() {
  mockApi.get.mockImplementation((url) => {
    if (url === '/courses') return Promise.resolve({ data: { success: true, data: backendCourses } })
    if (url === '/courses/1/modules') return Promise.resolve({ data: { success: true, data: modules } })
    if (url === '/courses/1/students') return Promise.resolve({ data: [] })
    if (url === '/students') return Promise.resolve({ data: [] })
    if (typeof url === 'string' && url.startsWith('/groups')) {
      return Promise.resolve({ data: { success: true, data: [] } })
    }
    return Promise.resolve({ data: [] })
  })
}

describe('Course programme', () => {
  beforeEach(() => {
    localStorage.clear()
    mockApi.get.mockReset()
    mockApi.post.mockReset()
    mockProgrammeApi()
  })

  it('shows the programme with each module and its submodules', async () => {
    render(<MemoryRouter><Courses /></MemoryRouter>)
    const open = await screen.findByRole('button', { name: /Consulter Français Débutant/ })
    await userEvent.click(open)

    expect(await screen.findByText('Programme — modules et sous-modules')).toBeInTheDocument()
    // The module name also appears as an enrolment checkbox: at least the list row.
    expect(screen.getAllByText('Module 1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sous A')).toBeInTheDocument()
    expect(screen.getByText('Sous B')).toBeInTheDocument()
    expect(screen.getByText(/10%.*une fois/)).toBeInTheDocument()
    expect(screen.getByText('Total : 250,000 DT')).toBeInTheDocument()
  })

  it('adds a module through the programme endpoint', async () => {
    mockApi.post.mockResolvedValue({ data: { success: true, data: modules[0] } })
    render(<MemoryRouter><Courses /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Consulter Français Débutant/ }))
    await screen.findByText('Programme — modules et sous-modules')

    await userEvent.type(screen.getByLabelText('Nom du nouveau module'), 'Module 2')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un module' }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/courses/1/modules', { name: 'Module 2' })
    })
  })

  it('offers the programme modules when enrolling a student', async () => {
    mockApi.post.mockResolvedValue({ data: { success: true, data: {} } })
    render(<MemoryRouter><Courses /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Consulter Français Débutant/ }))
    const checkbox = await screen.findByLabelText('Inscrire au module Module 1')
    expect(checkbox).toBeInTheDocument()
  })
})
