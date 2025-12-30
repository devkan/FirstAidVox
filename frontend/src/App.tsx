import React, { ErrorInfo, Component, ReactNode } from 'react'
import { AppStateProvider } from './hooks/useAppState'
import { ChatContainer } from './components/chat/ChatContainer'
import { errorHandler, ErrorType, ErrorSeverity } from './services/errorHandler'

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
        <div className="min-h-screen bg-gradient-to-br from-medical-50 to-chat-background flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-medical p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-emergency-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emergency-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-6">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-3 bg-medical-500 text-white rounded-lg hover:bg-medical-600 transition-colors font-medium"
              >
                Refresh Page
              </button>
              <button
                onClick={() => {
                  // Clear error state and try to recover
                  this.setState({ hasError: false, error: undefined, errorInfo: undefined })
                }}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            </div>
            
            {/* Show offline capabilities if available */}
            <div className="mt-6 p-4 bg-medical-50 rounded-lg text-left">
              <h3 className="font-medium text-medical-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Available Offline Features:
              </h3>
              <ul className="text-sm text-medical-700 space-y-1">
                <li>• Basic first aid advice</li>
                <li>• Emergency contact numbers (911, Poison Control)</li>
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

// Main App Component with Error Boundary and State Provider
function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <ChatContainer />
      </AppStateProvider>
    </ErrorBoundary>
  )
}

export default App
