"use client"

/**
 * 🚀 BOLT-STYLE AGENT TRACKING MAP
 * 
 * A premium Mapbox-based agent tracking map with Bolt/Uber-like experience.
 * Features ultra-smooth animations, minimal styling, and vector-based rendering.
 * 
 * Use this component for:
 * - Finding nearby agents
 * - Real-time agent tracking during withdrawals
 * - Route visualization
 * 
 * Key Features:
 * ✅ Vector tiles - sharp at all zoom levels
 * ✅ Smooth 60fps marker animations
 * ✅ Custom SVG markers with no pixelation
 * ✅ GeoJSON route rendering above roads
 * ✅ Minimal, clean styling
 * ✅ Real-time distance updates
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Star,
  MapPin,
  Navigation2,
  AlertCircle,
  Target,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { getCurrentLocation, watchLocation } from "@/lib/location-utils"

// ============================================================================
// TYPES
// ============================================================================

interface Agent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  isAvailable?: boolean
  distance?: number
  distanceFormatted?: string
  totalReviews?: number
}

interface BoltAgentTrackingMapProps {
  onSelectAgent?: (agent: Agent) => void
  selectedAgentId?: string | null
  height?: string
}

// ============================================================================
// CAMERA & ANIMATION CONFIG
// ============================================================================

const CAMERA_CONFIG = {
  duration: 1500,
  easing: (t: number) => 1 - Math.pow(1 - t, 3),
  defaultZoom: 15,
  minZoom: 10,
  maxZoom: 18,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m away`
  }
  return `${(meters / 1000).toFixed(1)} km away`
}

function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ============================================================================
// MARKER ELEMENTS
// ============================================================================

function createUserMarkerEl(): HTMLDivElement {
  const el = document.createElement("div")
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
      <defs>
        <!-- Pin shadow -->
        <filter id="userPinShadow" x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
        <!-- Pin gradient -->
        <linearGradient id="userPinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#1d4ed8"/>
        </linearGradient>
        <!-- Pulse animation -->
        <radialGradient id="userPinPulse" cx="50%" cy="100%" r="80%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.4">
            <animate attributeName="stop-opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0"/>
        </radialGradient>
      </defs>
      
      <!-- Pulse ring at bottom -->
      <ellipse cx="20" cy="50" rx="12" ry="4" fill="url(#userPinPulse)">
        <animate attributeName="rx" values="10;16;10" dur="1.5s" repeatCount="indefinite"/>
      </ellipse>
      
      <!-- Ground shadow -->
      <ellipse cx="20" cy="50" rx="6" ry="2" fill="#000000" opacity="0.2"/>
      
      <!-- Map pin shape -->
      <g filter="url(#userPinShadow)">
        <path d="M20 0 C9 0 0 9 0 20 C0 32 20 48 20 48 C20 48 40 32 40 20 C40 9 31 0 20 0 Z" 
              fill="url(#userPinGrad)" stroke="#ffffff" stroke-width="2"/>
        <!-- Inner circle -->
        <circle cx="20" cy="18" r="8" fill="#ffffff"/>
        <!-- Center dot -->
        <circle cx="20" cy="18" r="4" fill="#3b82f6"/>
      </g>
    </svg>
  `
  el.style.cssText = "width: 40px; height: 52px; cursor: pointer;"
  return el
}

function createAgentMarkerEl(
  agent: Agent,
  isSelected: boolean
): HTMLDivElement {
  const el = document.createElement("div")
  
  // Colors based on selection and availability
  const primaryColor = isSelected
    ? "#22c55e"  // Green when selected
    : agent.isAvailable !== false
    ? "#22c55e"  // Green when available
    : "#6b7280"  // Gray when unavailable
  const secondaryColor = isSelected
    ? "#16a34a"
    : agent.isAvailable !== false
    ? "#16a34a"
    : "#4b5563"

  const selectedPulse = isSelected
    ? `<radialGradient id="carPulse_${agent.id}" cx="50%" cy="50%" r="60%">
         <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.5">
           <animate attributeName="stop-opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite"/>
         </stop>
         <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0"/>
       </radialGradient>`
    : ""

  const selectedPulseCircle = isSelected
    ? `<ellipse cx="20" cy="28" rx="22" ry="22" fill="url(#carPulse_${agent.id})">
         <animate attributeName="rx" values="20;26;20" dur="1.5s" repeatCount="indefinite"/>
         <animate attributeName="ry" values="20;26;20" dur="1.5s" repeatCount="indefinite"/>
       </ellipse>`
    : ""

  const verifiedBadge = isSelected
    ? `<circle cx="35" cy="8" r="7" fill="#22c55e" stroke="#ffffff" stroke-width="1.5"/>
       <path d="M32 8 L34 10 L38 5" stroke="#ffffff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : ""

  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
      <defs>
        <filter id="carShadow_${agent.id}" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.25"/>
        </filter>
        <linearGradient id="carGrad_${agent.id}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor}"/>
          <stop offset="100%" style="stop-color:${secondaryColor}"/>
        </linearGradient>
        ${selectedPulse}
      </defs>
      
      ${selectedPulseCircle}
      
      <!-- Ground shadow -->
      <ellipse cx="20" cy="52" rx="10" ry="3" fill="#000000" opacity="0.15"/>
      
      <!-- Small car icon -->
      <g filter="url(#carShadow_${agent.id})">
        <!-- Car body -->
        <rect x="8" y="16" width="24" height="36" rx="6" ry="6" 
              fill="url(#carGrad_${agent.id})" stroke="#ffffff" stroke-width="2"/>
        
        <!-- Windshield -->
        <rect x="11" y="20" width="18" height="8" rx="2" fill="#1e293b" opacity="0.8"/>
        
        <!-- Rear window -->
        <rect x="11" y="36" width="18" height="6" rx="2" fill="#1e293b" opacity="0.8"/>
        
        <!-- Headlights -->
        <circle cx="12" cy="18" r="2" fill="#fef08a"/>
        <circle cx="28" cy="18" r="2" fill="#fef08a"/>
        
        <!-- Taillights -->
        <circle cx="12" cy="50" r="1.5" fill="#ef4444"/>
        <circle cx="28" cy="50" r="1.5" fill="#ef4444"/>
      </g>
      
      ${verifiedBadge}
    </svg>
  `
  el.style.cssText =
    "width: 40px; height: 56px; cursor: pointer; transition: transform 0.2s ease-out;"
  return el
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BoltAgentTrackingMap({
  onSelectAgent,
  selectedAgentId,
  height = "600px",
}: BoltAgentTrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  // Default to Nairobi so map loads immediately
  const DEFAULT_LOCATION = { lat: -1.2921, lng: 36.8219 }
  
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(DEFAULT_LOCATION) // Start with default location
  const [hasRealLocation, setHasRealLocation] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(false) // Start false since we have default location
  const [isGettingLocation, setIsGettingLocation] = useState(true) // Separate state for location
  const [error, setError] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)

  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const agentMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

  // Get user's location (non-blocking - map loads with default first)
  useEffect(() => {
    let watchCleanup: (() => void) | null = null
    let timeoutId: NodeJS.Timeout | null = null

    const initializeLocation = async () => {
      try {
        setIsGettingLocation(true)
        
        // Set a 10-second timeout for location
        const locationPromise = getCurrentLocation()
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error("Location timeout - using default"))
          }, 10000) // 10 second timeout
        })
        
        const location = await Promise.race([locationPromise, timeoutPromise])
        
        if (timeoutId) clearTimeout(timeoutId)
        
        setUserLocation({ lat: location.lat, lng: location.lng })
        setLocationAccuracy(location.accuracy || null)
        setHasRealLocation(true)

        // Fly to user location if map is loaded
        if (map.current) {
          map.current.flyTo({
            center: [location.lng, location.lat],
            zoom: CAMERA_CONFIG.defaultZoom,
            duration: 1500,
          })
        }

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
        // Keep default location, show warning
        setError(
          "Using default location. Enable location for better results."
        )
      } finally {
        setIsGettingLocation(false)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    initializeLocation()

    return () => {
      if (watchCleanup) {
        watchCleanup()
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !userLocation) return
    if (!mapboxToken) {
      setMapError(
        "Mapbox access token is missing. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN."
      )
      return
    }

    try {
      mapboxgl.accessToken = mapboxToken

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        // Streets style shows buildings, roads, and landmarks like Bolt
        style: "mapbox://styles/mapbox/streets-v12",
        center: [userLocation.lng, userLocation.lat],
        zoom: CAMERA_CONFIG.defaultZoom,
        minZoom: CAMERA_CONFIG.minZoom,
        maxZoom: CAMERA_CONFIG.maxZoom,
        antialias: true,
        fadeDuration: 0,
        attributionControl: false,
      })

      map.current.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-left"
      )

      map.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "top-right"
      )

      map.current.on("load", () => {
        if (!map.current) return

        // Minimal adjustments - keep streets-v12 style mostly intact
        // Only filter out very small POIs (tiny shops) to reduce clutter
        if (map.current?.getLayer("poi-label")) {
          try {
            map.current.setFilter("poi-label", [
              "any",
              ["==", ["get", "class"], "park"],
              ["==", ["get", "class"], "hospital"],
              ["==", ["get", "class"], "school"],
              ["==", ["get", "class"], "college"],
              ["==", ["get", "class"], "stadium"],
              ["==", ["get", "class"], "airport"],
              ["==", ["get", "class"], "bus_station"],
              ["==", ["get", "class"], "railway"],
              ["==", ["get", "class"], "lodging"],
              ["==", ["get", "class"], "place_of_worship"],
              ["==", ["get", "class"], "bank"],
              ["==", ["get", "class"], "fuel"],
              ["==", ["get", "class"], "parking"],
              [">=", ["get", "sizerank"], 14],
            ])
          } catch (e) {
            // Keep all POIs if filter fails
            console.log("POI filter not applied")
          }
        }

        setMapLoaded(true)
      })

      map.current.on("error", (e) => {
        console.error("Mapbox error:", e)
        setMapError("Failed to load map.")
      })
    } catch (error) {
      console.error("Map initialization error:", error)
      setMapError("Failed to initialize map.")
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [mapboxToken, userLocation])

  // Fetch nearby agents
  const fetchAgents = useCallback(async () => {
    if (!userLocation) return

    try {
      const response = await fetch(
        `/api/agents/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&maxDistance=20`
      )
      const data = await response.json()

      if (data.success && data.agents) {
        const agentsWithDistance = data.agents.map((agent: any) => {
          const distanceMeters = getDistanceMeters(
            userLocation.lat,
            userLocation.lng,
            agent.location.lat,
            agent.location.lng
          )

          return {
            ...agent,
            distance: distanceMeters,
            distanceFormatted: formatDistance(distanceMeters),
            isAvailable:
              agent.isAvailable !== undefined ? agent.isAvailable : true,
          }
        })

        const sortedAgents = agentsWithDistance.sort(
          (a: Agent, b: Agent) => {
            if (a.isAvailable !== b.isAvailable) {
              return a.isAvailable ? -1 : 1
            }
            return (a.distance || 0) - (b.distance || 0)
          }
        )

        setAgents(sortedAgents)
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error)
    }
  }, [userLocation])

  // Fetch agents when location is available
  useEffect(() => {
    if (userLocation && mapLoaded) {
      fetchAgents()
      const interval = setInterval(fetchAgents, 4000)
      return () => clearInterval(interval)
    }
  }, [userLocation, mapLoaded, fetchAgents])

  // Add user marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return

    if (userMarkerRef.current) {
      userMarkerRef.current.remove()
    }

    const el = createUserMarkerEl()
    userMarkerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: "center",
    })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current)
  }, [mapLoaded, userLocation])

  // Add agent markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    agentMarkersRef.current.forEach((marker) => marker.remove())
    agentMarkersRef.current.clear()

    agents.forEach((agent) => {
      if (!agent.location || !map.current) return

      const isSelected = selectedAgent?.id === agent.id
      const el = createAgentMarkerEl(agent, isSelected)

      el.addEventListener("click", () => {
        handleAgentClick(agent)
      })

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat([agent.location.lng, agent.location.lat])
        .addTo(map.current!)

      agentMarkersRef.current.set(agent.id, marker)
    })
  }, [mapLoaded, agents, selectedAgent])

  // Update selected agent when prop changes
  useEffect(() => {
    if (selectedAgentId && agents.length > 0) {
      const agent = agents.find((a) => a.id === selectedAgentId)
      if (agent) {
        setSelectedAgent(agent)
        if (map.current && agent.location) {
          map.current.flyTo({
            center: [agent.location.lng, agent.location.lat],
            zoom: 15,
            duration: CAMERA_CONFIG.duration,
            easing: CAMERA_CONFIG.easing,
          })
        }
      }
    } else {
      setSelectedAgent(null)
    }
  }, [selectedAgentId, agents])

  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent)
    if (map.current && agent.location) {
      map.current.flyTo({
        center: [agent.location.lng, agent.location.lat],
        zoom: 15,
        duration: CAMERA_CONFIG.duration,
        easing: CAMERA_CONFIG.easing,
      })
    }
    onSelectAgent?.(agent)
  }

  const handleCenterOnUser = useCallback(() => {
    if (!map.current || !userLocation) return
    map.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: CAMERA_CONFIG.defaultZoom,
      duration: CAMERA_CONFIG.duration,
      easing: CAMERA_CONFIG.easing,
    })
  }, [userLocation])

  // Error state - no Mapbox token
  if (mapError || !mapboxToken) {
    return (
      <Card>
        <CardContent className="py-6 px-4">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div className="text-red-500">
              <p className="font-semibold text-lg">Mapbox Configuration Required</p>
              <p className="text-sm text-muted-foreground mt-2">
                {mapError ||
                  "Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment."}
              </p>
            </div>
            <div className="text-left bg-muted p-4 rounded-lg text-sm max-w-md mx-auto">
              <p className="font-semibold mb-2">How to fix:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  Create an account at{" "}
                  <a
                    href="https://mapbox.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    mapbox.com
                  </a>
                </li>
                <li>Copy your access token from the dashboard</li>
                <li>
                  Add to .env.local:{" "}
                  <code className="bg-background px-1 rounded">
                    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx
                  </code>
                </li>
                <li>Restart your dev server</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state - only show if map token is missing (map loads with default location now)
  if (!mapboxToken) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Initializing map...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Note: We no longer block on location errors - map loads with default location

  return (
    <div className="w-full space-y-4">
      {/* Location Status */}
      {isGettingLocation && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/30 mb-4">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Getting your precise location...
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Location Error Warning */}
      {error && !isGettingLocation && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 mb-4">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Location Accuracy Warning */}
      {!isGettingLocation && hasRealLocation && locationAccuracy && locationAccuracy > 100 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 mb-4">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  Location Accuracy Warning
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  Your location accuracy is ±{Math.round(locationAccuracy)}m.
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>💡 Tip:</strong> For best accuracy, use a mobile phone
                  with GPS.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map Container */}
      <Card className="overflow-hidden rounded-2xl shadow-2xl border-2 border-border/50">
        <div style={{ height }} className="relative">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Floating Controls */}
          <div
            className="absolute top-4 right-4 flex flex-col gap-2"
            style={{ marginTop: "80px" }}
          >
            {userLocation && (
              <Button
                size="sm"
                variant="secondary"
                className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
                onClick={handleCenterOnUser}
                title="Center on your location"
              >
                <Target className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
              onClick={() => map.current?.zoomIn({ duration: 300 })}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
              onClick={() => map.current?.zoomOut({ duration: 300 })}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Map not loaded overlay */}
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Agent List Panel */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/50">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Agents ({agents.filter((a) => a.isAvailable === true).length}{" "}
              online, {agents.length} total)
            </h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto pb-4">
            {agents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No agents available nearby</p>
              </div>
            ) : (
              <div>
                {/* Available Agents */}
                {agents.filter((a) => a.isAvailable === true).length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-green-50 dark:bg-green-950/30 border-b">
                      <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">
                        Available - Online (
                        {agents.filter((a) => a.isAvailable === true).length})
                      </h4>
                    </div>
                    <div className="divide-y">
                      {agents
                        .filter((a) => a.isAvailable === true)
                        .map((agent) => {
                          const isSelected = selectedAgent?.id === agent.id
                          return (
                            <div
                              key={agent.id}
                              className={`p-4 cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-green-50 dark:bg-green-950 border-l-4 border-green-500"
                                  : "hover:bg-muted/50"
                              }`}
                              onClick={() => handleAgentClick(agent)}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
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
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold text-base truncate">
                                        {agent.name}
                                      </h4>
                                      {isSelected && (
                                        <Badge className="bg-green-500 text-white text-xs flex-shrink-0">
                                          Selected
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                        <span className="font-medium">
                                          {agent.rating.toFixed(1)}
                                        </span>
                                      </div>
                                      <span>•</span>
                                      <span>
                                        {agent.totalTransactions}{" "}
                                        {agent.totalTransactions === 1
                                          ? "transaction"
                                          : "transactions"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
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

                {/* Offline Agents */}
                {agents.filter((a) => a.isAvailable !== true).length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/30 border-b border-t">
                      <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        Offline (
                        {agents.filter((a) => a.isAvailable !== true).length})
                      </h4>
                    </div>
                    <div className="divide-y">
                      {agents
                        .filter((a) => a.isAvailable !== true)
                        .map((agent) => {
                          const isSelected = selectedAgent?.id === agent.id
                          return (
                            <div
                              key={agent.id}
                              className={`p-4 cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-green-50 dark:bg-green-950 border-l-4 border-green-500"
                                  : "opacity-60 bg-muted/30"
                              }`}
                              onClick={() => handleAgentClick(agent)}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                                    <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
                                      {agent.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <h4 className="font-semibold text-base truncate">
                                        {agent.name}
                                      </h4>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs flex-shrink-0"
                                      >
                                        Offline
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                        <span className="font-medium">
                                          {agent.rating.toFixed(1)}
                                        </span>
                                      </div>
                                      <span>•</span>
                                      <span>
                                        {agent.totalTransactions}{" "}
                                        {agent.totalTransactions === 1
                                          ? "transaction"
                                          : "transactions"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <Badge
                                    variant="outline"
                                    className="font-semibold whitespace-nowrap bg-gray-100 dark:bg-gray-800 border-gray-300 text-gray-600 dark:text-gray-400"
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

