import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileGameDrawer } from './MobileGameDrawer'

beforeEach(() => {
  // Stub PointerEvent capture API not implemented in JSDOM.
  Element.prototype.setPointerCapture = function () {}
  Element.prototype.releasePointerCapture = function () {}
  Element.prototype.hasPointerCapture = function () { return false }

  // JSDOM ships no PointerEvent class. fireEvent.pointer* falls back to the base
  // Event constructor which drops clientY/pointerId, so we shim it from MouseEvent.
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventShim extends MouseEvent {
      pointerId: number
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
      }
    }
    ;(window as unknown as { PointerEvent: typeof PointerEventShim }).PointerEvent = PointerEventShim
  }
})

function getDrawer(): HTMLElement {
  return screen.getByTestId('mobile-game-drawer')
}

function getHandle(): HTMLButtonElement {
  return screen.getByRole('button')
}

type PointerHandler = 'pointerDown' | 'pointerMove' | 'pointerUp'

function pointer(target: HTMLElement, kind: PointerHandler, clientY: number) {
  fireEvent[kind](target, { clientY, pointerId: 1, bubbles: true })
}

describe('MobileGameDrawer', () => {
  it('renders children inside the drawer', () => {
    render(
      <MobileGameDrawer>
        <p>panel content</p>
      </MobileGameDrawer>,
    )
    expect(screen.getByText('panel content')).toBeDefined()
  })

  it('starts open by default', () => {
    render(
      <MobileGameDrawer>
        <p>x</p>
      </MobileGameDrawer>,
    )
    expect(getDrawer().getAttribute('data-open')).toBe('true')
  })

  it('collapses to handle-only height on tap', () => {
    render(
      <MobileGameDrawer>
        <p>x</p>
      </MobileGameDrawer>,
    )
    const handle = getHandle()
    pointer(handle, "pointerDown", 200)
    pointer(handle, "pointerUp", 200)
    expect(getDrawer().getAttribute('data-open')).toBe('false')
  })

  it('reopens to default height on second tap', () => {
    render(
      <MobileGameDrawer>
        <p>x</p>
      </MobileGameDrawer>,
    )
    const handle = getHandle()
    pointer(handle, "pointerDown", 200)
    pointer(handle, "pointerUp", 200)
    pointer(handle, "pointerDown", 200)
    pointer(handle, "pointerUp", 200)
    expect(getDrawer().getAttribute('data-open')).toBe('true')
  })

  it('drags down past threshold collapses the drawer', () => {
    render(
      <MobileGameDrawer>
        <p>x</p>
      </MobileGameDrawer>,
    )
    const handle = getHandle()
    pointer(handle, "pointerDown", 100)
    pointer(handle, "pointerMove", 600)
    pointer(handle, "pointerUp", 600)
    expect(getDrawer().getAttribute('data-open')).toBe('false')
  })

  it('does not toggle when the user actually drags', () => {
    render(
      <MobileGameDrawer>
        <p>x</p>
      </MobileGameDrawer>,
    )
    const handle = getHandle()
    // Drag a bit but not enough to cross collapse snap, drawer stays open
    pointer(handle, "pointerDown", 100)
    pointer(handle, "pointerMove", 80)
    pointer(handle, "pointerUp", 80)
    expect(getDrawer().getAttribute('data-open')).toBe('true')
  })

  it('handle aria-expanded matches the open state', () => {
    render(
      <MobileGameDrawer>
        <p>x</p>
      </MobileGameDrawer>,
    )
    const handle = getHandle()
    expect(handle.getAttribute('aria-expanded')).toBe('true')
    pointer(handle, "pointerDown", 200)
    pointer(handle, "pointerUp", 200)
    expect(handle.getAttribute('aria-expanded')).toBe('false')
  })

  it('hides children from interaction when collapsed', () => {
    render(
      <MobileGameDrawer>
        <p>x</p>
      </MobileGameDrawer>,
    )
    const handle = getHandle()
    pointer(handle, "pointerDown", 200)
    pointer(handle, "pointerUp", 200)
    const childWrapper = screen.getByText('x').parentElement!
    expect(childWrapper.className).toContain('pointer-events-none')
  })
})
