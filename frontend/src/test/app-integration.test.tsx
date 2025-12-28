import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from '../App'

// Mock the voice agent
vi.mock('../hooks/useVoiceAgent', () => ({
  useVoiceAgent: () => ({
    isActive: false,
    isListening: false,
    isProcessing: false,
    currentTranscription: '',
    audioLevel: 0,
    connectionStatus: 'disconnected',
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined)
  })
}))

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render the main app without errors', () => {
    const { container } = render(<App />)
    
    // Check if the app renders without showing error boundary
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('should render all main components', () => {
    render(<App />)
    
    // Check for main sections
    expect(screen.getByText('FirstAidVox')).toBeInTheDocument()
    expect(screen.getByText('Voice Assistant')).toBeInTheDocument()
    expect(screen.getByText('Photo Capture')).toBeInTheDocument()
  })
})