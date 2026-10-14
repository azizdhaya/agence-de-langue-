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

const mockSocket = { emit: vi.fn(), on: vi.fn(), disconnect: vi.fn() }
vi.mock('socket.io-client', () => ({
  io: () => mockSocket
}))

import Messages from '../pages/Messages'

const conversations = [
  {
    contact_id: 2, contact_name: 'Marie Dupont', contact_role: 'teacher',
    last_message: 'Bonjour, à demain', last_message_time: '2026-10-06T10:00:00',
    unread_count: 2
  },
  {
    contact_id: 4, contact_name: 'Pierre Bernard', contact_role: 'student',
    last_message: 'Merci !', last_message_time: '2026-10-05T09:00:00',
    unread_count: 0
  }
]

describe('Messages page', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/messages/conversations') return Promise.resolve({ data: conversations })
      if (url === '/messages/contacts/all') {
        return Promise.resolve({
          data: [
            { id: 2, name: 'Marie Dupont', role: 'teacher' },
            { id: 4, name: 'Pierre Bernard', role: 'student' }
          ]
        })
      }
      return Promise.resolve({ data: [] })
    })
  })

  it('renders the conversation list with unread counts', async () => {
    render(<Messages />)
    expect(await screen.findByText('Marie Dupont')).toBeInTheDocument()
    expect(screen.getByText('Bonjour, à demain')).toBeInTheDocument()
    expect(screen.getByText('Pierre Bernard')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('opens a conversation and sends a message', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/messages/conversations') return Promise.resolve({ data: conversations })
      if (url === '/messages/contacts/all') return Promise.resolve({ data: [] })
      if (url === '/messages/2') {
        return Promise.resolve({ data: [{ id: 1, sender_id: 2, content: 'Bonjour, à demain' }] })
      }
      return Promise.resolve({ data: [] })
    })
    mockApi.post.mockResolvedValue({ data: { id: 99 } })

    const { container } = render(<Messages />)
    await userEvent.click(await screen.findByRole('button', { name: /Marie Dupont/ }))
    // Visible à la fois dans la liste et dans la conversation ouverte.
    expect(await screen.findAllByText('Bonjour, à demain')).not.toHaveLength(0)

    const input = screen.getByPlaceholderText(/Écrivez votre message/)
    await userEvent.type(input, 'Bien reçu, merci')
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le message/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/messages',
        expect.objectContaining({ receiverId: 2, content: 'Bien reçu, merci' })
      )
    })
  }, 15000)

  it('shows an empty state when there are no conversations', async () => {
    mockApi.get.mockResolvedValue({ data: [] })
    render(<Messages />)
    await waitFor(() => {
      expect(screen.queryByText('Marie Dupont')).not.toBeInTheDocument()
    })
  })

  it('starts a new conversation from the contacts list', async () => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/messages/conversations') return Promise.resolve({ data: [] })
      if (url === '/messages/contacts/all') {
        return Promise.resolve({
          data: [{ id: 4, name: 'Pierre Bernard', role: 'student' }]
        })
      }
      if (url === '/messages/4') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    mockApi.post.mockResolvedValue({ data: { id: 99 } })

    render(<Messages />)

    // Sans conversation, les contacts sont proposés directement.
    await userEvent.click(await screen.findByRole('button', { name: /Pierre Bernard/ }))
    expect(await screen.findByPlaceholderText(/crivez votre message/)).toBeInTheDocument()

    const input = screen.getByPlaceholderText(/crivez votre message/)
    await userEvent.type(input, 'Bienvenue !')
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le message/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/messages',
        expect.objectContaining({ receiverId: 4, content: 'Bienvenue !' })
      )
    })
  })

  it('opens the contact picker with the + button', async () => {
    render(<Messages />)
    await screen.findByText('Marie Dupont')

    await userEvent.click(screen.getByRole('button', { name: /Nouvelle conversation/i }))
    expect(await screen.findByText('Nouveau contact')).toBeInTheDocument()
  })
})
