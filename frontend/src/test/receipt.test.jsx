import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

vi.mock('../utils/api', () => ({ default: mockApi }))

import PaymentReceipt from '../pages/PaymentReceipt'

const payment = {
  id: 5,
  amount_millimes: 150000,
  method: 'cash',
  reference: 'RECU-1',
  paid_at: '2026-11-03T10:00:00.000Z',
  student_name: 'Pierre Bernard',
  student_email: 'pierre@center.com',
  recorded_by_name: 'Admin User',
  allocations: [
    {
      id: 1,
      course_name: 'Blocage Test Langue',
      module_name: 'Module Blocage',
      submodule_name: 'Sous Blocage',
      amount_millimes: 150000
    }
  ]
}

function renderReceipt() {
  return render(
    <MemoryRouter initialEntries={['/payments/5/receipt']}>
      <Routes>
        <Route path="/payments/:id/receipt" element={<PaymentReceipt />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Payment receipt', () => {
  beforeEach(() => {
    mockApi.get.mockReset()
  })

  it('renders the receipt with its allocated lines and total', async () => {
    mockApi.get.mockResolvedValue({ data: { success: true, data: payment } })
    renderReceipt()

    expect(await screen.findByText('Reçu n° 00005')).toBeInTheDocument()
    expect(screen.getByText('Pierre Bernard')).toBeInTheDocument()
    expect(screen.getByText('Sous Blocage')).toBeInTheDocument()
    expect(screen.getByText('Module Blocage')).toBeInTheDocument()
    // Amount appears in the line and in the total.
    expect(screen.getAllByText('150,000 DT').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Imprimer/i })).toBeInTheDocument()
    expect(mockApi.get).toHaveBeenCalledWith('/payments/5')
  })

  it('shows a fallback when the receipt cannot be loaded', async () => {
    mockApi.get.mockRejectedValue({ response: { data: { error: { message: 'Reçu introuvable' } } } })
    renderReceipt()

    expect(await screen.findByText('Reçu introuvable')).toBeInTheDocument()
  })
})
