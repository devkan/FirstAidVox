import { MedicalResponse, ConversationEntry, HospitalLocation } from '../types';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

/**
 * Offline Fallback Service
 * Provides graceful degradation when services are unavailable
 * Validates: Requirements 5.5 - Graceful degradation for offline scenarios
 */
export class OfflineFallbackService {
  private cachedHospitals: HospitalLocation[] = [];
  private conversationCache: ConversationEntry[] = [];
  private offlineQueue: Array<{
    id: string;
    type: 'medical_query' | 'image_upload' | 'hospital_search';
    data: any;
    timestamp: Date;
  }> = [];

  /**
   * Get cached medical advice for common conditions
   */
  getOfflineMedicalAdvice(query: string): MedicalResponse | null {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Basic first aid advice for common emergencies
    const offlineAdvice = this.getBasicFirstAidAdvice(normalizedQuery);
    
    if (offlineAdvice) {
      return {
        condition: offlineAdvice.condition,
        urgencyLevel: offlineAdvice.urgencyLevel,
        advice: offlineAdvice.advice,
        confidence: 0.6, // Lower confidence for offline advice
        requiresEmergencyServices: offlineAdvice.requiresEmergencyServices
      };
    }
    
    return null;
  }

  /**
   * Get cached hospital data for offline use
   */
  getCachedHospitals(userLocation?: { latitude: number; longitude: number }): HospitalLocation[] {
    if (this.cachedHospitals.length === 0) {
      // Return default emergency hospitals if no cache
      return this.getDefaultEmergencyHospitals();
    }
    
    if (userLocation) {
      // Sort by distance if location is available
      return this.cachedHospitals
        .map(hospital => ({
          ...hospital,
          distance: this.calculateDistance(userLocation, hospital.coordinates)
        }))
        .sort((a, b) => a.distance - b.distance);
    }
    
    return this.cachedHospitals;
  }

  /**
   * Cache hospital data for offline use
   */
  cacheHospitals(hospitals: HospitalLocation[]): void {
    this.cachedHospitals = hospitals;
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('cached_hospitals', JSON.stringify(hospitals));
    } catch (error) {
      console.warn('Failed to cache hospitals in localStorage:', error);
    }
  }

  /**
   * Load cached hospitals from localStorage
   */
  loadCachedHospitals(): void {
    try {
      const cached = localStorage.getItem('cached_hospitals');
      if (cached) {
        this.cachedHospitals = JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Failed to load cached hospitals:', error);
    }
  }

  /**
   * Queue requests for when connection is restored
   */
  queueOfflineRequest(type: 'medical_query' | 'image_upload' | 'hospital_search', data: any): string {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.offlineQueue.push({
      id,
      type,
      data,
      timestamp: new Date()
    });
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.warn('Failed to store offline queue:', error);
    }
    
    return id;
  }

  /**
   * Process queued requests when connection is restored
   */
  async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }
    
    console.log(`Processing ${this.offlineQueue.length} queued offline requests`);
    
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const request of queue) {
      try {
        await this.processQueuedRequest(request);
      } catch (error) {
        errorHandler.handleError(error as Error, {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.MEDIUM,
          component: 'OfflineFallbackService',
          action: 'processQueuedRequest',
          timestamp: new Date(),
          additionalData: { requestId: request.id, requestType: request.type }
        });
        
        // Re-queue failed requests (with limit)
        if (this.shouldRequeueRequest(request)) {
          this.offlineQueue.push(request);
        }
      }
    }
    
    // Update localStorage
    try {
      localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.warn('Failed to update offline queue:', error);
    }
  }

  /**
   * Get offline status and available fallbacks
   */
  getOfflineCapabilities(): {
    basicAdvice: boolean;
    cachedHospitals: boolean;
    queuedRequests: number;
    emergencyContacts: boolean;
  } {
    return {
      basicAdvice: true,
      cachedHospitals: this.cachedHospitals.length > 0,
      queuedRequests: this.offlineQueue.length,
      emergencyContacts: true
    };
  }

  /**
   * Get emergency contact information
   */
  getEmergencyContacts(): Array<{
    name: string;
    number: string;
    description: string;
  }> {
    return [
      {
        name: 'Emergency Services',
        number: '911',
        description: 'For life-threatening emergencies'
      },
      {
        name: 'Poison Control',
        number: '1-800-222-1222',
        description: 'For poisoning emergencies'
      },
      {
        name: 'Crisis Text Line',
        number: 'Text HOME to 741741',
        description: 'For mental health crises'
      }
    ];
  }

  /**
   * Clear offline cache and queue
   */
  clearOfflineData(): void {
    this.cachedHospitals = [];
    this.conversationCache = [];
    this.offlineQueue = [];
    
    try {
      localStorage.removeItem('cached_hospitals');
      localStorage.removeItem('offline_queue');
    } catch (error) {
      console.warn('Failed to clear offline data:', error);
    }
  }

  // Private methods
  private getBasicFirstAidAdvice(query: string): {
    condition: string;
    urgencyLevel: 'low' | 'moderate' | 'high';
    advice: string;
    requiresEmergencyServices: boolean;
  } | null {
    
    // Chest pain / heart attack
    if (query.includes('chest pain') || query.includes('heart attack') || query.includes('cardiac')) {
      return {
        condition: 'Possible Cardiac Event',
        urgencyLevel: 'high',
        advice: 'Call 911 immediately. Sit down and rest. If conscious and not allergic, chew an aspirin. Do not drive yourself to the hospital.',
        requiresEmergencyServices: true
      };
    }
    
    // Choking
    if (query.includes('choking') || query.includes('cant breathe') || query.includes('airway blocked')) {
      return {
        condition: 'Choking',
        urgencyLevel: 'high',
        advice: 'If conscious: encourage coughing. If unable to cough/speak: perform Heimlich maneuver. Call 911 if unsuccessful.',
        requiresEmergencyServices: true
      };
    }
    
    // Bleeding
    if (query.includes('bleeding') || query.includes('cut') || query.includes('wound')) {
      return {
        condition: 'Bleeding/Wound',
        urgencyLevel: 'moderate',
        advice: 'Apply direct pressure with clean cloth. Elevate if possible. Seek medical attention if bleeding doesn\'t stop or wound is deep.',
        requiresEmergencyServices: false
      };
    }
    
    // Burns
    if (query.includes('burn') || query.includes('burned')) {
      return {
        condition: 'Burn Injury',
        urgencyLevel: 'moderate',
        advice: 'Cool with running water for 10-20 minutes. Do not use ice. Cover with clean, dry cloth. Seek medical attention for severe burns.',
        requiresEmergencyServices: false
      };
    }
    
    // Allergic reaction
    if (query.includes('allergic') || query.includes('allergy') || query.includes('swelling') || query.includes('hives')) {
      return {
        condition: 'Allergic Reaction',
        urgencyLevel: 'moderate',
        advice: 'Remove allergen if known. For mild reactions: antihistamine. For severe reactions (difficulty breathing, swelling): call 911 and use EpiPen if available.',
        requiresEmergencyServices: false
      };
    }
    
    // Fracture/sprain
    if (query.includes('fracture') || query.includes('broken') || query.includes('sprain') || query.includes('twisted')) {
      return {
        condition: 'Possible Fracture/Sprain',
        urgencyLevel: 'moderate',
        advice: 'Do not move the injured area. Apply ice wrapped in cloth. Elevate if possible. Seek medical attention for proper evaluation.',
        requiresEmergencyServices: false
      };
    }
    
    // Fever
    if (query.includes('fever') || query.includes('temperature') || query.includes('hot')) {
      return {
        condition: 'Fever',
        urgencyLevel: 'low',
        advice: 'Rest and stay hydrated. Use fever-reducing medication as directed. Seek medical attention if fever is very high or persistent.',
        requiresEmergencyServices: false
      };
    }
    
    return null;
  }

  private getDefaultEmergencyHospitals(): HospitalLocation[] {
    return [
      {
        id: 'emergency_default_1',
        name: 'Emergency Services',
        coordinates: { latitude: 0, longitude: 0 },
        address: 'Call 911 for nearest emergency room',
        phone: '911',
        distance: 0,
        emergencyServices: [
          {
            type: 'emergency_room',
            waitTime: 0,
            availability: 'available'
          }
        ],
        rating: 5,
        isOpen24Hours: true
      }
    ];
  }

  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async processQueuedRequest(request: any): Promise<void> {
    // This would integrate with the actual services when available
    console.log(`Processing queued ${request.type} request:`, request.id);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In a real implementation, this would call the appropriate service
    // For now, we just log the processing
  }

  private shouldRequeueRequest(request: any): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const age = Date.now() - request.timestamp.getTime();
    
    return age < maxAge;
  }
}

// Create singleton instance
export const offlineFallbackService = new OfflineFallbackService();

// Load cached data on initialization
offlineFallbackService.loadCachedHospitals();