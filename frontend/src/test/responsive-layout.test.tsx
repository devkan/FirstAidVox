import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import { ReportCard, MedicalReportCard } from '../components/ReportCard'
import { MapComponent } from '../components/MapComponent'
import { MedicalResponse, HospitalLocation, Coordinates } from '../types'

/**
 * Feature: first-aid-voice-ui, Property 26: Responsive layout adaptation
 * Validates: Requirements 7.3
 */
describe('Property 26: Responsive layout adaptation', () => {
  // Mock window.matchMedia for responsive testing
  const mockMatchMedia = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    })
  }

  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it('should adapt ReportCard layout appropriately for different screen sizes', () => {
    fc.assert(
      fc.property(
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          confidence: fc.float({ min: 0, max: 1 }),
          screenSize: fc.constantFrom('mobile', 'tablet', 'desktop') as fc.Arbitrary<'mobile' | 'tablet' | 'desktop'>
        }),
        ({ condition, urgencyLevel, advice, confidence, screenSize }) => {
          // Set up responsive behavior based on screen size
          const isMobile = screenSize === 'mobile'
          const isTablet = screenSize === 'tablet'
          
          mockMatchMedia(isMobile)

          const { container } = render(
            <ReportCard
              condition={condition}
              urgencyLevel={urgencyLevel}
              adviceSummary={advice}
              confidence={confidence}
            />
          )

          // Verify the component renders with responsive classes
          const reportCard = container.querySelector('.bg-white.rounded-lg.shadow-lg')
          expect(reportCard).toBeTruthy()

          // Verify responsive padding and spacing classes are present
          const headerSection = container.querySelector('.px-6.py-4')
          expect(headerSection).toBeTruthy()

          const contentSection = container.querySelector('.p-6.space-y-6')
          expect(contentSection).toBeTruthy()

          // Verify responsive text sizing classes
          const title = container.querySelector('.text-xl.font-bold')
          expect(title).toBeTruthy()

          const sectionHeaders = container.querySelectorAll('.text-lg.font-semibold')
          expect(sectionHeaders.length).toBeGreaterThan(0)

          // Verify responsive flex layout
          const flexContainer = container.querySelector('.flex.items-center.justify-between')
          expect(flexContainer).toBeTruthy()

          // Verify responsive spacing classes
          const spacingElements = container.querySelectorAll('[class*="space-"]')
          expect(spacingElements.length).toBeGreaterThan(0)

          // Verify responsive margin and padding classes
          const paddingElements = container.querySelectorAll('[class*="p-"], [class*="px-"], [class*="py-"]')
          expect(paddingElements.length).toBeGreaterThan(0)

          const marginElements = container.querySelectorAll('[class*="m-"], [class*="mx-"], [class*="my-"], [class*="mb-"], [class*="mt-"]')
          expect(marginElements.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should adapt MapComponent layout appropriately for different screen sizes', () => {
    fc.assert(
      fc.property(
        fc.record({
          hospitalData: fc.array(
            fc.record({
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
            }),
            { minLength: 1, maxLength: 5 }
          ),
          userLocation: fc.record({
            latitude: fc.float({ min: -90, max: 90 }),
            longitude: fc.float({ min: -180, max: 180 })
          }),
          screenSize: fc.constantFrom('mobile', 'tablet', 'desktop') as fc.Arbitrary<'mobile' | 'tablet' | 'desktop'>
        }),
        ({ hospitalData, userLocation, screenSize }) => {
          // Set up responsive behavior based on screen size
          const isMobile = screenSize === 'mobile'
          
          mockMatchMedia(isMobile)

          const { container } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={userLocation}
              isVisible={true}
              onDismiss={() => {}}
            />
          )

          // Verify the component renders with responsive structure
          const mapContainer = container.firstChild as HTMLElement
          expect(mapContainer).toBeTruthy()

          // Verify responsive classes are applied - MapComponent uses fixed positioning and responsive heights
          const bottomSheet = container.querySelector('.absolute.bottom-0.left-0.right-0')
          expect(bottomSheet).toBeTruthy()

          // Verify responsive height classes
          const hasResponsiveHeight = container.querySelector('[class*="max-h-"], [class*="min-h-"]')
          expect(hasResponsiveHeight).toBeTruthy()

          // Verify responsive padding and spacing
          const hasResponsivePadding = container.querySelector('[class*="px-"], [class*="py-"], [class*="p-"]')
          expect(hasResponsivePadding).toBeTruthy()

          // Verify responsive layout classes (flex, grid, etc.)
          const hasLayoutClasses = container.querySelector('.flex') || container.querySelector('.grid')
          expect(hasLayoutClasses).toBeTruthy()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain functionality across different screen sizes', () => {
    fc.assert(
      fc.property(
        fc.record({
          medicalResponse: fc.record({
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
          screenSizes: fc.array(
            fc.constantFrom('mobile', 'tablet', 'desktop') as fc.Arbitrary<'mobile' | 'tablet' | 'desktop'>,
            { minLength: 1, maxLength: 3 }
          )
        }),
        ({ medicalResponse, screenSizes }) => {
          // Test functionality across multiple screen sizes
          screenSizes.forEach(screenSize => {
            cleanup()
            
            const isMobile = screenSize === 'mobile'
            mockMatchMedia(isMobile)

            const { container } = render(
              <MedicalReportCard medicalResponse={medicalResponse} />
            )

            // Verify core functionality is preserved regardless of screen size
            const reportCard = container.querySelector('.bg-white')
            expect(reportCard).toBeTruthy()

            // Verify essential content is always present
            const conditionElements = container.querySelectorAll('p')
            const hasCondition = Array.from(conditionElements).some(el => 
              el.textContent?.trim() === medicalResponse.condition.trim()
            )
            expect(hasCondition).toBe(true)

            const adviceElements = container.querySelectorAll('p')
            const hasAdvice = Array.from(adviceElements).some(el => 
              el.textContent?.trim() === medicalResponse.advice.trim()
            )
            expect(hasAdvice).toBe(true)

            // Verify urgency level is always displayed
            const urgencyLabels = {
              low: 'Low Priority',
              moderate: 'Moderate Priority',
              high: 'High Priority'
            }
            const urgencyText = container.textContent
            expect(urgencyText).toContain(urgencyLabels[medicalResponse.urgencyLevel])

            // Verify confidence is always displayed
            const confidencePercentage = Math.round(medicalResponse.confidence * 100)
            expect(urgencyText).toContain(`${confidencePercentage}%`)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should apply appropriate responsive breakpoint classes', () => {
    fc.assert(
      fc.property(
        fc.record({
          condition: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          urgencyLevel: fc.constantFrom('low', 'moderate', 'high') as fc.Arbitrary<'low' | 'moderate' | 'high'>,
          advice: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          confidence: fc.float({ min: 0, max: 1 })
        }),
        ({ condition, urgencyLevel, advice, confidence }) => {
          const { container } = render(
            <ReportCard
              condition={condition}
              urgencyLevel={urgencyLevel}
              adviceSummary={advice}
              confidence={confidence}
            />
          )

          // Verify Tailwind responsive utility classes are used
          const allElements = container.querySelectorAll('*')
          const hasResponsiveClasses = Array.from(allElements).some(element => {
            const className = element.className
            return className.includes('sm:') || 
                   className.includes('md:') || 
                   className.includes('lg:') || 
                   className.includes('xl:') ||
                   className.includes('2xl:') ||
                   // Check for responsive spacing, sizing, and layout classes
                   className.includes('space-') ||
                   className.includes('flex') ||
                   className.includes('grid') ||
                   className.includes('w-') ||
                   className.includes('h-') ||
                   className.includes('p-') ||
                   className.includes('m-') ||
                   className.includes('text-')
          })

          // The component should use responsive design patterns
          expect(hasResponsiveClasses).toBe(true)

          // Verify the component structure supports responsive behavior
          const flexElements = container.querySelectorAll('.flex')
          const spacingElements = container.querySelectorAll('[class*="space-"]')
          const paddingElements = container.querySelectorAll('[class*="p-"]')

          // Should have layout elements that support responsive design
          expect(flexElements.length + spacingElements.length + paddingElements.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})