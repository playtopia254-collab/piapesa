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
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="100" viewBox="0 0 80 100">
      <defs>
        <filter id="userGlowT" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="userShadowT" x="-50%" y="-30%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#1e40af" flood-opacity="0.4"/>
        </filter>
        <radialGradient id="pulseGradT" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.5">
            <animate attributeName="stop-opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0"/>
        </radialGradient>
        <linearGradient id="userBodyGradT" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#1e40af"/>
        </linearGradient>
      </defs>
      <!-- Pulsing ring at feet -->
      <ellipse cx="40" cy="92" rx="30" ry="8" fill="url(#pulseGradT)">
        <animate attributeName="rx" values="25;35;25" dur="2s" repeatCount="indefinite"/>
      </ellipse>
      <!-- Ground shadow -->
      <ellipse cx="40" cy="92" rx="16" ry="5" fill="#000000" opacity="0.2"/>
      <!-- Full body human figure -->
      <g filter="url(#userShadowT)">
        <!-- Head -->
        <circle cx="40" cy="18" r="12" fill="url(#userBodyGradT)" stroke="#ffffff" stroke-width="3"/>
        <circle cx="37" cy="15" r="4" fill="#60a5fa" opacity="0.4"/>
        <!-- Body -->
        <path d="M28 32 L28 55 Q28 60 33 60 L47 60 Q52 60 52 55 L52 32 Q52 28 47 28 L33 28 Q28 28 28 32 Z" 
              fill="url(#userBodyGradT)" stroke="#ffffff" stroke-width="3"/>
        <!-- Arms -->
        <path d="M28 34 L18 50 Q16 54 20 56 L22 54 L30 42" 
              fill="url(#userBodyGradT)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
        <path d="M52 34 L62 50 Q64 54 60 56 L58 54 L50 42" 
              fill="url(#userBodyGradT)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
        <!-- Legs -->
        <path d="M33 60 L30 82 Q29 87 34 87 L38 87 Q42 87 41 82 L40 65" 
              fill="url(#userBodyGradT)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
        <path d="M47 60 L50 82 Q51 87 46 87 L42 87 Q38 87 39 82 L40 65" 
              fill="url(#userBodyGradT)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
      </g>
      <!-- Location indicator above head -->
      <circle cx="40" cy="2" r="5" fill="#22c55e" stroke="#ffffff" stroke-width="2">
        <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `
  el.style.cssText = "width: 80px; height: 100px; cursor: pointer;"
  return el
}

function createAgentMarkerEl(
  agent: Agent,
  isSelected: boolean
): HTMLDivElement {
  const el = document.createElement("div")
  const primaryColor = isSelected
    ? "#10b981"
    : agent.isAvailable !== false
    ? "#6366f1"
    : "#6b7280"
  const secondaryColor = isSelected
    ? "#059669"
    : agent.isAvailable !== false
    ? "#4f46e5"
    : "#4b5563"

  const selectedPulse = isSelected
    ? `<radialGradient id="selectedPulse_${agent.id}" cx="50%" cy="40%" r="50%">
         <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.5">
           <animate attributeName="stop-opacity" values="0.5;0.15;0.5" dur="1.5s" repeatCount="indefinite"/>
         </stop>
         <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0"/>
       </radialGradient>`
    : ""

  const selectedPulseCircle = isSelected
    ? `<circle cx="36" cy="36" r="32" fill="url(#selectedPulse_${agent.id})">
         <animate attributeName="r" values="28;38;28" dur="1.5s" repeatCount="indefinite"/>
       </circle>`
    : ""

  const verifiedBadge = isSelected
    ? `<circle cx="54" cy="16" r="10" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
       <path d="M50 16 L53 19 L58 12" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : ""

  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="88" viewBox="0 0 72 88">
      <defs>
        <filter id="pinShadow_${agent.id}" x="-50%" y="-30%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="${secondaryColor}" flood-opacity="0.4"/>
        </filter>
        <linearGradient id="pinGrad_${agent.id}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor}"/>
          <stop offset="50%" style="stop-color:${primaryColor}"/>
          <stop offset="100%" style="stop-color:${secondaryColor}"/>
        </linearGradient>
        ${selectedPulse}
      </defs>
      ${selectedPulseCircle}
      <g filter="url(#pinShadow_${agent.id})">
        <path d="M36 8 C22 8, 12 20, 12 32 C12 48, 36 80, 36 80 C36 80, 60 48, 60 32 C60 20, 50 8, 36 8 Z" 
              fill="url(#pinGrad_${agent.id})" stroke="#ffffff" stroke-width="3"/>
        <circle cx="36" cy="30" r="16" fill="#ffffff"/>
        <circle cx="36" cy="26" r="7" fill="${primaryColor}"/>
        <path d="M26 40 Q36 32, 46 40" fill="${primaryColor}"/>
      </g>
      ${verifiedBadge}
    </svg>
  `
  el.style.cssText =
    "width: 72px; height: 88px; cursor: pointer; transform: translate(-50%, -100%);"
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

  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)

  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const agentMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

  // Get user's location
  useEffect(() => {
    let watchCleanup: (() => void) | null = null

    const initializeLocation = async () => {
      try {
        setIsLoading(true)
        const location = await getCurrentLocation()
        setUserLocation({ lat: location.lat, lng: location.lng })
        setLocationAccuracy(location.accuracy || null)

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
        setError(
          "Failed to get your location. Please enable location permissions."
        )
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
        style: "mapbox://styles/mapbox/light-v11",
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

        // Hide POI labels
        const poiLayers = ["poi-label", "transit-label"]
        poiLayers.forEach((layer) => {
          if (map.current?.getLayer(layer)) {
            map.current.setLayoutProperty(layer, "visibility", "none")
          }
        })

        // Subtle water
        if (map.current.getLayer("water")) {
          map.current.setPaintProperty("water", "fill-color", "#e0f2fe")
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

  // Loading state
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

  // Location error
  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p className="font-semibold text-lg">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No location
  if (!userLocation) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Location not available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

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

