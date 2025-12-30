import React from 'react';
import { conversationalService } from '../../services/conversationalService';

interface ConversationProgressProps {
  className?: string;
}

export const ConversationProgress = React.memo(function ConversationProgress({ 
  className = '' 
}: ConversationProgressProps) {
  const conversation = conversationalService.getCurrentConversation();
  
  if (!conversation) return null;

  const { currentStage, symptoms, assessmentProgress } = conversation;
  
  // Stage configuration
  const stages = [
    { key: 'initial', label: 'Initial Assessment', icon: '🩺', description: 'Gathering key symptoms' },
    { key: 'clarification', label: 'Clarification', icon: '🔍', description: 'Asking follow-up questions' },
    { key: 'final', label: 'Diagnosis & Advice', icon: '📋', description: 'Providing diagnosis and recommendations' }
  ];

  const currentStageIndex = stages.findIndex(stage => stage.key === currentStage);
  
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 mb-4 ${className}`}>
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Assessment Progress</h3>
        <span className="text-xs text-gray-500">
          {conversationalService.getConversationSummary()}
        </span>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-4">
        {stages.map((stage, index) => {
          const isActive = index === currentStageIndex;
          const isCompleted = index < currentStageIndex;
          const isUpcoming = index > currentStageIndex;
          
          return (
            <div key={stage.key} className="flex flex-col items-center flex-1">
              {/* Step Circle */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-2
                ${isActive ? 'bg-blue-500 text-white ring-4 ring-blue-100' : ''}
                ${isCompleted ? 'bg-green-500 text-white' : ''}
                ${isUpcoming ? 'bg-gray-200 text-gray-500' : ''}
              `}>
                {isCompleted ? '✓' : stage.icon}
              </div>
              
              {/* Step Label */}
              <div className="text-center">
                <div className={`text-xs font-medium ${
                  isActive ? 'text-blue-600' : 
                  isCompleted ? 'text-green-600' : 
                  'text-gray-400'
                }`}>
                  {stage.label}
                </div>
                {isActive && (
                  <div className="text-xs text-gray-500 mt-1">
                    {stage.description}
                  </div>
                )}
              </div>
              
              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div className={`
                  absolute h-0.5 w-full top-4 left-1/2 transform -translate-y-1/2
                  ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}
                `} style={{ zIndex: -1 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Assessment Info */}
      {(symptoms.length > 0 || Object.keys(assessmentProgress).length > 0) && (
        <div className="border-t border-gray-100 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Symptoms Identified */}
            {symptoms.length > 0 && (
              <div>
                <span className="font-medium text-gray-600">Symptoms:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {symptoms.slice(0, 5).map((symptom, index) => (
                    <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                      {symptom}
                    </span>
                  ))}
                  {symptoms.length > 5 && (
                    <span className="text-gray-500">+{symptoms.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
            
            {/* Assessment Progress */}
            {Object.keys(assessmentProgress).length > 0 && (
              <div>
                <span className="font-medium text-gray-600">Progress:</span>
                <div className="mt-1 space-y-1">
                  {assessmentProgress.duration && (
                    <div className="text-gray-600">
                      <span className="text-gray-500">Duration:</span> {assessmentProgress.duration}
                    </div>
                  )}
                  {assessmentProgress.severity && (
                    <div className="text-gray-600">
                      <span className="text-gray-500">Severity:</span> {assessmentProgress.severity}
                    </div>
                  )}
                  {assessmentProgress.associatedSymptoms && assessmentProgress.associatedSymptoms.length > 0 && (
                    <div className="text-gray-600">
                      <span className="text-gray-500">Associated:</span> {assessmentProgress.associatedSymptoms.slice(0, 2).join(', ')}
                      {assessmentProgress.associatedSymptoms.length > 2 && '...'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage-specific Tips */}
      <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
        {currentStage === 'initial' && (
          <div>💡 <strong>Tip:</strong> Describe your main symptoms. The AI will ask key questions to quickly assess your condition.</div>
        )}
        {currentStage === 'clarification' && (
          <div>💡 <strong>Tip:</strong> Answer the follow-up questions to help narrow down the diagnosis.</div>
        )}
        {currentStage === 'final' && (
          <div>✅ <strong>Assessment Complete:</strong> Review the diagnosis and follow the recommended actions.</div>
        )}
      </div>
    </div>
  );
});