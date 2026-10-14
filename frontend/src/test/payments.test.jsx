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

import Students from '../pages/Students'

const demoStudents = [
  { id: 4, first_name: 'Pierre', last_name: 'Bernard', email: 'student@center.com', phone: '+33600000004', status: 'active', enrollment_date: '2026-10-05' }
]

const submodules = ({ firstPaid = false } = {}) => [
  {
    enrollment_submodule_id: 101,
    submodule_id: 100,
    name: 'Sons et alphabet',
    price_millimes: 120000,
    discount_millimes: 0,
    amount_paid_millimes: firstPaid ? 120000 : 0,
    balance_millimes: firstPaid ? 0 : 120000,
    status: firstPaid ? 'paid' : 'unpaid',
    due_date: null
  },
  {
    enrollment_submodule_id: 102,
    submodule_id: 101,
    name: 'Se présenter',
    price_millimes: 180000,
    discount_millimes: 0,
    amount_paid_millimes: 0,
    balance_millimes: 180000,
    status: 'unpaid',
    due_date: null
  }
]

function buildLedger({ firstPaid = false, payments = [] } = {}) {
  const subs = submodules({ firstPaid })
  const balance = subs.reduce((total, sub) => total + sub.balance_millimes, 0)
  const price = subs.reduce((total, sub) => total + sub.price_millimes, 0)
  const paid = price - balance
  return {
    success: true,
    data: {
      totals: { price_millimes: price, discount_millimes: 0, paid_millimes: paid, balance_millimes: balance },
      enrollments: [
        {
          enrollment_id: 2,
          course_id: 7,
          course_name: 'Français Débutant',
          totals: { price_millimes: price, discount_millimes: 0, paid_millimes: paid, balance_millimes: balance },
          modules: [
            {
              enrollment_module_id: 11,
              module_id: 10,
              module_name: 'Module 1 — Fondations',
              discount_percent: 10,
              status: 'active',
              paid: false,
              submodule_count: 2,
              totals: { price_millimes: price, discount_millimes: 0, paid_millimes: paid, balance_millimes: balance },
              submodules: subs
            }
          ]
        }
      ],
      payments
    }
  }
}

function mockWithLedger(ledger) {
  mockApi.get.mockImplementation((url) => {
    if (url === '/students') return Promise.resolve({ data: demoStudents })
    if (url === '/students/4/ledger') return Promise.resolve({ data: ledger })
    if (url === '/vehicles' || url === '/languages') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: { success: true, data: [] } })
  })
  mockApi.post.mockResolvedValue({ data: { success: true, data: { id: 9 } } })
  mockApi.delete.mockResolvedValue({ data: { success: true, data: { deleted: true } } })
}

async function openFiche() {
  render(<MemoryRouter><Students /></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: /Voir Pierre Bernard/i }))
  await screen.findByText('Module 1 — Fondations')
}

describe('Student payments', () => {
  beforeEach(() => {
    localStorage.clear()
    mockApi.get.mockReset()
    mockApi.post.mockReset()
    mockApi.delete.mockReset()
  })

  it('records a single submodule payment in full', async () => {
    mockWithLedger(buildLedger())
    await openFiche()

    await userEvent.click(screen.getByLabelText('Payer Sons et alphabet'))
    const totalLabel = await screen.findByText('Total à encaisser')
    expect(totalLabel.nextElementSibling).toHaveTextContent('120,000 DT')

    await userEvent.click(screen.getByRole('button', { name: 'Encaisser' }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/students/4/payments', {
        method: 'cash',
        items: [{ enrollmentSubmoduleId: 101 }]
      })
    })
  })

  it('settles a whole clean module with the default discount', async () => {
    mockWithLedger(buildLedger())
    await openFiche()

    await userEvent.click(screen.getByLabelText('Régler le module Module 1 — Fondations'))
    // 300 000 millimes less 10% = 270 000.
    const totalLabel = await screen.findByText('Total à encaisser')
    expect(totalLabel.nextElementSibling).toHaveTextContent('270,000 DT')

    await userEvent.click(screen.getByRole('button', { name: 'Encaisser' }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/students/4/payments', {
        method: 'cash',
        items: [{ enrollmentModuleId: 11, discountPercent: 10 }]
      })
    })
  })

  it('drops the discount on a module that already has a paid submodule', async () => {
    mockWithLedger(buildLedger({ firstPaid: true }))
    await openFiche()

    await userEvent.click(screen.getByLabelText('Régler le module Module 1 — Fondations'))
    expect(await screen.findByText(/module déjà entamé/i)).toBeInTheDocument()
    // Only the second submodule's balance is due: 180 000, at the full price.
    const totalLabel = screen.getByText('Total à encaisser')
    expect(totalLabel.nextElementSibling).toHaveTextContent('180,000 DT')

    await userEvent.click(screen.getByRole('button', { name: 'Encaisser' }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/students/4/payments', {
        method: 'cash',
        items: [{ enrollmentModuleId: 11, discountPercent: 0 }]
      })
    })
  })

  it('voids a payment through the confirmation dialog', async () => {
    mockWithLedger(buildLedger({
      payments: [
        { id: 5, amount_millimes: 120000, method: 'cash', reference: null, paid_at: '2026-10-14T10:00:00.000Z', allocations: [{ id: 1 }] }
      ]
    }))
    await openFiche()

    await userEvent.click(await screen.findByLabelText('Annuler le paiement 5'))
    expect(await screen.findByText('Annuler ce paiement ?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Annuler le paiement' }))

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/payments/5')
    })
  })

  it('links each payment to its printable receipt', async () => {
    mockWithLedger(buildLedger({
      payments: [
        { id: 5, amount_millimes: 120000, method: 'cash', reference: null, paid_at: '2026-10-14T10:00:00.000Z', allocations: [{ id: 1 }] }
      ]
    }))
    await openFiche()

    const link = await screen.findByLabelText('Reçu du paiement 5')
    expect(link).toHaveAttribute('href', '/payments/5/receipt')
  })
})
