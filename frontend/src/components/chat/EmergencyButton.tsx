import React, { useState } from 'react';
import type { EmergencyButtonProps } from './types';

export function EmergencyButton({ onEmergencyCall, className = '' }: EmergencyButtonProps) {
  const [showOptions, setShowOptions] = useState(false);

  const emergencyContacts = [
    { name: '911', number: '911', icon: '🚨', description: 'Emergency Services' },
    { name: 'Poison Control', number: '1-800-222-1222', icon: '☠️', description: 'Poison Control Center' },
  ];

  return (
    <>
      {/* Options Menu - Fixed position */}
      {showOptions && (
        <div className="fixed bottom-64 right-3 sm:bottom-68 sm:right-4 lg:right-6 z-50 bg-white rounded-2xl shadow-xl border border-red-200 overflow-hidden min-w-72">
          <div className="p-4 bg-red-50 border-b border-red-200">
            <h3 className="font-bold text-red-800 text-lg">Emergency Contacts</h3>
            <p className="text-sm text-red-600 mt-1">Tap to call immediately</p>
          </div>
          
          <div className="p-3">
            {emergencyContacts.map((contact) => (
              <button
                key={contact.number}
                onClick={() => {
                  window.open(`tel:${contact.number}`, '_self');
                  setShowOptions(false);
                }}
                className="w-full flex items-center space-x-4 p-4 hover:bg-red-50 rounded-xl transition-colors text-left mb-2 last:mb-0 border border-gray-100"
              >
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">
                  {contact.icon}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-lg">{contact.name}</div>
                  <div className="text-base text-gray-600">{contact.description}</div>
                  <div className="text-xl text-red-600 font-bold mt-1">{contact.number}</div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="p-4 bg-gray-50 border-t">
            <button
              onClick={() => setShowOptions(false)}
              className="w-full text-center text-base font-medium text-gray-600 hover:text-gray-800 transition-colors py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Emergency Button - No wrapper div, just the button */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className={`w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${className}`}
        title="Emergency Contacts"
        style={{ pointerEvents: 'auto' }}
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </button>
    </>
  );
}