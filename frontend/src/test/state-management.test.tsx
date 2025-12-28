import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as fc from 'fast-check'
import { AppStateProvider, useMedicalState } from '../hooks/useAppState'
import { MedicalResponse } from '../types'

/**
 * Feature: first-aid-voice-ui, Property 15: Real-time report updates
 * Validates: Requirements 4.4
 */
describe('Property 15: Real-time report updates', () => {
  it('should update medical assessment immediately when new medical data is processed', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary medical responses
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 100 }),
          urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }),
          confidence: fc.float({ min: 0, max: 1 }),
          requiresEmergencyServices: fc.boolean()
        }),
        (medicalData: MedicalResponse) => {
          // Render the hook with provider
          const { result } = renderHook(() => useMedicalState(), {
            wrapper: ({ children }) => <AppStateProvider>{children}</AppStateProvider>
          })

          // Verify initial state
          expect(result.current.currentAssessment).toBeNull()
          expect(result.current.isProcessing).toBe(false)

          // Set new medical assessment
          act(() => {
            result.current.setAssessment(medicalData)
          })

          // Verify the assessment is updated immediately
          expect(result.current.currentAssessment).not.toBeNull()
          expect(result.current.currentAssessment?.condition).toBe(medicalData.condition)
          expect(result.current.currentAssessment?.urgencyLevel).toBe(medicalData.urgencyLevel)
          expect(result.current.currentAssessment?.advice).toBe(medicalData.advice)
          expect(result.current.currentAssessment?.confidence).toBe(medicalData.confidence)
          expect(result.current.currentAssessment?.requiresEmergencyServices).toBe(medicalData.requiresEmergencyServices)
          
          // Verify processing flag is set to false after update
          expect(result.current.isProcessing).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should update medical assessment when multiple sequential updates occur', () => {
    fc.assert(
      fc.property(
        // Generate an array of medical responses to simulate sequential updates
        fc.array(
          fc.record({
            condition: fc.string({ minLength: 1, maxLength: 100 }),
            urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
            advice: fc.string({ minLength: 1, maxLength: 500 }),
            confidence: fc.float({ min: 0, max: 1 }),
            requiresEmergencyServices: fc.boolean()
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (medicalDataArray: MedicalResponse[]) => {
          const { result } = renderHook(() => useMedicalState(), {
            wrapper: ({ children }) => <AppStateProvider>{children}</AppStateProvider>
          })

          // Apply each medical data update sequentially
          medicalDataArray.forEach((medicalData) => {
            act(() => {
              result.current.setAssessment(medicalData)
            })

            // Verify each update is reflected immediately
            expect(result.current.currentAssessment).not.toBeNull()
            expect(result.current.currentAssessment?.condition).toBe(medicalData.condition)
            expect(result.current.currentAssessment?.urgencyLevel).toBe(medicalData.urgencyLevel)
            expect(result.current.currentAssessment?.advice).toBe(medicalData.advice)
            expect(result.current.currentAssessment?.confidence).toBe(medicalData.confidence)
          })

          // Verify the final state matches the last update
          const lastUpdate = medicalDataArray[medicalDataArray.length - 1]
          expect(result.current.currentAssessment?.condition).toBe(lastUpdate.condition)
          expect(result.current.currentAssessment?.urgencyLevel).toBe(lastUpdate.urgencyLevel)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain conversation history while updating assessments', () => {
    fc.assert(
      fc.property(
        fc.record({
          medicalResponse: fc.record({
            condition: fc.string({ minLength: 1, maxLength: 100 }),
            urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
            advice: fc.string({ minLength: 1, maxLength: 500 }),
            confidence: fc.float({ min: 0, max: 1 }),
            requiresEmergencyServices: fc.boolean()
          }),
          conversationEntries: fc.array(
            fc.record({
              id: fc.uuid(),
              timestamp: fc.date(),
              type: fc.constantFrom('user_voice', 'user_image', 'system_response') as fc.Arbitrary<'user_voice' | 'user_image' | 'system_response'>,
              content: fc.string({ minLength: 1, maxLength: 200 })
            }),
            { minLength: 1, maxLength: 10 }
          )
        }),
        ({ medicalResponse, conversationEntries }) => {
          const { result } = renderHook(() => useMedicalState(), {
            wrapper: ({ children }) => <AppStateProvider>{children}</AppStateProvider>
          })

          // Add conversation entries
          conversationEntries.forEach((entry) => {
            act(() => {
              result.current.addConversationEntry(entry)
            })
          })

          // Verify conversation history is maintained
          expect(result.current.conversationHistory).toHaveLength(conversationEntries.length)

          // Update medical assessment
          act(() => {
            result.current.setAssessment(medicalResponse)
          })

          // Verify assessment is updated
          expect(result.current.currentAssessment).not.toBeNull()
          expect(result.current.currentAssessment?.condition).toBe(medicalResponse.condition)

          // Verify conversation history is still maintained after assessment update
          expect(result.current.conversationHistory).toHaveLength(conversationEntries.length)
          
          // Verify conversation entries are preserved
          conversationEntries.forEach((entry, index) => {
            expect(result.current.conversationHistory[index].id).toBe(entry.id)
            expect(result.current.conversationHistory[index].content).toBe(entry.content)
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})
