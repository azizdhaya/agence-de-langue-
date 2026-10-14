import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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

import Students from '../pages/Students'

const demoStudents = [
  { id: 4, first_name: 'Pierre', last_name: 'Bernard', email: 'student@center.com', phone: '+33600000004', status: 'active', enrollment_date: '2026-10-05' },
  { id: 5, first_name: 'Sophie', last_name: 'Leroy', email: 'student2@center.com', phone: '+33600000005', status: 'active', enrollment_date: '2026-10-05' }
]

const pierreProfile = {
  id: 1, student_id: 1, language_id: 1, global_level_id: 10,
  listening_level_id: 10, reading_level_id: 10, speaking_level_id: 9, writing_level_id: 10,
  assessment_method: 'placement_test', assessment_score: 68, assessed_at: '2026-10-05',
  global_level_code: 'B1.1', global_level_order: 31,
  listening_level_code: 'B1.1', reading_level_code: 'B1.1',
  speaking_level_code: 'A2.2', writing_level_code: 'B1.1',
  language_code: 'fr', language_name: 'Français', language_flag: '🇫🇷'
}

const backendLanguages = [
  { id: 1, code: 'fr', name: 'Français', flag: '🇫🇷' },
  { id: 2, code: 'en', name: 'Anglais', flag: '🇬🇧' }
]

function mockAll() {
  mockApi.get.mockImplementation((url) => {
    if (url === '/students') return Promise.resolve({ data: demoStudents })
    if (url === '/languages') return Promise.resolve({ data: backendLanguages })
    if (url === '/students/4/languages') {
      return Promise.resolve({ data: { success: true, data: [pierreProfile] } })
    }
    if (url.endsWith('/history') || url.endsWith('/compatible-courses')) {
      return Promise.resolve({ data: { success: true, data: [] } })
    }
    if (url.endsWith('/courses')) return Promise.resolve({ data: [] })
    return Promise.resolve({ data: { success: true, data: [] } })
  })
  mockApi.post.mockResolvedValue({ data: { success: true, data: { id: 7 } } })
}

describe('Students page', () => {
  beforeEach(() => {
    localStorage.clear()
    mockAll()
  })

  it('renders Langue and Niveau CEFR columns from profiles', async () => {
    render(<MemoryRouter><Students /></MemoryRouter>)
    expect(await screen.findByText('Français')).toBeInTheDocument()
    // Badge du tableau + option du filtre niveau
    expect(screen.getAllByText('B1 — Intermédiaire').length).toBeGreaterThanOrEqual(1)
  })

  it('shows a dash when a student has no profile', async () => {
    render(<MemoryRouter><Students /></MemoryRouter>)
    await screen.findByText('Sophie Leroy')
    const row = screen.getByText('Sophie Leroy').closest('tr')
    // Ni langue ni niveau : deux tirets dans la ligne
    const dashes = within(row).getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('searches by phone, language and level', async () => {
    render(<MemoryRouter><Students /></MemoryRouter>)
    await screen.findByText('Pierre Bernard')

    await userEvent.type(screen.getByLabelText('Rechercher un candidat'), '+33600000005')
    expect(screen.queryByText('Pierre Bernard')).not.toBeInTheDocument()
    expect(screen.getByText('Sophie Leroy')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Rechercher un candidat'))
    await userEvent.type(screen.getByLabelText('Rechercher un candidat'), 'français')
    expect(screen.getByText('Pierre Bernard')).toBeInTheDocument()
    expect(screen.queryByText('Sophie Leroy')).not.toBeInTheDocument()
  })

  it('filters by level', async () => {
    render(<MemoryRouter><Students /></MemoryRouter>)
    await screen.findByText('Pierre Bernard')
    await userEvent.selectOptions(screen.getByLabelText('Filtrer par niveau'), 'A2')
    expect(screen.queryByText('Pierre Bernard')).not.toBeInTheDocument()
  })

  it('creates a student then its language profile', async () => {
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
      expect(mockApi.post).toHaveBeenCalledWith('/students', expect.objectContaining({ firstName: 'Nadia' }))
    })
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/students\/\d+\/languages/),
      expect.objectContaining({ languageId: 1, globalLevelCode: 'A1' })
    )
  }, 15000)

  it('opens the fiche with progression, test, skills and group', async () => {
    render(<MemoryRouter><Students /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Voir Pierre Bernard/i }))

    expect(await screen.findByText('Fiche candidat')).toBeInTheDocument()
    expect(screen.getByText('Parcours linguistique')).toBeInTheDocument()
    expect(screen.getByText('Test de positionnement')).toBeInTheDocument()
    expect(screen.getByText('68 / 100')).toBeInTheDocument()
    expect(screen.getByText('Compétences')).toBeInTheDocument()
    expect(screen.getByText('Compréhension orale')).toBeInTheDocument()
    expect(screen.getByText('Groupe')).toBeInTheDocument()
    expect(screen.getByText('Aucun groupe affecté')).toBeInTheDocument()
  })

  it('deletes through a confirmation dialog, not window.confirm', async () => {
    render(<MemoryRouter><Students /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: /Supprimer Pierre Bernard/i }))
    expect(await screen.findByText('Supprimer ce candidat ?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Supprimer$/i }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/students/4')
    })
  })
})


