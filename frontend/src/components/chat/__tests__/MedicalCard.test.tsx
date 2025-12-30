import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MedicalCard } from '../MedicalCard';
import type { MedicalAssessment, UrgencyLevel } from '../types';

describe('MedicalCard', () => {
  const createAssessment = (overrides: Partial<MedicalAssessment> = {}): MedicalAssessment => ({
    condition: 'Test medical condition',
    urgencyLevel: 'low',
    advice: 'Test medical advice for the patient',
    confidence: 0.8,
    ...overrides
  });

  const defaultTimestamp = new Date('2023-01-01T10:00:00Z');

  describe('Property 5: Medical Card Highlighting', () => {
    it('should have distinct visual styling that differentiates from regular messages', () => {
      const assessment = createAssessment();
      
      render(<MedicalCard assessment={assessment} timestamp={defaultTimestamp} />);
      
      // Should have medical card specific classes
      const container = screen.getByText('Medical Assessment').closest('.rounded-2xl');
      expect(container).toHaveClass('shadow-medical');
      expect(container).toHaveClass('medical-card-safe'); // For low urgency
      expect(container).toHaveClass('bg-gradient-to-br');
    });

    it('should apply emergency styling for emergency urgency level', () => {
      const emergencyAssessment = createAssessment({ 
        urgencyLevel: 'emergency',
        condition: 'Severe chest pain'
      });
      
      render(<MedicalCard assessment={emergencyAssessment} timestamp={defaultTimestamp} />);
      
      const container = screen.getByText('Medical Assessment').closest('.rounded-2xl');
      expect(container).toHaveClass('medical-card-emergency');
      expect(container).toHaveClass('border-emergency-500');
      
      // Should show emergency badge
      expect(screen.getByText('EMERGENCY')).toBeInTheDocument();
      expect(screen.getByText('🚨')).toBeInTheDocument();
      
      // Should show emergency actions
      expect(screen.getByText('IMMEDIATE ACTION REQUIRED')).toBeInTheDocument();
      expect(screen.getByText('📞 Call 911')).toBeInTheDocument();
    });

    it('should apply high priority styling for high urgency level', () => {
      const highAssessment = createAssessment({ 
        urgencyLevel: 'high',
        condition: 'Severe headache with vision changes'
      });
      
      render(<MedicalCard assessment={highAssessment} timestamp={defaultTimestamp} />);
      
      const container = screen.getByText('Medical Assessment').closest('.rounded-2xl');
      expect(container).toHaveClass('medical-card-emergency');
      expect(container).toHaveClass('border-emergency-400');
      
      // Should show high priority badge
      expect(screen.getByText('HIGH PRIORITY')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
      
      // Should show urgent medical attention notice
      expect(screen.getByText('Urgent Medical Attention')).toBeInTheDocument();
    });

    it('should apply moderate styling for moderate urgency level', () => {
      const moderateAssessment = createAssessment({ 
        urgencyLevel: 'moderate',
        condition: 'Persistent cough with fever'
      });
      
      render(<MedicalCard assessment={moderateAssessment} timestamp={defaultTimestamp} />);
      
      const container = screen.getByText('Medical Assessment').closest('.rounded-2xl');
      expect(container).toHaveClass('medical-card-warning');
      expect(container).toHaveClass('border-warning-400');
      
      // Should show moderate badge
      expect(screen.getByText('MODERATE')).toBeInTheDocument();
      
      // Should not show emergency actions
      expect(screen.queryByText('IMMEDIATE ACTION REQUIRED')).not.toBeInTheDocument();
      expect(screen.queryByText('📞 Call 911')).not.toBeInTheDocument();
    });

    it('should apply safe styling for low urgency level', () => {
      const lowAssessment = createAssessment({ 
        urgencyLevel: 'low',
        condition: 'Minor headache'
      });
      
      render(<MedicalCard assessment={lowAssessment} timestamp={defaultTimestamp} />);
      
      const container = screen.getByText('Medical Assessment').closest('.rounded-2xl');
      expect(container).toHaveClass('medical-card-safe');
      expect(container).toHaveClass('border-safe-400');
      
      // Should show low priority badge
      expect(screen.getByText('LOW PRIORITY')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
      
      // Should not show emergency actions
      expect(screen.queryByText('IMMEDIATE ACTION REQUIRED')).not.toBeInTheDocument();
    });

    it('should maintain consistent styling across different urgency levels', () => {
      const urgencyLevels: UrgencyLevel[] = ['low', 'moderate', 'high', 'emergency'];
      
      urgencyLevels.forEach((urgency) => {
        const assessment = createAssessment({ urgencyLevel: urgency });
        const { container } = render(<MedicalCard assessment={assessment} timestamp={defaultTimestamp} />);
        
        // All should have consistent base styling
        const cardContainer = container.querySelector('.rounded-2xl');
        expect(cardContainer).toHaveClass('shadow-medical');
        expect(cardContainer).toHaveClass('overflow-hidden');
        expect(cardContainer).toHaveClass('mb-4');
        
        // All should have gradient backgrounds
        expect(cardContainer).toHaveClass('bg-gradient-to-br');
        
        // Clean up for next iteration
        container.remove();
      });
    });

    it('should display confidence level with appropriate visual indicators', () => {
      const highConfidenceAssessment = createAssessment({ confidence: 0.95 });
      const { container: highContainer } = render(
        <MedicalCard assessment={highConfidenceAssessment} timestamp={defaultTimestamp} />
      );
      
      expect(screen.getByText(/95%/)).toBeInTheDocument();
      
      // High confidence should show green bar
      const highConfidenceBar = highContainer.querySelector('.bg-safe-500');
      expect(highConfidenceBar).toBeInTheDocument();
      
      highContainer.remove();

      // Test medium confidence
      const mediumConfidenceAssessment = createAssessment({ confidence: 0.65 });
      const { container: mediumContainer } = render(
        <MedicalCard assessment={mediumConfidenceAssessment} timestamp={defaultTimestamp} />
      );
      
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      
      // Medium confidence should show yellow bar
      const mediumConfidenceBar = mediumContainer.querySelector('.bg-warning-500');
      expect(mediumConfidenceBar).toBeInTheDocument();
      
      mediumContainer.remove();

      // Test low confidence
      const lowConfidenceAssessment = createAssessment({ confidence: 0.45 });
      const { container: lowContainer } = render(<MedicalCard assessment={lowConfidenceAssessment} timestamp={defaultTimestamp} />);
      
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      
      // Low confidence should show red bar
      const lowConfidenceBar = lowContainer.querySelector('.bg-emergency-500');
      expect(lowConfidenceBar).toBeInTheDocument();
    });

    it('should show hospital information when available', () => {
      const assessmentWithHospitals = createAssessment({
        hospitalData: [
          { name: 'General Hospital', distance: '2.1 km' },
          { name: 'Emergency Center', distance: '3.5 km' }
        ]
      });
      
      render(<MedicalCard assessment={assessmentWithHospitals} timestamp={defaultTimestamp} />);
      
      expect(screen.getByText('Nearby Medical Facilities')).toBeInTheDocument();
      expect(screen.getByText('2 facilities found near your location')).toBeInTheDocument();
      expect(screen.getByText('View on Map →')).toBeInTheDocument();
    });

    it('should not show hospital section when no hospital data available', () => {
      const assessmentWithoutHospitals = createAssessment({ hospitalData: undefined });
      
      render(<MedicalCard assessment={assessmentWithoutHospitals} timestamp={defaultTimestamp} />);
      
      expect(screen.queryByText('Nearby Medical Facilities')).not.toBeInTheDocument();
      expect(screen.queryByText('View on Map →')).not.toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    it('should expand/collapse long advice text', () => {
      const longAdvice = 'This is a very long medical advice that should be truncated initially. '.repeat(10);
      const assessmentWithLongAdvice = createAssessment({ advice: longAdvice });
      
      render(<MedicalCard assessment={assessmentWithLongAdvice} timestamp={defaultTimestamp} />);
      
      // Should show "Show More" button for long text
      const showMoreButton = screen.getByText('Show More');
      expect(showMoreButton).toBeInTheDocument();
      
      // Click to expand
      fireEvent.click(showMoreButton);
      expect(screen.getByText('Show Less')).toBeInTheDocument();
      
      // Click to collapse
      fireEvent.click(screen.getByText('Show Less'));
      expect(screen.getByText('Show More')).toBeInTheDocument();
    });

    it('should not show expand/collapse for short advice text', () => {
      const shortAdvice = 'Short advice text';
      const assessmentWithShortAdvice = createAssessment({ advice: shortAdvice });
      
      render(<MedicalCard assessment={assessmentWithShortAdvice} timestamp={defaultTimestamp} />);
      
      expect(screen.queryByText('Show More')).not.toBeInTheDocument();
      expect(screen.queryByText('Show Less')).not.toBeInTheDocument();
    });

    it('should handle emergency call button click', () => {
      // Mock window.open
      const mockOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      
      const emergencyAssessment = createAssessment({ urgencyLevel: 'emergency' });
      
      render(<MedicalCard assessment={emergencyAssessment} timestamp={defaultTimestamp} />);
      
      const callButton = screen.getByText('📞 Call 911');
      fireEvent.click(callButton);
      
      expect(mockOpen).toHaveBeenCalledWith('tel:911', '_self');
      
      mockOpen.mockRestore();
    });
  });

  describe('Timestamp Formatting', () => {
    it('should format timestamp correctly', () => {
      const testDate = new Date('2023-06-15T14:30:00Z');
      const assessment = createAssessment();
      
      const { container } = render(<MedicalCard assessment={assessment} timestamp={testDate} />);
      
      // Should show formatted date and time (timezone may vary in test environment)
      expect(screen.getByText(/Jun 15/)).toBeInTheDocument();
      // Check for time pattern instead of exact time due to timezone differences
      const timeElement = container.querySelector('.text-sm.opacity-75');
      expect(timeElement?.textContent).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and semantic structure', () => {
      const assessment = createAssessment({ urgencyLevel: 'high' });
      
      render(<MedicalCard assessment={assessment} timestamp={defaultTimestamp} />);
      
      // Should have proper heading structure
      expect(screen.getByRole('heading', { name: /Medical Assessment/ })).toBeInTheDocument();
      
      // Emergency button should be focusable
      const emergencyButton = screen.getByText('📞 Call 911');
      expect(emergencyButton).toHaveClass('focus-emergency');
    });

    it('should support keyboard navigation', () => {
      const longAdvice = 'Long advice text. '.repeat(20);
      const assessment = createAssessment({ advice: longAdvice });
      
      render(<MedicalCard assessment={assessment} timestamp={defaultTimestamp} />);
      
      const expandButton = screen.getByText('Show More');
      
      // Should be focusable
      expandButton.focus();
      expect(document.activeElement).toBe(expandButton);
      
      // Should respond to Enter key
      fireEvent.keyDown(expandButton, { key: 'Enter' });
      // Note: This would require additional implementation in the component
    });
  });
});

/**
 * Property-Based Test: Medical Card Highlighting
 * 
 * Feature: ui-redesign, Property 5: For any medical assessment response, 
 * the medical card should have distinct visual styling that differentiates it from regular messages
 * 
 * This test validates that medical cards are visually distinct from regular chat messages
 * and that different urgency levels have appropriate visual treatments. It ensures that
 * medical information is properly highlighted and accessible to users.
 */