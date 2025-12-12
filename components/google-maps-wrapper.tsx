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
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places", "geometry"]

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
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="text-red-500">
              <p className="font-semibold text-lg">Google Maps API Key Missing</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please add your API key to `.env.local`
              </p>
            </div>
            <div className="text-left bg-muted p-4 rounded-lg text-sm space-y-2 max-w-md mx-auto">
              <p className="font-semibold">Add this to your `.env.local` file:</p>
              <code className="block bg-background p-2 rounded mt-2">
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCUye5Of2MtmvhnWrA96k3DDk9Rv6GnGAA
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Then restart your dev server: <code>npm run dev</code>
              </p>
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

  // Calculate map bounds to fit all markers
  const calculateBounds = useCallback(() => {
    if (!userLocation || agents.length === 0) return null

    const bounds = new google.maps.LatLngBounds()
    bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng))
    
    agents.forEach((agent) => {
      bounds.extend(new google.maps.LatLng(agent.location.lat, agent.location.lng))
    })

    if (agentLocation) {
      bounds.extend(new google.maps.LatLng(agentLocation.lat, agentLocation.lng))
    }

    return bounds
  }, [userLocation, agents, agentLocation])

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
  }, [map, isMapReady, userLocation, agents, agentLocation, calculateBounds])

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
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="text-red-500">
              <p className="font-semibold text-lg">Error loading Google Maps</p>
              <p className="text-sm text-muted-foreground mt-2">
                {loadError.message || "Please check your API key configuration"}
              </p>
            </div>
            <div className="text-left bg-muted p-4 rounded-lg text-sm space-y-2 max-w-md mx-auto">
              <p className="font-semibold">Troubleshooting Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Verify API key is in `.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`</li>
                <li>Restart your dev server after adding the key</li>
                <li>Enable these 4 APIs in Google Cloud Console:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Maps JavaScript API</li>
                    <li>Geocoding API</li>
                    <li>Directions API</li>
                    <li>Distance Matrix API</li>
                  </ul>
                </li>
                <li>Enable billing in Google Cloud (required even for free tier)</li>
                <li>If API key is restricted, add `http://localhost:3000/*` to allowed referrers</li>
              </ol>
            </div>
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

  const center = userLocation || defaultCenter

  // Icon creation functions - only called when Google Maps is loaded
  const createUserMarkerIcon = (): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="#3b82f6" stroke="white" stroke-width="3"/>
          <circle cx="20" cy="20" r="8" fill="white"/>
        </svg>
      `),
      scaledSize: new google.maps.Size(40, 40),
      anchor: new google.maps.Point(20, 20),
    }
  }

  const createAgentMarkerIcon = (isSelected: boolean): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="22" fill="${isSelected ? "#22c55e" : "#f97316"}" stroke="white" stroke-width="3"/>
          <path d="M25 10 C18 10, 12 16, 12 23 C12 30, 25 40, 25 40 C25 40, 38 30, 38 23 C38 16, 32 10, 25 10 Z" fill="white" opacity="0.9"/>
          <circle cx="25" cy="23" r="6" fill="${isSelected ? "#22c55e" : "#f97316"}"/>
        </svg>
      `),
      scaledSize: new google.maps.Size(50, 50),
      anchor: new google.maps.Point(25, 50),
    }
  }

  const createCarIcon = (heading?: number): google.maps.Icon | undefined => {
    if (!isMapReady || typeof window === "undefined" || !window.google) return undefined
    const rotation = heading || 0
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
          <g transform="rotate(${rotation} 30 30)">
            <rect x="10" y="20" width="40" height="20" rx="3" fill="#1a1a1a" stroke="white" stroke-width="2"/>
            <rect x="15" y="25" width="10" height="10" rx="1" fill="#3b82f6" opacity="0.8"/>
            <rect x="35" y="25" width="10" height="10" rx="1" fill="#3b82f6" opacity="0.8"/>
            <circle cx="20" cy="45" r="5" fill="#333" stroke="white" stroke-width="1"/>
            <circle cx="20" cy="45" r="2" fill="#fff"/>
            <circle cx="40" cy="45" r="5" fill="#333" stroke="white" stroke-width="1"/>
            <circle cx="40" cy="45" r="2" fill="#fff"/>
            <rect x="12" y="15" width="36" height="8" rx="2" fill="#1a1a1a"/>
          </g>
        </svg>
      `),
      scaledSize: new google.maps.Size(60, 60),
      anchor: new google.maps.Point(30, 30),
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
        {/* User location marker */}
        {isMapReady && createUserMarkerIcon() && (
          <Marker
            position={userLocation}
            icon={createUserMarkerIcon()}
            title="Your Location"
            animation={google.maps.Animation.DROP}
          />
        )}

        {/* User location circle */}
        <Circle
          center={userLocation}
          radius={100}
          options={{
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            strokeColor: "#3b82f6",
            strokeOpacity: 0.5,
            strokeWeight: 2,
          }}
        />

        {/* Agent markers */}
        {isMapReady && agents.map((agent) => {
          // Use real-time agent location if available and this is the selected agent
          const agentPos =
            agentLocation && selectedAgent?.id === agent.id
              ? agentLocation
              : agent.location

          const icon = agentLocation && selectedAgent?.id === agent.id
            ? createCarIcon(agentHeading)
            : createAgentMarkerIcon(selectedAgent?.id === agent.id)

          if (!icon) return null

          return (
            <Marker
              key={agent.id}
              position={agentPos}
              icon={icon}
              title={agent.name}
              animation={
                agentLocation && selectedAgent?.id === agent.id
                  ? undefined
                  : google.maps.Animation.DROP
              }
              onClick={() => onSelectAgent(agent)}
            />
          )
        })}

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
      </div>
    </div>
  )
}

