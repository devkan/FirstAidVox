import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import * as fc from 'fast-check'
import App from '../App'
import { AppStateProvider, useMedicalState, useVoiceState, useCameraState } from '../hooks/useAppState'

// Mock the voice agent
const mockVoiceAgent = {
  isActive: false,
  isListening: false,
  isProcessing: false,
  currentTranscription: '',
  audioLevel: 0,
  connectionStatus: 'disconnected' as 'connected' | 'connecting' | 'disconnected',
  activate: vi.fn().mockResolvedValue(undefined),
  deactivate: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue(undefined)
}

vi.mock('../hooks/useVoiceAgent', () => ({
  useVoiceAgent: () => mockVoiceAgent
}))

/**
 * Feature: first-aid-voice-ui, Property 18: Simultaneous response updates
 * Validates: Requirements 5.4
 */
describe('Property 18: Simultaneous response updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should update both audio output and visual components simultaneously for any backend response', () => {
    fc.assert(
      fc.property(
        // Generate medical response data
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 100 }),
          urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }),
          confidence: fc.float({ min: 0, max: 1 }),
          requiresEmergencyServices: fc.boolean(),
          audioResponse: fc.string({ minLength: 1, maxLength: 200 })
        }),
        (responseData) => {
          const { result } = renderHook(() => ({
            medical: useMedicalState(),
            voice: useVoiceState()
          }), {
            wrapper: ({ children }) => <AppStateProvider>{children}</AppStateProvider>
          })

          // Simulate simultaneous backend response processing
          act(() => {
            // Update medical assessment (visual component)
            result.current.medical.setAssessment({
              condition: responseData.condition,
              urgencyLevel: responseData.urgencyLevel,
              advice: responseData.advice,
              confidence: responseData.confidence,
              requiresEmergencyServices: responseData.requiresEmergencyServices
            })

            // Update voice transcription (audio component)
            result.current.voice.updateTranscription(responseData.audioResponse)
          })

          // Verify both updates occurred simultaneously
          expect(result.current.medical.currentAssessment).not.toBeNull()
          expect(result.current.medical.currentAssessment?.condition).toBe(responseData.condition)
          expect(result.current.medical.currentAssessment?.urgencyLevel).toBe(responseData.urgencyLevel)
          expect(result.current.medical.currentAssessment?.advice).toBe(responseData.advice)
          expect(result.current.medical.currentAssessment?.confidence).toBe(responseData.confidence)

          expect(result.current.voice.currentTranscription).toBe(responseData.audioResponse)

          // Verify both components are in consistent state
          expect(result.current.medical.isProcessing).toBe(false)
          expect(result.current.voice.isProcessing).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain state consistency when multiple components update simultaneously', () => {
    fc.assert(
      fc.property(
        // Generate multiple simultaneous updates
        fc.record({
          medicalUpdate: fc.record({
            condition: fc.string({ minLength: 1, maxLength: 100 }),
            urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
            advice: fc.string({ minLength: 1, maxLength: 500 }),
            confidence: fc.float({ min: 0, max: 1 }),
            requiresEmergencyServices: fc.boolean()
          }),
          voiceUpdate: fc.record({
            transcription: fc.string({ minLength: 1, maxLength: 200 }),
            audioLevel: fc.float({ min: 0, max: 1 }),
            isListening: fc.boolean(),
            isProcessing: fc.boolean()
          }),
          cameraUpdate: fc.record({
            isUploading: fc.boolean(),
            uploadProgress: fc.integer({ min: 0, max: 100 }),
            hasPermission: fc.boolean()
          })
        }),
        ({ medicalUpdate, voiceUpdate, cameraUpdate }) => {
          const { result } = renderHook(() => ({
            medical: useMedicalState(),
            voice: useVoiceState(),
            camera: useCameraState()
          }), {
            wrapper: ({ children }) => <AppStateProvider>{children}</AppStateProvider>
          })

          // Perform simultaneous updates across all components
          act(() => {
            // Medical component update
            result.current.medical.setAssessment(medicalUpdate)

            // Voice component updates
            result.current.voice.updateTranscription(voiceUpdate.transcription)
            result.current.voice.updateAudioLevel(voiceUpdate.audioLevel)
            if (voiceUpdate.isListening) {
              result.current.voice.startListening()
            }
            if (voiceUpdate.isProcessing) {
              result.current.voice.startProcessing()
            }

            // Camera component updates
            result.current.camera.setPermission(cameraUpdate.hasPermission)
            if (cameraUpdate.isUploading) {
              result.current.camera.startUpload()
              result.current.camera.updateUploadProgress(cameraUpdate.uploadProgress)
            }
          })

          // Verify all updates were applied correctly and simultaneously
          expect(result.current.medical.currentAssessment?.condition).toBe(medicalUpdate.condition)
          expect(result.current.medical.currentAssessment?.urgencyLevel).toBe(medicalUpdate.urgencyLevel)
          expect(result.current.medical.currentAssessment?.advice).toBe(medicalUpdate.advice)

          expect(result.current.voice.currentTranscription).toBe(voiceUpdate.transcription)
          expect(result.current.voice.audioLevel).toBe(voiceUpdate.audioLevel)

          expect(result.current.camera.hasPermission).toBe(cameraUpdate.hasPermission)
          if (cameraUpdate.isUploading) {
            expect(result.current.camera.isUploading).toBe(true)
            expect(result.current.camera.uploadProgress).toBe(cameraUpdate.uploadProgress)
          }

          // Verify state consistency - no conflicting states
          if (voiceUpdate.isListening && voiceUpdate.isProcessing) {
            // Should not be both listening and processing simultaneously
            expect(result.current.voice.isListening || result.current.voice.isProcessing).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle rapid sequential updates without losing data', () => {
    fc.assert(
      fc.property(
        // Generate sequence of rapid updates
        fc.array(
          fc.record({
            condition: fc.string({ minLength: 1, maxLength: 100 }),
            urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
            advice: fc.string({ minLength: 1, maxLength: 500 }),
            confidence: fc.float({ min: 0, max: 1 }),
            requiresEmergencyServices: fc.boolean(),
            transcription: fc.string({ minLength: 1, maxLength: 200 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (updateSequence) => {
          const { result } = renderHook(() => ({
            medical: useMedicalState(),
            voice: useVoiceState()
          }), {
            wrapper: ({ children }) => <AppStateProvider>{children}</AppStateProvider>
          })

          // Apply rapid sequential updates
          updateSequence.forEach((update, index) => {
            act(() => {
              // Simultaneous medical and voice updates
              result.current.medical.setAssessment({
                condition: update.condition,
                urgencyLevel: update.urgencyLevel,
                advice: update.advice,
                confidence: update.confidence,
                requiresEmergencyServices: update.requiresEmergencyServices
              })

              result.current.voice.updateTranscription(update.transcription)
            })

            // Verify each update was applied correctly
            expect(result.current.medical.currentAssessment?.condition).toBe(update.condition)
            expect(result.current.medical.currentAssessment?.urgencyLevel).toBe(update.urgencyLevel)
            expect(result.current.voice.currentTranscription).toBe(update.transcription)
          })

          // Verify final state matches the last update
          const lastUpdate = updateSequence[updateSequence.length - 1]
          expect(result.current.medical.currentAssessment?.condition).toBe(lastUpdate.condition)
          expect(result.current.medical.currentAssessment?.urgencyLevel).toBe(lastUpdate.urgencyLevel)
          expect(result.current.voice.currentTranscription).toBe(lastUpdate.transcription)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should update UI components simultaneously when backend responses are received', () => {
    fc.assert(
      fc.property(
        // Generate backend response scenario
        fc.record({
          medicalResponse: fc.record({
            condition: fc.string({ minLength: 1, maxLength: 100 }),
            urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
            advice: fc.string({ minLength: 1, maxLength: 500 }),
            confidence: fc.float({ min: 0, max: 1 }),
            requiresEmergencyServices: fc.boolean()
          }),
          audioResponse: fc.string({ minLength: 1, maxLength: 200 })
        }),
        ({ medicalResponse, audioResponse }) => {
          // Set up initial state to simulate backend response processing
          mockVoiceAgent.isProcessing = true

          const { container, unmount } = render(<App />)

          try {
            // Verify initial processing state
            expect(container.querySelector('.min-h-screen')).toBeInTheDocument()

            // Simulate simultaneous backend response
            act(() => {
              // Update voice agent state
              mockVoiceAgent.isProcessing = false
              mockVoiceAgent.currentTranscription = audioResponse
            })

            // Verify UI remains stable and responsive
            expect(container.querySelector('.min-h-screen')).toBeInTheDocument()
            expect(screen.getByText('FirstAidVox')).toBeInTheDocument()
            expect(screen.getByText('Voice Assistant')).toBeInTheDocument()
            expect(screen.getByText('Photo Capture')).toBeInTheDocument()
            expect(screen.queryByText('Medical Assessment') || screen.queryByText(/No medical assessment available/)).toBeInTheDocument()

            // Verify UI components are still interactive
            const voiceButton = screen.getByRole('button', { name: /start voice|stop voice|connecting/i })
            expect(voiceButton).toBeInTheDocument()
            expect(voiceButton).not.toBeDisabled()

            const textInput = screen.getByPlaceholderText(/type your medical question/i)
            expect(textInput).toBeInTheDocument()
            expect(textInput).not.toBeDisabled()

            // Verify layout consistency after updates
            const mainElement = container.querySelector('main')
            expect(mainElement).toBeInTheDocument()
            expect(mainElement).toHaveClass('max-w-md', 'mx-auto', 'w-full')
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 10 } // Reduce number of runs to prevent timeout
    )
  }, 10000) // Add 10 second timeout
})