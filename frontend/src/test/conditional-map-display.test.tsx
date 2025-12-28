import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { MapComponent } from '../components/MapComponent';
import { HospitalLocation, Coordinates } from '../types';

// Mock the Google Maps API
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="api-provider">{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="google-map">{children}</div>,
  Marker: ({ title }: { title: string }) => <div data-testid="marker" title={title} />,
  InfoWindow: ({ children }: { children: React.ReactNode }) => <div data-testid="info-window">{children}</div>
}));

describe('Conditional Map Display Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 10: Conditional map display**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Property: For any Backend_Service response containing hospital_data, 
   * the Map_Component should slide up and display with hospital markers
   */
  it('should display map when hospital data is provided and isVisible is true', async () => {
    await fc.assert(
      fc.property(
        // Generate arbitrary hospital data
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
              { minLength: 0, maxLength: 3 }
            ),
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 1, maxLength: 10 }
        ),
        // Generate optional user location
        fc.option(
          fc.record({
            latitude: fc.float({ min: -90, max: 90 }),
            longitude: fc.float({ min: -180, max: 180 })
          })
        ),
        (hospitalData, userLocation) => {
          const mockOnDismiss = vi.fn();

          // Property: When isVisible is true and hospital data exists, map should be displayed
          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={userLocation}
              isVisible={true}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Map container should be present in DOM
            const mapContainer = container.querySelector('[class*="fixed inset-0"]');
            expect(mapContainer).toBeTruthy();

            // Google Maps component should be rendered
            const apiProvider = container.querySelector('[data-testid="api-provider"]');
            expect(apiProvider).toBeTruthy();
            
            const googleMap = container.querySelector('[data-testid="google-map"]');
            expect(googleMap).toBeTruthy();

            // Hospital count should be displayed in header
            const headerText = container.textContent;
            expect(headerText).toContain(`Nearby Hospitals (${hospitalData.length})`);

            // Each hospital should have a marker
            const markers = container.querySelectorAll('[data-testid="marker"]');
            // Should have markers for hospitals + optionally user location
            const expectedMarkerCount = hospitalData.length + (userLocation ? 1 : 0);
            expect(markers).toHaveLength(expectedMarkerCount);

            // Hospital names should be present in the list
            hospitalData.forEach(hospital => {
              expect(headerText).toContain(hospital.name);
            });
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When isVisible is false, map should not be displayed regardless of hospital data
   */
  it('should not display map when isVisible is false', async () => {
    await fc.assert(
      fc.property(
        // Generate arbitrary hospital data (even with data, should not display)
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
              { minLength: 0, maxLength: 3 }
            ),
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 0, maxLength: 10 }
        ),
        fc.option(
          fc.record({
            latitude: fc.float({ min: -90, max: 90 }),
            longitude: fc.float({ min: -180, max: 180 })
          })
        ),
        (hospitalData, userLocation) => {
          const mockOnDismiss = vi.fn();

          // Property: When isVisible is false, map should not be rendered
          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={userLocation}
              isVisible={false}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Map container should not be present in DOM
            const mapContainer = container.querySelector('[class*="fixed inset-0"]');
            expect(mapContainer).toBeNull();

            // Google Maps components should not be rendered
            const apiProvider = container.querySelector('[data-testid="api-provider"]');
            expect(apiProvider).toBeNull();
            
            const googleMap = container.querySelector('[data-testid="google-map"]');
            expect(googleMap).toBeNull();
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Map should handle empty hospital data gracefully when visible
   */
  it('should handle empty hospital data gracefully when visible', () => {
    const mockOnDismiss = vi.fn();

    // Property: Even with empty hospital data, map should still render when visible
    const { container } = render(
      <MapComponent
        hospitalData={[]}
        userLocation={null}
        isVisible={true}
        onDismiss={mockOnDismiss}
      />
    );

    // Map container should be present
    const mapContainer = container.querySelector('[class*="fixed inset-0"]');
    expect(mapContainer).toBeTruthy();

    // Should show 0 hospitals in header
    expect(screen.getByText('Nearby Hospitals (0)')).toBeInTheDocument();

    // Google Maps should still be rendered
    expect(screen.getByTestId('api-provider')).toBeInTheDocument();
    expect(screen.getByTestId('google-map')).toBeInTheDocument();
  });

  /**
   * Property: Map visibility should be controlled solely by isVisible prop
   */
  it('should control visibility solely through isVisible prop', async () => {
    await fc.assert(
      fc.property(
        fc.boolean(), // isVisible value
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
              { minLength: 0, maxLength: 3 }
            ),
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 0, maxLength: 5 }
        ),
        (isVisible, hospitalData) => {
          const mockOnDismiss = vi.fn();

          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={null}
              isVisible={isVisible}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Property: Map presence in DOM should match isVisible prop exactly
            const mapContainer = container.querySelector('[class*="fixed inset-0"]');
            
            if (isVisible) {
              expect(mapContainer).toBeTruthy();
              const apiProvider = container.querySelector('[data-testid="api-provider"]');
              expect(apiProvider).toBeTruthy();
            } else {
              expect(mapContainer).toBeNull();
              const apiProvider = container.querySelector('[data-testid="api-provider"]');
              expect(apiProvider).toBeNull();
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});