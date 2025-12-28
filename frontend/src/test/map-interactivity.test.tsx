import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import { MapComponent } from '../components/MapComponent';
import { HospitalLocation } from '../types';

// Mock the Google Maps API with interactive capabilities
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="api-provider">{children}</div>,
  Map: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div 
      data-testid="google-map" 
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </div>
  ),
  Marker: ({ title, onClick }: { title: string; onClick?: () => void }) => (
    <div 
      data-testid="marker" 
      title={title} 
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    />
  ),
  InfoWindow: ({ children, onCloseClick }: { children: React.ReactNode; onCloseClick?: () => void }) => (
    <div data-testid="info-window">
      {children}
      <button data-testid="info-window-close" onClick={onCloseClick}>×</button>
    </div>
  )
}));

describe('Map Interactivity Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: first-aid-voice-ui, Property 12: Map interactivity preservation**
   * **Validates: Requirements 3.4**
   * 
   * Property: While the map is visible, the Map_Component should allow 
   * user interaction for zooming and panning
   */
  it('should preserve map interactivity when visible', async () => {
    await fc.assert(
      fc.property(
        // Generate hospital data for testing interactivity
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
            // Property: Map should be interactive when visible
            const googleMap = container.querySelector('[data-testid="google-map"]');
            expect(googleMap).toBeTruthy();

            // Property: Map should respond to click interactions
            if (googleMap) {
              // Simulate map click (for panning/zooming interactions)
              fireEvent.click(googleMap);
              
              // Map should still be present and functional after interaction
              expect(googleMap).toBeInTheDocument();
              expect(googleMap).toHaveStyle('cursor: pointer');
            }

            // Property: Hospital markers should be interactive
            const markers = container.querySelectorAll('[data-testid="marker"]');
            const hospitalMarkers = Array.from(markers).filter(marker => 
              marker.getAttribute('title') !== 'Your Location'
            );

            hospitalMarkers.forEach(marker => {
              // Each marker should be clickable
              expect(marker).toHaveStyle('cursor: pointer');
              
              // Simulate marker click
              fireEvent.click(marker);
              
              // Marker should still be present after interaction
              expect(marker).toBeInTheDocument();
            });

            // Property: Map container should maintain interactive state
            const mapContainer = container.querySelector('[class*="fixed inset-0"]');
            expect(mapContainer).toBeTruthy();

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Map interactions should not break when no hospitals are present
   */
  it('should maintain interactivity with empty hospital data', () => {
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
      // Property: Map should still be interactive with no hospitals
      const googleMap = container.querySelector('[data-testid="google-map"]');
      expect(googleMap).toBeTruthy();

      if (googleMap) {
        // Should be able to interact with empty map
        fireEvent.click(googleMap);
        expect(googleMap).toBeInTheDocument();
        expect(googleMap).toHaveStyle('cursor: pointer');
      }

      // Should show 0 hospitals but still be interactive
      const containerText = container.textContent || '';
      expect(containerText).toContain('Nearby Hospitals (0)');

    } finally {
      unmount();
    }
  });

  /**
   * Property: Map interactions should work with user location marker
   */
  it('should maintain interactivity with user location marker', async () => {
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
            emergencyServices: fc.constant([]), // Simplified for interaction testing
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
            // Property: Should have user location marker that's interactive
            const markers = container.querySelectorAll('[data-testid="marker"]');
            const userLocationMarker = Array.from(markers).find(marker => 
              marker.getAttribute('title') === 'Your Location'
            );

            expect(userLocationMarker).toBeTruthy();

            if (userLocationMarker) {
              // User location marker should be interactive
              expect(userLocationMarker).toHaveStyle('cursor: pointer');
              
              // Should respond to clicks
              fireEvent.click(userLocationMarker);
              expect(userLocationMarker).toBeInTheDocument();
            }

            // Property: Total markers should be hospitals + user location
            expect(markers).toHaveLength(hospitalData.length + 1);

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Map should handle marker interactions without breaking
   */
  it('should handle marker interactions gracefully', async () => {
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
            // Property: Multiple marker interactions should work
            const markers = container.querySelectorAll('[data-testid="marker"]');
            
            // Click each marker multiple times
            markers.forEach(marker => {
              // First click
              fireEvent.click(marker);
              expect(marker).toBeInTheDocument();
              
              // Second click (should still work)
              fireEvent.click(marker);
              expect(marker).toBeInTheDocument();
            });

            // Property: Map should still be functional after multiple interactions
            const googleMap = container.querySelector('[data-testid="google-map"]');
            expect(googleMap).toBeTruthy();

            if (googleMap) {
              fireEvent.click(googleMap);
              expect(googleMap).toBeInTheDocument();
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
   * Property: Map interactivity should be disabled when not visible
   */
  it('should not have interactive elements when not visible', async () => {
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
          { minLength: 0, maxLength: 3 }
        ),
        (hospitalData) => {
          const mockOnDismiss = vi.fn();

          const { container, unmount } = render(
            <MapComponent
              hospitalData={hospitalData}
              userLocation={null}
              isVisible={false}
              onDismiss={mockOnDismiss}
            />
          );

          try {
            // Property: No interactive elements should be present when not visible
            const googleMap = container.querySelector('[data-testid="google-map"]');
            expect(googleMap).toBeNull();

            const markers = container.querySelectorAll('[data-testid="marker"]');
            expect(markers).toHaveLength(0);

            const mapContainer = container.querySelector('[class*="fixed inset-0"]');
            expect(mapContainer).toBeNull();

          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});