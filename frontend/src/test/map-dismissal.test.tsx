import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import { MapComponent } from '../components/MapComponent';
import { HospitalLocation } from '../types';

// Mock the Google Maps API
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="api-provider">{children}</div>,
  Map: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="google-map" onClick={onClick}>{children}</div>
  ),
  Marker: ({ title, onClick }: { title: string; onClick?: () => void }) => (
    <div data-testid="marker" title={title} onClick={onClick} />
  ),
  InfoWindow: ({ children, onCloseClick }: { children: React.ReactNode; onCloseClick?: () => void }) => (
    <div data-testid="info-window">
      {children}
      <button data-testid="info-window-close" onClick={onCloseClick}>×</button>
    </div>
  )
}));

describe('Map Dismissal Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 13: Map dismissal behavior**
   * **Validates: Requirements 3.5**
   * 
   * Property: For any user dismissal action, the Map_Component should 
   * slide down and hide from view
   */
  it('should handle map dismissal through close button', async () => {
    await fc.assert(
      fc.property(
        // Generate hospital data for testing dismissal
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            coordinates: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 })
            }),
            address: fc.string({ minLength: 1, maxLength: 100 }),
            phone: fc.string({ minLength: 10, maxLength: 15 }),
            distance: fc.float({ min: 0, max: 100 }),
            emergencyServices: fc.array(
              fc.record({
                type: fc.constantFrom('emergency_room', 'urgent_care', 'trauma_center'),
                waitTime: fc.integer({ min: 0, max: 300 }),
                availability: fc.constantFrom('available', 'busy', 'full')
              }),
              { minLength: 0, maxLength: 2 }
            ),
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 0, maxLength: 3 }
        ),
        fc.option(
          fc.record({
            latitude: fc.float({ min: -90, max: 90 }),
            longitude: fc.float({ min: -180, max: 180 })
          })
        ),
        (hospitalData, userLocation) => {
          const mockOnDismiss = vi.fn();

          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={userLocation}
              isVisible={true}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Property: Map should be visible initially
            const mapContainer = container.querySelector('[class*="fixed inset-0"]');
            expect(mapContainer).toBeTruthy();

            // Property: Close button should be present and functional
            const closeButton = container.querySelector('button[aria-label="Close map"]');
            expect(closeButton).toBeTruthy();

            if (closeButton) {
              // Simulate clicking the close button
              fireEvent.click(closeButton);

              // Property: onDismiss callback should be called
              expect(mockOnDismiss).toHaveBeenCalledTimes(1);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Map dismissal through backdrop click should work
   */
  it('should handle map dismissal through backdrop click', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            coordinates: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 })
            }),
            address: fc.string({ minLength: 1, maxLength: 100 }),
            phone: fc.string({ minLength: 10, maxLength: 15 }),
            distance: fc.float({ min: 0, max: 100 }),
            emergencyServices: fc.constant([]), // Simplified
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 0, maxLength: 2 }
        ),
        (hospitalData) => {
          const mockOnDismiss = vi.fn();

          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={null}
              isVisible={true}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Property: Backdrop should be present and clickable
            const backdrop = container.querySelector('.absolute.inset-0.bg-black.bg-opacity-50');
            expect(backdrop).toBeTruthy();

            if (backdrop) {
              // Simulate clicking the backdrop
              fireEvent.click(backdrop);

              // Property: onDismiss callback should be called
              expect(mockOnDismiss).toHaveBeenCalledTimes(1);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Map dismissal should work regardless of hospital data state
   */
  it('should handle dismissal with various hospital data states', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          fc.constant([]), // Empty hospital data
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              coordinates: fc.record({
                latitude: fc.float({ min: -90, max: 90 }),
                longitude: fc.float({ min: -180, max: 180 })
              }),
              address: fc.string({ minLength: 1, maxLength: 100 }),
              phone: fc.string({ minLength: 10, maxLength: 15 }),
              distance: fc.float({ min: 0, max: 100 }),
              emergencyServices: fc.constant([]),
              rating: fc.float({ min: 1, max: 5 }),
              isOpen24Hours: fc.boolean()
            }),
            { minLength: 1, maxLength: 5 }
          )
        ),
        (hospitalData) => {
          const mockOnDismiss = vi.fn();

          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={null}
              isVisible={true}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Property: Dismissal should work regardless of data state
            const closeButton = container.querySelector('button[aria-label="Close map"]');
            expect(closeButton).toBeTruthy();

            if (closeButton) {
              fireEvent.click(closeButton);
              expect(mockOnDismiss).toHaveBeenCalledTimes(1);
            }

            // Property: Should also work via backdrop
            const backdrop = container.querySelector('.absolute.inset-0.bg-black.bg-opacity-50');
            if (backdrop) {
              // Reset mock for second test
              mockOnDismiss.mockClear();
              fireEvent.click(backdrop);
              expect(mockOnDismiss).toHaveBeenCalledTimes(1);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Map dismissal should not trigger when clicking on map content
   */
  it('should not dismiss when clicking on map content', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            coordinates: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 })
            }),
            address: fc.string({ minLength: 1, maxLength: 100 }),
            phone: fc.string({ minLength: 10, maxLength: 15 }),
            distance: fc.float({ min: 0, max: 100 }),
            emergencyServices: fc.constant([]),
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 1, maxLength: 2 }
        ),
        (hospitalData) => {
          const mockOnDismiss = vi.fn();

          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={null}
              isVisible={true}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Property: Clicking on map content should not trigger dismissal
            const googleMap = container.querySelector('[data-testid="google-map"]');
            if (googleMap) {
              fireEvent.click(googleMap);
              expect(mockOnDismiss).not.toHaveBeenCalled();
            }

            // Property: Clicking on markers should not trigger dismissal
            const markers = container.querySelectorAll('[data-testid="marker"]');
            markers.forEach(marker => {
              fireEvent.click(marker);
              expect(mockOnDismiss).not.toHaveBeenCalled();
            });

            // Property: Clicking on hospital list items should not trigger dismissal
            const hospitalItems = container.querySelectorAll('.p-4.border-b.border-gray-100');
            hospitalItems.forEach(item => {
              fireEvent.click(item);
              expect(mockOnDismiss).not.toHaveBeenCalled();
            });

            // Property: Only explicit dismissal actions should trigger callback
            const closeButton = container.querySelector('button[aria-label="Close map"]');
            if (closeButton) {
              fireEvent.click(closeButton);
              expect(mockOnDismiss).toHaveBeenCalledTimes(1);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 } // Reduced for interaction testing
    );
  });

  /**
   * Property: Map dismissal should work with user location present
   */
  it('should handle dismissal with user location marker', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          latitude: fc.float({ min: -90, max: 90 }),
          longitude: fc.float({ min: -180, max: 180 })
        }),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            coordinates: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 })
            }),
            address: fc.string({ minLength: 1, maxLength: 100 }),
            phone: fc.string({ minLength: 10, maxLength: 15 }),
            distance: fc.float({ min: 0, max: 100 }),
            emergencyServices: fc.constant([]),
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 0, maxLength: 2 }
        ),
        (userLocation, hospitalData) => {
          const mockOnDismiss = vi.fn();

          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={userLocation}
              isVisible={true}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Property: Should have user location marker
            const markers = container.querySelectorAll('[data-testid="marker"]');
            const userLocationMarker = Array.from(markers).find(marker => 
              marker.getAttribute('title') === 'Your Location'
            );
            expect(userLocationMarker).toBeTruthy();

            // Property: Clicking user location marker should not dismiss
            if (userLocationMarker) {
              fireEvent.click(userLocationMarker);
              expect(mockOnDismiss).not.toHaveBeenCalled();
            }

            // Property: Dismissal should still work normally
            const closeButton = container.querySelector('button[aria-label="Close map"]');
            if (closeButton) {
              fireEvent.click(closeButton);
              expect(mockOnDismiss).toHaveBeenCalledTimes(1);
            }

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple dismissal attempts should not cause issues
   */
  it('should handle multiple dismissal attempts gracefully', () => {
    const mockOnDismiss = vi.fn();

    const { container, unmount } = render(
      <MapComponent
        hospitalData={[]}
        userLocation={null}
        isVisible={true}
        onDismiss={mockOnDismiss}
      />
    );

    try {
      const closeButton = container.querySelector('button[aria-label="Close map"]');
      expect(closeButton).toBeTruthy();

      if (closeButton) {
        // Property: Multiple clicks should call onDismiss multiple times
        fireEvent.click(closeButton);
        fireEvent.click(closeButton);
        fireEvent.click(closeButton);

        expect(mockOnDismiss).toHaveBeenCalledTimes(3);
      }

      // Property: Component should remain stable after multiple dismissals
      expect(closeButton).toBeInTheDocument();

    } finally {
      unmount();
    }
  });
});