"use client"

/**
 * 🗺️ BOLT-STYLE MAPBOX MAP COMPONENT
 * 
 * A premium, ride-hailing style map using Mapbox GL JS.
 * Designed to feel as smooth and polished as Bolt or Uber.
 * 
 * KEY FEATURES:
 * ✅ Vector tiles - sharp at all zoom levels, no pixel blur
 * ✅ Custom minimal styling - reduced visual clutter
 * ✅ Smooth camera animations with easing functions
 * ✅ Custom SVG markers - no pixelation or lag
 * ✅ Route rendering above roads/buildings
 * ✅ GPU-accelerated, 60fps smooth pan/zoom
 * ✅ Performance optimized - minimal re-renders
 * 
 * WHY MAPBOX?
 * - Vector-based (not image tiles) = smooth zooming
 * - Full control over styling = clean, premium look
 * - Better animation APIs = buttery smooth transitions
 * - Lower latency = faster map loads
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
  Phone,
  Clock,
  Shield,
  Target,
  Layers,
  Volume2,
  VolumeX,
  Route,
  Car,
  Award,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Agent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  distance?: number
  distanceFormatted?: string
  isAvailable?: boolean
  totalReviews?: number
  verifiedAgent?: boolean
  premiumAgent?: boolean
}

interface BoltMapboxMapProps {
  userLocation: { lat: number; lng: number } | null
  agents?: Agent[]
  selectedAgent?: Agent | null
  onSelectAgent?: (agent: Agent) => void
  agentLocation?: { lat: number; lng: number } | null
  showRoute?: boolean
  etaSeconds?: number | null
  etaFormatted?: string | null
  requestStatus?: string
  height?: string
  className?: string
}

// ============================================================================
// BOLT-STYLE MAP CONFIGURATION
// ============================================================================

/**
 * 🎨 MINIMAL COLOR PALETTE
 * 
 * Bolt uses a very limited color palette to reduce cognitive load.
 * This makes the map feel cleaner and the route/markers pop.
 * 
 * Colors:
 * - Background: Light grey (#f8fafc)
 * - Roads: White with subtle grey borders
 * - Water: Soft blue (#dbeafe)
 * - Parks: Muted green (#dcfce7)
 * - Labels: Dark grey (#374151) - readable but not distracting
 * - Route: Soft blue (#3b82f6)
 */
const BOLT_MAP_STYLE: mapboxgl.Style = {
  version: 8,
  name: "Bolt Style",
  // Using Mapbox's vector tile sources
  sources: {
    // We'll use Mapbox's default sources which come with the style
  },
  // Sprite and glyphs for icons and text
  sprite: "mapbox://sprites/mapbox/streets-v12",
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  layers: [
    // Background - clean light grey
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f8fafc", // Tailwind slate-50
      },
    },
  ],
}

/**
 * 🎯 CAMERA ANIMATION CONFIG
 * 
 * Smooth camera transitions are crucial for that premium feel.
 * We use ease-out-cubic for natural deceleration.
 */
const CAMERA_CONFIG = {
  // Animation duration in ms - longer = smoother but slower
  duration: 1500,
  // Easing function - ease-out-cubic feels most natural
  easing: (t: number) => 1 - Math.pow(1 - t, 3),
  // Default zoom level - 15 is street-level detail
  defaultZoom: 15,
  // Min/max zoom to prevent over-zooming
  minZoom: 10,
  maxZoom: 18,
  // Pitch for 3D perspective (0 = flat, 60 = tilted)
  pitch: 0,
  // Bearing (rotation) - 0 = north up
  bearing: 0,
}

/**
 * 🚗 MARKER ANIMATION CONFIG
 */
const MARKER_ANIMATION = {
  // Duration for marker position updates
  duration: 1200,
  // Minimum distance (meters) to trigger animation
  minDistance: 2,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two coordinates in meters
 * Using Haversine formula for accuracy
 */
function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // Earth's radius in meters
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

/**
 * Calculate bearing between two points (for vehicle rotation)
 */
function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * Linear interpolation for smooth animations
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/**
 * Interpolate angle (handles 360° wrap-around)
 */
function lerpAngle(start: number, end: number, t: number): number {
  let diff = end - start
  while (diff < -180) diff += 360
  while (diff > 180) diff -= 360
  return start + diff * t
}

/**
 * Format ETA for display
 */
function formatETADisplay(seconds: number | null): string {
  if (seconds === null) return "--"
  if (seconds < 60) return "< 1 min"
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return `${hours}h ${remainingMins}m`
}

/**
 * Format distance for display
 */
function formatDistanceDisplay(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

// ============================================================================
// SVG MARKER CREATORS
// ============================================================================

/**
 * 📍 USER LOCATION MARKER - CLEAN MAP PIN
 * 
 * Simple, clean map pin marker for client/user location.
 * Blue color to distinguish from agent.
 */
function createUserMarkerElement(): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "bolt-user-marker"
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
      <defs>
        <!-- Pin shadow -->
        <filter id="pinShadow" x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
        <!-- Pin gradient -->
        <linearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#1d4ed8"/>
        </linearGradient>
        <!-- Pulse animation -->
        <radialGradient id="pinPulse" cx="50%" cy="100%" r="80%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.4">
            <animate attributeName="stop-opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0"/>
        </radialGradient>
      </defs>
      
      <!-- Pulse ring at bottom -->
      <ellipse cx="20" cy="50" rx="12" ry="4" fill="url(#pinPulse)">
        <animate attributeName="rx" values="10;16;10" dur="1.5s" repeatCount="indefinite"/>
      </ellipse>
      
      <!-- Ground shadow -->
      <ellipse cx="20" cy="50" rx="6" ry="2" fill="#000000" opacity="0.2"/>
      
      <!-- Map pin shape -->
      <g filter="url(#pinShadow)">
        <path d="M20 0 C9 0 0 9 0 20 C0 32 20 48 20 48 C20 48 40 32 40 20 C40 9 31 0 20 0 Z" 
              fill="url(#pinGrad)" stroke="#ffffff" stroke-width="2"/>
        <!-- Inner circle -->
        <circle cx="20" cy="18" r="8" fill="#ffffff"/>
        <!-- Center dot -->
        <circle cx="20" cy="18" r="4" fill="#3b82f6"/>
      </g>
    </svg>
  `
  el.style.cssText = "width: 80px; height: 100px; cursor: pointer;"
  return el
}

/**
 * 📍 AGENT MARKER (Pin style)
 * 
 * Premium pin marker with gradient and shadow.
 * Different colors for selected/available/offline states.
 */
function createAgentMarkerElement(
  agent: Agent,
  isSelected: boolean
): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "bolt-agent-marker"
  
  // Color scheme based on state
  const primaryColor = isSelected
    ? "#10b981" // Green for selected
    : agent.isAvailable !== false
    ? "#6366f1" // Indigo for available
    : "#6b7280" // Grey for offline
  
  const secondaryColor = isSelected
    ? "#059669"
    : agent.isAvailable !== false
    ? "#4f46e5"
    : "#4b5563"

  const selectedPulse = isSelected
    ? `
    <radialGradient id="selectedPulse_${agent.id}" cx="50%" cy="40%" r="50%">
      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.5">
        <animate attributeName="stop-opacity" values="0.5;0.15;0.5" dur="1.5s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0"/>
    </radialGradient>
  `
    : ""

  const selectedPulseCircle = isSelected
    ? `
    <circle cx="36" cy="36" r="32" fill="url(#selectedPulse_${agent.id})">
      <animate attributeName="r" values="28;38;28" dur="1.5s" repeatCount="indefinite"/>
    </circle>
  `
    : ""

  const verifiedBadge =
    isSelected || agent.verifiedAgent
      ? `
    <circle cx="54" cy="16" r="10" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
    <path d="M50 16 L53 19 L58 12" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `
      : agent.premiumAgent
      ? `
    <circle cx="54" cy="16" r="10" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
    <text x="54" y="20" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">★</text>
  `
      : ""

  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="88" viewBox="0 0 72 88">
      <defs>
        <!-- Shadow for depth -->
        <filter id="pinShadow_${agent.id}" x="-50%" y="-30%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="${secondaryColor}" flood-opacity="0.4"/>
        </filter>
        <!-- Gradient for pin body -->
        <linearGradient id="pinGrad_${agent.id}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor}"/>
          <stop offset="50%" style="stop-color:${primaryColor}"/>
          <stop offset="100%" style="stop-color:${secondaryColor}"/>
        </linearGradient>
        ${selectedPulse}
      </defs>
      ${selectedPulseCircle}
      <!-- Pin with shadow -->
      <g filter="url(#pinShadow_${agent.id})">
        <!-- Pin shape -->
        <path d="M36 8 C22 8, 12 20, 12 32 C12 48, 36 80, 36 80 C36 80, 60 48, 60 32 C60 20, 50 8, 36 8 Z" 
              fill="url(#pinGrad_${agent.id})" stroke="#ffffff" stroke-width="3"/>
        <!-- Avatar circle -->
        <circle cx="36" cy="30" r="16" fill="#ffffff"/>
        <!-- Agent icon (head) -->
        <circle cx="36" cy="26" r="7" fill="${primaryColor}"/>
        <!-- Agent icon (body) -->
        <path d="M26 40 Q36 32, 46 40" fill="${primaryColor}"/>
      </g>
      <!-- Verification/Premium badge -->
      ${verifiedBadge}
    </svg>
  `
  el.style.cssText = "width: 72px; height: 88px; cursor: pointer; transform: translate(-50%, -100%);"
  return el
}

/**
 * 🚗 SMALL CAR MARKER (For agent tracking)
 * 
 * Compact top-down car icon that fits well on the map.
 * Clean, simple design with smooth animations.
 */
function createCarMarkerElement(heading: number = 0): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "bolt-car-marker"
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48" style="transform: rotate(${heading}deg)">
      <defs>
        <!-- Car shadow -->
        <filter id="carShadowSmall" x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.25"/>
        </filter>
        <!-- Car body gradient - Green like Bolt -->
        <linearGradient id="carBodySmall" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#22c55e"/>
          <stop offset="100%" style="stop-color:#16a34a"/>
        </linearGradient>
      </defs>
      
      <!-- Main car body -->
      <g filter="url(#carShadowSmall)">
        <!-- Car body - simple rounded rectangle -->
        <rect x="6" y="8" width="20" height="32" rx="6" ry="6" 
              fill="url(#carBodySmall)" stroke="#ffffff" stroke-width="2"/>
        
        <!-- Windshield (front) -->
        <rect x="9" y="12" width="14" height="6" rx="2" fill="#1e293b" opacity="0.8"/>
        
        <!-- Rear window -->
        <rect x="9" y="28" width="14" height="5" rx="2" fill="#1e293b" opacity="0.8"/>
        
        <!-- Headlights -->
        <circle cx="10" cy="10" r="2" fill="#fef08a"/>
        <circle cx="22" cy="10" r="2" fill="#fef08a"/>
        
        <!-- Taillights -->
        <circle cx="10" cy="38" r="1.5" fill="#ef4444"/>
        <circle cx="22" cy="38" r="1.5" fill="#ef4444"/>
      </g>
    </svg>
  `
  el.style.cssText = "width: 32px; height: 48px; cursor: pointer; transition: transform 0.3s ease-out;"
  return el
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BoltMapboxMap({
  userLocation,
  agents = [],
  selectedAgent = null,
  onSelectAgent,
  agentLocation = null,
  showRoute = false,
  etaSeconds = null,
  etaFormatted = null,
  requestStatus = "pending",
  height = "600px",
  className = "",
}: BoltMapboxMapProps) {
  // Map state
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  
  // Marker refs
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const agentMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const carMarkerRef = useRef<mapboxgl.Marker | null>(null)
  
  // Animation state
  const animationFrameRef = useRef<number | null>(null)
  const previousAgentLocation = useRef<{ lat: number; lng: number } | null>(null)
  const [displayHeading, setDisplayHeading] = useState(0)
  const [smoothedCarPos, setSmoothedCarPos] = useState<{ lat: number; lng: number } | null>(null)
  
  // UI state
  const [showTrafficLayer, setShowTrafficLayer] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [animatedETA, setAnimatedETA] = useState<number | null>(null)
  const [mapStyle, setMapStyle] = useState<"light" | "satellite">("light")
  
  // Voice refs
  const lastSpokenETA = useRef<number | null>(null)
  
  // Get Mapbox token from environment
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

  // ============================================================================
  // MAP INITIALIZATION
  // ============================================================================
  
  useEffect(() => {
    if (!mapContainer.current || map.current) return
    if (!mapboxToken) {
      setMapError("Mapbox access token is missing. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment.")
      return
    }

    try {
      mapboxgl.accessToken = mapboxToken

      const initialCenter = userLocation 
        ? [userLocation.lng, userLocation.lat] as [number, number]
        : [36.8219, -1.2921] as [number, number] // Default: Nairobi

      /**
       * 🗺️ MAP INITIALIZATION
       * 
       * Key settings for that premium feel:
       * - style: Using custom light style with minimal labels
       * - antialias: true - smoother edges on lines
       * - fadeDuration: 0 - instant tile transitions (no flicker)
       * - preserveDrawingBuffer: true - enables screenshots
       */
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        // Mapbox streets style - shows buildings, roads, landmarks like Bolt
        style: "mapbox://styles/mapbox/streets-v12",
        center: initialCenter,
        zoom: CAMERA_CONFIG.defaultZoom,
        minZoom: CAMERA_CONFIG.minZoom,
        maxZoom: CAMERA_CONFIG.maxZoom,
        pitch: CAMERA_CONFIG.pitch,
        bearing: CAMERA_CONFIG.bearing,
        antialias: true, // Smoother edges
        fadeDuration: 0, // No tile fade = cleaner transitions
        attributionControl: false, // We'll add custom attribution
        preserveDrawingBuffer: true, // Enable canvas capture
      })

      // Custom attribution (smaller, less intrusive)
      map.current.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-left"
      )

      // Navigation controls (zoom in/out)
      map.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "top-right"
      )

      // Geolocate control (find user)
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
          showUserLocation: false, // We use custom marker
        }),
        "top-right"
      )

      map.current.on("load", () => {
        if (!map.current) return
        
        /**
         * 🎨 MINIMAL STYLE ADJUSTMENTS
         * 
         * Keep the streets-v12 style mostly intact for full visibility.
         * Only hide small shop/restaurant labels to reduce clutter.
         * Buildings, roads, landmarks all remain visible.
         */
        
        // Only reduce small POI labels slightly (shops, restaurants) - keep everything else
        if (map.current?.getLayer("poi-label")) {
          try {
            // Filter out only very small POIs, keep everything important
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
              [">=", ["get", "sizerank"], 14], // Show larger POIs
            ])
          } catch (e) {
            // Keep all POIs if filter fails
            console.log("POI filter not applied, keeping all POIs")
          }
        }

        // Add route source and layer (will be populated when route is needed)
        map.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [],
            },
          },
        })

        /**
         * 🛣️ ROUTE LAYER
         * 
         * The route line is styled to pop above everything else:
         * - Soft blue color (#3b82f6)
         * - Wide line width (6px)
         * - Slight blur for "glow" effect
         * - Rounded line caps and joins
         */
        map.current.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3b82f6", // Tailwind blue-500
            "line-width": 6,
            "line-opacity": 0.9,
            // Blur creates a subtle glow effect
            "line-blur": 1,
          },
        })

        // Route outline for better visibility
        map.current.addLayer(
          {
            id: "route-outline",
            type: "line",
            source: "route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#1e40af", // Tailwind blue-800
              "line-width": 8,
              "line-opacity": 0.3,
            },
          },
          "route-line" // Insert below the main line
        )

        setMapLoaded(true)
      })

      map.current.on("error", (e) => {
        console.error("Mapbox error:", e)
        setMapError("Failed to load map. Please check your connection.")
      })

      // Timeout fallback - if map doesn't load in 15 seconds, show error
      const loadTimeout = setTimeout(() => {
        if (!map.current?.loaded()) {
          console.error("Map load timeout")
          setMapError("Map is taking too long to load. Please refresh the page.")
          setMapLoaded(true) // Allow UI to show error state
        }
      }, 15000)

      // Clear timeout when map loads
      map.current.once("load", () => {
        clearTimeout(loadTimeout)
      })

    } catch (error) {
      console.error("Map initialization error:", error)
      setMapError("Failed to initialize map.")
    }

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [mapboxToken])

  // ============================================================================
  // USER LOCATION MARKER
  // ============================================================================

  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return

    // Remove existing marker if any
    if (userMarkerRef.current) {
      userMarkerRef.current.remove()
    }

    // Create and add user marker
    const el = createUserMarkerElement()
    userMarkerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: "center",
    })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current)

  }, [mapLoaded, userLocation])

  // ============================================================================
  // AGENT MARKERS
  // ============================================================================

  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Clear existing markers
    agentMarkersRef.current.forEach((marker) => marker.remove())
    agentMarkersRef.current.clear()

    // Add agent markers
    agents.forEach((agent) => {
      if (!agent.location || !map.current) return

      const isSelected = selectedAgent?.id === agent.id
      const el = createAgentMarkerElement(agent, isSelected)

      // Add click handler
      el.addEventListener("click", () => {
        onSelectAgent?.(agent)
        
        // Smooth fly to agent
        map.current?.flyTo({
          center: [agent.location.lng, agent.location.lat],
          zoom: 16,
          duration: CAMERA_CONFIG.duration,
          easing: CAMERA_CONFIG.easing,
        })
      })

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat([agent.location.lng, agent.location.lat])
        .addTo(map.current!)

      agentMarkersRef.current.set(agent.id, marker)
    })

  }, [mapLoaded, agents, selectedAgent, onSelectAgent])

  // ============================================================================
  // CAR MARKER (REAL-TIME TRACKING)
  // ============================================================================

  useEffect(() => {
    if (!map.current || !mapLoaded || !agentLocation || !showRoute) return

    const currentPos = smoothedCarPos || previousAgentLocation.current
    
    if (!currentPos) {
      // First position - just set it
      setSmoothedCarPos(agentLocation)
      previousAgentLocation.current = agentLocation
      return
    }

    const distance = getDistanceMeters(
      currentPos.lat,
      currentPos.lng,
      agentLocation.lat,
      agentLocation.lng
    )

    // Skip tiny movements
    if (distance < MARKER_ANIMATION.minDistance) {
      previousAgentLocation.current = agentLocation
      return
    }

    // Calculate new heading
    const newHeading = calculateBearing(
      currentPos.lat,
      currentPos.lng,
      agentLocation.lat,
      agentLocation.lng
    )

    // Animate position and heading
    const startTime = performance.now()
    const startPos = { ...currentPos }
    const startHeading = displayHeading

    const animate = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / MARKER_ANIMATION.duration, 1)
      const easedProgress = CAMERA_CONFIG.easing(progress)

      const newLat = lerp(startPos.lat, agentLocation.lat, easedProgress)
      const newLng = lerp(startPos.lng, agentLocation.lng, easedProgress)
      const interpolatedHeading = lerpAngle(startHeading, newHeading, easedProgress)

      setSmoothedCarPos({ lat: newLat, lng: newLng })
      setDisplayHeading(interpolatedHeading)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
    previousAgentLocation.current = agentLocation

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [agentLocation, showRoute, mapLoaded])

  // Update car marker position and rotation
  useEffect(() => {
    if (!map.current || !mapLoaded || !smoothedCarPos || !showRoute) return

    // Remove existing car marker
    if (carMarkerRef.current) {
      carMarkerRef.current.remove()
    }

    // Create new car marker with current heading
    const el = createCarMarkerElement(displayHeading)
    carMarkerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: "center",
      rotationAlignment: "map",
    })
      .setLngLat([smoothedCarPos.lng, smoothedCarPos.lat])
      .addTo(map.current)

  }, [smoothedCarPos, displayHeading, showRoute, mapLoaded])

  // ============================================================================
  // ROUTE RENDERING
  // ============================================================================

  useEffect(() => {
    if (!map.current || !mapLoaded || !showRoute || !userLocation || !smoothedCarPos) return

    /**
     * 🛣️ ROUTE FETCHING
     * 
     * We use Mapbox Directions API for accurate routing.
     * The route is rendered as GeoJSON above roads/buildings.
     */
    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${smoothedCarPos.lng},${smoothedCarPos.lat};${userLocation.lng},${userLocation.lat}?geometries=geojson&access_token=${mapboxToken}`
        )
        const data = await response.json()

        if (data.routes && data.routes[0]) {
          const route = data.routes[0].geometry

          // Update route source
          const source = map.current?.getSource("route") as mapboxgl.GeoJSONSource
          if (source) {
            source.setData({
              type: "Feature",
              properties: {},
              geometry: route,
            })
          }
        }
      } catch (error) {
        console.error("Failed to fetch route:", error)
      }
    }

    fetchRoute()
  }, [showRoute, userLocation, smoothedCarPos, mapLoaded, mapboxToken])

  // ============================================================================
  // CAMERA FOLLOW
  // ============================================================================

  useEffect(() => {
    if (!map.current || !mapLoaded || !showRoute || !smoothedCarPos) return

    /**
     * 📷 SMOOTH CAMERA FOLLOW
     * 
     * Only pan if the car has moved significantly.
     * This prevents constant jittery camera updates.
     */
    const center = map.current.getCenter()
    const distance = getDistanceMeters(
      center.lat,
      center.lng,
      smoothedCarPos.lat,
      smoothedCarPos.lng
    )

    // Only pan if moved more than 100 meters
    if (distance > 100) {
      map.current.easeTo({
        center: [smoothedCarPos.lng, smoothedCarPos.lat],
        duration: 1000,
        easing: CAMERA_CONFIG.easing,
      })
    }
  }, [smoothedCarPos, showRoute, mapLoaded])

  // ============================================================================
  // ETA ANIMATION & VOICE
  // ============================================================================

  useEffect(() => {
    if (etaSeconds === null) {
      setAnimatedETA(null)
      return
    }

    // Countdown animation
    const interval = setInterval(() => {
      setAnimatedETA((prev) => {
        if (prev === null) return etaSeconds
        if (prev <= 0) return 0
        return prev - 1
      })
    }, 1000)

    setAnimatedETA(etaSeconds)

    // Voice announcement
    if (voiceEnabled && typeof window !== "undefined" && window.speechSynthesis) {
      if (!lastSpokenETA.current || Math.abs(lastSpokenETA.current - etaSeconds) >= 30) {
        lastSpokenETA.current = etaSeconds
        const minutes = Math.round(etaSeconds / 60)
        const text = minutes <= 1
          ? "Your agent is arriving now"
          : minutes < 5
          ? `Your agent will arrive in ${minutes} minutes`
          : `Estimated arrival in ${minutes} minutes`
        
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 1.0
        utterance.pitch = 1.0
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
      }
    }

    return () => clearInterval(interval)
  }, [etaSeconds, voiceEnabled])

  // ============================================================================
  // MAP CONTROLS
  // ============================================================================

  const handleCenterOnUser = useCallback(() => {
    if (!map.current || !userLocation) return
    
    map.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: CAMERA_CONFIG.defaultZoom,
      duration: CAMERA_CONFIG.duration,
      easing: CAMERA_CONFIG.easing,
    })
  }, [userLocation])

  const handleToggleStyle = useCallback(() => {
    if (!map.current) return
    
    const newStyle = mapStyle === "light" ? "satellite" : "light"
    setMapStyle(newStyle)
    
    map.current.setStyle(
      newStyle === "light"
        ? "mapbox://styles/mapbox/streets-v12"
        : "mapbox://styles/mapbox/satellite-streets-v12"
    )
  }, [mapStyle])

  const handleZoomIn = useCallback(() => {
    map.current?.zoomIn({ duration: 300 })
  }, [])

  const handleZoomOut = useCallback(() => {
    map.current?.zoomOut({ duration: 300 })
  }, [])

  // ============================================================================
  // RENDER
  // ============================================================================

  // Error state
  if (mapError || !mapboxToken) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="text-red-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-semibold text-lg">Map Configuration Required</p>
              <p className="text-sm text-muted-foreground mt-2">
                {mapError || "Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment variables."}
              </p>
            </div>
            <div className="text-left bg-muted p-4 rounded-lg text-sm max-w-md mx-auto">
              <p className="font-semibold mb-2">How to fix:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Go to <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">mapbox.com</a> and create an account</li>
                <li>Copy your access token from the dashboard</li>
                <li>Add to .env.local: <code className="bg-background px-1 rounded">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx</code></li>
                <li>Restart your dev server</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state - show map container with overlay so map can initialize in background
  // This is less blocking than returning early

  return (
    <div className={`relative w-full ${className}`}>
      {/* Map Container */}
      <div
        ref={mapContainer}
        className="w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-border/50"
        style={{ height }}
      />

      {/* Loading Overlay */}
      {!mapLoaded && !mapError && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl z-50"
          style={{ height }}
        >
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary/20 animate-ping" />
          </div>
          <p className="text-muted-foreground mt-4 font-medium">Loading map...</p>
          <p className="text-xs text-muted-foreground mt-1">Please wait, this may take a moment</p>
        </div>
      )}

      {/* Floating Controls - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2" style={{ marginTop: "80px" }}>
        {/* Map Style Toggle */}
        <Button
          size="sm"
          variant="secondary"
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={handleToggleStyle}
          title={mapStyle === "light" ? "Switch to satellite" : "Switch to light"}
        >
          <Layers className="h-4 w-4" />
        </Button>

        {/* Voice Toggle */}
        <Button
          size="sm"
          variant={voiceEnabled ? "default" : "secondary"}
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          title={voiceEnabled ? "Disable voice" : "Enable voice"}
        >
          {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>

        {/* Center on User */}
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

        {/* Zoom Controls */}
        <Button
          size="sm"
          variant="secondary"
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* ETA Card - Bottom Center */}
      {selectedAgent && showRoute && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:min-w-[320px]">
          <Card className="shadow-2xl border-2 border-primary/20 backdrop-blur-sm bg-background/95">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Agent Avatar */}
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {selectedAgent.name.charAt(0)}
                  </div>
                  {requestStatus === "matched" && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                      <Car className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base sm:text-lg truncate">{selectedAgent.name}</p>
                    {selectedAgent.verifiedAgent && (
                      <Shield className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span className="text-sm font-medium">{selectedAgent.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{selectedAgent.totalTransactions} trips</span>
                  </div>
                </div>

                {/* ETA */}
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-2xl sm:text-3xl font-bold text-primary">
                      {formatETADisplay(animatedETA)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {requestStatus === "matched" ? "Agent arriving" : "Estimated"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.open(`tel:${selectedAgent.phone}`, "_self")}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call Agent
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  onClick={() => {
                    if (smoothedCarPos) {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${smoothedCarPos.lat},${smoothedCarPos.lng}`
                      window.open(url, "_blank")
                    }
                  }}
                >
                  <Navigation2 className="h-4 w-4 mr-2" />
                  Track Live
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent List - Bottom (when no agent selected) */}
      {!selectedAgent && agents.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 max-h-[45vh] overflow-hidden">
          <Card className="shadow-2xl border-2 border-border/50 backdrop-blur-sm bg-background/95">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm sm:text-base">Nearby Agents</h3>
                <Badge variant="secondary" className="text-xs">
                  {agents.filter(a => a.isAvailable !== false).length} available
                </Badge>
              </div>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                {agents.slice(0, 5).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onSelectAgent?.(agent)
                      if (map.current && agent.location) {
                        map.current.flyTo({
                          center: [agent.location.lng, agent.location.lat],
                          zoom: 16,
                          duration: CAMERA_CONFIG.duration,
                          easing: CAMERA_CONFIG.easing,
                        })
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-200 active:scale-[0.98]"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {agent.name.charAt(0)}
                      </div>
                      {agent.premiumAgent && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                          <Award className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{agent.name}</span>
                        {agent.verifiedAgent && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="h-3 w-3 fill-current" />
                          <span className="text-xs font-medium">{agent.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{agent.totalTransactions} trips</span>
                      </div>
                    </div>

                    {/* Distance */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-primary">
                        {agent.distanceFormatted || (agent.distance ? formatDistanceDisplay(agent.distance * 1000) : "--")}
                      </p>
                      <p className="text-xs text-muted-foreground">away</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

