import { render, screen, fireEvent } from '@testing-library/react'
import { ModeCard } from '@/components/ModeCard'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ModeCard', () => {
  const onSelect = vi.fn()

  beforeEach(() => onSelect.mockClear())

  it('renders title and description for each mode', () => {
    render(<ModeCard mode="pvp-local" onSelect={onSelect} />)
    expect(screen.getByText('Local Match')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    render(<ModeCard mode="pve" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect on Enter key', () => {
    render(<ModeCard mode="pve" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect on Space key', () => {
    render(<ModeCard mode="pve" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  describe('when disabled', () => {
    it('does not call onSelect when clicked', () => {
      render(<ModeCard mode="pvp-online" onSelect={onSelect} disabled />)
      fireEvent.click(screen.getByRole('button'))
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('does not call onSelect on Enter key', () => {
      render(<ModeCard mode="pvp-online" onSelect={onSelect} disabled />)
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('has tabIndex -1', () => {
      render(<ModeCard mode="pvp-online" onSelect={onSelect} disabled />)
      expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1')
    })

    it('shows "Soon" label', () => {
      render(<ModeCard mode="pvp-online" onSelect={onSelect} disabled />)
      expect(screen.getByText('Soon')).toBeInTheDocument()
    })

    it('applies cursor-not-allowed class', () => {
      render(<ModeCard mode="pvp-online" onSelect={onSelect} disabled />)
    expect(screen.getByRole('button')).toHaveClass('cursor-not-allowed')    })
  })
})