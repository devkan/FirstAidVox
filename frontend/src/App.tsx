import React, { ErrorInfo, Component, ReactNode, useEffect } from 'react'
import { AppStateProvider } from './hooks/useAppState'
import VoiceInterface from './components/VoiceInterface'
import CameraInterface from './components/CameraInterface'
import MapComponent from './components/MapComponent'
import { MedicalReportCard } from './components/ReportCard'
import { useMedicalState, useMapState, useUIState } from './hooks/useAppState'
import { errorHandler, ErrorType, ErrorSeverity } from './services/errorHandler'
import { connectionMonitor } from './services/connectionMonitor'
import { offlineFallbackService } from './services/offlineFallback'

// Enhanced Error Boundary Component with comprehensive error handling
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })
    
    // Handle error through comprehensive error handler
    errorHandler.handleError(error, {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.CRITICAL,
      component: 'App',
      action: 'render',
      timestamp: new Date(),
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => {
                  // Clear error state and try to recover
                  this.setState({ hasError: false, error: undefined, errorInfo: undefined })
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Try Again
              </button>
            </div>
            
            {/* Show offline capabilities if available */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-left">
              <h3 className="font-medium text-blue-800 mb-2">Available Offline Features:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Basic first aid advice</li>
                <li>• Emergency contact numbers</li>
                <li>• Cached hospital information</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Connection Status Component
function ConnectionStatus() {
  const [connectionStatus, setConnectionStatus] = React.useState(connectionMonitor.getStatus())
  const [showDetails, setShowDetails] = React.useState(false)

  useEffect(() => {
    const handleStatusChange = (status: any) => {
      setConnectionStatus(status)
    }

    connectionMonitor.startMonitoring()
    
    // Set up status change listener (this would be implemented in connectionMonitor)
    const interval = setInterval(() => {
      setConnectionStatus(connectionMonitor.getStatus())
    }, 5000)

    return () => {
      clearInterval(interval)
      connectionMonitor.stopMonitoring()
    }
  }, [])

  if (connectionStatus.isOnline && connectionStatus.quality !== 'poor') {
    return null // Don't show anything when connection is good
  }

  return (
    <div className={`
      fixed top-16 left-4 right-4 z-40 p-3 rounded-lg shadow-lg
      ${connectionStatus.isOnline ? 'bg-yellow-100 border border-yellow-200' : 'bg-red-100 border border-red-200'}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`
            w-2 h-2 rounded-full mr-2
            ${connectionStatus.isOnline ? 'bg-yellow-500' : 'bg-red-500'}
          `} />
          <span className={`
            text-sm font-medium
            ${connectionStatus.isOnline ? 'text-yellow-800' : 'text-red-800'}
          `}>
            {connectionStatus.isOnline ? 'Poor Connection' : 'Offline Mode'}
          </span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-gray-600 hover:text-gray-800"
        >
          {showDetails ? 'Hide' : 'Details'}
        </button>
      </div>
      
      {showDetails && (
        <div className="mt-2 text-xs text-gray-700">
          <p>Last checked: {connectionStatus.lastChecked.toLocaleTimeString()}</p>
          {connectionStatus.latency && (
            <p>Latency: {connectionStatus.latency}ms</p>
          )}
          <p>Offline features available: Basic advice, Emergency contacts</p>
        </div>
      )}
    </div>
  )
}

// Main App Content Component with integrated error handling
function AppContent() {
  const medicalState = useMedicalState()
  const mapState = useMapState()
  const uiState = useUIState()
  const [pendingImage, setPendingImage] = React.useState<Blob | null>(null)

  // Initialize error handling system
  useEffect(() => {
    // Set up notification handler
    errorHandler.setNotificationHandler((notification) => {
      uiState.addNotification(notification)
    })

    // Set up connection monitoring callbacks
    connectionMonitor.startMonitoring()

    // Set up offline queue processing when connection is restored
    const handleReconnect = () => {
      console.log('Connection restored, processing offline queue')
      offlineFallbackService.processOfflineQueue()
    }

    // This would be properly implemented with event listeners in connectionMonitor
    const interval = setInterval(() => {
      const status = connectionMonitor.getStatus()
      if (status.isOnline) {
        handleReconnect()
      }
    }, 30000) // Check every 30 seconds

    return () => {
      clearInterval(interval)
      connectionMonitor.stopMonitoring()
    }
  }, [uiState])

  // Auto-dismiss notifications
  useEffect(() => {
    const timer = setInterval(() => {
      uiState.notifications.forEach(notification => {
        if (notification.autoClose) {
          const age = Date.now() - notification.timestamp.getTime()
          if (age > 5000) { // Auto-dismiss after 5 seconds
            uiState.removeNotification(notification.id)
          }
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [uiState.notifications, uiState])

  const handlePhotoCapture = (imageData: Blob) => {
    try {
      console.log('Photo captured:', imageData)
      // Store the image to be sent with the next voice message
      setPendingImage(imageData)
      
      uiState.addNotification({
        id: `photo-ready-${Date.now()}`,
        type: 'success',
        title: 'Photo Ready',
        message: 'Photo captured and ready to send with your next voice message.',
        timestamp: new Date(),
        autoClose: true
      })
    } catch (error) {
      errorHandler.handleCameraError(error as Error, 'AppContent', 'handlePhotoCapture')
    }
  }

  const handleUploadComplete = (analysisId: string) => {
    try {
      console.log('Upload complete:', analysisId)
      // The image is now ready to be sent with voice messages
    } catch (error) {
      errorHandler.handleBackendError(error as Error, 'AppContent', 'handleUploadComplete')
    }
  }

  // Handle hospital data from medical responses
  useEffect(() => {
    if (medicalState.currentAssessment?.hospitalData && medicalState.currentAssessment.hospitalData.length > 0) {
      mapState.setHospitals(medicalState.currentAssessment.hospitalData)
      
      // Try to get current location for map
      navigator.geolocation.getCurrentPosition(
        (position) => {
          mapState.setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        (error) => {
          console.log('Could not get location for map:', error)
        },
        { timeout: 5000, enableHighAccuracy: false }
      )
      
      mapState.show()
    }
  }, [medicalState.currentAssessment?.hospitalData, mapState])

  const handleMapDismiss = () => {
    try {
      mapState.hide()
    } catch (error) {
      errorHandler.handleError(error as Error, {
        type: ErrorType.UNKNOWN,
        severity: ErrorSeverity.LOW,
        component: 'AppContent',
        action: 'handleMapDismiss',
        timestamp: new Date()
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Connection Status Indicator */}
      <ConnectionStatus />

      {/* Header */}
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <h1 className="text-xl font-semibold text-gray-900 text-center">
          FirstAidVox
        </h1>
        {/* Global loading indicator */}
        {(medicalState.isProcessing) && (
          <div className="mt-2 flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Processing...</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        <div className="space-y-4">
          {/* Voice Interface */}
          <VoiceInterface 
            className="w-full" 
            pendingImage={pendingImage}
            onImageSent={() => setPendingImage(null)}
          />

          {/* Camera Interface */}
          <CameraInterface
            onPhotoCapture={handlePhotoCapture}
            onUploadComplete={handleUploadComplete}
            className="w-full"
          />

          {/* Medical Report Card */}
          <MedicalReportCard
            medicalResponse={medicalState.currentAssessment}
            className="w-full"
          />
        </div>
      </main>

      {/* Map Component (Modal/Overlay) */}
      {mapState.isVisible && (
        <MapComponent
          hospitalData={mapState.hospitals}
          userLocation={mapState.userLocation}
          isVisible={mapState.isVisible}
          onDismiss={handleMapDismiss}
        />
      )}

      {/* Enhanced Notifications with Recovery Actions */}
      {uiState.notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
          {uiState.notifications.map((notification) => (
            <div
              key={notification.id}
              className={`
                p-4 rounded-lg shadow-lg
                ${notification.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : ''}
                ${notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : ''}
                ${notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : ''}
                ${notification.type === 'info' ? 'bg-blue-100 text-blue-800 border border-blue-200' : ''}
              `}
            >
              <div className="flex items-start">
                <div className="flex-1">
                  <h4 className="font-medium">{notification.title}</h4>
                  <p className="text-sm mt-1">{notification.message}</p>
                </div>
                <button
                  onClick={() => uiState.removeNotification(notification.id)}
                  className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emergency Contacts (Always Available) */}
      <div className="fixed bottom-4 left-4 z-30">
        <button
          onClick={() => {
            const contacts = offlineFallbackService.getEmergencyContacts()
            uiState.addNotification({
              id: `emergency-contacts-${Date.now()}`,
              type: 'info',
              title: 'Emergency Contacts',
              message: contacts.map(c => `${c.name}: ${c.number}`).join('\n'),
              timestamp: new Date(),
              autoClose: false
            })
          }}
          className="bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700 transition-colors"
          title="Emergency Contacts"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Main App Component with Error Boundary and State Provider
function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </ErrorBoundary>
  )
}

export default App
