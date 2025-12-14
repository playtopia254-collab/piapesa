"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { GoogleMap, useJsApiLoader, Marker, Circle } from "@react-google-maps/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Star, MapPin, Navigation, AlertCircle } from "lucide-react"
import { getCurrentLocation, watchLocation } from "@/lib/location-utils"

interface Agent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  isAvailable?: boolean
  distance?: number // in meters
  distanceFormatted?: string
  totalReviews?: number
}

interface UberAgentTrackingMapProps {
  onSelectAgent?: (agent: Agent) => void
  selectedAgentId?: string | null
  height?: string
}

// Use the same libraries as google-maps-wrapper to avoid conflicts
const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places", "geometry", "drawing"]

const mapContainerStyle = {
  width: "100%",
  height: "100%",
}

const defaultCenter = {
  lat: -1.2921, // Nairobi
  lng: 36.8219,
}

// Bolt-style clean map theme - clear streets, easy to read
const boltMapStyle: google.maps.MapTypeStyle[] = [
  // Clean background colors
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  
  // Clear, readable text
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  
  // Locality names (city, neighborhood) - prominent
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#1a1a1a" }, { weight: 0.5 }] },
  
  // Street names - clear and readable
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#4a4a4a" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#1a1a1a" }] },
  
  // Roads - clean white with subtle borders
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e0e0e0" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#d0d0d0" }] },
  
  // Parks - subtle green
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c8e6c9" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4caf50" }] },
  
  // Water - subtle blue
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bbdefb" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1976d2" }] },
  
  // Hide clutter but keep important landmarks
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station.bus", stylers: [{ visibility: "off" }] },
  
  // Keep important POIs like malls, hospitals
  { featureType: "poi.medical", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "poi.place_of_worship", elementType: "labels", stylers: [{ visibility: "on" }] },
]

// Format distance for display
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m away`
  }
  return `${(meters / 1000).toFixed(1)} km away`
}

export function UberAgentTrackingMap({
  onSelectAgent,
  selectedAgentId,
  height = "600px",
}: UberAgentTrackingMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  
  // Refs for marker animations
  const markerRefs = useRef<{ [key: string]: google.maps.Marker }>({})
  const previousPositions = useRef<{ [key: string]: { lat: number; lng: number } }>({})
  const animationFrames = useRef<{ [key: string]: number }>({})
  
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  // Use the same loader ID as google-maps-wrapper to avoid conflicts
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  })

  // Log detailed error information
  useEffect(() => {
    if (loadError) {
      console.error("=".repeat(80))
      console.error("🚨 GOOGLE MAPS ERROR DETECTED (Tracking Map)")
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

  // Get user's location with high accuracy
  useEffect(() => {
    let watchCleanup: (() => void) | null = null

    const initializeLocation = async () => {
      try {
        setIsLoading(true)
        
        // Get initial location
        const location = await getCurrentLocation()
        setUserLocation({ lat: location.lat, lng: location.lng })
        setLocationAccuracy(location.accuracy || null)
        
        // Watch for location updates
        watchCleanup = watchLocation(
          (location) => {
            setUserLocation({ lat: location.lat, lng: location.lng })
            setLocationAccuracy(location.accuracy || null)
          },
          (error) => {
            console.error("Location watch error:", error)
          }
        )
      } catch (error) {
        console.error("Failed to get location:", error)
        setError("Failed to get your location. Please enable location permissions.")
      } finally {
        setIsLoading(false)
      }
    }

    initializeLocation()

    return () => {
      if (watchCleanup) {
        watchCleanup()
      }
    }
  }, [])

  // Fetch nearby agents
  const fetchAgents = useCallback(async () => {
    if (!userLocation) return

    try {
      const response = await fetch(
        `/api/agents/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&maxDistance=20`
      )
      const data = await response.json()

      if (data.success && data.agents) {
        console.log("📊 Agents received from API:", data.agents.map((a: any) => ({
          name: a.name,
          isAvailable: a.isAvailable,
        })))
        
        // Calculate distances using Google Maps Geometry Library
        const agentsWithDistance = data.agents.map((agent: any) => {
          if (!window.google?.maps?.geometry) {
            // Fallback to existing distance if geometry library not loaded
            return {
              ...agent,
              distance: agent.distance ? agent.distance * 1000 : 0, // Convert km to meters
              distanceFormatted: agent.distanceFormatted || "Unknown",
              isAvailable: agent.isAvailable !== undefined ? agent.isAvailable : true, // Preserve availability status
            }
          }

          const userLatLng = new google.maps.LatLng(userLocation.lat, userLocation.lng)
          const agentLatLng = new google.maps.LatLng(agent.location.lat, agent.location.lng)
          
          // Use Google Maps Geometry Library for accurate distance calculation
          let distanceMeters = 0
          
          if (window.google?.maps?.geometry) {
            distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(
              userLatLng,
              agentLatLng
            )
          } else {
            // Fallback: use server-provided distance or calculate manually
            if (agent.distance) {
              distanceMeters = agent.distance * 1000 // Convert km to meters
            } else {
              // Manual calculation as last resort
              const R = 6371000 // Earth radius in meters
              const dLat = (agent.location.lat - userLocation.lat) * Math.PI / 180
              const dLng = (agent.location.lng - userLocation.lng) * Math.PI / 180
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(agent.location.lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2)
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
              distanceMeters = R * c
            }
          }

          return {
            ...agent,
            distance: distanceMeters,
            distanceFormatted: formatDistance(distanceMeters),
            isAvailable: agent.isAvailable !== undefined ? agent.isAvailable : true, // Preserve availability status
          }
        })

        // Sort: available first, then by distance
        const sortedAgents = agentsWithDistance.sort((a: Agent, b: Agent) => {
          // First sort by availability (available first)
          if (a.isAvailable !== b.isAvailable) {
            return a.isAvailable ? -1 : 1
          }
          // Then sort by distance
          return (a.distance || 0) - (b.distance || 0)
        })
        
        setAgents(sortedAgents)
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error)
    }
  }, [userLocation])

  // Fetch agents when location is available
  useEffect(() => {
    if (userLocation && isMapReady) {
      fetchAgents()
      
      // Set up real-time updates every 4 seconds
      const interval = setInterval(() => {
        fetchAgents()
      }, 4000)

      return () => clearInterval(interval)
    }
  }, [userLocation, isMapReady, fetchAgents])

  // Update selected agent when prop changes
  useEffect(() => {
    if (selectedAgentId && agents.length > 0) {
      const agent = agents.find((a) => a.id === selectedAgentId)
      if (agent) {
        setSelectedAgent(agent)
        // Zoom to agent
        if (map && agent.location) {
          map.setCenter(new google.maps.LatLng(agent.location.lat, agent.location.lng))
          map.setZoom(15)
        }
      }
    } else {
      setSelectedAgent(null)
    }
  }, [selectedAgentId, agents, map])

  // Center map on user location
  useEffect(() => {
    if (map && userLocation && isMapReady) {
      map.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng))
      map.setZoom(14)
    }
  }, [map, userLocation, isMapReady])

  // Smooth marker animation
  const animateMarker = useCallback((marker: google.maps.Marker, from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const startTime = Date.now()
    const duration = 1000 // 1 second animation

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      
      const lat = from.lat + (to.lat - from.lat) * easeOut
      const lng = from.lng + (to.lng - from.lng) * easeOut
      
      marker.setPosition(new google.maps.LatLng(lat, lng))
      
      if (progress < 1) {
        const frameId = requestAnimationFrame(animate)
        animationFrames.current[marker.getTitle() || ""] = frameId
      }
    }
    
    animate()
  }, [])

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
    setIsMapReady(true)
  }, [])

  const onMapUnmount = useCallback(() => {
    // Clean up animation frames
    Object.values(animationFrames.current).forEach((frameId) => {
      cancelAnimationFrame(frameId)
    })
    animationFrames.current = {}
    markerRefs.current = {}
    previousPositions.current = {}
    
    setMap(null)
    setIsMapReady(false)
  }, [])

  // Handle agent selection
  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent)
    if (map && agent.location) {
      map.setCenter(new google.maps.LatLng(agent.location.lat, agent.location.lng))
      map.setZoom(15)
    }
    onSelectAgent?.(agent)
  }

  // Create user marker icon (blue circular)
  const createUserMarkerIcon = (): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
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
          <circle cx="40" cy="40" r="35" fill="url(#pulseGrad)">
            <animate attributeName="r" values="28;38;28" dur="2s" repeatCount="indefinite"/>
          </circle>
          <!-- Accuracy ring -->
          <circle cx="40" cy="40" r="22" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.2"/>
          <!-- Main dot with glow -->
          <g filter="url(#premiumGlow)">
            <circle cx="40" cy="40" r="12" fill="url(#userGrad)" stroke="#ffffff" stroke-width="4"/>
            <!-- Inner highlight for 3D effect -->
            <circle cx="37" cy="37" r="4" fill="#93c5fd" opacity="0.5"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(80, 80),
      anchor: new google.maps.Point(40, 40),
    }
  }

  // Create premium agent marker icon
  const createAgentMarkerIcon = (isSelected: boolean, agentId: string, isAvailable: boolean = true): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    
    const primaryColor = isSelected ? "#10b981" : isAvailable ? "#6366f1" : "#6b7280"
    const secondaryColor = isSelected ? "#059669" : isAvailable ? "#4f46e5" : "#4b5563"
    
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="72" height="88" viewBox="0 0 72 88">
          <defs>
            <filter id="premiumShadow${agentId}" x="-50%" y="-30%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="${secondaryColor}" flood-opacity="0.4"/>
            </filter>
            <linearGradient id="pinGrad${agentId}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:${primaryColor}"/>
              <stop offset="50%" style="stop-color:${primaryColor}"/>
              <stop offset="100%" style="stop-color:${secondaryColor}"/>
            </linearGradient>
            ${isSelected ? `
            <radialGradient id="selectedPulse${agentId}" cx="50%" cy="40%" r="50%">
              <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.5">
                <animate attributeName="stop-opacity" values="0.5;0.15;0.5" dur="1.5s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0"/>
            </radialGradient>` : ""}
          </defs>
          ${isSelected ? `
          <!-- Selection pulse animation -->
          <circle cx="36" cy="36" r="32" fill="url(#selectedPulse${agentId})">
            <animate attributeName="r" values="28;38;28" dur="1.5s" repeatCount="indefinite"/>
          </circle>` : ""}
          <!-- Premium pin with shadow -->
          <g filter="url(#premiumShadow${agentId})">
            <!-- Pin shape -->
            <path d="M36 8 C22 8, 12 20, 12 32 C12 48, 36 80, 36 80 C36 80, 60 48, 60 32 C60 20, 50 8, 36 8 Z" 
                  fill="url(#pinGrad${agentId})" stroke="#ffffff" stroke-width="3"/>
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Getting your location...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-red-500">
            <p className="font-semibold text-lg">{error}</p>
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

  const center = userLocation || defaultCenter

  return (
    <div className="w-full space-y-4">
      {/* Location Accuracy Warning */}
      {locationAccuracy && locationAccuracy > 100 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 mb-4">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  Location Accuracy Warning
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  Your location accuracy is ±{Math.round(locationAccuracy)}m. This is less accurate because you're using a laptop/desktop.
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>💡 Tip:</strong> For best accuracy (±5-20m), use a mobile phone with GPS. Laptops use WiFi/IP location which can be off by 100-1000m.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map Container */}
      <Card className="overflow-hidden rounded-2xl shadow-2xl border-2 border-border/50">
        <div style={{ height }} className="relative">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={16}
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
              scaleControl: false,
              rotateControl: false,
              clickableIcons: false,
              gestureHandling: "greedy",
              styles: boltMapStyle,
              minZoom: 10,
              maxZoom: 20,
            }}
          >
            {/* User location marker */}
            {isMapReady && createUserMarkerIcon() && userLocation && (
              <Marker
                position={userLocation}
                icon={createUserMarkerIcon()}
                title="Your Location"
                zIndex={1000}
                optimized={false}
              />
            )}

            {/* User location accuracy circle - size based on actual accuracy */}
            {userLocation && (
              <Circle
                center={userLocation}
                radius={locationAccuracy ? Math.max(locationAccuracy, 50) : 50}
                options={{
                  fillColor: locationAccuracy && locationAccuracy > 100 ? "#f59e0b" : "#3b82f6",
                  fillOpacity: 0.1,
                  strokeColor: locationAccuracy && locationAccuracy > 100 ? "#f59e0b" : "#3b82f6",
                  strokeOpacity: 0.4,
                  strokeWeight: 2,
                  zIndex: 1,
                }}
              />
            )}

            {/* Agent markers */}
            {isMapReady &&
              agents.map((agent) => {
                if (!agent.location || !agent.location.lat || !agent.location.lng) return null

                const isSelected = selectedAgent?.id === agent.id
                const previousPos = previousPositions.current[agent.id]
                const currentPos = { lat: agent.location.lat, lng: agent.location.lng }

                // Animate marker if position changed
                if (previousPos && (previousPos.lat !== currentPos.lat || previousPos.lng !== currentPos.lng)) {
                  const marker = markerRefs.current[agent.id]
                  if (marker) {
                    animateMarker(marker, previousPos, currentPos)
                  }
                }

                previousPositions.current[agent.id] = currentPos

                return (
                  <Marker
                    key={agent.id}
                    position={currentPos}
                    icon={createAgentMarkerIcon(isSelected, agent.id, agent.isAvailable)}
                    title={`${agent.name} - ${agent.distanceFormatted || "Unknown distance"}${!agent.isAvailable ? " (Offline)" : ""}`}
                    onClick={() => handleAgentClick(agent)}
                    zIndex={isSelected ? 1001 : agent.isAvailable ? 500 : 400}
                    onLoad={(marker) => {
                      markerRefs.current[agent.id] = marker
                    }}
                    animation={undefined} // We handle animation manually
                  />
                )
              })}
          </GoogleMap>
        </div>
      </Card>

      {/* Agent List Panel - Uber Style */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/50">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Agents ({agents.filter(a => a.isAvailable === true).length} online, {agents.length} total)
            </h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto pb-4">
            {agents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No agents available nearby</p>
              </div>
            ) : (
              <div>
                {/* Available Agents Section - Only agents who pressed "Go Online" */}
                {agents.filter(a => a.isAvailable === true).length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-green-50 dark:bg-green-950/30 border-b">
                      <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">
                        Available - Online ({agents.filter(a => a.isAvailable === true).length})
                      </h4>
                    </div>
                    <div className="px-4 py-2.5 bg-green-50/50 dark:bg-green-950/20 border-b">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Tap on an agent marker or select from the list above
                      </p>
                    </div>
                    <div className="divide-y">
                      {agents
                        .filter(a => a.isAvailable === true)
                        .map((agent) => {
                          const isSelected = selectedAgent?.id === agent.id
                          return (
                            <div
                              key={agent.id}
                              className={`p-4 cursor-pointer transition-all relative isolate ${
                                isSelected
                                  ? "bg-green-50 dark:bg-green-950 border-l-4 border-green-500"
                                  : "hover:bg-muted/50"
                              }`}
                              onClick={() => handleAgentClick(agent)}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Avatar */}
                                  <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? "bg-green-100 dark:bg-green-900 ring-2 ring-green-500"
                                        : "bg-orange-100 dark:bg-orange-900"
                                    }`}
                                  >
                                    <span
                                      className={`text-lg font-bold ${
                                        isSelected
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-orange-600 dark:text-orange-400"
                                      }`}
                                    >
                                      {agent.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>

                                  {/* Agent Info */}
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold text-base truncate">{agent.name}</h4>
                                      {isSelected && (
                                        <Badge className="bg-green-500 text-white text-xs flex-shrink-0">Selected</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                        <span className="font-medium">{agent.rating.toFixed(1)}</span>
                                      </div>
                                      <span>•</span>
                                      <span>{agent.totalTransactions} {agent.totalTransactions === 1 ? "transaction" : "transactions"}</span>
                                      {agent.totalReviews !== undefined && agent.totalReviews > 0 && (
                                        <>
                                          <span>•</span>
                                          <span>{agent.totalReviews} reviews</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Distance */}
                                <div className="text-right flex-shrink-0">
                                  <Badge
                                    variant="outline"
                                    className={`font-semibold whitespace-nowrap ${
                                      isSelected
                                        ? "bg-green-100 dark:bg-green-900 border-green-500 text-green-700 dark:text-green-300"
                                        : "bg-primary/10 text-primary border-primary"
                                    }`}
                                  >
                                    {agent.distanceFormatted || "Unknown"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </>
                )}

                {/* Offline Agents Section - Agents who haven't pressed "Go Online" */}
                {agents.filter(a => a.isAvailable !== true).length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/30 border-b border-t">
                      <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        Offline ({agents.filter(a => a.isAvailable !== true).length})
                      </h4>
                    </div>
                    <div className="divide-y">
                      {agents
                        .filter(a => a.isAvailable !== true)
                        .map((agent) => {
                          const isSelected = selectedAgent?.id === agent.id
                          return (
                            <div
                              key={agent.id}
                              className={`p-4 cursor-pointer transition-all relative isolate ${
                                isSelected
                                  ? "bg-green-50 dark:bg-green-950 border-l-4 border-green-500"
                                  : "opacity-60 bg-muted/30"
                              }`}
                              onClick={() => handleAgentClick(agent)}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Avatar */}
                                  <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? "bg-green-100 dark:bg-green-900 ring-2 ring-green-500"
                                        : "bg-gray-100 dark:bg-gray-800"
                                    }`}
                                  >
                                    <span
                                      className={`text-lg font-bold ${
                                        isSelected
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-gray-600 dark:text-gray-400"
                                      }`}
                                    >
                                      {agent.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>

                                  {/* Agent Info */}
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <h4 className="font-semibold text-base truncate">{agent.name}</h4>
                                      <Badge variant="secondary" className="text-xs flex-shrink-0">Offline</Badge>
                                      {isSelected && (
                                        <Badge className="bg-green-500 text-white text-xs flex-shrink-0">Selected</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                        <span className="font-medium">{agent.rating.toFixed(1)}</span>
                                      </div>
                                      <span>•</span>
                                      <span>{agent.totalTransactions} {agent.totalTransactions === 1 ? "transaction" : "transactions"}</span>
                                      {agent.totalReviews !== undefined && agent.totalReviews > 0 && (
                                        <>
                                          <span>•</span>
                                          <span>{agent.totalReviews} reviews</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Distance */}
                                <div className="text-right flex-shrink-0">
                                  <Badge
                                    variant="outline"
                                    className={`font-semibold whitespace-nowrap ${
                                      isSelected
                                        ? "bg-green-100 dark:bg-green-900 border-green-500 text-green-700 dark:text-green-300"
                                        : "bg-gray-100 dark:bg-gray-800 border-gray-300 text-gray-600 dark:text-gray-400"
                                    }`}
                                  >
                                    {agent.distanceFormatted || "Unknown"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

