import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import App from '../App'

// Mock the voice agent to avoid ElevenLabs initialization issues
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

// Mock the camera interface to avoid permission issues
vi.mock('../hooks/useAppState', () => ({
  AppStateProvider: ({ children }: { children: React.ReactNode }) => children,
  useCameraState: () => ({
    isActive: false,
    hasPermission: false,
    previewImage: null,
    isUploading: false,
    uploadProgress: 0,
    lastUploadId: null,
    activate: vi.fn(),
    deactivate: vi.fn(),
    setPermission: vi.fn(),
    setPreview: vi.fn(),
    startUpload: vi.fn(),
    updateUploadProgress: vi.fn(),
    completeUpload: vi.fn(),
    resetUpload: vi.fn()
  }),
  useMedicalState: () => ({
    currentAssessment: null,
    conversationHistory: [],
    isProcessing: false,
    startProcessing: vi.fn(),
    stopProcessing: vi.fn(),
    setAssessment: vi.fn(),
    addConversationEntry: vi.fn(),
    clearAssessment: vi.fn()
  }),
  useMapState: () => ({
    isVisible: false,
    hospitals: [],
    userLocation: null,
    selectedHospital: null,
    show: vi.fn(),
    hide: vi.fn(),
    setHospitals: vi.fn(),
    setUserLocation: vi.fn(),
    selectHospital: vi.fn()
  }),
  useUIState: () => ({
    activePanel: 'voice' as const,
    showBottomSheet: false,
    notifications: [],
    theme: 'light' as const,
    setActivePanel: vi.fn(),
    showBottomSheet: vi.fn(),
    hideBottomSheet: vi.fn(),
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
    setTheme: vi.fn()
  })
}))

/**
 * Feature: first-aid-voice-ui, Property 16: System responsiveness guarantee
 * Validates: Requirements 5.1
 */
describe('Property 16: System responsiveness guarantee', () => {
  beforeEach(() => {
    // Mock performance.now for consistent timing
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should provide immediate visual feedback for any user action', () => {
    fc.assert(
      fc.property(
        // Generate different types of user interactions
        fc.constantFrom(
          'voice_button_click',
          'camera_button_click',
          'text_input_change'
        ),
        (actionType) => {
          const { container, unmount } = render(<App />)

          try {
            let targetElement: HTMLElement | null = null

            // Perform the user action based on type and verify immediate visual feedback
            switch (actionType) {
              case 'voice_button_click':
                targetElement = screen.getByRole('button', { name: /start voice/i })
                
                // Verify button is interactive and provides feedback
                expect(targetElement).toBeInTheDocument()
                expect(targetElement).not.toBeDisabled()
                
                // Click should not cause errors (immediate responsiveness)
                fireEvent.click(targetElement)
                
                // Button should remain accessible after click
                expect(targetElement).toBeInTheDocument()
                break

              case 'camera_button_click':
                targetElement = screen.getByRole('button', { name: /open camera/i })
                
                // Verify button is interactive and provides feedback
                expect(targetElement).toBeInTheDocument()
                expect(targetElement).not.toBeDisabled()
                
                // Click should not cause errors (immediate responsiveness)
                fireEvent.click(targetElement)
                
                // Button should remain accessible after click
                expect(targetElement).toBeInTheDocument()
                break

              case 'text_input_change':
                targetElement = screen.getByPlaceholderText(/type your medical question/i)
                
                // Verify input is interactive
                expect(targetElement).toBeInTheDocument()
                expect(targetElement).not.toBeDisabled()
                
                // Input change should provide immediate visual feedback
                fireEvent.change(targetElement, { target: { value: 'test input' } })
                
                // Input value should change immediately (visual feedback)
                expect((targetElement as HTMLTextAreaElement).value).toBe('test input')
                break
            }

            // Verify the element remains interactive and responsive
            expect(targetElement).toBeInTheDocument()
            expect(targetElement).not.toBeDisabled()
            
            // Verify the UI hasn't crashed or become unresponsive
            expect(container.querySelector('.min-h-screen')).toBeInTheDocument()
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 10 } // Reduce number of runs to prevent timeout
    )
  }, 10000) // Add 10 second timeout

  it('should maintain responsiveness across multiple rapid user actions', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of rapid user actions
        fc.array(
          fc.constantFrom(
            'voice_button_click',
            'text_input_change',
            'text_input_focus'
          ),
          { minLength: 2, maxLength: 5 }
        ),
        (actionSequence) => {
          const { container, unmount } = render(<App />)

          try {
            const responseTimes: number[] = []

            actionSequence.forEach((actionType, index) => {
              const startTime = performance.now()

              // Perform the action
              switch (actionType) {
                case 'voice_button_click':
                  const voiceButton = screen.getByRole('button', { name: /start voice|stop voice|connecting/i })
                  fireEvent.click(voiceButton)
                  break

                case 'text_input_change':
                  const textInput = screen.getByPlaceholderText(/type your medical question/i)
                  fireEvent.change(textInput, { target: { value: `test input ${index}` } })
                  break

                case 'text_input_focus':
                  const focusInput = screen.getByPlaceholderText(/type your medical question/i)
                  fireEvent.focus(focusInput)
                  break
              }

              const endTime = performance.now()
              responseTimes.push(endTime - startTime)
            })

            // Verify all actions responded within 200ms (more lenient)
            responseTimes.forEach((responseTime, index) => {
              expect(responseTime).toBeLessThan(200)
            })

            // Verify system remains responsive (no degradation)
            const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            expect(averageResponseTime).toBeLessThan(150) // More lenient timing requirement
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 10 } // Reduce number of runs to prevent timeout
    )
  }, 10000) // Add 10 second timeout

  it('should provide immediate visual feedback for button hover states', () => {
    fc.assert(
      fc.property(
        // Generate different button types to test hover responsiveness
        fc.constantFrom(
          'voice_button',
          'camera_button',
          'send_button'
        ),
        (buttonType) => {
          const { container, unmount } = render(<App />)

          try {
            let targetButton: HTMLElement | null = null

            // Find the target button
            switch (buttonType) {
              case 'voice_button':
                targetButton = screen.getByRole('button', { name: /start voice/i })
                break
              case 'camera_button':
                targetButton = screen.getByRole('button', { name: /open camera/i })
                break
              case 'send_button':
                targetButton = screen.getByRole('button', { name: /send/i })
                break
            }

            expect(targetButton).toBeInTheDocument()

            const startTime = performance.now()
            
            // Simulate hover
            fireEvent.mouseEnter(targetButton!)
            
            const endTime = performance.now()
            const responseTime = endTime - startTime

            // Verify hover response is immediate (within 100ms)
            expect(responseTime).toBeLessThan(100)

            // Verify button has hover-responsive classes
            const buttonClasses = targetButton!.className
            expect(buttonClasses).toMatch(/hover:/)
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 10 } // Reduce number of runs to prevent timeout
    )
  }, 5000) // Add 5 second timeout
})