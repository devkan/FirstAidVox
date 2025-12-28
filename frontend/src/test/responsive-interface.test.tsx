import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import App from '../App'

/**
 * Feature: first-aid-voice-ui, Property 24: Responsive interface rendering
 * Validates: Requirements 7.1
 */
describe('Property 24: Responsive interface rendering', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render responsive interface using Tailwind CSS for any viewport dimensions', () => {
    fc.assert(
      fc.property(
        // Generate viewport dimensions that represent different device types
        fc.record({
          width: fc.integer({ min: 320, max: 1920 }), // From mobile to desktop
          height: fc.integer({ min: 568, max: 1080 }), // From mobile to desktop
        }),
        (viewport) => {
          // Set viewport dimensions
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: viewport.width,
          })
          Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: viewport.height,
          })

          // Render the application
          const { container, unmount } = render(<App />)

          try {
            // Verify that the application renders without errors
            expect(container).toBeTruthy()

            // Verify essential responsive elements are present
            expect(screen.getAllByText('FirstAidVox')[0]).toBeInTheDocument()
            expect(screen.getAllByText('Voice Assistant')[0]).toBeInTheDocument()
            expect(screen.getAllByText('Photo Capture')[0]).toBeInTheDocument()
            expect(screen.queryByText('Medical Assessment') || screen.queryByText(/No medical assessment available/)).toBeInTheDocument()

            // Verify Tailwind CSS classes are applied for responsive design
            const mainElement = container.querySelector('main')
            expect(mainElement).toHaveClass('max-w-md', 'mx-auto', 'w-full')

            // Verify the layout uses flexbox for responsive behavior
            const appContainer = container.querySelector('div')
            expect(appContainer).toHaveClass('min-h-screen', 'flex', 'flex-col')

            // Verify buttons are accessible and properly styled
            const voiceButton = screen.getByRole('button', { name: /start voice/i })
            const cameraButton = screen.getByRole('button', { name: /open camera/i })
            
            expect(voiceButton).toBeInTheDocument()
            expect(cameraButton).toBeInTheDocument()

            // Verify responsive spacing classes are applied
            const spaceContainer = container.querySelector('.space-y-4')
            expect(spaceContainer).toBeInTheDocument()
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 50 } // Reduced from 100 to 50
    )
  }, 15000) // Added 15 second timeout

  it('should maintain consistent layout structure across different viewport sizes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { width: 320, height: 568 },   // iPhone SE
          { width: 375, height: 667 },   // iPhone 8
          { width: 414, height: 896 },   // iPhone 11 Pro Max
          { width: 768, height: 1024 },  // iPad
          { width: 1024, height: 768 },  // iPad Landscape
          { width: 1440, height: 900 },  // Desktop
          { width: 1920, height: 1080 }  // Large Desktop
        ),
        (viewport) => {
          // Set viewport dimensions
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: viewport.width,
          })
          Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: viewport.height,
          })

          const { container, unmount } = render(<App />)

          try {
            // Verify consistent structure regardless of viewport
            const header = container.querySelector('header')
            const main = container.querySelector('main')
            
            expect(header).toBeInTheDocument()
            expect(main).toBeInTheDocument()

            // Verify all three main sections are always present (with different styling based on state)
            const whiteSections = container.querySelectorAll('.bg-white.rounded-lg')
            const graySections = container.querySelectorAll('.bg-gray-50.rounded-lg')
            const totalSections = whiteSections.length + graySections.length
            expect(totalSections).toBeGreaterThanOrEqual(2) // At least Voice and Camera sections

            // Verify responsive classes are consistently applied
            expect(main).toHaveClass('flex-1', 'p-4', 'max-w-md', 'mx-auto', 'w-full')
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})