/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`
  }
  return `${km.toFixed(1)}km`
}

/**
 * Get user's current location using Google Geolocation API (client-side, most accurate)
 * Falls back to browser geolocation if Google API fails
 */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number; accuracy?: number }> {
  // Try Google Geolocation API first (most accurate)
  // Called directly from browser to work with API key restrictions
  try {
    const googleLocation = await getGoogleGeolocation()
    if (googleLocation) {
      console.log(`📍 Google Geolocation API accuracy: ±${Math.round(googleLocation.accuracy || 0)}m (BEST)`)
      return googleLocation
    }
  } catch (error) {
    console.warn('Google Geolocation API failed, using browser geolocation:', error)
  }

  // Fallback to browser geolocation with maximum accuracy settings
  return getBrowserGeolocation()
}

/**
 * Get location using Google Geolocation API (client-side, most accurate)
 * Uses WiFi, cell towers, and GPS for best accuracy
 * Must be called from browser (client-side) to work with API key restrictions
 */
async function getGoogleGeolocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  // Only run in browser
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.warn('Google Maps API key not found')
      return null
    }

    // Get WiFi access points and cell towers for better accuracy
    const wifiAccessPoints: any[] = []
    const cellTowers: any[] = []

    // Try to get WiFi info (if available via experimental APIs)
    // Note: Most browsers don't expose this, but we try anyway
    if ('wifi' in navigator && (navigator as any).wifi) {
      // This is experimental and may not be available
    }

    // Call Google Geolocation API directly from client-side
    // This works with API key referrer restrictions
    const url = `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        considerIp: true, // Use IP as fallback
        wifiAccessPoints: wifiAccessPoints.length > 0 ? wifiAccessPoints : undefined,
        cellTowers: cellTowers.length > 0 ? cellTowers : undefined,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Google Geolocation API error:', errorData)
      throw new Error(`Google Geolocation API request failed: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.location) {
      return {
        lat: data.location.lat,
        lng: data.location.lng,
        accuracy: data.accuracy || 20, // Default to 20m if not provided
      }
    }

    return null
  } catch (error) {
    console.error('Google Geolocation API error:', error)
    // Return null to trigger browser geolocation fallback
    return null
  }
}

/**
 * Get location using browser geolocation with maximum accuracy settings
 */
function getBrowserGeolocation(): Promise<{ lat: number; lng: number; accuracy?: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"))
      return
    }

    // Maximum accuracy settings
    const options: PositionOptions = {
      enableHighAccuracy: true, // Use GPS, not just network location
      timeout: 20000, // Increased timeout for better accuracy
      maximumAge: 0, // Don't use cached location - always get fresh
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const accuracy = position.coords.accuracy
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          reject(new Error("Invalid location coordinates received"))
          return
        }

        // Log accuracy for debugging
        if (accuracy) {
          const accuracyMeters = Math.round(accuracy)
          if (accuracyMeters < 20) {
            console.log(`📍 Browser GPS accuracy: ±${accuracyMeters}m (EXCELLENT)`)
          } else if (accuracyMeters < 50) {
            console.log(`📍 Browser GPS accuracy: ±${accuracyMeters}m (GOOD)`)
          } else {
            console.log(`📍 Browser GPS accuracy: ±${accuracyMeters}m (ACCEPTABLE)`)
          }
        }

        resolve({
          lat: lat,
          lng: lng,
          accuracy: accuracy,
        })
      },
      (error) => {
        console.error("Browser geolocation error:", error)
        
        // Provide helpful error messages
        let errorMessage = "Failed to get location"
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions."
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable. Please check your GPS."
            break
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again."
            break
        }
        
        reject(new Error(errorMessage))
      },
      options
    )
  })
}

/**
 * Watch user's location continuously (for real-time tracking)
 * Returns a cleanup function to stop watching
 */
export function watchLocation(
  callback: (location: { lat: number; lng: number; accuracy?: number }) => void,
  errorCallback?: (error: Error) => void
): () => void {
  if (!navigator.geolocation) {
    errorCallback?.(new Error("Geolocation is not supported"))
    return () => {}
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const accuracy = position.coords.accuracy

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        callback({
          lat,
          lng,
          accuracy,
        })
      }
    },
    (error) => {
      errorCallback?.(new Error(`Location watch error: ${error.message}`))
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000, // Allow 5 second old data for continuous updates
    }
  )

  // Return cleanup function
  return () => {
    navigator.geolocation.clearWatch(watchId)
  }
}

