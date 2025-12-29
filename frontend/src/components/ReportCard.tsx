import React from 'react';
import type { MedicalResponse } from '../types/index';

export interface ReportCardProps {
  condition: string;
  urgencyLevel: 'low' | 'moderate' | 'high';
  adviceSummary: string;
  confidence: number;
  className?: string;
}

interface UrgencyColors {
  low: string;
  moderate: string;
  high: string;
}

const urgencyColors: UrgencyColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200'
};

const urgencyIcons = {
  low: '✓',
  moderate: '⚠',
  high: '⚠'
};

const urgencyLabels = {
  low: 'Low Priority',
  moderate: 'Moderate Priority', 
  high: 'High Priority'
};

export function ReportCard({
  condition,
  urgencyLevel,
  adviceSummary,
  confidence,
  className = ''
}: ReportCardProps) {
  
  console.log('📋 ReportCard render with props:', { condition, urgencyLevel, adviceSummary, confidence });
  
  // Format confidence as percentage
  const confidencePercentage = Math.round(confidence * 100);
  
  // Get urgency styling
  const urgencyColorClass = urgencyColors[urgencyLevel];
  const urgencyIcon = urgencyIcons[urgencyLevel];
  const urgencyLabel = urgencyLabels[urgencyLevel];

  return (
    <div className={`bg-red-100 border-4 border-red-500 rounded-lg shadow-lg overflow-hidden ${className}`} style={{minHeight: '200px'}}>
      <div style={{backgroundColor: 'yellow', padding: '10px', fontSize: '20px', fontWeight: 'bold'}}>
        🚨 MEDICAL REPORT CARD - TEST VISIBILITY 🚨
      </div>
      {/* Header with urgency indicator */}
      <div className={`px-6 py-4 border-b border-gray-200 ${urgencyLevel === 'high' ? 'bg-red-50' : urgencyLevel === 'moderate' ? 'bg-yellow-50' : 'bg-green-50'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            Medical Assessment
          </h2>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${urgencyColorClass}`}>
            <span className="mr-1" aria-hidden="true">{urgencyIcon}</span>
            {urgencyLabel}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Condition */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Predicted Condition
          </h3>
          <p className="text-gray-700 text-base leading-relaxed">
            {condition}
          </p>
        </div>

        {/* Advice Summary */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Recommended Actions
          </h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700 text-base leading-relaxed">
              {adviceSummary}
            </p>
          </div>
        </div>

        {/* Confidence and metadata */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>
                Confidence: <span className="font-medium text-gray-800">{confidencePercentage}%</span>
              </span>
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    confidence >= 0.8 ? 'bg-green-500' : 
                    confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${confidencePercentage}%` }}
                />
              </div>
            </div>
            <span className="text-xs">
              Updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Emergency notice for high urgency */}
        {urgencyLevel === 'high' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-red-600 text-xl" aria-hidden="true">🚨</span>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-red-800">
                  Emergency Attention Required
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  This condition may require immediate medical attention. Consider contacting emergency services or visiting the nearest hospital.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for integration with medical state
export interface MedicalReportCardProps {
  medicalResponse: MedicalResponse | null;
  className?: string;
}

export function MedicalReportCard({ medicalResponse, className }: MedicalReportCardProps) {
  console.log('🏥 MedicalReportCard render:', { medicalResponse });
  
  if (!medicalResponse) {
    console.log('📝 No medical response, showing placeholder');
    return (
      <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center ${className}`}>
        <div className="text-gray-400 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">
          No medical assessment available yet. Start a conversation to receive your medical report.
        </p>
      </div>
    );
  }

  console.log('✅ Rendering medical report with data:', medicalResponse);
  
  return (
    <div style={{ 
      position: 'relative', 
      zIndex: 10, 
      backgroundColor: 'red', 
      border: '5px solid blue', 
      padding: '20px',
      margin: '20px 0',
      minHeight: '300px'
    }}>
      <div style={{ 
        backgroundColor: 'yellow', 
        color: 'black', 
        padding: '10px', 
        fontSize: '24px', 
        fontWeight: 'bold',
        textAlign: 'center'
      }}>
        🚨 MEDICAL REPORT VISIBLE - TEST MODE 🚨
      </div>
      <ReportCard
        condition={medicalResponse.condition}
        urgencyLevel={medicalResponse.urgencyLevel}
        adviceSummary={medicalResponse.advice}
        confidence={medicalResponse.confidence}
        className={className}
      />
    </div>
  );
}

export default ReportCard;