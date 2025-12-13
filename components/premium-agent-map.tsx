"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  DirectionsRenderer, 
  Circle,
  TrafficLayer,
  OverlayView,
  InfoWindow,
} from "@react-google-maps/api"
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
  Zap,
  Shield,
  CheckCircle2,
  Route,
  Volume2,
  VolumeX,
  Layers,
  Target,
  Car,
  User,
  TrendingUp,
  Award,
} from "lucide-react"
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
  isAvailable?: boolean
  totalReviews?: number
  verifiedAgent?: boolean
  premiumAgent?: boolean
}

interface PremiumAgentMapProps {
  userLocation: { lat: number; lng: number } | null
  agents: Agent[]
  selectedAgent: Agent | null
  onSelectAgent: (agent: Agent) => void
  agentLocation?: { lat: number; lng: number } | null
  showRoute?: boolean
  showTraffic?: boolean
  etaSeconds?: number | null
  etaFormatted?: string | null
  requestStatus?: string
}

// Premium map libraries - must match all other components using useJsApiLoader
const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places", "geometry", "drawing"]

// Premium dark mode map style (Netflix-inspired)
const premiumDarkStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0f0f23" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f0f23" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b8b9e" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d4d4e8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a35" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#262645" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7a7a95" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2d2d55" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#3d3d70" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0b0c5" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#080820" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a4a6a" }] },
]

// Premium light mode map style (Apple Maps inspired)
const premiumLightStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#1e293b" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dcfce7" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#fef3c7" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#fcd34d" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
]

const defaultCenter = { lat: -1.2921, lng: 36.8219 }

export function PremiumAgentMap({
  userLocation,
  agents,
  selectedAgent,
  onSelectAgent,
  agentLocation = null,
  showRoute = false,
  showTraffic = false,
  etaSeconds = null,
  etaFormatted = null,
  requestStatus = "pending",
}: PremiumAgentMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showTrafficLayer, setShowTrafficLayer] = useState(showTraffic)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [showInfoWindow, setShowInfoWindow] = useState<string | null>(null)
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid">("roadmap")
  
  // Smooth animation state
  const [smoothedAgentPos, setSmoothedAgentPos] = useState<{ lat: number; lng: number } | null>(null)
  const [displayHeading, setDisplayHeading] = useState<number>(0)
  const [animatedETA, setAnimatedETA] = useState<number | null>(null)
  const positionSmootherRef = useRef<PositionSmoother | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const animationStartRef = useRef<number>(0)
  const animationFromRef = useRef<{ lat: number; lng: number; heading: number }>({ lat: 0, lng: 0, heading: 0 })
  const animationToRef = useRef<{ lat: number; lng: number; heading: number }>({ lat: 0, lng: 0, heading: 0 })
  const isAnimatingRef = useRef<boolean>(false)
  const previousAgentLocation = useRef<{ lat: number; lng: number } | null>(null)
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const lastSpokenETA = useRef<number | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  // Initialize smoother
  if (!positionSmootherRef.current) {
    positionSmootherRef.current = new PositionSmoother(0.35)
  }

  // Detect system dark mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)")
      setIsDarkMode(darkModeQuery.matches)
      
      const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches)
      darkModeQuery.addEventListener("change", handler)
      return () => darkModeQuery.removeEventListener("change", handler)
    }
  }, [])

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  })

  // Voice navigation announcements
  const speakETA = useCallback((seconds: number) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return
    
    // Only speak if ETA changed significantly (>30 seconds)
    if (lastSpokenETA.current && Math.abs(lastSpokenETA.current - seconds) < 30) return
    
    lastSpokenETA.current = seconds
    
    const minutes = Math.round(seconds / 60)
    let text = ""
    
    if (minutes <= 1) {
      text = "Your agent is arriving now"
    } else if (minutes < 5) {
      text = `Your agent will arrive in ${minutes} minutes`
    } else {
      text = `Estimated arrival in ${minutes} minutes`
    }
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 0.8
    speechSynthRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [voiceEnabled])

  // Smooth ETA counter animation
  useEffect(() => {
    if (etaSeconds === null) {
      setAnimatedETA(null)
      return
    }
    
    // Animate ETA countdown smoothly
    const interval = setInterval(() => {
      setAnimatedETA(prev => {
        if (prev === null) return etaSeconds
        if (prev <= 0) return 0
        return prev - 1
      })
    }, 1000)
    
    // Sync with actual ETA every 10 seconds
    setAnimatedETA(etaSeconds)
    
    // Voice announcement
    speakETA(etaSeconds)
    
    return () => clearInterval(interval)
  }, [etaSeconds, speakETA])

  // Smooth marker animation
  const animateMarker = useCallback(() => {
    if (!isAnimatingRef.current) return
    
    const now = performance.now()
    const elapsed = now - animationStartRef.current
    const duration = 1200 // Longer, smoother animation
    const progress = Math.min(elapsed / duration, 1)
    const easedProgress = easeOutCubic(progress)
    
    const currentLat = lerp(animationFromRef.current.lat, animationToRef.current.lat, easedProgress)
    const currentLng = lerp(animationFromRef.current.lng, animationToRef.current.lng, easedProgress)
    const currentHeading = lerpAngle(animationFromRef.current.heading, animationToRef.current.heading, easedProgress)
    
    setSmoothedAgentPos({ lat: currentLat, lng: currentLng })
    setDisplayHeading(currentHeading)
    
    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animateMarker)
    } else {
      isAnimatingRef.current = false
      setSmoothedAgentPos({ lat: animationToRef.current.lat, lng: animationToRef.current.lng })
      setDisplayHeading(animationToRef.current.heading)
    }
  }, [])

  // Handle agent location updates with ultra-smooth animation
  useEffect(() => {
    if (!agentLocation) return
    
    const smoother = positionSmootherRef.current
    if (!smoother) return
    
    const smoothed = smoother.update(agentLocation.lat, agentLocation.lng)
    const currentPos = smoothedAgentPos || previousAgentLocation.current
    
    if (!currentPos) {
      setSmoothedAgentPos(smoothed)
      previousAgentLocation.current = smoothed
      return
    }
    
    const distance = getDistanceMeters(currentPos.lat, currentPos.lng, smoothed.lat, smoothed.lng)
    
    // Skip tiny movements
    if (distance < 1.5) {
      previousAgentLocation.current = agentLocation
      return
    }
    
    // Calculate heading
    let newHeading = displayHeading
    if (distance > 2) {
      newHeading = calculateBearing(currentPos.lat, currentPos.lng, smoothed.lat, smoothed.lng)
    }
    
    // Cancel existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // Setup animation
    animationFromRef.current = { lat: currentPos.lat, lng: currentPos.lng, heading: displayHeading }
    animationToRef.current = { lat: smoothed.lat, lng: smoothed.lng, heading: newHeading }
    animationStartRef.current = performance.now()
    isAnimatingRef.current = true
    
    animationFrameRef.current = requestAnimationFrame(animateMarker)
    previousAgentLocation.current = agentLocation
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [agentLocation, animateMarker, displayHeading, smoothedAgentPos])

  // Calculate route with Roads API snap-to-roads
  useEffect(() => {
    if (!showRoute || !directionsService || !userLocation || !smoothedAgentPos || !selectedAgent) return
    
    directionsService.route(
      {
        origin: new google.maps.LatLng(smoothedAgentPos.lat, smoothedAgentPos.lng),
        destination: new google.maps.LatLng(userLocation.lat, userLocation.lng),
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
        optimizeWaypoints: true,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result)
        }
      }
    )
  }, [showRoute, directionsService, userLocation, smoothedAgentPos, selectedAgent])

  // Smooth camera follow
  useEffect(() => {
    if (!map || !isMapReady || !smoothedAgentPos || !showRoute) return
    
    const center = map.getCenter()
    if (!center) return
    
    const currentLat = center.lat()
    const currentLng = center.lng()
    const distance = getDistanceMeters(currentLat, currentLng, smoothedAgentPos.lat, smoothedAgentPos.lng)
    
    // Only pan if moved significantly
    if (distance > 50) {
      map.panTo({ lat: smoothedAgentPos.lat, lng: smoothedAgentPos.lng })
    }
  }, [map, isMapReady, smoothedAgentPos, showRoute])

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
    setDirectionsService(new google.maps.DirectionsService())
    setIsMapReady(true)
  }, [])

  const onMapUnmount = useCallback(() => {
    setMap(null)
    setIsMapReady(false)
  }, [])

  // Premium User Marker (pulsing blue dot with accuracy ring)
  const createPremiumUserMarker = (): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <radialGradient id="pulseGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.6">
                <animate attributeName="stop-opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0">
                <animate attributeName="stop-opacity" values="0;0.1;0" dur="2s" repeatCount="indefinite"/>
              </stop>
            </radialGradient>
          </defs>
          <!-- Pulsing outer ring -->
          <circle cx="40" cy="40" r="35" fill="url(#pulseGrad)">
            <animate attributeName="r" values="25;35;25" dur="2s" repeatCount="indefinite"/>
          </circle>
          <!-- Accuracy ring -->
          <circle cx="40" cy="40" r="20" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.3"/>
          <!-- Main dot with glow -->
          <g filter="url(#glow)">
            <circle cx="40" cy="40" r="12" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>
            <!-- Inner highlight -->
            <circle cx="37" cy="37" r="4" fill="#60a5fa" opacity="0.6"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(80, 80),
      anchor: new google.maps.Point(40, 40),
    }
  }

  // Premium Agent Marker with verification badge
  const createPremiumAgentMarker = (agent: Agent, isSelected: boolean): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    
    const baseColor = isSelected ? "#10b981" : agent.premiumAgent ? "#f59e0b" : "#6366f1"
    const glowColor = isSelected ? "#059669" : agent.premiumAgent ? "#d97706" : "#4f46e5"
    const badgeIcon = agent.verifiedAgent 
      ? `<circle cx="52" cy="16" r="10" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
         <path d="M48 16 L51 19 L56 13" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round"/>`
      : agent.premiumAgent 
      ? `<circle cx="52" cy="16" r="10" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
         <text x="52" y="20" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">★</text>`
      : ""
    
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80">
          <defs>
            <filter id="agentShadow" x="-50%" y="-30%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="${glowColor}" flood-opacity="0.4"/>
            </filter>
            <linearGradient id="agentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:${baseColor};stop-opacity:1"/>
              <stop offset="100%" style="stop-color:${glowColor};stop-opacity:1"/>
            </linearGradient>
            ${isSelected ? `
            <radialGradient id="selectedGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:${baseColor};stop-opacity:0.4">
                <animate attributeName="stop-opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" style="stop-color:${baseColor};stop-opacity:0"/>
            </radialGradient>` : ""}
          </defs>
          ${isSelected ? `<circle cx="32" cy="40" r="30" fill="url(#selectedGlow)">
            <animate attributeName="r" values="28;35;28" dur="1.5s" repeatCount="indefinite"/>
          </circle>` : ""}
          <g filter="url(#agentShadow)">
            <!-- Pin shape -->
            <path d="M32 8 C20 8, 12 18, 12 28 C12 42, 32 70, 32 70 C32 70, 52 42, 52 28 C52 18, 44 8, 32 8 Z" 
                  fill="url(#agentGrad)" stroke="#ffffff" stroke-width="3"/>
            <!-- Inner circle -->
            <circle cx="32" cy="28" r="14" fill="#ffffff"/>
            <!-- Agent icon -->
            <circle cx="32" cy="24" r="6" fill="${baseColor}"/>
            <path d="M24 36 Q32 30, 40 36" fill="${baseColor}"/>
          </g>
          <!-- Verification/Premium badge -->
          ${badgeIcon}
        </svg>
      `),
      scaledSize: new google.maps.Size(64, 80),
      anchor: new google.maps.Point(32, 70),
    }
  }

  // Premium Car Icon with smooth rotation
  const createPremiumCarMarker = (heading: number): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
          <defs>
            <filter id="carGlow" x="-50%" y="-50%" width="200%" height="200%">
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
            <linearGradient id="carBody" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#1e3a8a"/>
              <stop offset="50%" style="stop-color:#1e40af"/>
              <stop offset="100%" style="stop-color:#1e3a8a"/>
            </linearGradient>
            <linearGradient id="carRoof" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#3b82f6"/>
              <stop offset="100%" style="stop-color:#2563eb"/>
            </linearGradient>
            <!-- Direction indicator glow -->
            <radialGradient id="directionGlow" cx="50%" cy="0%" r="100%">
              <stop offset="0%" style="stop-color:#22c55e;stop-opacity:0.8"/>
              <stop offset="100%" style="stop-color:#22c55e;stop-opacity:0"/>
            </radialGradient>
          </defs>
          <g filter="url(#carGlow)" transform="rotate(${heading} 40 40)">
            <!-- Direction indicator -->
            <ellipse cx="40" cy="12" rx="10" ry="15" fill="url(#directionGlow)" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.3;0.6" dur="1s" repeatCount="indefinite"/>
            </ellipse>
            <!-- Car shadow -->
            <ellipse cx="40" cy="60" rx="18" ry="6" fill="#000000" opacity="0.2"/>
            <!-- Car body -->
            <rect x="22" y="32" width="36" height="24" rx="4" fill="url(#carBody)" stroke="#ffffff" stroke-width="2"/>
            <!-- Car roof/cabin -->
            <path d="M26 32 L30 22 H50 L54 32" fill="url(#carRoof)" stroke="#ffffff" stroke-width="2"/>
            <!-- Windows -->
            <rect x="28" y="24" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8"/>
            <rect x="42" y="24" width="10" height="8" rx="1" fill="#1e293b" opacity="0.8"/>
            <!-- Headlights (front) -->
            <circle cx="26" cy="36" r="3" fill="#fef08a">
              <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="54" cy="36" r="3" fill="#fef08a">
              <animate attributeName="opacity" values="1;0.7;1" dur="0.5s" repeatCount="indefinite"/>
            </circle>
            <!-- Taillights (back) -->
            <circle cx="26" cy="52" r="2.5" fill="#ef4444"/>
            <circle cx="54" cy="52" r="2.5" fill="#ef4444"/>
            <!-- Wheels -->
            <circle cx="28" cy="58" r="5" fill="#1f2937" stroke="#374151" stroke-width="2"/>
            <circle cx="28" cy="58" r="2" fill="#6b7280"/>
            <circle cx="52" cy="58" r="5" fill="#1f2937" stroke="#374151" stroke-width="2"/>
            <circle cx="52" cy="58" r="2" fill="#6b7280"/>
            <!-- Side mirror -->
            <ellipse cx="20" cy="38" rx="3" ry="2" fill="#1e3a8a"/>
            <ellipse cx="60" cy="38" rx="3" ry="2" fill="#1e3a8a"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(80, 80),
      anchor: new google.maps.Point(40, 40),
    }
  }

  // Format ETA for display
  const formatETADisplay = (seconds: number | null): string => {
    if (seconds === null) return "--"
    if (seconds < 60) return "< 1 min"
    const minutes = Math.ceil(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainingMins = minutes % 60
    return `${hours}h ${remainingMins}m`
  }

  // Calculate distance for display
  const formatDistanceDisplay = (agent: Agent): string => {
    if (agent.distance < 1) {
      return `${Math.round(agent.distance * 1000)}m`
    }
    return `${agent.distance.toFixed(1)}km`
  }

  // Error state
  if (loadError || !apiKey) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="text-red-500">
              <p className="font-semibold text-lg">Map Configuration Required</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please configure Google Maps API key
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (!isLoaded) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary/20 animate-ping" />
            </div>
            <p className="text-muted-foreground mt-4 font-medium">Loading premium map...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const validUserLocation = userLocation && 
    typeof userLocation.lat === "number" && 
    typeof userLocation.lng === "number" &&
    !isNaN(userLocation.lat) && !isNaN(userLocation.lng)

  const center = validUserLocation ? userLocation : defaultCenter

  return (
    <div className="relative w-full">
      {/* Map Container */}
      <div className="h-[400px] sm:h-[500px] lg:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-border/50">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={15}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          options={{
            styles: isDarkMode ? premiumDarkStyle : premiumLightStyle,
            zoomControl: true,
            zoomControlOptions: {
              position: google.maps.ControlPosition.RIGHT_CENTER,
            },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            fullscreenControlOptions: {
              position: google.maps.ControlPosition.RIGHT_TOP,
            },
            rotateControl: false,
            scaleControl: true,
            clickableIcons: false,
            gestureHandling: "greedy",
            mapTypeId: mapType,
          }}
        >
          {/* Traffic Layer */}
          {showTrafficLayer && <TrafficLayer />}

          {/* User Location Marker */}
          {isMapReady && validUserLocation && (
            <Marker
              position={userLocation}
              icon={createPremiumUserMarker()}
              title="Your Location"
              zIndex={1000}
              optimized={false}
            />
          )}

          {/* User accuracy circle */}
          {validUserLocation && (
            <Circle
              center={userLocation}
              radius={100}
              options={{
                fillColor: "#3b82f6",
                fillOpacity: 0.05,
                strokeColor: "#3b82f6",
                strokeOpacity: 0.2,
                strokeWeight: 1,
                zIndex: 1,
              }}
            />
          )}

          {/* Agent Markers */}
          {isMapReady && agents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id
            const isRealTimeTracking = isSelected && smoothedAgentPos
            
            const position = isRealTimeTracking 
              ? smoothedAgentPos 
              : agent.location

            if (!position) return null

            return (
              <Marker
                key={agent.id}
                position={position}
                icon={isRealTimeTracking 
                  ? createPremiumCarMarker(displayHeading)
                  : createPremiumAgentMarker(agent, isSelected)
                }
                title={agent.name}
                onClick={() => {
                  onSelectAgent(agent)
                  setShowInfoWindow(agent.id)
                }}
                zIndex={isSelected ? 1001 : 500}
                optimized={false}
              />
            )
          })}

          {/* Info Windows */}
          {showInfoWindow && agents.find(a => a.id === showInfoWindow) && (
            <InfoWindow
              position={agents.find(a => a.id === showInfoWindow)!.location}
              onCloseClick={() => setShowInfoWindow(null)}
              options={{ pixelOffset: new google.maps.Size(0, -60) }}
            >
              <div className="p-2 min-w-[200px]">
                {(() => {
                  const agent = agents.find(a => a.id === showInfoWindow)!
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {agent.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{agent.name}</p>
                          <div className="flex items-center gap-1 text-xs text-amber-500">
                            <Star className="h-3 w-3 fill-current" />
                            <span>{agent.rating.toFixed(1)}</span>
                            <span className="text-gray-400">({agent.totalTransactions} trips)</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {formatDistanceDisplay(agent)}
                        </span>
                        {agent.verifiedAgent && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Shield className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </InfoWindow>
          )}

          {/* Directions Route */}
          {showRoute && directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                polylineOptions: {
                  strokeColor: "#10b981",
                  strokeOpacity: 0.9,
                  strokeWeight: 6,
                },
                suppressMarkers: true,
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* Floating Controls - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* Map Type Toggle */}
        <Button
          size="sm"
          variant="secondary"
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={() => setMapType(prev => prev === "roadmap" ? "satellite" : prev === "satellite" ? "hybrid" : "roadmap")}
        >
          <Layers className="h-4 w-4" />
        </Button>
        
        {/* Traffic Toggle */}
        <Button
          size="sm"
          variant={showTrafficLayer ? "default" : "secondary"}
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={() => setShowTrafficLayer(!showTrafficLayer)}
        >
          <Route className="h-4 w-4" />
        </Button>
        
        {/* Voice Toggle */}
        <Button
          size="sm"
          variant={voiceEnabled ? "default" : "secondary"}
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
        >
          {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        
        {/* Center on User */}
        {validUserLocation && (
          <Button
            size="sm"
            variant="secondary"
            className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm bg-background/80"
            onClick={() => map?.panTo(userLocation)}
          >
            <Target className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ETA Card - Bottom Center (Mobile Optimized) */}
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
              
              {/* Call Button */}
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
                    if (smoothedAgentPos) {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${smoothedAgentPos.lat},${smoothedAgentPos.lng}`
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

      {/* Agent List - Scrollable (Mobile Optimized) */}
      {!selectedAgent && agents.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 max-h-[45vh] overflow-hidden">
          <Card className="shadow-2xl border-2 border-border/50 backdrop-blur-sm bg-background/95">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm sm:text-base">Nearby Agents</h3>
                <Badge variant="secondary" className="text-xs">
                  {agents.length} available
                </Badge>
              </div>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                {agents.slice(0, 5).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => onSelectAgent(agent)}
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
                      <p className="font-bold text-sm text-primary">{formatDistanceDisplay(agent)}</p>
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

