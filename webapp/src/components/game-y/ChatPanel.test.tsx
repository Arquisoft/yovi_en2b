import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from './ChatPanel'
import type { ChatMessage } from '@/types'

// jsdom does not implement scrollIntoView
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    gameId: 'game-1',
    senderId: 'user-1',
    senderName: 'Alice',
    content: 'Hello!',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

const defaultProps = {
  messages: [] as ChatMessage[],
  currentUserId: 'user-1',
  onSendMessage: vi.fn(),
}

describe('ChatPanel — empty state', () => {
  it('shows "No messages yet" when messages array is empty', () => {
    render(<ChatPanel {...defaultProps} />)
    expect(screen.getByText('No messages yet')).toBeDefined()
  })
})

describe('ChatPanel — message display', () => {
  it('renders message content', () => {
    render(
      <ChatPanel
        {...defaultProps}
        messages={[makeMessage({ content: 'Hello from Alice' })]}
      />
    )
    expect(screen.getByText('Hello from Alice')).toBeDefined()
  })

  it('shows "You" label for own messages', () => {
    render(
      <ChatPanel
        {...defaultProps}
        messages={[makeMessage({ senderId: 'user-1' })]}
      />
    )
    expect(screen.getByText('You')).toBeDefined()
  })

  it('shows sender name for other users\' messages', () => {
    render(
      <ChatPanel
        {...defaultProps}
        messages={[makeMessage({ senderId: 'user-2', senderName: 'Bob' })]}
      />
    )
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('does not show sender label for system messages', () => {
    render(
      <ChatPanel
        {...defaultProps}
        messages={[makeMessage({ senderId: 'system', senderName: 'System', content: 'Game started' })]}
      />
    )
    expect(screen.getByText('Game started')).toBeDefined()
    expect(screen.queryByText('You')).toBeNull()
    expect(screen.queryByText('System')).toBeNull()
  })
})

describe('ChatPanel — message sending', () => {
  it('calls onSendMessage with trimmed content on submit', () => {
    const onSendMessage = vi.fn()
    render(<ChatPanel {...defaultProps} onSendMessage={onSendMessage} />)
    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: '  hi there  ' } })
    fireEvent.submit(input.closest('form')!)
    expect(onSendMessage).toHaveBeenCalledWith('hi there')
  })

  it('clears the input after sending', () => {
    render(<ChatPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.submit(input.closest('form')!)
    expect(input.value).toBe('')
  })

  it('does NOT call onSendMessage for whitespace-only input', () => {
    const onSendMessage = vi.fn()
    render(<ChatPanel {...defaultProps} onSendMessage={onSendMessage} />)
    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatPanel {...defaultProps} />)
    const button = screen.getByRole('button', { name: '' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})

describe('ChatPanel — collapsible mode', () => {
  it('shows collapse button when isCollapsible is true', () => {
    render(<ChatPanel {...defaultProps} isCollapsible={true} />)
    // collapse button exists (ChevronDown)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(1) // collapse button + send button
  })

  it('does NOT show collapse button when isCollapsible is false', () => {
    render(<ChatPanel {...defaultProps} isCollapsible={false} />)
    // Only the send button should be present
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(1)
  })

  it('collapses to a button when the chevron is clicked', () => {
    render(<ChatPanel {...defaultProps} isCollapsible={true} />)
    // Find the collapse button (not the send button)
    const allButtons = screen.getAllByRole('button')
    const collapseBtn = allButtons.find((b) => b.querySelector('svg'))!
    // Click the collapse button (first one with SVG but not submit)
    // The header collapse button is the one without disabled state
    const headerBtn = allButtons.find((b) => !b.hasAttribute('type'))
    if (headerBtn) fireEvent.click(headerBtn)
    // After collapse, should show a single "Chat" toggle button
    expect(screen.getByText('Chat')).toBeDefined()
  })

  it('shows message count badge when collapsed with messages', () => {
    render(
      <ChatPanel
        {...defaultProps}
        isCollapsible={true}
        messages={[makeMessage(), makeMessage({ id: 'msg-2' })]}
      />
    )
    // Collapse first
    const allButtons = screen.getAllByRole('button')
    const headerBtn = allButtons.find((b) => !b.hasAttribute('type'))
    if (headerBtn) fireEvent.click(headerBtn)
    // Badge with count should appear
    expect(screen.getByText('2')).toBeDefined()
  })

  it('expands back when the collapsed button is clicked', () => {
    render(<ChatPanel {...defaultProps} isCollapsible={true} />)
    const allButtons = screen.getAllByRole('button')
    const headerBtn = allButtons.find((b) => !b.hasAttribute('type'))
    if (headerBtn) fireEvent.click(headerBtn) // collapse
    // Now click the single button to expand
    fireEvent.click(screen.getByRole('button'))
    // Input should be visible again
    expect(screen.getByPlaceholderText('Type a message...')).toBeDefined()
  })
})
