import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBanner } from './Message'

describe('MessageBanner', () => {
  it('renders the message text', () => {
    render(<MessageBanner message="Game over!" />)
    expect(screen.getByText('Game over!')).toBeDefined()
  })

  it('renders a close button when onClose is provided', () => {
    render(<MessageBanner message="Hello" onClose={vi.fn()} />)
    expect(screen.getByLabelText('Close message')).toBeDefined()
  })

  it('does NOT render a close button when onClose is omitted', () => {
    render(<MessageBanner message="Hello" />)
    expect(screen.queryByLabelText('Close message')).toBeNull()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<MessageBanner message="Hello" onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close message'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('accepts ReactNode as message content', () => {
    render(<MessageBanner message={<strong>Bold message</strong>} />)
    expect(screen.getByText('Bold message')).toBeDefined()
  })

  it('applies extra className to the outer wrapper', () => {
    const { container } = render(
      <MessageBanner message="Hi" className="test-class" />
    )
    expect(container.firstChild).toHaveClass('test-class')
  })
})
