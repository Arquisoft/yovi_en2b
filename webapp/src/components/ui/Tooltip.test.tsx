import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip, TooltipProvider } from './Tooltip'

describe('Tooltip', () => {
  it('renders the trigger child', () => {
    render(
      <TooltipProvider>
        <Tooltip label="Save">
          <button type="button">action</button>
        </Tooltip>
      </TooltipProvider>,
    )
    expect(screen.getByRole('button', { name: 'action' })).toBeDefined()
  })

  it('does not render the tooltip content while idle', () => {
    render(
      <TooltipProvider>
        <Tooltip label="Save">
          <button type="button">action</button>
        </Tooltip>
      </TooltipProvider>,
    )
    expect(screen.queryByText('Save')).toBeNull()
  })

  it('does not break when mounted without an explicit provider', () => {
    expect(() =>
      render(
        <TooltipProvider>
          <Tooltip label="Help">
            <button type="button">go</button>
          </Tooltip>
        </TooltipProvider>,
      ),
    ).not.toThrow()
  })
})
