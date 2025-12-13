"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Circle } from "@react-google-maps/api"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface Agent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  distance: number
  distanceFormatted: string
}

interface GoogleMapsWrapperProps {
  userLocation: { lat: number; lng: number } | null
  agents: Agent[]
  selectedAgent: { id: string } | null
  onSelectAgent: (agent: Agent) => void
  showRoute?: boolean // Show route from agent to user
  agentLocation?: { lat: number; lng: number } | null // Real-time agent location for tracking
  showMeetingPoint?: boolean // Show meeting point (midpoint) between customer and agent
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places", "geometry", "drawing"]

const mapContainerStyle = {
  width: "100%",
  height: "100%",
}

const defaultCenter = {
  lat: -1.2921, // Nairobi
  lng: 36.8219,
}

export function GoogleMapsWrapper({
  userLocation,
  agents,
  selectedAgent,
  onSelectAgent,
  showRoute = false,
  agentLocation = null,
  showMeetingPoint = false,
}: GoogleMapsWrapperProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [agentHeading, setAgentHeading] = useState<number>(0)
  const previousAgentLocation = useRef<{ lat: number; lng: number } | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  // Debug: Log if key is missing (only in development)
  if (typeof window !== "undefined" && !apiKey) {
    console.error("❌ Google Maps API Key Missing!")
    console.log("Available env vars:", Object.keys(process.env).filter(k => k.includes("GOOGLE")))
  }

  // Check if API key is missing
  if (!apiKey) {
    const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="text-red-500">
              <p className="font-semibold text-lg">Google Maps API Key Missing</p>
              <p className="text-sm text-muted-foreground mt-2">
                {isProduction 
                  ? "Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your hosting platform's environment variables"
                  : "Please add your API key to `.env.local`"}
              </p>
            </div>
            <div className="text-left bg-muted p-4 rounded-lg text-sm space-y-2 max-w-md mx-auto">
              <p className="font-semibold">How to fix:</p>
              {isProduction ? (
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to your hosting platform (Vercel, Netlify, etc.)</li>
                  <li>Navigate to Environment Variables settings</li>
                  <li>Add: <code className="bg-background px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></li>
                  <li>Set the value to your Google Maps API key</li>
                  <li>Redeploy your application</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Create or edit `.env.local` in your project root</li>
                  <li>Add: <code className="bg-background px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here</code></li>
                  <li>Restart your dev server</li>
                </ol>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  })

  // Log detailed error information
  useEffect(() => {
    if (loadError) {
      console.error("=".repeat(80))
      console.error("🚨 GOOGLE MAPS ERROR DETECTED")
      console.error("=".repeat(80))
      console.error("Full error object:", JSON.stringify(loadError, null, 2))
      console.error("Error message:", loadError.message)
      console.error("Error name:", loadError.name)
      console.error("Current domain:", typeof window !== "undefined" ? window.location.origin : "N/A")
      console.error("API Key exists:", !!apiKey)
      console.error("=".repeat(80))
      
      // Check for specific error types
      const errorMsg = (loadError.message || "").toLowerCase()
      if (errorMsg.includes("referer") || errorMsg.includes("referrer")) {
        console.error("❌ FIX: Add this to Google Cloud Console → API Key → HTTP referrers:")
        console.error(`   ${typeof window !== "undefined" ? window.location.origin : ""}/*`)
      }
    }
  }, [loadError, apiKey])

  // Calculate map bounds to fit all markers with validation
  const calculateBounds = useCallback(() => {
    if (!userLocation || agents.length === 0) return null

    const bounds = new google.maps.LatLngBounds()
    
    // Validate and add user location
    const validUserLoc = userLocation && 
      typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number' &&
      !isNaN(userLocation.lat) && !isNaN(userLocation.lng)
      ? userLocation
      : null

    if (validUserLoc) {
      bounds.extend(new google.maps.LatLng(validUserLoc.lat, validUserLoc.lng))
    }
    
    // Validate and add agent locations
    agents.forEach((agent) => {
      if (agent.location && 
          typeof agent.location.lat === 'number' && typeof agent.location.lng === 'number' &&
          !isNaN(agent.location.lat) && !isNaN(agent.location.lng)) {
        bounds.extend(new google.maps.LatLng(agent.location.lat, agent.location.lng))
      }
    })

    // Validate and add real-time agent location
    if (agentLocation && 
        typeof agentLocation.lat === 'number' && typeof agentLocation.lng === 'number' &&
        !isNaN(agentLocation.lat) && !isNaN(agentLocation.lng)) {
      bounds.extend(new google.maps.LatLng(agentLocation.lat, agentLocation.lng))
    }

    // Include meeting point if shown - calculate it here
    if (showMeetingPoint && validUserLoc && agentLocation) {
      const meetingPoint = {
        lat: (validUserLoc.lat + agentLocation.lat) / 2,
        lng: (validUserLoc.lng + agentLocation.lng) / 2,
      }
      bounds.extend(new google.maps.LatLng(meetingPoint.lat, meetingPoint.lng))
    }

    return bounds
  }, [userLocation, agents, agentLocation, showMeetingPoint])

  // Calculate agent heading (direction of movement)
  useEffect(() => {
    if (agentLocation && previousAgentLocation.current) {
      const prev = previousAgentLocation.current
      const current = agentLocation
      
      // Calculate bearing (heading) between two points
      const lat1 = (prev.lat * Math.PI) / 180
      const lat2 = (current.lat * Math.PI) / 180
      const deltaLng = ((current.lng - prev.lng) * Math.PI) / 180

      const y = Math.sin(deltaLng) * Math.cos(lat2)
      const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)

      const bearing = (Math.atan2(y, x) * 180) / Math.PI
      setAgentHeading((bearing + 360) % 360)
    }

    if (agentLocation) {
      previousAgentLocation.current = agentLocation
    }
  }, [agentLocation])

  // Fit map to bounds when locations change
  useEffect(() => {
    if (map && isMapReady) {
      const bounds = calculateBounds()
      if (bounds) {
        map.fitBounds(bounds)
        // Add padding
        const padding = 50
        map.setOptions({
          padding: { top: padding, right: padding, bottom: padding, left: padding },
        })
      }
    }
  }, [map, isMapReady, userLocation, agents, agentLocation, showMeetingPoint, calculateBounds])

  // Calculate and display route
  useEffect(() => {
    if (
      !showRoute ||
      !directionsService ||
      !selectedAgent ||
      !userLocation ||
      !isMapReady
    ) {
      setDirections(null)
      return
    }

    const agentLoc = agentLocation || selectedAgent.location

    directionsService.route(
      {
        origin: new google.maps.LatLng(agentLoc.lat, agentLoc.lng),
        destination: new google.maps.LatLng(userLocation.lat, userLocation.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result)
        } else {
          console.error("Directions request failed:", status)
        }
      }
    )
  }, [
    showRoute,
    directionsService,
    selectedAgent,
    userLocation,
    agentLocation,
    isMapReady,
  ])

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
    setDirectionsService(new google.maps.DirectionsService())
    setIsMapReady(true)
  }, [])

  const onMapUnmount = useCallback(() => {
    setMap(null)
    setDirectionsService(null)
    setIsMapReady(false)
  }, [])

  if (loadError) {
    const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    const currentDomain = typeof window !== "undefined" ? window.location.origin : ""
    const hostname = typeof window !== "undefined" ? window.location.hostname : ""
    const protocol = typeof window !== "undefined" ? window.location.protocol : ""
    
    // Extract error type from message
    const errorMsg = (loadError.message || "").toLowerCase()
    const isReferrerError = errorMsg.includes("referer") || errorMsg.includes("referrer")
    const isInvalidKeyError = errorMsg.includes("invalid") && errorMsg.includes("key")
    const isBillingError = errorMsg.includes("billing")
    const isApiNotEnabledError = errorMsg.includes("api") && (errorMsg.includes("not enabled") || errorMsg.includes("not activated"))
    
    return (
      <Card>
        <CardContent className="py-6 px-4">
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-red-500 mb-2">
                <p className="font-semibold text-lg">⚠️ Google Maps Error</p>
              </div>
              {loadError.message && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="font-semibold text-red-800 dark:text-red-200 text-sm mb-2">Error Message:</p>
                  <p className="text-red-700 dark:text-red-300 font-mono text-xs break-all">{loadError.message}</p>
                </div>
              )}
            </div>

            {/* Diagnostic Info */}
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm mb-2">📋 Diagnostic Info:</p>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p>• Domain: <code className="bg-white dark:bg-gray-900 px-1 rounded">{currentDomain}</code></p>
                <p>• Hostname: <code className="bg-white dark:bg-gray-900 px-1 rounded">{hostname}</code></p>
                <p>• Protocol: <code className="bg-white dark:bg-gray-900 px-1 rounded">{protocol}</code></p>
                <p>• API Key Present: <code className="bg-white dark:bg-gray-900 px-1 rounded">{apiKey ? "Yes" : "No"}</code></p>
              </div>
            </div>

            {/* Specific Fix Based on Error Type */}
            {isReferrerError && (
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
                <p className="font-bold text-yellow-900 dark:text-yellow-100 text-sm mb-3">🔧 FIX: Add Domain to API Key Restrictions</p>
                <p className="text-yellow-800 dark:text-yellow-200 text-xs mb-3">
                  Your domain is not allowed in the API key restrictions. Add these to Google Cloud Console:
                </p>
                <div className="bg-white dark:bg-gray-900 p-2 rounded space-y-1 mb-3">
                  <code className="block text-xs break-all">{currentDomain}/*</code>
                  {hostname && (
                    <code className="block text-xs break-all">{protocol}//*.{hostname}/*</code>
                  )}
                </div>
                <div className="text-yellow-800 dark:text-yellow-200 text-xs space-y-1">
                  <p className="font-semibold">Steps:</p>
                  <ol className="list-decimal list-inside ml-2 space-y-1">
                    <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console → Credentials</a></li>
                    <li>Click your API key</li>
                    <li>Under "Application restrictions" → Select "HTTP referrers"</li>
                    <li>Add the domains shown above</li>
                    <li>Click "SAVE"</li>
                  </ol>
                </div>
              </div>
            )}

            {isInvalidKeyError && (
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border-2 border-red-400">
                <p className="font-bold text-red-900 dark:text-red-100 text-sm mb-2">🔧 FIX: Invalid API Key</p>
                <p className="text-red-800 dark:text-red-200 text-xs">
                  Check that your API key is correct in your hosting platform's environment variables.
                </p>
              </div>
            )}

            {isBillingError && (
              <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg border-2 border-orange-400">
                <p className="font-bold text-orange-900 dark:text-orange-100 text-sm mb-2">🔧 FIX: Enable Billing</p>
                <p className="text-orange-800 dark:text-orange-200 text-xs">
                  Go to Google Cloud Console → Billing and enable billing (required even for free tier).
                </p>
              </div>
            )}

            {isApiNotEnabledError && (
              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border-2 border-purple-400">
                <p className="font-bold text-purple-900 dark:text-purple-100 text-sm mb-2">🔧 FIX: Enable Maps JavaScript API</p>
                <p className="text-purple-800 dark:text-purple-200 text-xs">
                  Go to Google Cloud Console → APIs & Services → Library and enable "Maps JavaScript API".
                </p>
              </div>
            )}

            {/* General Troubleshooting */}
            {!isReferrerError && !isInvalidKeyError && !isBillingError && !isApiNotEnabledError && (
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-300 dark:border-gray-700">
                <p className="font-semibold text-sm mb-2">General Troubleshooting:</p>
                <ol className="list-decimal list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1 ml-2">
                  <li>Verify API key is set in hosting platform environment variables</li>
                  <li>Add your domain to API key restrictions: <code className="bg-white dark:bg-gray-800 px-1 rounded">{currentDomain}/*</code></li>
                  <li>Enable Maps JavaScript API in Google Cloud Console</li>
                  <li>Enable billing in Google Cloud Console</li>
                  <li>Redeploy your application after making changes</li>
                </ol>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading Google Maps...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!userLocation) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Location not available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Ensure userLocation has valid coordinates
  const validUserLocation = userLocation && 
    typeof userLocation.lat === 'number' && 
    typeof userLocation.lng === 'number' &&
    !isNaN(userLocation.lat) && 
    !isNaN(userLocation.lng)
    ? userLocation
    : null

  if (!validUserLocation) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Invalid location coordinates
          </div>
        </CardContent>
      </Card>
    )
  }

  const center = validUserLocation || defaultCenter

  // Icon creation functions - Awesome designed markers with accurate positioning
  const createUserMarkerIcon = (): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
          <defs>
            <filter id="userShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
              <feOffset dx="0" dy="3" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="userGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
            </linearGradient>
            <radialGradient id="userGlow" cx="50%" cy="50%">
              <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:0.6" />
              <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0" />
            </radialGradient>
          </defs>
          <g filter="url(#userShadow)">
            <!-- Outer glow ring -->
            <circle cx="40" cy="40" r="36" fill="url(#userGlow)"/>
            <!-- Main circle background -->
            <circle cx="40" cy="40" r="32" fill="url(#userGradient)" stroke="#ffffff" stroke-width="4"/>
            <!-- Person/Avatar Icon -->
            <g transform="translate(40, 40)">
              <!-- Head -->
              <circle cx="0" cy="-8" r="10" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
              <!-- Body (shoulders and torso) -->
              <path d="M -14 4 Q -14 0, -10 0 L 10 0 Q 14 0, 14 4 L 14 20 Q 14 24, 10 24 L -10 24 Q -14 24, -14 20 Z" 
                    fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
              <!-- Face details -->
              <circle cx="-4" cy="-10" r="1.5" fill="#3b82f6"/>
              <circle cx="4" cy="-10" r="1.5" fill="#3b82f6"/>
              <path d="M -4 -6 Q 0 -4, 4 -6" stroke="#3b82f6" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </g>
            <!-- Pulse ring animation -->
            <circle cx="40" cy="40" r="30" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.5"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(80, 80),
      anchor: new google.maps.Point(40, 40), // Center anchor for accurate positioning
    }
  }

  const createAgentMarkerIcon = (isSelected: boolean): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    const color = isSelected ? "#22c55e" : "#f97316"
    const shadowColor = isSelected ? "#16a34a" : "#ea580c"
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
          <defs>
            <filter id="agentShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
              <feOffset dx="0" dy="3" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.4"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="agentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${shadowColor};stop-opacity:1" />
            </linearGradient>
          </defs>
          <g filter="url(#agentShadow)">
            <!-- Location pin shape -->
            <path d="M32 8 C24 8, 18 14, 18 22 C18 30, 32 56, 32 56 C32 56, 46 30, 46 22 C46 14, 40 8, 32 8 Z" 
                  fill="url(#agentGradient)" 
                  stroke="#ffffff" 
                  stroke-width="3"/>
            <!-- Inner highlight -->
            <ellipse cx="32" cy="22" rx="12" ry="12" fill="#ffffff" opacity="0.3"/>
            <!-- Icon/Letter -->
            <circle cx="32" cy="22" r="8" fill="#ffffff"/>
            <text x="32" y="26" font-family="Arial, sans-serif" font-size="14" font-weight="bold" 
                  fill="${color}" text-anchor="middle">A</text>
            <!-- Glow effect -->
            <circle cx="32" cy="22" r="14" fill="none" stroke="${color}" stroke-width="2" opacity="0.3"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(64, 64),
      anchor: new google.maps.Point(32, 56), // Bottom center of pin for accurate positioning
    }
  }

  // Calculate meeting point (midpoint) between customer and agent
  const calculateMeetingPoint = (): { lat: number; lng: number } | null => {
    if (!validUserLocation || !agentLocation) return null
    
    return {
      lat: (validUserLocation.lat + agentLocation.lat) / 2,
      lng: (validUserLocation.lng + agentLocation.lng) / 2,
    }
  }

  const meetingPoint = showMeetingPoint ? calculateMeetingPoint() : null

  const createMeetingPointIcon = (): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
          <defs>
            <filter id="meetingShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
              <feOffset dx="0" dy="3" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.4"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="meetingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#9333ea;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
            </linearGradient>
          </defs>
          <g filter="url(#meetingShadow)">
            <!-- Location pin shape -->
            <path d="M32 8 C24 8, 18 14, 18 22 C18 30, 32 56, 32 56 C32 56, 46 30, 46 22 C46 14, 40 8, 32 8 Z" 
                  fill="url(#meetingGradient)" 
                  stroke="#ffffff" 
                  stroke-width="3"/>
            <!-- Inner highlight -->
            <ellipse cx="32" cy="22" rx="12" ry="12" fill="#ffffff" opacity="0.3"/>
            <!-- Handshake icon -->
            <circle cx="32" cy="22" r="10" fill="#ffffff"/>
            <path d="M24 22 L28 18 L32 22 L36 18 L40 22" stroke="#9333ea" stroke-width="2" fill="none" stroke-linecap="round"/>
            <circle cx="28" cy="20" r="2" fill="#9333ea"/>
            <circle cx="36" cy="20" r="2" fill="#9333ea"/>
            <!-- Glow effect -->
            <circle cx="32" cy="22" r="14" fill="none" stroke="#9333ea" stroke-width="2" opacity="0.3"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(64, 64),
      anchor: new google.maps.Point(32, 56), // Bottom center of pin
    }
  }

  const createCarIcon = (heading?: number): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    const rotation = heading || 0
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
          <defs>
            <filter id="carShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
              <feOffset dx="0" dy="4" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="carGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#1e3a8a;stop-opacity:1" />
            </linearGradient>
          </defs>
          <g filter="url(#carShadow)" transform="rotate(${rotation} 36 36)">
            <!-- Car body with modern design -->
            <rect x="14" y="24" width="44" height="24" rx="4" fill="url(#carGradient)" stroke="#ffffff" stroke-width="2.5"/>
            <!-- Windshield -->
            <rect x="18" y="28" width="14" height="16" rx="2" fill="#3b82f6" opacity="0.6"/>
            <!-- Rear window -->
            <rect x="32" y="28" width="14" height="16" rx="2" fill="#3b82f6" opacity="0.6"/>
            <!-- Roof -->
            <rect x="16" y="18" width="40" height="10" rx="3" fill="#1e3a8a"/>
            <!-- Wheels with detail -->
            <circle cx="24" cy="52" r="6" fill="#1a1a1a" stroke="#ffffff" stroke-width="2"/>
            <circle cx="24" cy="52" r="3" fill="#4a4a4a"/>
            <circle cx="24" cy="52" r="1.5" fill="#ffffff"/>
            <circle cx="48" cy="52" r="6" fill="#1a1a1a" stroke="#ffffff" stroke-width="2"/>
            <circle cx="48" cy="52" r="3" fill="#4a4a4a"/>
            <circle cx="48" cy="52" r="1.5" fill="#ffffff"/>
            <!-- Headlights -->
            <circle cx="20" cy="32" r="2" fill="#ffff99"/>
            <circle cx="20" cy="40" r="2" fill="#ff4444"/>
            <!-- Side detail line -->
            <line x1="18" y1="36" x2="54" y2="36" stroke="#ffffff" stroke-width="1.5" opacity="0.5"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(72, 72),
      anchor: new google.maps.Point(36, 36), // Center anchor for accurate positioning
    }
  }

  return (
    <div className="h-[350px] w-full relative border rounded-lg overflow-hidden">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        }}
      >
        {/* User location marker with accurate positioning */}
        {isMapReady && createUserMarkerIcon() && validUserLocation && (
          <Marker
            position={{
              lat: validUserLocation.lat,
              lng: validUserLocation.lng,
            }}
            icon={createUserMarkerIcon()}
            title="Your Location"
            animation={google.maps.Animation.DROP}
            zIndex={1000}
            optimized={false}
          />
        )}

        {/* User location circle with better visibility */}
        {validUserLocation && (
          <Circle
            center={validUserLocation}
            radius={150}
            options={{
              fillColor: "#3b82f6",
              fillOpacity: 0.08,
              strokeColor: "#3b82f6",
              strokeOpacity: 0.6,
              strokeWeight: 2,
              zIndex: 1,
            }}
          />
        )}

        {/* Agent markers with accurate positioning */}
        {isMapReady && agents.map((agent) => {
          // Use real-time agent location if available and this is the selected agent
          const agentPos =
            agentLocation && selectedAgent?.id === agent.id
              ? agentLocation
              : agent.location

          // Ensure coordinates are valid
          if (!agentPos || typeof agentPos.lat !== 'number' || typeof agentPos.lng !== 'number' || 
              isNaN(agentPos.lat) || isNaN(agentPos.lng)) {
            console.warn(`Invalid coordinates for agent ${agent.id}:`, agentPos)
            return null
          }

          const icon = agentLocation && selectedAgent?.id === agent.id
            ? createCarIcon(agentHeading)
            : createAgentMarkerIcon(selectedAgent?.id === agent.id)

          if (!icon) return null

          return (
            <Marker
              key={agent.id}
              position={{
                lat: agentPos.lat,
                lng: agentPos.lng,
              }}
              icon={icon}
              title={`${agent.name} - ${agent.distanceFormatted} away`}
              animation={
                agentLocation && selectedAgent?.id === agent.id
                  ? undefined
                  : google.maps.Animation.DROP
              }
              onClick={() => onSelectAgent(agent)}
              zIndex={selectedAgent?.id === agent.id ? 1001 : 500}
            />
          )
        })}

        {/* Meeting Point Marker */}
        {showMeetingPoint && meetingPoint && isMapReady && createMeetingPointIcon() && (
          <Marker
            position={meetingPoint}
            icon={createMeetingPointIcon()}
            title="Meeting Point (Midpoint)"
            animation={google.maps.Animation.DROP}
            zIndex={999}
          />
        )}

        {/* Route from agent to user */}
        {showRoute && directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true, // We use custom markers
              polylineOptions: {
                strokeColor: "#22c55e",
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* Legend overlay */}
      <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white p-2 rounded text-xs space-y-1 z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Your Location</span>
        </div>
        {agents.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>{agents.length} Agent{agents.length !== 1 ? "s" : ""} Available</span>
          </div>
        )}
        {showRoute && selectedAgent && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 h-1"></div>
            <span>Route to {selectedAgent.name}</span>
          </div>
        )}
        {showMeetingPoint && meetingPoint && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Meeting Point</span>
          </div>
        )}
      </div>
    </div>
  )
}

