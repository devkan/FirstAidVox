import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import { ReportCard, MedicalReportCard } from '../components/ReportCard'
import { MedicalResponse } from '../types'

/**
 * Feature: first-aid-voice-ui, Property 14: Medical report display completeness
 * Validates: Requirements 4.1, 4.2, 4.3
 */
describe('Property 14: Medical report display completeness', () => {
  it('should display all required medical assessment information for any valid medical response', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary medical responses
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          confidence: fc.float({ min: 0, max: 1 })
        }),
        ({ condition, urgencyLevel, advice, confidence }) => {
          // Clean up any previous renders
          cleanup()
          
          // Render the ReportCard component
          const { container } = render(
            <ReportCard
              condition={condition}
              urgencyLevel={urgencyLevel}
              adviceSummary={advice}
              confidence={confidence}
            />
          )

          // Verify predicted condition is displayed (Requirement 4.1)
          expect(screen.getByText('Predicted Condition')).toBeInTheDocument()
          
          // Find condition text within the condition section
          const conditionElements = container.querySelectorAll('p')
          const conditionElement = Array.from(conditionElements).find(el => 
            el.textContent?.trim() === condition.trim() && 
            el.previousElementSibling?.textContent?.includes('Predicted Condition')
          )
          expect(conditionElement).toBeTruthy()

          // Verify color-coded urgency level is displayed (Requirement 4.2)
          expect(screen.getByText('Medical Assessment')).toBeInTheDocument()
          
          // Check urgency level indicator is present
          const urgencyLabels = {
            low: 'Low Priority',
            moderate: 'Moderate Priority',
            high: 'High Priority'
          }
          expect(screen.getByText(urgencyLabels[urgencyLevel])).toBeInTheDocument()

          // Verify advice summary is displayed (Requirement 4.3)
          expect(screen.getByText('Recommended Actions')).toBeInTheDocument()
          
          // Find advice text within the advice section
          const adviceElements = container.querySelectorAll('p')
          const adviceElement = Array.from(adviceElements).find(el => 
            el.textContent?.trim() === advice.trim() && 
            el.closest('div')?.previousElementSibling?.textContent?.includes('Recommended Actions')
          )
          expect(adviceElement).toBeTruthy()

          // Verify confidence is displayed as percentage
          const confidencePercentage = Math.round(confidence * 100)
          expect(screen.getByText(`${confidencePercentage}%`)).toBeInTheDocument()

          // Verify timestamp is displayed
          expect(screen.getByText(/Updated:/)).toBeInTheDocument()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should display emergency notice for high urgency conditions', () => {
    fc.assert(
      fc.property(
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          advice: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          confidence: fc.float({ min: 0, max: 1 })
        }),
        ({ condition, advice, confidence }) => {
          // Clean up any previous renders
          cleanup()
          
          // Render with high urgency
          render(
            <ReportCard
              condition={condition}
              urgencyLevel="high"
              adviceSummary={advice}
              confidence={confidence}
            />
          )

          // Verify emergency notice is displayed for high urgency
          expect(screen.getByText('Emergency Attention Required')).toBeInTheDocument()
          expect(screen.getByText(/This condition may require immediate medical attention/)).toBeInTheDocument()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not display emergency notice for low and moderate urgency conditions', () => {
    fc.assert(
      fc.property(
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          urgencyLevel: fc.constantFrom('low', 'moderate') as fc.Arbitrary<'low' | 'moderate'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          confidence: fc.float({ min: 0, max: 1 })
        }),
        ({ condition, urgencyLevel, advice, confidence }) => {
          // Clean up any previous renders
          cleanup()
          
          // Render with low or moderate urgency
          render(
            <ReportCard
              condition={condition}
              urgencyLevel={urgencyLevel}
              adviceSummary={advice}
              confidence={confidence}
            />
          )

          // Verify emergency notice is NOT displayed for low/moderate urgency
          expect(screen.queryByText('Emergency Attention Required')).not.toBeInTheDocument()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should display appropriate confidence bar color based on confidence level', () => {
    fc.assert(
      fc.property(
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          confidence: fc.float({ min: 0, max: 1 })
        }),
        ({ condition, urgencyLevel, advice, confidence }) => {
          // Clean up any previous renders
          cleanup()
          
          const { container } = render(
            <ReportCard
              condition={condition}
              urgencyLevel={urgencyLevel}
              adviceSummary={advice}
              confidence={confidence}
            />
          )

          // Find the confidence bar
          const confidenceBar = container.querySelector('.h-2.rounded-full.transition-all')
          expect(confidenceBar).toBeInTheDocument()

          // Verify confidence bar has appropriate color class
          if (confidence >= 0.8) {
            expect(confidenceBar).toHaveClass('bg-green-500')
          } else if (confidence >= 0.6) {
            expect(confidenceBar).toHaveClass('bg-yellow-500')
          } else {
            expect(confidenceBar).toHaveClass('bg-red-500')
          }

          // Verify confidence bar width matches confidence percentage
          const expectedWidth = `${Math.round(confidence * 100)}%`
          expect(confidenceBar).toHaveStyle(`width: ${expectedWidth}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: first-aid-voice-ui, Property 14: Medical report display completeness (MedicalReportCard wrapper)
 * Validates: Requirements 4.1, 4.2, 4.3
 */
describe('Property 14: Medical report display completeness (MedicalReportCard)', () => {
  it('should display complete medical report when medical response is provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          confidence: fc.float({ min: 0, max: 1 }),
          requiresEmergencyServices: fc.boolean(),
          hospitalData: fc.option(fc.array(fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            coordinates: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 })
            }),
            address: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
            phone: fc.string({ minLength: 10, maxLength: 15 }),
            distance: fc.float({ min: 0, max: 100 }),
            emergencyServices: fc.array(fc.record({
              type: fc.constantFrom('emergency_room', 'urgent_care', 'trauma_center') as fc.Arbitrary<'emergency_room' | 'urgent_care' | 'trauma_center'>,
              waitTime: fc.integer({ min: 0, max: 300 }),
              availability: fc.constantFrom('available', 'busy', 'full') as fc.Arbitrary<'available' | 'busy' | 'full'>
            })),
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          })))
        }),
        (medicalResponse: MedicalResponse) => {
          // Clean up any previous renders
          cleanup()
          
          // Render the MedicalReportCard component
          const { container } = render(<MedicalReportCard medicalResponse={medicalResponse} />)

          // Verify all required information is displayed
          expect(screen.getByText('Predicted Condition')).toBeInTheDocument()
          expect(screen.getByText('Recommended Actions')).toBeInTheDocument()

          // Find condition text within the condition section
          const conditionElements = container.querySelectorAll('p')
          const conditionElement = Array.from(conditionElements).find(el => 
            el.textContent?.trim() === medicalResponse.condition.trim() && 
            el.previousElementSibling?.textContent?.includes('Predicted Condition')
          )
          expect(conditionElement).toBeTruthy()

          // Find advice text within the advice section
          const adviceElements = container.querySelectorAll('p')
          const adviceElement = Array.from(adviceElements).find(el => 
            el.textContent?.trim() === medicalResponse.advice.trim() && 
            el.closest('div')?.previousElementSibling?.textContent?.includes('Recommended Actions')
          )
          expect(adviceElement).toBeTruthy()

          // Verify urgency level
          const urgencyLabels = {
            low: 'Low Priority',
            moderate: 'Moderate Priority',
            high: 'High Priority'
          }
          expect(screen.getByText(urgencyLabels[medicalResponse.urgencyLevel])).toBeInTheDocument()

          // Verify confidence display
          const confidencePercentage = Math.round(medicalResponse.confidence * 100)
          expect(screen.getByText(`${confidencePercentage}%`)).toBeInTheDocument()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should display placeholder when no medical response is provided', () => {
    cleanup()
    render(<MedicalReportCard medicalResponse={null} />)

    // Verify placeholder content is displayed
    expect(screen.getByText(/No medical assessment available yet/)).toBeInTheDocument()
    expect(screen.getByText(/Start a conversation to receive your medical report/)).toBeInTheDocument()

    // Verify medical assessment content is NOT displayed
    expect(screen.queryByText('Predicted Condition')).not.toBeInTheDocument()
    expect(screen.queryByText('Recommended Actions')).not.toBeInTheDocument()
  })
})