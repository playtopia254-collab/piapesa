"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Circle } from "@react-google-maps/api"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { 
  PositionSmoother, 
  getDistanceMeters, 
  calculateBearing, 
  lerp, 
  lerpAngle,
  easeOutCubic 
} from "@/lib/smooth-marker"

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

// Clean Bolt-style map theme - always visible and clear
const cleanMapStyle: google.maps.MapTypeStyle[] = [
  // Keep default Google Maps appearance but reduce clutter
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station.bus", stylers: [{ visibility: "off" }] },
]

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
  
  // Smooth marker animation state
  const [smoothedAgentPos, setSmoothedAgentPos] = useState<{ lat: number; lng: number } | null>(null)
  const [displayHeading, setDisplayHeading] = useState<number>(0)
  const positionSmootherRef = useRef<PositionSmoother | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const animationStartRef = useRef<number>(0)
  const animationFromRef = useRef<{ lat: number; lng: number; heading: number }>({ lat: 0, lng: 0, heading: 0 })
  const animationToRef = useRef<{ lat: number; lng: number; heading: number }>({ lat: 0, lng: 0, heading: 0 })
  const isAnimatingRef = useRef<boolean>(false)
  
  // Initialize position smoother
  if (!positionSmootherRef.current) {
    positionSmootherRef.current = new PositionSmoother(0.4) // 0.4 = balanced smoothing
  }

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

  // Smooth marker animation function
  const animateMarker = useCallback(() => {
    if (!isAnimatingRef.current) return
    
    const now = performance.now()
    const elapsed = now - animationStartRef.current
    const duration = 800 // 800ms animation duration
    const progress = Math.min(elapsed / duration, 1)
    const easedProgress = easeOutCubic(progress)
    
    // Interpolate position
    const currentLat = lerp(animationFromRef.current.lat, animationToRef.current.lat, easedProgress)
    const currentLng = lerp(animationFromRef.current.lng, animationToRef.current.lng, easedProgress)
    
    // Smooth heading interpolation
    const currentHeading = lerpAngle(
      animationFromRef.current.heading,
      animationToRef.current.heading,
      easedProgress
    )
    
    setSmoothedAgentPos({ lat: currentLat, lng: currentLng })
    setDisplayHeading(currentHeading)
    
    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animateMarker)
    } else {
      isAnimatingRef.current = false
      // Snap to final position
      setSmoothedAgentPos({ lat: animationToRef.current.lat, lng: animationToRef.current.lng })
      setDisplayHeading(animationToRef.current.heading)
    }
  }, [])

  // Calculate agent heading and smooth position (Uber-like smooth movement)
  useEffect(() => {
    if (!agentLocation) return
    
    // Apply GPS smoothing
    const smoother = positionSmootherRef.current
    if (!smoother) return
    
    const smoothed = smoother.update(agentLocation.lat, agentLocation.lng)
    
    // Calculate distance to determine if we should animate
    const currentPos = smoothedAgentPos || previousAgentLocation.current
    if (!currentPos) {
      // First position - set immediately
      setSmoothedAgentPos(smoothed)
      previousAgentLocation.current = smoothed
      return
    }
    
    const distance = getDistanceMeters(
      currentPos.lat,
      currentPos.lng,
      smoothed.lat,
      smoothed.lng
    )
    
    // Skip tiny movements (< 2m) to avoid jitter
    if (distance < 2) {
      previousAgentLocation.current = agentLocation
      return
    }
    
    // Calculate new heading based on movement direction
    let newHeading = displayHeading
    if (distance > 3) {
      newHeading = calculateBearing(
        currentPos.lat,
        currentPos.lng,
        smoothed.lat,
        smoothed.lng
      )
    }
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // Set up animation parameters
    animationFromRef.current = {
      lat: currentPos.lat,
      lng: currentPos.lng,
      heading: displayHeading
    }
    animationToRef.current = {
      lat: smoothed.lat,
      lng: smoothed.lng,
      heading: newHeading
    }
    animationStartRef.current = performance.now()
    isAnimatingRef.current = true
    
    // Start animation
    animationFrameRef.current = requestAnimationFrame(animateMarker)
    
    // Update heading state for icon rotation
    setAgentHeading(newHeading)
    previousAgentLocation.current = agentLocation
    
    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [agentLocation, animateMarker, displayHeading, smoothedAgentPos])

  // Smooth camera following for agent movement (like Bolt/Uber)
  useEffect(() => {
    if (map && isMapReady && agentLocation && showRoute && selectedAgent) {
      // Smoothly pan to agent location instead of jumping
      const currentCenter = map.getCenter()
      if (currentCenter) {
        const currentLat = currentCenter.lat()
        const currentLng = currentCenter.lng()
        const targetLat = agentLocation.lat
        const targetLng = agentLocation.lng
        
        // Only pan if there's a significant change (more than 0.0001 degrees ~11 meters)
        const latDiff = Math.abs(currentLat - targetLat)
        const lngDiff = Math.abs(currentLng - targetLng)
        
        if (latDiff > 0.0001 || lngDiff > 0.0001) {
          // Smooth pan animation
          map.panTo({
            lat: targetLat,
            lng: targetLng,
          })
        }
      }
    }
  }, [map, isMapReady, agentLocation, showRoute, selectedAgent])

  // Fit map to bounds when locations change (only when not tracking)
  useEffect(() => {
    if (map && isMapReady && !showRoute) {
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
  }, [map, isMapReady, userLocation, agents, showMeetingPoint, calculateBounds, showRoute])

  // Calculate and display route - updates smoothly when agent moves
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

    // Debounce route updates to avoid too many API calls
    const timeoutId = setTimeout(() => {
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
    }, 500) // Small delay to batch updates

    return () => clearTimeout(timeoutId)
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
        <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90">
          <defs>
            <filter id="premiumGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <radialGradient id="pulseGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.5">
                <animate attributeName="stop-opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0">
                <animate attributeName="stop-opacity" values="0;0.08;0" dur="2s" repeatCount="indefinite"/>
              </stop>
            </radialGradient>
            <linearGradient id="userGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#60a5fa"/>
              <stop offset="100%" style="stop-color:#3b82f6"/>
            </linearGradient>
          </defs>
          <!-- Animated pulse ring -->
          <circle cx="45" cy="45" r="38" fill="url(#pulseGrad)">
            <animate attributeName="r" values="28;42;28" dur="2s" repeatCount="indefinite"/>
          </circle>
          <!-- Accuracy ring -->
          <circle cx="45" cy="45" r="25" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.2"/>
          <!-- Main dot with glow -->
          <g filter="url(#premiumGlow)">
            <circle cx="45" cy="45" r="14" fill="url(#userGrad)" stroke="#ffffff" stroke-width="4"/>
            <!-- Inner highlight for 3D effect -->
            <circle cx="41" cy="41" r="4" fill="#93c5fd" opacity="0.5"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(90, 90),
      anchor: new google.maps.Point(45, 45),
    }
  }

  const createAgentMarkerIcon = (isSelected: boolean): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    const primaryColor = isSelected ? "#10b981" : "#6366f1"
    const secondaryColor = isSelected ? "#059669" : "#4f46e5"
    const glowOpacity = isSelected ? "0.4" : "0.2"
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="72" height="88" viewBox="0 0 72 88">
          <defs>
            <filter id="premiumShadow" x="-50%" y="-30%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="${secondaryColor}" flood-opacity="0.4"/>
            </filter>
            <linearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:${primaryColor}"/>
              <stop offset="50%" style="stop-color:${primaryColor}"/>
              <stop offset="100%" style="stop-color:${secondaryColor}"/>
            </linearGradient>
            ${isSelected ? `
            <radialGradient id="selectedPulse" cx="50%" cy="40%" r="50%">
              <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.5">
                <animate attributeName="stop-opacity" values="0.5;0.15;0.5" dur="1.5s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0"/>
            </radialGradient>` : ""}
          </defs>
          ${isSelected ? `
          <!-- Selection pulse animation -->
          <circle cx="36" cy="36" r="32" fill="url(#selectedPulse)">
            <animate attributeName="r" values="28;38;28" dur="1.5s" repeatCount="indefinite"/>
          </circle>` : ""}
          <!-- Premium pin with shadow -->
          <g filter="url(#premiumShadow)">
            <!-- Pin shape -->
            <path d="M36 8 C22 8, 12 20, 12 32 C12 48, 36 80, 36 80 C36 80, 60 48, 60 32 C60 20, 50 8, 36 8 Z" 
                  fill="url(#pinGrad)" stroke="#ffffff" stroke-width="3"/>
            <!-- Avatar circle -->
            <circle cx="36" cy="30" r="16" fill="#ffffff"/>
            <!-- Agent icon -->
            <circle cx="36" cy="26" r="7" fill="${primaryColor}"/>
            <path d="M26 40 Q36 32, 46 40" fill="${primaryColor}"/>
          </g>
          <!-- Verification badge for selected -->
          ${isSelected ? `
          <circle cx="54" cy="16" r="10" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
          <path d="M50 16 L53 19 L58 12" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
        </svg>
      `),
      scaledSize: new google.maps.Size(72, 88),
      anchor: new google.maps.Point(36, 80),
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
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
          <defs>
            <filter id="premiumCarShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
              <feOffset dx="0" dy="2"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="carBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#0f172a"/>
              <stop offset="50%" style="stop-color:#1e293b"/>
              <stop offset="100%" style="stop-color:#0f172a"/>
            </linearGradient>
            <linearGradient id="roofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#334155"/>
              <stop offset="100%" style="stop-color:#1e293b"/>
            </linearGradient>
            <!-- Direction indicator glow -->
            <radialGradient id="directionGlow" cx="50%" cy="0%" r="80%">
              <stop offset="0%" style="stop-color:#10b981;stop-opacity:0.8"/>
              <stop offset="100%" style="stop-color:#10b981;stop-opacity:0"/>
            </radialGradient>
          </defs>
          <g filter="url(#premiumCarShadow)" transform="rotate(${rotation} 40 40)">
            <!-- Direction indicator beam -->
            <ellipse cx="40" cy="10" rx="12" ry="18" fill="url(#directionGlow)" opacity="0.7">
              <animate attributeName="opacity" values="0.7;0.4;0.7" dur="1s" repeatCount="indefinite"/>
            </ellipse>
            <!-- Car shadow on ground -->
            <ellipse cx="40" cy="60" rx="20" ry="7" fill="#000000" opacity="0.15"/>
            <!-- Main car body -->
            <rect x="20" y="30" width="40" height="26" rx="5" fill="url(#carBodyGrad)" stroke="#ffffff" stroke-width="2"/>
            <!-- Roof/Cabin -->
            <path d="M24 30 L28 20 H52 L56 30" fill="url(#roofGrad)" stroke="#ffffff" stroke-width="2"/>
            <!-- Windows -->
            <rect x="28" y="22" width="11" height="9" rx="1.5" fill="#1e3a5f" opacity="0.9"/>
            <rect x="41" y="22" width="11" height="9" rx="1.5" fill="#1e3a5f" opacity="0.9"/>
            <!-- Front headlights (bright) -->
            <circle cx="24" cy="34" r="3" fill="#fef08a">
              <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="56" cy="34" r="3" fill="#fef08a">
              <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite"/>
            </circle>
            <!-- Taillights -->
            <circle cx="24" cy="52" r="2.5" fill="#ef4444"/>
            <circle cx="56" cy="52" r="2.5" fill="#ef4444"/>
            <!-- Premium chrome strip -->
            <line x1="22" y1="43" x2="58" y2="43" stroke="#94a3b8" stroke-width="1.5" opacity="0.6"/>
            <!-- Wheels with alloy detail -->
            <g>
              <circle cx="26" cy="58" r="5" fill="#1f2937" stroke="#475569" stroke-width="2"/>
              <circle cx="26" cy="58" r="2.5" fill="#4b5563"/>
              <circle cx="26" cy="58" r="1" fill="#9ca3af"/>
            </g>
            <g>
              <circle cx="54" cy="58" r="5" fill="#1f2937" stroke="#475569" stroke-width="2"/>
              <circle cx="54" cy="58" r="2.5" fill="#4b5563"/>
              <circle cx="54" cy="58" r="1" fill="#9ca3af"/>
            </g>
            <!-- Side mirrors -->
            <ellipse cx="18" cy="36" rx="3" ry="2" fill="#1e293b"/>
            <ellipse cx="62" cy="36" rx="3" ry="2" fill="#1e293b"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(80, 80),
      anchor: new google.maps.Point(40, 40),
    }
  }

  return (
    <div className="h-[400px] sm:h-[450px] lg:h-[500px] w-full relative rounded-2xl overflow-hidden shadow-2xl border-2 border-border/50">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          zoomControlOptions: {
            position: typeof window !== "undefined" && window.google 
              ? google.maps.ControlPosition.RIGHT_CENTER 
              : undefined,
          },
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: typeof window !== "undefined" && window.google 
              ? google.maps.ControlPosition.RIGHT_TOP 
              : undefined,
          },
          scaleControl: true,
          rotateControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: cleanMapStyle,
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

        {/* Agent markers with smooth animation */}
        {isMapReady && agents.map((agent) => {
          // Check if this is the selected agent being tracked in real-time
          const isRealTimeTracking = agentLocation && selectedAgent?.id === agent.id
          
          // Use smoothed position for real-time tracking, otherwise use raw location
          let agentPos: { lat: number; lng: number }
          if (isRealTimeTracking && smoothedAgentPos) {
            // Use smoothed position for ultra-smooth movement
            agentPos = smoothedAgentPos
          } else if (isRealTimeTracking && agentLocation) {
            // Fallback to raw location if smooth position not ready
            agentPos = agentLocation
          } else {
            // Static agent - use their stored location
            agentPos = agent.location
          }

          // Ensure coordinates are valid
          if (!agentPos || typeof agentPos.lat !== 'number' || typeof agentPos.lng !== 'number' || 
              isNaN(agentPos.lat) || isNaN(agentPos.lng)) {
            console.warn(`Invalid coordinates for agent ${agent.id}:`, agentPos)
            return null
          }

          // Use smooth heading for car icon rotation
          const currentHeading = isRealTimeTracking ? displayHeading : 0
          
          const icon = isRealTimeTracking
            ? createCarIcon(currentHeading)
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
                isRealTimeTracking
                  ? undefined // No animation for real-time updates (smooth movement handled internally)
                  : google.maps.Animation.DROP // Drop animation only on initial load
              }
              onClick={() => onSelectAgent(agent)}
              zIndex={selectedAgent?.id === agent.id ? 1001 : 500}
              optimized={false} // CRITICAL: Disable optimization for smooth position updates
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
                strokeColor: "#10b981",
                strokeWeight: 6,
                strokeOpacity: 0.9,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* Premium Legend overlay */}
      <div className="absolute bottom-3 left-3 bg-background/95 backdrop-blur-md text-foreground px-4 py-3 rounded-xl shadow-2xl border border-border/50 text-sm z-10">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 ring-2 ring-blue-400/30"></div>
            <span className="font-medium">Your Location</span>
          </div>
          {agents.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 ring-2 ring-indigo-400/30"></div>
              <span className="font-medium">{agents.length} Agent{agents.length !== 1 ? "s" : ""} Available</span>
            </div>
          )}
          {showRoute && selectedAgent && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
              <span className="font-medium">Route to {selectedAgent.name}</span>
            </div>
          )}
          {showMeetingPoint && meetingPoint && (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 ring-2 ring-purple-400/30"></div>
              <span className="font-medium">Meeting Point</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

