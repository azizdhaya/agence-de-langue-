import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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

import Teachers from '../pages/Teachers'
import Students from '../pages/Students'

const emptyList = { data: [] }

describe('Teachers page — création', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue(emptyList)
    mockApi.post.mockResolvedValue({ data: { success: true, data: { id: 9 } } })
  })

  it('creates a teacher with password and no empty optionals', async () => {
    render(<Teachers />)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau Professeur/i }))

    await userEvent.type(screen.getByLabelText('Prénom'), 'Sonia')
    await userEvent.type(screen.getByLabelText('Nom'), 'Test')
    await userEvent.type(screen.getByLabelText('Email'), 'sonia@test.com')
    await userEvent.type(screen.getByLabelText('Mot de passe initial'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/teachers',
        expect.objectContaining({
          firstName: 'Sonia', lastName: 'Test',
          email: 'sonia@test.com', password: 'secret123'
        })
      )
    })
    const payload = mockApi.post.mock.calls[0][1]
    expect(payload.phone).toBeUndefined()
    expect(payload.specialization).toBeUndefined()
  }, 15000)

  it('shows the server error when creation fails', async () => {
    mockApi.post.mockRejectedValue({
      response: { data: { error: { message: 'Cet email est déjà utilisé' } } }
    })
    render(<Teachers />)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau Professeur/i }))
    await userEvent.type(screen.getByLabelText('Prénom'), 'A')
    await userEvent.type(screen.getByLabelText('Nom'), 'B')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Mot de passe initial'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/i }))

    expect(await screen.findByText('Cet email est déjà utilisé')).toBeInTheDocument()
  }, 15000)
})

describe('Students page — création', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/languages') {
        return Promise.resolve({
          data: [{ id: 1, code: 'fr', name: 'Français', flag: '🇫🇷' }]
        })
      }
      return Promise.resolve(emptyList)
    })
    mockApi.post.mockResolvedValue({ data: { success: true, data: { id: 9 } } })
  })

  it('creates a student with password and no empty optionals', async () => {
    render(<MemoryRouter><Students /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau Candidat/i }))

    await userEvent.type(screen.getByLabelText('Prénom *'), 'Nadia')
    await userEvent.type(screen.getByLabelText('Nom *'), 'Test')
    await userEvent.type(screen.getByLabelText('Email *'), 'nadia@test.com')
    await userEvent.type(screen.getByLabelText('Mot de passe initial *'), 'secret123')
    await userEvent.selectOptions(screen.getByLabelText('Langue *'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Niveau *'), 'A1')
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/students',
        expect.objectContaining({ firstName: 'Nadia', password: 'secret123' })
      )
    })
    const payload = mockApi.post.mock.calls[0][1]
    expect(payload.phone).toBeUndefined()
    expect(payload.address).toBeUndefined()
  }, 15000)

  it('shows the server error when creation fails', async () => {
    mockApi.post.mockRejectedValue({
      response: { data: { error: { message: 'Cet email est déjà utilisé' } } }
    })
    render(<MemoryRouter><Students /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Nouveau Candidat/i }))
    await userEvent.type(screen.getByLabelText('Prénom *'), 'A')
    await userEvent.type(screen.getByLabelText('Nom *'), 'B')
    await userEvent.type(screen.getByLabelText('Email *'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Mot de passe initial *'), 'secret123')
    await userEvent.selectOptions(screen.getByLabelText('Langue *'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Niveau *'), 'A1')
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/i }))

    expect(await screen.findByText('Cet email est déjà utilisé')).toBeInTheDocument()
  }, 15000)
})

