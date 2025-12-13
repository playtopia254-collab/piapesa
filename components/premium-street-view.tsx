"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useJsApiLoader } from "@react-google-maps/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  MapPin, 
  RotateCcw, 
  Maximize2, 
  Minimize2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Compass,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PremiumStreetViewProps {
  location: { lat: number; lng: number }
  heading?: number
  pitch?: number
  zoom?: number
  className?: string
  showControls?: boolean
  showLocationBadge?: boolean
  onLocationVerified?: () => void
}

const libraries: ("places" | "geometry")[] = ["places", "geometry"]

export function PremiumStreetView({
  location,
  heading = 0,
  pitch = 0,
  zoom = 1,
  className,
  showControls = true,
  showLocationBadge = true,
  onLocationVerified,
}: PremiumStreetViewProps) {
  const streetViewRef = useRef<HTMLDivElement>(null)
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentHeading, setCurrentHeading] = useState(heading)
  const [currentPitch, setCurrentPitch] = useState(pitch)
  const [currentZoom, setCurrentZoom] = useState(zoom)
  const [address, setAddress] = useState<string>("")

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  const { isLoaded } = useJsApiLoader({
    id: "google-map-premium-streetview",
    googleMapsApiKey: apiKey,
    libraries,
  })

  // Initialize Street View
  useEffect(() => {
    if (!isLoaded || !streetViewRef.current) return

    setIsLoading(true)

    // Check Street View availability
    const streetViewService = new google.maps.StreetViewService()
    
    streetViewService.getPanorama(
      { location, radius: 100 },
      (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data) {
          setIsAvailable(true)
          
          // Create panorama
          panoramaRef.current = new google.maps.StreetViewPanorama(
            streetViewRef.current!,
            {
              position: location,
              pov: { heading: currentHeading, pitch: currentPitch },
              zoom: currentZoom,
              addressControl: false,
              showRoadLabels: true,
              zoomControl: false,
              panControl: false,
              fullscreenControl: false,
              motionTracking: true,
              motionTrackingControl: true,
              linksControl: true,
            }
          )

          // Add listeners
          panoramaRef.current.addListener("pov_changed", () => {
            const pov = panoramaRef.current?.getPov()
            if (pov) {
              setCurrentHeading(pov.heading || 0)
              setCurrentPitch(pov.pitch || 0)
            }
          })

          panoramaRef.current.addListener("zoom_changed", () => {
            setCurrentZoom(panoramaRef.current?.getZoom() || 1)
          })

          setIsLoading(false)
        } else {
          setIsAvailable(false)
          setIsLoading(false)
        }
      }
    )

    // Get address via reverse geocoding
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        setAddress(results[0].formatted_address)
      }
    })

    return () => {
      if (panoramaRef.current) {
        google.maps.event.clearInstanceListeners(panoramaRef.current)
      }
    }
  }, [isLoaded, location, currentHeading, currentPitch, currentZoom])

  // Control functions
  const rotateLeft = useCallback(() => {
    if (panoramaRef.current) {
      const pov = panoramaRef.current.getPov()
      panoramaRef.current.setPov({ heading: pov.heading - 30, pitch: pov.pitch })
    }
  }, [])

  const rotateRight = useCallback(() => {
    if (panoramaRef.current) {
      const pov = panoramaRef.current.getPov()
      panoramaRef.current.setPov({ heading: pov.heading + 30, pitch: pov.pitch })
    }
  }, [])

  const lookUp = useCallback(() => {
    if (panoramaRef.current) {
      const pov = panoramaRef.current.getPov()
      panoramaRef.current.setPov({ heading: pov.heading, pitch: Math.min(pov.pitch + 15, 90) })
    }
  }, [])

  const lookDown = useCallback(() => {
    if (panoramaRef.current) {
      const pov = panoramaRef.current.getPov()
      panoramaRef.current.setPov({ heading: pov.heading, pitch: Math.max(pov.pitch - 15, -90) })
    }
  }, [])

  const zoomIn = useCallback(() => {
    if (panoramaRef.current) {
      const current = panoramaRef.current.getZoom()
      panoramaRef.current.setZoom(Math.min((current || 1) + 0.5, 4))
    }
  }, [])

  const zoomOut = useCallback(() => {
    if (panoramaRef.current) {
      const current = panoramaRef.current.getZoom()
      panoramaRef.current.setZoom(Math.max((current || 1) - 0.5, 0))
    }
  }, [])

  const resetView = useCallback(() => {
    if (panoramaRef.current) {
      panoramaRef.current.setPov({ heading: 0, pitch: 0 })
      panoramaRef.current.setZoom(1)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!streetViewRef.current) return
    
    if (!isFullscreen) {
      if (streetViewRef.current.requestFullscreen) {
        streetViewRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  // Loading state
  if (!isLoaded) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="h-64 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading Street View...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Not available state
  if (!isAvailable && !isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="h-64 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="text-center text-white">
            <EyeOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-semibold">Street View Not Available</p>
            <p className="text-sm opacity-70 mt-1">No imagery at this location</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("overflow-hidden relative", className)}>
      {/* Street View Container */}
      <div 
        ref={streetViewRef} 
        className={cn(
          "w-full transition-all duration-300",
          isFullscreen ? "h-screen" : "h-64 sm:h-80 lg:h-96"
        )}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading Street View...</p>
          </div>
        </div>
      )}

      {/* Location Badge */}
      {showLocationBadge && address && (
        <div className="absolute top-3 left-3 right-16 z-10">
          <Badge 
            variant="secondary" 
            className="max-w-full px-3 py-1.5 bg-black/60 backdrop-blur-sm border-0 text-white"
          >
            <MapPin className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
            <span className="truncate text-xs">{address}</span>
          </Badge>
        </div>
      )}

      {/* Compass */}
      <div className="absolute top-3 right-3 z-10">
        <div 
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
          style={{ transform: `rotate(${-currentHeading}deg)` }}
        >
          <Compass className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Controls */}
      {showControls && !isLoading && (
        <>
          {/* Navigation Controls - Left Side */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={rotateLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Controls - Right Side */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={rotateRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Vertical Controls */}
          <div className="absolute bottom-16 right-3 flex flex-col gap-1 z-10">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={lookUp}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={lookDown}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <div className="flex items-center justify-between">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={zoomOut}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={zoomIn}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Other Controls */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={resetView}
                  title="Reset view"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                {onLocationVerified && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                    onClick={onLocationVerified}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Verify
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

