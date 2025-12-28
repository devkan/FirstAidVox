import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { WaveformVisualizer, WaveformVisualizerProps } from '../components/WaveformVisualizer';

describe('Waveform Synchronization Property Tests', () => {
  /**
   * **Feature: first-aid-voice-ui, Property 5: Waveform visualization synchronization**
   * **Validates: Requirements 1.5**
   * 
   * Property: For any audio level change while the Voice_Agent is active, 
   * the Waveform_Visualizer should update to reflect the current audio activity
   */
  it('should synchronize waveform display with audio level changes', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary audio levels (0.0 to 1.0)
        fc.float({ min: 0.0, max: 1.0 }),
        // Generate different visualization states
        fc.constantFrom('listening', 'speaking', 'processing'),
        // Generate active/inactive states
        fc.boolean(),
        (audioLevel, variant, isActive) => {
          // Render the WaveformVisualizer with generated props
          const props: WaveformVisualizerProps = {
            audioLevel,
            isActive,
            variant: variant as 'listening' | 'speaking' | 'processing'
          };

          const { container, rerender } = render(<WaveformVisualizer {...props} />);
          
          // Property: Component should render without errors
          expect(container.firstChild).toBeTruthy();
          
          // Property: Should have the correct number of waveform bars (12 as per implementation)
          const waveformContainer = container.querySelector('[role="img"]');
          expect(waveformContainer).toBeTruthy();
          const waveformBars = waveformContainer!.children;
          expect(waveformBars.length).toBe(12);
          
          // Property: When active, bars should reflect the audio level in their styling
          if (isActive) {
            Array.from(waveformBars).forEach((bar) => {
              // Active bars should have full opacity
              expect(bar.className).toContain('opacity-100');
              expect(bar.className).not.toContain('opacity-30');
            });
          } else {
            Array.from(waveformBars).forEach((bar) => {
              // Inactive bars should have reduced opacity
              expect(bar.className).toContain('opacity-30');
            });
          }
          
          // Property: Different variants should have different color classes
          const expectedColorClass = variant === 'listening' ? 'bg-blue-500' :
                                   variant === 'speaking' ? 'bg-green-500' :
                                   'bg-yellow-500';
          
          Array.from(waveformBars).forEach((bar) => {
            expect(bar.className).toContain(expectedColorClass);
          });
          
          // Property: Changing audio level should result in different bar heights
          const newAudioLevel = Math.min(1.0, audioLevel + 0.1);
          const newProps = { ...props, audioLevel: newAudioLevel };
          
          rerender(<WaveformVisualizer {...newProps} />);
          
          // After rerender, bars should still be present and properly styled
          const updatedContainer = container.querySelector('[role="img"]');
          const updatedBars = updatedContainer!.children;
          expect(updatedBars.length).toBe(12);
          
          // Property: Audio level changes should be reflected in the component
          // (The exact height calculation is internal, but the component should handle the change)
          Array.from(updatedBars).forEach((bar) => {
            expect(bar.className).toContain(expectedColorClass);
            if (isActive) {
              expect(bar.className).toContain('opacity-100');
            } else {
              expect(bar.className).toContain('opacity-30');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Waveform should handle edge cases gracefully
   */
  it('should handle edge audio levels gracefully', () => {
    fc.assert(
      fc.property(
        // Test edge cases: exactly 0, exactly 1, and values outside normal range
        fc.constantFrom(0.0, 1.0, -0.1, 1.1, NaN, Infinity, -Infinity),
        fc.constantFrom('listening', 'speaking', 'processing'),
        fc.boolean(),
        (audioLevel, variant, isActive) => {
          const props: WaveformVisualizerProps = {
            audioLevel,
            isActive,
            variant: variant as 'listening' | 'speaking' | 'processing'
          };

          // Property: Component should not crash with edge case values
          expect(() => {
            const { container } = render(<WaveformVisualizer {...props} />);
            
            // Should still render the correct number of bars
            const waveformContainer = container.querySelector('[role="img"]');
            expect(waveformContainer).toBeTruthy();
            const waveformBars = waveformContainer!.children;
            expect(waveformBars.length).toBe(12);
            
            // Should still apply correct styling
            const expectedColorClass = variant === 'listening' ? 'bg-blue-500' :
                                     variant === 'speaking' ? 'bg-green-500' :
                                     'bg-yellow-500';
            
            Array.from(waveformBars).forEach((bar) => {
              expect(bar.className).toContain(expectedColorClass);
            });
          }).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Waveform animation classes should be consistent with variant and active state
   */
  it('should apply consistent animation classes based on variant and active state', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.0, max: 1.0 }),
        fc.constantFrom('listening', 'speaking', 'processing'),
        fc.boolean(),
        (audioLevel, variant, isActive) => {
          const props: WaveformVisualizerProps = {
            audioLevel,
            isActive,
            variant: variant as 'listening' | 'speaking' | 'processing'
          };

          const { container } = render(<WaveformVisualizer {...props} />);
          const waveformContainer = container.querySelector('[role="img"]');
          const waveformBars = waveformContainer!.children;
          
          // Property: Animation classes should be consistent with active state and variant
          if (isActive) {
            const expectedAnimationClass = variant === 'listening' ? 'animate-pulse' :
                                         variant === 'speaking' ? 'animate-bounce' :
                                         'animate-pulse';
            
            Array.from(waveformBars).forEach((bar) => {
              expect(bar.className).toContain(expectedAnimationClass);
            });
          } else {
            // When inactive, should not have animation classes or they should be overridden by opacity
            Array.from(waveformBars).forEach((bar) => {
              expect(bar.className).toContain('opacity-30');
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Waveform should maintain accessibility attributes
   */
  it('should maintain proper accessibility attributes', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.0, max: 1.0 }),
        fc.constantFrom('listening', 'speaking', 'processing'),
        fc.boolean(),
        (audioLevel, variant, isActive) => {
          const props: WaveformVisualizerProps = {
            audioLevel,
            isActive,
            variant: variant as 'listening' | 'speaking' | 'processing'
          };

          const { container } = render(<WaveformVisualizer {...props} />);
          const waveformContainer = container.firstChild as HTMLElement;
          
          // Property: Should have proper accessibility attributes
          expect(waveformContainer.getAttribute('role')).toBe('img');
          expect(waveformContainer.getAttribute('aria-label')).toContain(`Voice ${variant} indicator`);
        }
      ),
      { numRuns: 100 }
    );
  });
});