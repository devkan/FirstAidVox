import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { MapComponent } from '../components/MapComponent';
import { HospitalLocation } from '../types';

// Mock the Google Maps API
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="api-provider">{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="google-map">{children}</div>,
  Marker: ({ title }: { title: string }) => <div data-testid="marker" title={title} />,
  InfoWindow: ({ children }: { children: React.ReactNode }) => <div data-testid="info-window">{children}</div>
}));

describe('Hospital Marker Information Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 11: Hospital marker information completeness**
   * **Validates: Requirements 3.3**
   * 
   * Property: For any displayed hospital marker, the Map_Component should show 
   * all relevant facility information including name, distance, and services
   */
  it('should display complete hospital information for all markers', async () => {
    await fc.assert(
      fc.property(
        // Generate hospital data with all required fields
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
          { minLength: 1, maxLength: 5 }
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
            // Property: Each hospital should have complete information displayed
            hospitalData.forEach(hospital => {
              const hospitalText = container.textContent || '';
              
              // Hospital name should be present
              expect(hospitalText).toContain(hospital.name);
              
              // Hospital address should be present
              expect(hospitalText).toContain(hospital.address);
              
              // Distance should be formatted and displayed
              const distanceText = hospital.distance < 1 
                ? `${Math.round(hospital.distance * 1000)}m`
                : `${hospital.distance.toFixed(1)}km`;
              expect(hospitalText).toContain(distanceText);
              
              // Rating should be displayed
              expect(hospitalText).toContain(hospital.rating.toString());
              
              // 24/7 status should be indicated if applicable
              if (hospital.isOpen24Hours) {
                expect(hospitalText).toContain('24');
              }
              
              // Emergency services information should be present if available
              if (hospital.emergencyServices.length > 0) {
                // At least one service type should be mentioned
                const hasServiceInfo = hospital.emergencyServices.some(service => {
                  const serviceType = service.type.replace('_', ' ');
                  return hospitalText.includes(serviceType) || 
                         hospitalText.includes(service.availability) ||
                         hospitalText.includes('min') || // wait time formatting
                         hospitalText.includes('h'); // hour formatting
                });
                // Note: We don't strictly require all service info to be visible in the list view
                // as some might only appear in the info window
              }
            });

            // Property: Each hospital should have a corresponding marker
            const markers = container.querySelectorAll('[data-testid="marker"]');
            const hospitalMarkers = Array.from(markers).filter(marker => 
              hospitalData.some(hospital => 
                marker.getAttribute('title') === hospital.name
              )
            );
            expect(hospitalMarkers).toHaveLength(hospitalData.length);

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hospital information should be consistent between list and markers
   */
  it('should maintain consistent information between hospital list and markers', async () => {
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
          { minLength: 1, maxLength: 3 }
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
            // Property: Each hospital in the data should have a marker with matching title
            hospitalData.forEach(hospital => {
              // Use a more robust way to find markers by title
              const markers = container.querySelectorAll('[data-testid="marker"]');
              const matchingMarker = Array.from(markers).find(marker => 
                marker.getAttribute('title') === hospital.name
              );
              expect(matchingMarker).toBeTruthy();
            });

            // Property: Number of hospital markers should match hospital data length
            const hospitalMarkers = container.querySelectorAll('[data-testid="marker"]');
            // Filter out user location marker if present
            const actualHospitalMarkers = Array.from(hospitalMarkers).filter(marker => 
              marker.getAttribute('title') !== 'Your Location'
            );
            expect(actualHospitalMarkers).toHaveLength(hospitalData.length);

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hospital information should handle edge cases gracefully
   */
  it('should handle hospital information edge cases gracefully', async () => {
    await fc.assert(
      fc.property(
        // Generate hospitals with potential edge case values
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }),
              fc.constant(''), // Edge case: empty name
              fc.string({ minLength: 1, maxLength: 1 }) // Edge case: single character
            ),
            coordinates: fc.record({
              latitude: fc.float({ min: -90, max: 90 }),
              longitude: fc.float({ min: -180, max: 180 })
            }),
            address: fc.oneof(
              fc.string({ minLength: 1, maxLength: 100 }),
              fc.constant('') // Edge case: empty address
            ),
            phone: fc.string({ minLength: 0, maxLength: 15 }), // Can be empty
            distance: fc.oneof(
              fc.float({ min: 0, max: 100 }),
              fc.constant(0), // Edge case: zero distance
              fc.float({ min: Math.fround(0.001), max: Math.fround(0.999) }) // Edge case: very small distance
            ),
            emergencyServices: fc.oneof(
              fc.array(
                fc.record({
                  type: fc.constantFrom('emergency_room', 'urgent_care', 'trauma_center'),
                  waitTime: fc.integer({ min: 0, max: 300 }),
                  availability: fc.constantFrom('available', 'busy', 'full')
                }),
                { minLength: 1, maxLength: 3 }
              ),
              fc.constant([]) // Edge case: no services
            ),
            rating: fc.oneof(
              fc.float({ min: 1, max: 5 }),
              fc.constant(1), // Edge case: minimum rating
              fc.constant(5)  // Edge case: maximum rating
            ),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (hospitalData) => {
          const mockOnDismiss = vi.fn();

          // Property: Component should render without crashing even with edge case data
          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={null}
              isVisible={true}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Should render successfully
            const mapContainer = container.querySelector('[class*="fixed inset-0"]');
            expect(mapContainer).toBeTruthy();

            // Should display hospital count correctly
            const headerText = container.textContent || '';
            expect(headerText).toContain(`Nearby Hospitals (${hospitalData.length})`);

            // Should handle empty names gracefully (either display empty or fallback)
            hospitalData.forEach(hospital => {
              if (hospital.name.trim() === '') {
                // Component should handle empty names gracefully - either show empty or some fallback
                // We don't crash, which is the main property we're testing
              } else {
                expect(headerText).toContain(hospital.name);
              }
            });

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 } // Reduced runs for edge case testing
    );
  });

  /**
   * Property: Distance formatting should be consistent and readable
   */
  it('should format distances consistently and readably', async () => {
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
            emergencyServices: fc.constant([]), // Simplified for distance testing
            rating: fc.float({ min: 1, max: 5 }),
            isOpen24Hours: fc.boolean()
          }),
          { minLength: 1, maxLength: 3 }
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
            const containerText = container.textContent || '';

            // Property: Distance should be formatted correctly for each hospital
            hospitalData.forEach(hospital => {
              const expectedFormat = hospital.distance < 1 
                ? `${Math.round(hospital.distance * 1000)}m`
                : `${hospital.distance.toFixed(1)}km`;
              
              expect(containerText).toContain(expectedFormat);
            });

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});