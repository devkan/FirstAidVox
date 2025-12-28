import { Notification } from '../types';

// Error types for categorization
export enum ErrorType {
  NETWORK = 'network',
  VOICE_SERVICE = 'voice_service',
  CAMERA = 'camera',
  BACKEND = 'backend',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  type: ErrorType;
  severity: ErrorSeverity;
  component: string;
  action: string;
  timestamp: Date;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, any>;
}

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export interface ErrorHandlingResult {
  handled: boolean;
  notification?: Notification;
  recoveryActions?: RecoveryAction[];
  shouldRetry?: boolean;
  fallbackAvailable?: boolean;
}

// Application-wide error handler
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: Array<{ error: Error; context: ErrorContext }> = [];
  private maxLogSize = 100;
  private onNotification?: (notification: Notification) => void;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Set notification callback for displaying errors to users
   */
  setNotificationHandler(handler: (notification: Notification) => void): void {
    this.onNotification = handler;
  }

  /**
   * Handle any error with context and return appropriate response
   * Validates: Requirements 5.5, 6.3, 6.5
   */
  handleError(error: Error, context: ErrorContext): ErrorHandlingResult {
    // Log the error
    this.logError(error, context);

    // Determine error handling strategy based on type and severity
    const result = this.determineHandlingStrategy(error, context);

    // Create user notification if needed
    if (result.notification && this.onNotification) {
      this.onNotification(result.notification);
    }

    return result;
  }

  /**
   * Handle network-related errors
   */
  handleNetworkError(error: Error, component: string, action: string): ErrorHandlingResult {
    const context: ErrorContext = {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      component,
      action,
      timestamp: new Date()
    };

    return this.handleError(error, context);
  }

  /**
   * Handle voice service errors with recovery options
   */
  handleVoiceServiceError(error: Error, component: string, action: string): ErrorHandlingResult {
    const context: ErrorContext = {
      type: ErrorType.VOICE_SERVICE,
      severity: ErrorSeverity.HIGH,
      component,
      action,
      timestamp: new Date()
    };

    return this.handleError(error, context);
  }

  /**
   * Handle camera-related errors
   */
  handleCameraError(error: Error, component: string, action: string): ErrorHandlingResult {
    const context: ErrorContext = {
      type: ErrorType.CAMERA,
      severity: ErrorSeverity.MEDIUM,
      component,
      action,
      timestamp: new Date()
    };

    return this.handleError(error, context);
  }

  /**
   * Handle backend service errors
   */
  handleBackendError(error: Error, component: string, action: string): ErrorHandlingResult {
    const context: ErrorContext = {
      type: ErrorType.BACKEND,
      severity: ErrorSeverity.HIGH,
      component,
      action,
      timestamp: new Date()
    };

    return this.handleError(error, context);
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: number; // Last hour
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const stats = {
      total: this.errorLog.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recent: 0
    };

    // Initialize counters
    Object.values(ErrorType).forEach(type => {
      stats.byType[type] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });

    // Count errors
    this.errorLog.forEach(({ context }) => {
      stats.byType[context.type]++;
      stats.bySeverity[context.severity]++;
      
      if (context.timestamp > oneHourAgo) {
        stats.recent++;
      }
    });

    return stats;
  }

  /**
   * Clear error log (for testing or maintenance)
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // Private methods
  private logError(error: Error, context: ErrorContext): void {
    this.errorLog.push({ error, context });

    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Console logging for development
    console.error(`[${context.type}] ${context.component}.${context.action}:`, error);
  }

  private determineHandlingStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    switch (context.type) {
      case ErrorType.NETWORK:
        return this.handleNetworkErrorStrategy(error, context);
      
      case ErrorType.VOICE_SERVICE:
        return this.handleVoiceServiceErrorStrategy(error, context);
      
      case ErrorType.CAMERA:
        return this.handleCameraErrorStrategy(error, context);
      
      case ErrorType.BACKEND:
        return this.handleBackendErrorStrategy(error, context);
      
      case ErrorType.VALIDATION:
        return this.handleValidationErrorStrategy(error, context);
      
      case ErrorType.PERMISSION:
        return this.handlePermissionErrorStrategy(error, context);
      
      default:
        return this.handleUnknownErrorStrategy(error, context);
    }
  }

  private handleNetworkErrorStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    return {
      handled: true,
      notification: {
        id: `network-error-${Date.now()}`,
        type: 'error',
        title: 'Connection Issue',
        message: 'Unable to connect to the service. Please check your internet connection and try again.',
        timestamp: new Date(),
        autoClose: false
      },
      recoveryActions: [
        {
          label: 'Retry',
          action: () => window.location.reload(),
          primary: true
        },
        {
          label: 'Check Connection',
          action: () => window.open('https://www.google.com', '_blank')
        }
      ],
      shouldRetry: true,
      fallbackAvailable: false
    };
  }

  private handleVoiceServiceErrorStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    const isConnectionError = error.message.toLowerCase().includes('connection') ||
                             error.message.toLowerCase().includes('network');

    return {
      handled: true,
      notification: {
        id: `voice-error-${Date.now()}`,
        type: 'warning',
        title: 'Voice Service Issue',
        message: isConnectionError 
          ? 'Voice service connection lost. Attempting to reconnect...'
          : 'Voice service encountered an error. You can continue using text input.',
        timestamp: new Date(),
        autoClose: !isConnectionError
      },
      recoveryActions: [
        {
          label: 'Reconnect Voice',
          action: async () => {
            // This would trigger voice service reconnection
            console.log('Attempting voice service reconnection');
          },
          primary: true
        },
        {
          label: 'Use Text Input',
          action: () => {
            // This would switch to text input mode
            console.log('Switching to text input fallback');
          }
        }
      ],
      shouldRetry: isConnectionError,
      fallbackAvailable: true
    };
  }

  private handleCameraErrorStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    const isPermissionError = error.message.toLowerCase().includes('permission') ||
                             error.message.toLowerCase().includes('denied');

    return {
      handled: true,
      notification: {
        id: `camera-error-${Date.now()}`,
        type: 'warning',
        title: 'Camera Issue',
        message: isPermissionError
          ? 'Camera access denied. Please enable camera permissions to capture photos.'
          : 'Camera is not available. You can describe your symptoms instead.',
        timestamp: new Date(),
        autoClose: false
      },
      recoveryActions: isPermissionError ? [
        {
          label: 'Enable Camera',
          action: () => {
            // This would show permission instructions
            console.log('Showing camera permission instructions');
          },
          primary: true
        }
      ] : [
        {
          label: 'Describe Symptoms',
          action: () => {
            // This would switch to text description
            console.log('Switching to text description');
          },
          primary: true
        }
      ],
      shouldRetry: isPermissionError,
      fallbackAvailable: true
    };
  }

  private handleBackendErrorStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    const isServerError = error.message.includes('HTTP 5') || 
                         error.message.includes('Service Unavailable');

    return {
      handled: true,
      notification: {
        id: `backend-error-${Date.now()}`,
        type: 'error',
        title: 'Service Temporarily Unavailable',
        message: isServerError
          ? 'Our medical analysis service is temporarily unavailable. Please try again in a few moments.'
          : 'Unable to process your request. Please check your input and try again.',
        timestamp: new Date(),
        autoClose: false
      },
      recoveryActions: [
        {
          label: 'Try Again',
          action: () => {
            // This would retry the last action
            console.log('Retrying last backend request');
          },
          primary: true
        }
      ],
      shouldRetry: isServerError,
      fallbackAvailable: false
    };
  }

  private handleValidationErrorStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    return {
      handled: true,
      notification: {
        id: `validation-error-${Date.now()}`,
        type: 'warning',
        title: 'Input Error',
        message: error.message || 'Please check your input and try again.',
        timestamp: new Date(),
        autoClose: true
      },
      shouldRetry: false,
      fallbackAvailable: false
    };
  }

  private handlePermissionErrorStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    return {
      handled: true,
      notification: {
        id: `permission-error-${Date.now()}`,
        type: 'warning',
        title: 'Permission Required',
        message: 'This feature requires additional permissions. Please enable them in your browser settings.',
        timestamp: new Date(),
        autoClose: false
      },
      recoveryActions: [
        {
          label: 'Enable Permissions',
          action: () => {
            // This would show permission instructions
            console.log('Showing permission instructions');
          },
          primary: true
        }
      ],
      shouldRetry: true,
      fallbackAvailable: true
    };
  }

  private handleUnknownErrorStrategy(error: Error, context: ErrorContext): ErrorHandlingResult {
    return {
      handled: true,
      notification: {
        id: `unknown-error-${Date.now()}`,
        type: 'error',
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please refresh the page and try again.',
        timestamp: new Date(),
        autoClose: false
      },
      recoveryActions: [
        {
          label: 'Refresh Page',
          action: () => window.location.reload(),
          primary: true
        }
      ],
      shouldRetry: false,
      fallbackAvailable: false
    };
  }
}

// Singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions for common error handling patterns
export function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: Omit<ErrorContext, 'timestamp'>
): Promise<T> {
  return operation().catch((error) => {
    const result = errorHandler.handleError(error, {
      ...context,
      timestamp: new Date()
    });
    
    if (result.shouldRetry) {
      // Could implement retry logic here
      throw error;
    }
    
    throw error;
  });
}

export function createErrorBoundary(
  component: string,
  fallbackComponent?: () => JSX.Element
) {
  return function ErrorBoundaryWrapper(WrappedComponent: React.ComponentType<any>) {
    return function WithErrorBoundary(props: any) {
      try {
        return React.createElement(WrappedComponent, props);
      } catch (error) {
        errorHandler.handleError(error as Error, {
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.HIGH,
          component,
          action: 'render',
          timestamp: new Date()
        });
        
        return fallbackComponent ? fallbackComponent() : null;
      }
    };
  };
}