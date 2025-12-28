/**
 * Device detection utilities for cross-device compatibility
 */

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  hasTouch: boolean
  screenSize: 'mobile' | 'tablet' | 'desktop'
  orientation: 'portrait' | 'landscape'
}

/**
 * Detect device type and capabilities
 */
export function getDeviceInfo(): DeviceInfo {
  const width = window.innerWidth
  const height = window.innerHeight
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Determine device type based on screen size
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024
  const isDesktop = width >= 1024

  const screenSize: 'mobile' | 'tablet' | 'desktop' = 
    isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'

  const orientation: 'portrait' | 'landscape' = height > width ? 'portrait' : 'landscape'

  return {
    isMobile,
    isTablet,
    isDesktop,
    hasTouch,
    screenSize,
    orientation
  }
}

/**
 * Check if device supports camera
 */
export function hasCameraSupport(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

/**
 * Check if device supports geolocation
 */
export function hasGeolocationSupport(): boolean {
  return !!navigator.geolocation
}

/**
 * Get optimal camera constraints for device
 */
export function getCameraConstraints(deviceInfo: DeviceInfo): MediaStreamConstraints {
  const baseConstraints: MediaStreamConstraints = {
    video: {
      facingMode: 'environment', // Prefer back camera for medical photos
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  }

  // Adjust constraints based on device type
  if (deviceInfo.isMobile) {
    // Mobile devices may need lower resolution for performance
    const videoConstraints = baseConstraints.video as MediaTrackConstraints;
    baseConstraints.video = {
      ...videoConstraints,
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 }
    }
  }

  return baseConstraints
}

/**
 * Get responsive button size classes based on device
 */
export function getButtonSizeClasses(deviceInfo: DeviceInfo): string {
  if (deviceInfo.isMobile) {
    return 'px-6 py-4 text-base' // Larger touch targets
  } else if (deviceInfo.isTablet) {
    return 'px-5 py-3 text-base'
  } else {
    return 'px-4 py-2 text-sm' // Smaller for desktop
  }
}

/**
 * Get responsive spacing classes based on device
 */
export function getSpacingClasses(deviceInfo: DeviceInfo): string {
  if (deviceInfo.isMobile) {
    return 'space-y-6 p-4' // More spacing on mobile
  } else if (deviceInfo.isTablet) {
    return 'space-y-5 p-5'
  } else {
    return 'space-y-4 p-6' // Compact on desktop
  }
}

/**
 * Hook for device detection with reactive updates
 */
export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>(getDeviceInfo)

  React.useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo())
    }

    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(() => {
        setDeviceInfo(getDeviceInfo())
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return deviceInfo
}

// Import React for the hook
import React from 'react'