import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotFoundPage } from '@/pages/NotFoundPage'

function renderPage() {
  return render(<MemoryRouter><NotFoundPage /></MemoryRouter>)
}

describe('NotFoundPage', () => {
  it('renders the 404 heading', () => {
    renderPage()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders the page not found message', () => {
    renderPage()
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('renders a link back to the games page', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /back to games/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/games')
  })
})
