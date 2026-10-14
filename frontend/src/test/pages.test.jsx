import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// vi.mock factories are hoisted above imports, so the mocked modules must be
// created with vi.hoisted() to be referenced safely inside the factories.
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

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

import Languages from '../pages/Languages'
import Levels from '../pages/Levels'
import Skills from '../pages/Skills'
import Notifications from '../pages/Notifications'
import VerifyCertificate from '../pages/VerifyCertificate'

describe('Languages page (démo locale)', () => {
  it('renders the page title and subtitle', () => {
    render(<Languages />)
    expect(screen.getByText('Langues')).toBeInTheDocument()
    expect(screen.getByText('Gérez les langues proposées par le centre.')).toBeInTheDocument()
  })

  it('renders the demo languages with codes and level counts', () => {
    render(<Languages />)
    expect(screen.getByText('Anglais')).toBeInTheDocument()
    expect(screen.getByText('EN')).toBeInTheDocument()
    expect(screen.getByText('Français')).toBeInTheDocument()
    // Anglais a 6 niveaux rattachés
    expect(screen.getAllByText('6').length).toBeGreaterThan(0)
  })

  it('filters languages by search', async () => {
    render(<Languages />)
    await userEvent.type(screen.getByLabelText('Rechercher une langue'), 'ital')
    expect(screen.getByText('Italien')).toBeInTheDocument()
    expect(screen.queryByText('Anglais')).not.toBeInTheDocument()
  })

  it('filters languages by status', async () => {
    render(<Languages />)
    await userEvent.selectOptions(screen.getByLabelText('Filtrer par statut'), 'inactive')
    expect(screen.getByText('Italien')).toBeInTheDocument()
    expect(screen.queryByText('Anglais')).not.toBeInTheDocument()
  })

  it('adds a language through the modal', async () => {
    render(<Languages />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une langue/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nom de la langue'), 'Portugais')
    await userEvent.type(screen.getByLabelText('Code de la langue'), 'PT')
    await userEvent.click(screen.getByRole('button', { name: /^Enregistrer$/i }))

    expect(await screen.findByText('Portugais')).toBeInTheDocument()
  })

  it('toggles a language status', async () => {
    render(<Languages />)
    const toggle = await screen.findByRole('button', { name: /Désactiver Anglais/i })
    await userEvent.click(toggle)
    expect(await screen.findByRole('button', { name: /Activer Anglais/i })).toBeInTheDocument()
  })

  it('deletes a language after confirmation', async () => {
    render(<Languages />)
    // Italien n'a aucun niveau : suppression autorisée
    await userEvent.click(await screen.findByRole('button', { name: /Supprimer Italien/i }))
    await userEvent.click(await screen.findByRole('button', { name: /^Supprimer$/i }))
    await waitFor(() => {
      expect(screen.queryByText('Italien')).not.toBeInTheDocument()
    })
  })

  it('blocks deleting a language that has levels', async () => {
    render(<Languages />)
    await userEvent.click(await screen.findByRole('button', { name: /Supprimer Anglais/i }))
    await userEvent.click(await screen.findByRole('button', { name: /^Supprimer$/i }))
    expect(await screen.findByText(/Impossible de supprimer/)).toBeInTheDocument()
    expect(screen.getByText('Anglais')).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    render(<Languages />)
    await userEvent.type(screen.getByLabelText('Rechercher une langue'), 'zzz')
    expect(await screen.findByText('Aucune langue trouvée')).toBeInTheDocument()
  })

  it('persists changes across a refresh', async () => {
    const { unmount } = render(<Languages />)
    await userEvent.click(await screen.findByRole('button', { name: /Désactiver Anglais/i }))
    expect(await screen.findByRole('button', { name: /Activer Anglais/i })).toBeInTheDocument()
    // Refresh simulé : la page se remonte et relit le stockage local
    unmount()
    render(<Languages />)
    expect(await screen.findByRole('button', { name: /Activer Anglais/i })).toBeInTheDocument()
  }, 15000)
})

describe('Levels page (démo locale)', () => {
  it('renders the page title and subtitle', () => {
    render(<Levels />)
    expect(screen.getByText('Niveaux')).toBeInTheDocument()
    expect(screen.getByText('Gérez les niveaux disponibles pour chaque langue.')).toBeInTheDocument()
  })

  it('renders demo levels with their language', () => {
    render(<Levels />)
    // Chaque description existe une fois par langue (4 langues)
    expect(screen.getAllByText('Débutant').length).toBe(4)
    expect(screen.getAllByText('Anglais').length).toBeGreaterThan(0)
  })

  it('filters levels by language', async () => {
    render(<Levels />)
    await userEvent.selectOptions(screen.getByLabelText('Filtrer par langue'), '3')
    expect(screen.getAllByText('Allemand').length).toBeGreaterThan(0)
    // « Espagnol » ne doit rester que dans le <option> du filtre, plus dans le tableau
    const remaining = screen.queryAllByText('Espagnol')
    expect(remaining.length).toBeGreaterThan(0)
    expect(remaining.every((el) => el.tagName === 'OPTION')).toBe(true)
  })

  it('filters levels by search', async () => {
    render(<Levels />)
    await userEvent.type(screen.getByLabelText('Rechercher un niveau'), 'C2')
    expect(screen.getAllByText('C2').length).toBeGreaterThan(0)
    expect(screen.queryByText('Débutant')).not.toBeInTheDocument()
  })

  it('adds a level through the modal', async () => {
    render(<Levels />)
    await userEvent.click(screen.getByRole('button', { name: /Ajouter un niveau/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Niveau'), 'A0')
    await userEvent.selectOptions(screen.getByLabelText('Langue'), '1')
    await userEvent.type(screen.getByLabelText('Description'), 'Découverte')
    await userEvent.type(screen.getByLabelText('Ordre'), '0')
    await userEvent.click(screen.getByRole('button', { name: /^Enregistrer$/i }))

    // Ordre 0 refusé : la modale reste ouverte avec un message
    expect(await screen.findByText(/nombre entier positif/)).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Ordre'))
    await userEvent.type(screen.getByLabelText('Ordre'), '7')
    await userEvent.click(screen.getByRole('button', { name: /^Enregistrer$/i }))

    expect(await screen.findByText('A0')).toBeInTheDocument()
  }, 15000)

  it('toggles a level status', async () => {
    render(<Levels />)
    const toggles = await screen.findAllByRole('button', { name: /Désactiver le niveau A1$/i })
    await userEvent.click(toggles[0])
    expect(await screen.findAllByRole('button', { name: /Activer le niveau A1$/i })).not.toHaveLength(0)
  })

  it('deletes a level after confirmation', async () => {
    render(<Levels />)
    expect(screen.getAllByText('Maîtrise')).toHaveLength(4)
    const deletes = await screen.findAllByRole('button', { name: /Supprimer le niveau C2$/i })
    await userEvent.click(deletes[deletes.length - 1])
    await userEvent.click(await screen.findByRole('button', { name: /^Supprimer$/i }))
    await waitFor(() => {
      expect(screen.getAllByText('Maîtrise')).toHaveLength(3)
    })
  })

  it('hides levels whose language is inactive', async () => {
    // Cas réel : des niveaux créés avant la désactivation de leur langue
    // (données déjà en stockage local). Ils restent masqués avec une note.
    const stored = {
      languages: [
        { id: 1, name: 'Anglais', code: 'EN', flag: '🇬🇧', description: '', isActive: true },
        { id: 4, name: 'Italien', code: 'IT', flag: '🇮🇹', description: '', isActive: false }
      ],
      levels: [
        { id: 1, code: 'A1', languageId: 1, name: 'Débutant', description: 'Débutant', order: 1, isActive: true },
        { id: 2, code: 'A1', languageId: 4, name: 'Principiante', description: 'Principiante', order: 1, isActive: true }
      ]
    }
    localStorage.setItem('demo.administration.v1', JSON.stringify(stored))
    render(<Levels />)
    expect(await screen.findByText('Débutant')).toBeInTheDocument()
    expect(screen.queryByText('Principiante')).not.toBeInTheDocument()
    expect(screen.getByText(/1 niveau masqué/)).toBeInTheDocument()
  }, 15000)

  it('shows an empty state when nothing matches', async () => {
    render(<Levels />)
    await userEvent.type(screen.getByLabelText('Rechercher un niveau'), 'zzz')
    expect(await screen.findByText('Aucun niveau trouvé')).toBeInTheDocument()
  })

  it('only offers active languages in filters and creation', async () => {
    render(<Levels />)
    // Le filtre « Toutes les langues » ne propose pas l'italien (inactif)
    const filterOptions = screen.getByLabelText('Filtrer par langue').querySelectorAll('option')
    const filterLabels = [...filterOptions].map((o) => o.textContent)
    expect(filterLabels).not.toContain('Italien')
    expect(filterLabels).toContain('Anglais')

    await userEvent.click(screen.getByRole('button', { name: /Ajouter un niveau/i }))
    const langOptions = screen.getByLabelText('Langue').querySelectorAll('option')
    const langLabels = [...langOptions].map((o) => o.textContent)
    expect(langLabels).not.toContain('Italien')
  })
})

describe('Skills page', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({
      data: {
        success: true,
        data: [{ id: 1, code: 'listening', name: 'Listening', description: 'Compréhension orale', isActive: 1 }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
      }
    })
  })

  it('renders the skills page', async () => {
    render(<Skills />)
    expect(await screen.findByText('Compétences')).toBeInTheDocument()
    expect(screen.getByText('listening')).toBeInTheDocument()
  })

  it('asks for confirmation before deleting', async () => {
    render(<Skills />)
    await userEvent.click(await screen.findByRole('button', { name: /Supprimer 1/i }))
    expect(await screen.findByText('Supprimer cet élément ?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Supprimer$/i }))
    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/skills/1')
    })
  })

  it('cancelling the dialog deletes nothing', async () => {
    render(<Skills />)
    await userEvent.click(await screen.findByRole('button', { name: /Supprimer 1/i }))
    await userEvent.click(await screen.findByText('Supprimer cet élément ?'))
    await userEvent.click(screen.getByRole('button', { name: /^Annuler$/i }))

    await waitFor(() => {
      expect(screen.queryByText('Supprimer cet élément ?')).not.toBeInTheDocument()
    })
    expect(mockApi.delete).not.toHaveBeenCalled()
  })
})

describe('Notifications page', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({
      data: {
        success: true,
        unreadCount: 2,
        data: [
          { id: 1, title: 'Bienvenue', message: 'Bienvenue !', type: 'success', isRead: 0, createdAt: '2024-01-01T10:00:00Z' },
          { id: 2, title: 'Rappel', message: 'Cours demain', type: 'info', isRead: 0, createdAt: '2024-01-02T10:00:00Z' }
        ]
      }
    })
  })

  it('renders unread count', async () => {
    render(<Notifications />)
    expect(await screen.findByText('2 non lue(s)')).toBeInTheDocument()
  })

  it('renders notifications', async () => {
    render(<Notifications />)
    expect(await screen.findByText('Bienvenue')).toBeInTheDocument()
    expect(screen.getByText('Rappel')).toBeInTheDocument()
  })

  it('shows the mark-all-read button when there are unread items', async () => {
    render(<Notifications />)
    expect(await screen.findByRole('button', { name: /Tout marquer comme lu/i })).toBeInTheDocument()
  })

  it('calls read-all endpoint', async () => {
    mockApi.put.mockResolvedValue({ data: { updated: 2 } })
    render(<Notifications />)

    const button = await screen.findByRole('button', { name: /Tout marquer comme lu/i })
    await userEvent.click(button)

    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith('/notifications/read-all')
    })
  })

  it('renders empty state when no notifications', async () => {
    mockApi.get.mockResolvedValue({ data: { success: true, unreadCount: 0, data: [] } })
    render(<Notifications />)
    expect(await screen.findByText('Aucune notification')).toBeInTheDocument()
  })
})

describe('VerifyCertificate page', () => {
  it('renders the verification heading', () => {
    render(<VerifyCertificate />)
    expect(screen.getByText('Vérification de certificat')).toBeInTheDocument()
  })

  it('shows a success message for a valid certificate', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 1,
          certificateNumber: 'CERT-2024-001',
          studentName: 'Pierre Bernard',
          level: 'B1',
          score: 85,
          issueDate: '2024-01-01'
        }
      }
    })

    render(<VerifyCertificate />)
    await userEvent.type(screen.getByLabelText('Numéro de certificat'), 'CERT-2024-001')
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByText('Certificat authentique')).toBeInTheDocument()
    expect(screen.getByText('Pierre Bernard')).toBeInTheDocument()
    expect(screen.getByText('B1')).toBeInTheDocument()
  })

  it('shows an error message for an unknown certificate', async () => {
    mockApi.get.mockRejectedValue({
      response: { status: 404, data: { error: { message: 'Certificate not found' } } }
    })

    render(<VerifyCertificate />)
    await userEvent.type(screen.getByLabelText('Numéro de certificat'), 'INVALID')
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByText('Certificat non valide')).toBeInTheDocument()
    expect(screen.getByText('Certificate not found')).toBeInTheDocument()
  })

  it('falls back to a default message on network failure', async () => {
    mockApi.get.mockRejectedValue({ response: {} })

    render(<VerifyCertificate />)
    await userEvent.type(screen.getByLabelText('Numéro de certificat'), 'X')
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByText('Erreur de vérification')).toBeInTheDocument()
  })
})