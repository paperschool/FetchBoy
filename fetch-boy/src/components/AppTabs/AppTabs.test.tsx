import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppTabs } from './AppTabs'
import { useAppTabStore } from '@/stores/appTabStore'

vi.mock('@/components/Intercept/InterceptView', () => ({
  InterceptView: () => <div data-testid="intercept-view">Traffic Intercept Placeholder</div>,
}))

describe('AppTabs', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useAppTabStore.setState({ activeTab: 'client' })
  })

  it('renders "Client" and "Intercept" tab buttons', () => {
    render(<AppTabs><div>client content</div></AppTabs>)
    expect(screen.getByRole('tab', { name: 'Client' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Intercept' })).toBeInTheDocument()
  })

  it('shows client content when Client tab is active', () => {
    render(<AppTabs><div data-testid="client-content">client content</div></AppTabs>)
    const clientPanel = screen.getByTestId('client-panel')
    expect(clientPanel).toBeInTheDocument()
    expect(clientPanel).not.toHaveClass('hidden')
    expect(screen.getByTestId('client-content')).toBeInTheDocument()
  })

  it('shows InterceptView when Intercept tab is clicked', () => {
    render(<AppTabs><div>client content</div></AppTabs>)
    fireEvent.click(screen.getByRole('tab', { name: 'Intercept' }))
    const interceptPanel = screen.getByTestId('intercept-panel')
    expect(interceptPanel).not.toHaveClass('hidden')
    expect(screen.getByTestId('intercept-view')).toBeInTheDocument()
  })

  it('hides client panel (not unmounts) when Intercept tab is active', () => {
    render(<AppTabs><div data-testid="client-content">client content</div></AppTabs>)
    fireEvent.click(screen.getByRole('tab', { name: 'Intercept' }))
    // Client panel is still in the DOM (visibility toggled, NOT unmounted)
    const clientPanel = screen.getByTestId('client-panel')
    expect(clientPanel).toBeInTheDocument()
    expect(clientPanel).toHaveClass('hidden')
    // Client content is still in the DOM
    expect(screen.getByTestId('client-content')).toBeInTheDocument()
  })

  it('shows client content again when Client tab is clicked after switching to Intercept', () => {
    render(<AppTabs><div data-testid="client-content">client content</div></AppTabs>)
    fireEvent.click(screen.getByRole('tab', { name: 'Intercept' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Client' }))
    const clientPanel = screen.getByTestId('client-panel')
    expect(clientPanel).not.toHaveClass('hidden')
  })

  it('marks the active tab with aria-selected', () => {
    render(<AppTabs><div>client content</div></AppTabs>)
    expect(screen.getByRole('tab', { name: 'Client' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Intercept' })).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(screen.getByRole('tab', { name: 'Intercept' }))
    expect(screen.getByRole('tab', { name: 'Client' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Intercept' })).toHaveAttribute('aria-selected', 'true')
  })
})
