import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface ConnectionStatus {
  isOnline: boolean;
  lastChecked: Date;
  latency?: number;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
}

export interface ConnectionMonitorConfig {
  checkInterval: number; // milliseconds
  timeoutDuration: number; // milliseconds
  maxRetries: number;
  onStatusChange?: (status: ConnectionStatus) => void;
  onReconnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Connection Monitor Service
 * Validates: Requirements 6.5 - Connection monitoring and automatic reconnection
 */
export class ConnectionMonitor {
  private config: ConnectionMonitorConfig;
  private currentStatus: ConnectionStatus;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private retryCount = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: Partial<ConnectionMonitorConfig> = {}) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      timeoutDuration: 5000, // 5 seconds
      maxRetries: 3,
      ...config
    };

    this.currentStatus = {
      isOnline: navigator.onLine,
      lastChecked: new Date(),
      quality: navigator.onLine ? 'good' : 'offline'
    };

    this.setupEventListeners();
  }

  /**
   * Start monitoring connection status
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.scheduleNextCheck();
    
    console.log('Connection monitoring started');
  }

  /**
   * Stop monitoring connection status
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearTimeout(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    console.log('Connection monitoring stopped');
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.currentStatus };
  }

  /**
   * Force a connection check
   */
  async checkConnection(): Promise<ConnectionStatus> {
    const startTime = Date.now();
    
    try {
      // Use a lightweight endpoint for connection testing
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(this.config.timeoutDuration)
      });

      const latency = Date.now() - startTime;
      const isOnline = response.ok;
      
      this.updateStatus({
        isOnline,
        lastChecked: new Date(),
        latency,
        quality: this.calculateQuality(latency, isOnline)
      });

      if (isOnline && !this.currentStatus.isOnline) {
        this.handleReconnection();
      } else if (!isOnline && this.currentStatus.isOnline) {
        this.handleDisconnection();
      }

      this.retryCount = 0; // Reset retry count on successful check
      
    } catch (error) {
      this.handleConnectionError(error as Error);
    }

    return this.getStatus();
  }

  /**
   * Attempt to reconnect to services
   */
  async attemptReconnection(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      errorHandler.handleError(
        new Error('Maximum reconnection attempts exceeded'),
        {
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.HIGH,
          component: 'ConnectionMonitor',
          action: 'attemptReconnection',
          timestamp: new Date()
        }
      );
      return false;
    }

    this.reconnectAttempts++;
    
    try {
      const status = await this.checkConnection();
      
      if (status.isOnline) {
        this.reconnectAttempts = 0;
        this.config.onReconnect?.();
        return true;
      }
      
      // Schedule next reconnection attempt with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.attemptReconnection(), delay);
      
      return false;
      
    } catch (error) {
      errorHandler.handleError(error as Error, {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        component: 'ConnectionMonitor',
        action: 'attemptReconnection',
        timestamp: new Date(),
        additionalData: { attempt: this.reconnectAttempts }
      });
      
      return false;
    }
  }

  /**
   * Check if connection is stable
   */
  isConnectionStable(): boolean {
    const now = Date.now();
    const timeSinceLastCheck = now - this.currentStatus.lastChecked.getTime();
    
    return this.currentStatus.isOnline && 
           timeSinceLastCheck < this.config.checkInterval * 2 &&
           this.currentStatus.quality !== 'poor';
  }

  /**
   * Get connection quality metrics
   */
  getQualityMetrics(): {
    latency?: number;
    quality: string;
    stability: 'stable' | 'unstable' | 'unknown';
    lastCheck: Date;
  } {
    return {
      latency: this.currentStatus.latency,
      quality: this.currentStatus.quality,
      stability: this.isConnectionStable() ? 'stable' : 'unstable',
      lastCheck: this.currentStatus.lastChecked
    };
  }

  // Private methods
  private setupEventListeners(): void {
    // Listen for browser online/offline events
    window.addEventListener('online', () => {
      this.handleBrowserOnline();
    });

    window.addEventListener('offline', () => {
      this.handleBrowserOffline();
    });

    // Listen for visibility changes to pause/resume monitoring
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseMonitoring();
      } else {
        this.resumeMonitoring();
      }
    });
  }

  private scheduleNextCheck(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.monitoringInterval = setTimeout(() => {
      this.checkConnection().then(() => {
        this.scheduleNextCheck();
      });
    }, this.config.checkInterval);
  }

  private updateStatus(newStatus: Partial<ConnectionStatus>): void {
    const previousStatus = { ...this.currentStatus };
    this.currentStatus = { ...this.currentStatus, ...newStatus };
    
    // Notify listeners if status changed significantly
    if (previousStatus.isOnline !== this.currentStatus.isOnline ||
        previousStatus.quality !== this.currentStatus.quality) {
      this.config.onStatusChange?.(this.getStatus());
    }
  }

  private calculateQuality(latency: number, isOnline: boolean): ConnectionStatus['quality'] {
    if (!isOnline) {
      return 'offline';
    }
    
    if (latency < 100) {
      return 'excellent';
    } else if (latency < 300) {
      return 'good';
    } else {
      return 'poor';
    }
  }

  private handleConnectionError(error: Error): void {
    this.retryCount++;
    
    if (this.retryCount <= this.config.maxRetries) {
      // Retry after a short delay
      setTimeout(() => this.checkConnection(), 1000 * this.retryCount);
    } else {
      // Mark as offline after max retries
      this.updateStatus({
        isOnline: false,
        lastChecked: new Date(),
        quality: 'offline'
      });
      
      errorHandler.handleError(error, {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        component: 'ConnectionMonitor',
        action: 'checkConnection',
        timestamp: new Date(),
        additionalData: { retryCount: this.retryCount }
      });
    }
  }

  private handleReconnection(): void {
    console.log('Connection restored');
    this.reconnectAttempts = 0;
    this.config.onReconnect?.();
  }

  private handleDisconnection(): void {
    console.log('Connection lost');
    this.config.onDisconnect?.();
    
    // Start reconnection attempts
    this.attemptReconnection();
  }

  private handleBrowserOnline(): void {
    console.log('Browser reports online');
    this.checkConnection();
  }

  private handleBrowserOffline(): void {
    console.log('Browser reports offline');
    this.updateStatus({
      isOnline: false,
      lastChecked: new Date(),
      quality: 'offline'
    });
  }

  private pauseMonitoring(): void {
    if (this.monitoringInterval) {
      clearTimeout(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  private resumeMonitoring(): void {
    if (this.isMonitoring && !this.monitoringInterval) {
      this.checkConnection().then(() => {
        this.scheduleNextCheck();
      });
    }
  }
}

// Create singleton instance
export const connectionMonitor = new ConnectionMonitor();

// Auto-start monitoring
connectionMonitor.startMonitoring();