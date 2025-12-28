import React, { useCallback, useEffect, useState } from 'react';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { HospitalLocation, Coordinates } from '../types';

export interface MapComponentProps {
  hospitalData: HospitalLocation[];
  userLocation: Coordinates | null;
  isVisible: boolean;
  onDismiss: () => void;
  className?: string;
}

export function MapComponent({
  hospitalData,
  userLocation,
  isVisible,
  onDismiss,
  className = ''
}: MapComponentProps) {
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>({ latitude: 0, longitude: 0 });

  // Update map center when user location or hospital data changes
  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
    } else if (hospitalData.length > 0) {
      // Center on first hospital if no user location
      setMapCenter(hospitalData[0].coordinates);
    }
  }, [userLocation, hospitalData]);

  const handleMarkerClick = useCallback((hospitalId: string) => {
    setSelectedHospital(hospitalId);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedHospital(null);
  }, []);

  const handleMapClick = useCallback(() => {
    // Close info window when clicking on map
    setSelectedHospital(null);
  }, []);

  const getUrgencyColor = (services: any[]): string => {
    // Determine marker color based on emergency services
    const hasTraumaCenter = services.some(s => s.type === 'trauma_center');
    const hasEmergencyRoom = services.some(s => s.type === 'emergency_room');
    
    if (hasTraumaCenter) return '#dc2626'; // Red for trauma centers
    if (hasEmergencyRoom) return '#ea580c'; // Orange for emergency rooms
    return '#2563eb'; // Blue for urgent care
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const formatWaitTime = (waitTime: number): string => {
    if (waitTime < 60) {
      return `${waitTime}min`;
    }
    return `${Math.round(waitTime / 60)}h ${waitTime % 60}min`;
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`fixed inset-0 z-50 ${className}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onDismiss}
      />
      
      {/* Bottom Sheet */}
      <div className={`
        absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl
        transform transition-transform duration-300 ease-out
        ${isVisible ? 'translate-y-0' : 'translate-y-full'}
        max-h-[80vh] min-h-[60vh]
      `}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            Nearby Hospitals ({hospitalData.length})
          </h2>
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close map"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              style={{ width: '100%', height: '400px' }}
              defaultCenter={{ lat: mapCenter.latitude, lng: mapCenter.longitude }}
              defaultZoom={13}
              gestureHandling="greedy"
              disableDefaultUI={false}
              onClick={handleMapClick}
            >
              {/* User Location Marker */}
              {userLocation && (
                <Marker
                  position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
                  title="Your Location"
                />
              )}

              {/* Hospital Markers */}
              {hospitalData.map((hospital) => (
                <Marker
                  key={hospital.id}
                  position={{ lat: hospital.coordinates.latitude, lng: hospital.coordinates.longitude }}
                  title={hospital.name}
                  onClick={() => handleMarkerClick(hospital.id)}
                />
              ))}

              {/* Info Window for Selected Hospital */}
              {selectedHospital && (
                <InfoWindow
                  position={{
                    lat: hospitalData.find(h => h.id === selectedHospital)?.coordinates.latitude || 0,
                    lng: hospitalData.find(h => h.id === selectedHospital)?.coordinates.longitude || 0
                  }}
                  onCloseClick={handleInfoWindowClose}
                >
                  {(() => {
                    const hospital = hospitalData.find(h => h.id === selectedHospital);
                    if (!hospital) return null;

                    return (
                      <div className="p-3 max-w-xs">
                        <h3 className="font-bold text-lg mb-2">{hospital.name}</h3>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600">{hospital.address}</p>
                          <p className="text-gray-600">{hospital.phone}</p>
                          <p className="font-medium">Distance: {formatDistance(hospital.distance)}</p>
                          <p className="font-medium">Rating: {hospital.rating}/5</p>
                          {hospital.isOpen24Hours && (
                            <p className="text-green-600 font-medium">Open 24 Hours</p>
                          )}
                          
                          {hospital.emergencyServices.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-gray-800 mb-1">Services:</p>
                              {hospital.emergencyServices.map((service, index) => (
                                <div key={index} className="text-xs bg-gray-100 rounded px-2 py-1 mb-1">
                                  <span className="capitalize">{service.type.replace('_', ' ')}</span>
                                  <span className="ml-2 text-gray-600">
                                    Wait: {formatWaitTime(service.waitTime)}
                                  </span>
                                  <span className={`ml-2 font-medium ${
                                    service.availability === 'available' ? 'text-green-600' :
                                    service.availability === 'busy' ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {service.availability}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        </div>

        {/* Hospital List */}
        <div className="max-h-48 overflow-y-auto border-t border-gray-200">
          {hospitalData.map((hospital) => (
            <div
              key={hospital.id}
              className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onClick={() => handleMarkerClick(hospital.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{hospital.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{hospital.address}</p>
                  <div className="flex items-center mt-2 space-x-4 text-sm">
                    <span className="text-gray-600">
                      {formatDistance(hospital.distance)}
                    </span>
                    <span className="text-gray-600">
                      ★ {hospital.rating}
                    </span>
                    {hospital.isOpen24Hours && (
                      <span className="text-green-600 font-medium">24/7</span>
                    )}
                  </div>
                </div>
                
                {hospital.emergencyServices.length > 0 && (
                  <div className="ml-4">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getUrgencyColor(hospital.emergencyServices) }}
                      title={`${hospital.emergencyServices.length} services available`}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MapComponent;