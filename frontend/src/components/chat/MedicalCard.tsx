import React, { useState } from 'react';
import { marked } from 'marked';
import type { MedicalCardProps, UrgencyLevel } from './types';

export const MedicalCard = React.memo(function MedicalCard({ assessment, timestamp, className = '' }: MedicalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Helper function to extract text content from any input
  const getTextContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    } else if (content && typeof content === 'object') {
      return content.message || content.text || content.content || '';
    }
    return String(content || '');
  };

  // Configure marked for safe HTML rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Convert markdown to HTML safely
  const renderMarkdown = (content: any) => {
    try {
      // Ensure content is a string
      const textContent = getTextContent(content);
      const html = marked(textContent);
      return { __html: html };
    } catch (error) {
      console.error('Markdown parsing error:', error);
      // Fallback: return the content as-is
      const fallbackContent = getTextContent(content);
      return { __html: fallbackContent };
    }
  };
  
  // Get urgency-based styling
  const getUrgencyStyles = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'emergency':
        return {
          container: 'medical-card-emergency border-emergency-500 bg-gradient-to-br from-emergency-50 to-emergency-100',
          badge: 'bg-emergency-500 text-white',
          icon: '🚨',
          label: 'EMERGENCY',
          textColor: 'text-emergency-800'
        };
      case 'high':
        return {
          container: 'medical-card-emergency border-emergency-400 bg-gradient-to-br from-emergency-50 to-emergency-100',
          badge: 'bg-emergency-400 text-white',
          icon: '⚠️',
          label: 'HIGH PRIORITY',
          textColor: 'text-emergency-700'
        };
      case 'moderate':
        return {
          container: 'medical-card-warning border-warning-400 bg-gradient-to-br from-warning-50 to-warning-100',
          badge: 'bg-warning-500 text-white',
          icon: '⚠️',
          label: 'MODERATE',
          textColor: 'text-warning-800'
        };
      default:
        return {
          container: 'medical-card-safe border-safe-400 bg-gradient-to-br from-safe-50 to-safe-100',
          badge: 'bg-safe-500 text-white',
          icon: '✅',
          label: 'LOW PRIORITY',
          textColor: 'text-safe-800'
        };
    }
  };

  const urgencyStyles = getUrgencyStyles(assessment.urgencyLevel);
  const confidencePercentage = Math.round(assessment.confidence * 100);

  // Handle viewing hospitals on map
  const handleViewOnMap = (hospitals: any[]) => {
    if (!hospitals || hospitals.length === 0) {
      console.log('No hospital data available');
      return;
    }

    // Get the first hospital's location for the map center
    const firstHospital = hospitals[0];
    
    // Try to use Google Maps if available, otherwise use a generic map service
    if (firstHospital.latitude && firstHospital.longitude) {
      // Open Google Maps with the hospital location
      const mapsUrl = `https://www.google.com/maps/search/hospitals/@${firstHospital.latitude},${firstHospital.longitude},15z`;
      window.open(mapsUrl, '_blank');
    } else if (firstHospital.address) {
      // Search by address if coordinates are not available
      const encodedAddress = encodeURIComponent(firstHospital.address);
      const mapsUrl = `https://www.google.com/maps/search/hospitals+${encodedAddress}`;
      window.open(mapsUrl, '_blank');
    } else {
      // Fallback: search for hospitals in general area
      const mapsUrl = `https://www.google.com/maps/search/hospitals+near+me`;
      window.open(mapsUrl, '_blank');
    }
  };

  // Handle getting directions to a specific hospital
  const handleGetDirections = (hospital: any) => {
    if (!hospital) {
      console.log('No hospital data available');
      return;
    }

    // Try to use coordinates first, then address
    if (hospital.latitude && hospital.longitude) {
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`;
      window.open(directionsUrl, '_blank');
    } else if (hospital.address) {
      const encodedAddress = encodeURIComponent(hospital.address);
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
      window.open(directionsUrl, '_blank');
    } else if (hospital.name) {
      const encodedName = encodeURIComponent(hospital.name);
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedName}`;
      window.open(directionsUrl, '_blank');
    } else {
      // Fallback: search for hospitals in general area
      const mapsUrl = `https://www.google.com/maps/search/hospitals+near+me`;
      window.open(mapsUrl, '_blank');
    }
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
      hour12: false
    }).format(date);
  };

  return (
    <div className={`${urgencyStyles.container} rounded-xl sm:rounded-2xl shadow-medical overflow-hidden mb-3 sm:mb-4 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <svg className="w-4 h-4 sm:w-6 sm:h-6 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-bold ${urgencyStyles.textColor}`}>
                Medical Assessment
              </h3>
              <p className="text-xs sm:text-sm opacity-75">
                AI Analysis • {formatTime(timestamp)}
              </p>
            </div>
          </div>
          
          {/* Urgency Badge */}
          <div className={`${urgencyStyles.badge} px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs font-bold flex items-center space-x-1`}>
            <span className="text-xs sm:text-sm">{urgencyStyles.icon}</span>
            <span className="hidden xs:inline">{urgencyStyles.label}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Condition */}
        <div>
          <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h4 className={`text-sm sm:text-base font-semibold ${urgencyStyles.textColor}`}>
              Predicted Condition
            </h4>
          </div>
          <p className={`text-base sm:text-lg leading-relaxed ${urgencyStyles.textColor} bg-white/30 rounded-lg p-3 sm:p-4`}>
            {assessment.condition}
          </p>
        </div>

        {/* Advice */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className={`text-sm sm:text-base font-semibold ${urgencyStyles.textColor}`}>
                Recommended Actions
              </h4>
            </div>
            
            {assessment.advice.length > 200 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs sm:text-sm font-medium ${urgencyStyles.textColor} hover:underline focus:outline-none`}
              >
                {isExpanded ? 'Less' : 'More'}
              </button>
            )}
          </div>
          
          <div className={`bg-white/40 rounded-lg p-3 sm:p-4 ${urgencyStyles.textColor}`}>
            <div 
              className={`text-base sm:text-lg leading-relaxed prose prose-sm sm:prose-base max-w-none 
                         prose-headings:text-current prose-headings:font-semibold prose-headings:mb-3
                         prose-p:text-current prose-p:my-2 prose-p:leading-relaxed
                         prose-strong:text-current prose-strong:font-semibold
                         prose-em:text-current prose-em:italic
                         prose-ul:text-current prose-ul:my-3 prose-ul:pl-5
                         prose-ol:text-current prose-ol:my-3 prose-ol:pl-5
                         prose-li:text-current prose-li:my-1 prose-li:leading-relaxed
                         prose-code:text-current prose-code:bg-white prose-code:bg-opacity-50 prose-code:px-2 prose-code:py-1 prose-code:rounded
                         [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${
                !isExpanded && assessment.advice.length > 200 ? 'line-clamp-3' : ''
              }`}
              dangerouslySetInnerHTML={renderMarkdown(assessment.advice)}
            />
          </div>
        </div>

        {/* Confidence and Metadata */}
        <div className="border-t border-white/20 pt-3 sm:pt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xs sm:text-sm font-medium">
                  Confidence: {confidencePercentage}%
                </span>
              </div>
              
              {/* Confidence Bar */}
              <div className="w-16 sm:w-24 bg-white/30 rounded-full h-1.5 sm:h-2">
                <div 
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-500 ${
                    assessment.confidence >= 0.8 ? 'bg-safe-500' : 
                    assessment.confidence >= 0.6 ? 'bg-warning-500' : 'bg-emergency-500'
                  }`}
                  style={{ width: `${confidencePercentage}%` }}
                />
              </div>
            </div>
            
            <div className="text-xs opacity-75">
              Updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Emergency Actions */}
        {(assessment.urgencyLevel === 'emergency' || assessment.urgencyLevel === 'high') && (
          <div className="bg-white/50 rounded-lg p-3 sm:p-4 border border-white/30">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-emergency-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h5 className="text-sm sm:text-base font-semibold text-emergency-800 mb-1 sm:mb-2">
                  {assessment.urgencyLevel === 'emergency' ? 'IMMEDIATE ACTION REQUIRED' : 'Urgent Medical Attention'}
                </h5>
                <p className="text-xs sm:text-sm text-emergency-700 mb-2 sm:mb-3">
                  {assessment.urgencyLevel === 'emergency' 
                    ? 'This condition may be life-threatening. Seek immediate emergency care.'
                    : 'This condition requires prompt medical attention. Consider visiting a healthcare provider soon.'
                  }
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <button 
                    onClick={() => window.open('tel:911', '_self')}
                    className="bg-emergency-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-emergency-600 transition-colors focus-emergency touch-manipulation"
                  >
                    📞 Call 911
                  </button>
                  {assessment.hospitalData && assessment.hospitalData.length > 0 && (
                    <button className="bg-white text-emergency-600 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors border border-emergency-200 touch-manipulation">
                      🏥 Find Hospitals
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hospital Information */}
        {assessment.hospitalData && assessment.hospitalData.length > 0 && (
          <div className="bg-white/30 rounded-lg p-3 sm:p-4">
            <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h4 className={`text-sm sm:text-base font-semibold ${urgencyStyles.textColor}`}>
                Nearby Medical Facilities
              </h4>
            </div>
            <p className="text-xs sm:text-sm opacity-75 mb-3">
              {assessment.hospitalData.length} facilities found near your location
            </p>
            
            {/* Hospital List */}
            <div className="space-y-2 mb-3">
              {assessment.hospitalData.slice(0, 3).map((hospital: any, index: number) => (
                <div key={index} className="flex items-center justify-between bg-white/20 rounded-lg p-2">
                  <div className="flex-1">
                    <h5 className="text-xs sm:text-sm font-medium">{hospital.name}</h5>
                    {hospital.address && (
                      <p className="text-xs opacity-75 truncate">{hospital.address}</p>
                    )}
                    {hospital.distance_km && (
                      <p className="text-xs opacity-75">{hospital.distance_km.toFixed(1)} km away</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleGetDirections(hospital)}
                    className="ml-2 px-2 py-1 bg-white/30 hover:bg-white/50 rounded text-xs font-medium transition-colors"
                  >
                    Directions
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => handleViewOnMap(assessment.hospitalData || [])}
              className="text-xs sm:text-sm font-medium hover:underline focus:outline-none touch-manipulation"
            >
              View All on Map →
            </button>
          </div>
        )}
      </div>
    </div>
  );
});