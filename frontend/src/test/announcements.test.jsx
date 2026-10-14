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

import Announcements from '../pages/Announcements'

describe('Announcements page - publication', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/announcements') {
        return Promise.resolve({
          data: [
            { id: 1, title: 'Rentrée', content: 'Bienvenue', author_name: 'Admin User', created_at: '2026-10-10', target_audience: 'all', priority: 'normal' }
          ]
        })
      }
      return Promise.resolve({ data: [] })
    })
    mockApi.post.mockResolvedValue({ data: { message: 'Announcement created successfully', announcementId: 2 } })
    mockApi.delete.mockResolvedValue({ data: {} })
  })

  it('publishes without expiry date and shows it in the list', async () => {
    const user = userEvent.setup()
    render(<Announcements />)

    expect(await screen.findByText('Rentrée')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Nouvelle Annonce/i }))
    await user.type(screen.getByLabelText(/Titre/i), 'Fermeture')
    await user.type(screen.getByLabelText(/Contenu/i), 'Fermé lundi')
    await user.click(screen.getByRole('button', { name: /^Publier$/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/announcements',
        expect.objectContaining({ title: 'Fermeture', content: 'Fermé lundi' })
      )
    })
  })

  it('shows the server error inside the modal instead of failing silently', async () => {
    mockApi.post.mockRejectedValue({
      response: { data: { error: 'Title and content are required' } }
    })
    const user = userEvent.setup()
    render(<Announcements />)

    await user.click(await screen.findByRole('button', { name: /Nouvelle Annonce/i }))
    await user.type(screen.getByLabelText(/Titre/i), 'Brouillon')
    await user.type(screen.getByLabelText(/Contenu/i), 'Texte')
    await user.click(screen.getByRole('button', { name: /^Publier$/i }))

    expect(await screen.findByText('Title and content are required')).toBeInTheDocument()
    // The modal stays open so the saisie is not lost.
    expect(screen.getByRole('button', { name: /^Publier$/i })).toBeInTheDocument()
  })

  it('deletes through a confirmation dialog', async () => {    const user = userEvent.setup()
    render(<Announcements />)

    await user.click(await screen.findByRole('button', { name: /Supprimer Rentrée/i }))
    expect(await screen.findByText(/irréversible/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Supprimer$/i }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/announcements/1')
    })
  })
})
