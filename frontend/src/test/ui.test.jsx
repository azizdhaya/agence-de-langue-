import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('updates value on change', async () => {
    const onChange = vi.fn()
    render(<Input label="Email" onChange={onChange} />)
    const input = screen.getByLabelText('Email')
    await userEvent.type(input, 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('displays error message', () => {
    render(<Input label="Email" error="Email invalide" />)
    expect(screen.getByText('Email invalide')).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Actif</Badge>)
    expect(screen.getByText('Actif')).toBeInTheDocument()
  })

  it('renders success variant', () => {
    render(<Badge variant="success">OK</Badge>)
    const badge = screen.getByText('OK')
    expect(badge).toHaveClass('bg-green-100')
  })
})

describe('Modal', () => {
  const fields = [
    { name: 'code', label: 'Code', required: true },
    { name: 'name', label: 'Nom', required: true }
  ]

  it('renders title and fields', () => {
    render(
      <Modal
        title="Nouvelle langue"
        fields={fields}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Nouvelle langue')).toBeInTheDocument()
    expect(screen.getByLabelText('Code')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toBeInTheDocument()
  })

  it('calls onSubmit with values when form is valid', async () => {
    const onSubmit = vi.fn()
    render(
      <Modal title="Test" fields={fields} onClose={vi.fn()} onSubmit={onSubmit} />
    )

    await userEvent.type(screen.getByLabelText('Code'), 'fr')
    await userEvent.type(screen.getByLabelText('Nom'), 'Français')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ code: 'fr', name: 'Français' }))
  })

  it('shows error when required field is empty', async () => {
    const onSubmit = vi.fn()
    render(
      <Modal title="Test" fields={fields} onClose={vi.fn()} onSubmit={onSubmit} />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByText('Ce champ est requis').length).toBeGreaterThan(0)
  })

  it('closes on Escape key', async () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" fields={fields} onClose={onClose} onSubmit={vi.fn()} />
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Pagination', () => {
  it('renders page info', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    )
    // Page 2 of 5, 10 per page => items 11..20 shown out of 50.
    // The text is split across text nodes and <span>s, so match the wrapper div.
    const info = screen.getByText((_, el) =>
      el?.className === 'text-sm text-gray-700' &&
      /Affichage de\s*11\s*à\s*20\s*sur\s*50\s*résultats/.test(el.textContent)
    )
    expect(info).toBeInTheDocument()
  })

  it('calls onPageChange with next page', async () => {
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={onPageChange}
      />
    )
    // Click the next arrow (second chevron button)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[buttons.length - 1])
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('disables prev button on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()
  })
})
