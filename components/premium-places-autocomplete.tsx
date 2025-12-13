"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useJsApiLoader } from "@react-google-maps/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  MapPin, 
  Search, 
  Clock, 
  Home, 
  Building2, 
  Navigation, 
  Star,
  Loader2,
  X,
  History,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PlaceResult {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
  types: string[]
  location?: { lat: number; lng: number }
}

interface PremiumPlacesAutocompleteProps {
  onPlaceSelect: (place: PlaceResult) => void
  placeholder?: string
  defaultValue?: string
  currentLocation?: { lat: number; lng: number } | null
  className?: string
  showRecentSearches?: boolean
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places", "geometry", "drawing"]

// Recent searches storage key
const RECENT_SEARCHES_KEY = "piapesa_recent_places"
const MAX_RECENT_SEARCHES = 5

export function PremiumPlacesAutocomplete({
  onPlaceSelect,
  placeholder = "Search for a location...",
  defaultValue = "",
  currentLocation = null,
  className,
  showRecentSearches = true,
}: PremiumPlacesAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue)
  const [predictions, setPredictions] = useState<PlaceResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<PlaceResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  })

  // Initialize services
  useEffect(() => {
    if (isLoaded && typeof google !== "undefined") {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
      
      // Create a dummy div for PlacesService (required but not displayed)
      const dummyDiv = document.createElement("div")
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv)
      
      // Create session token for billing optimization
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()
    }
  }, [isLoaded])

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && showRecentSearches) {
      try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
        if (stored) {
          setRecentSearches(JSON.parse(stored))
        }
      } catch (e) {
        console.error("Failed to load recent searches:", e)
      }
    }
  }, [showRecentSearches])

  // Save to recent searches
  const saveToRecent = useCallback((place: PlaceResult) => {
    if (typeof window === "undefined" || !showRecentSearches) return
    
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      let recent: PlaceResult[] = stored ? JSON.parse(stored) : []
      
      // Remove if already exists
      recent = recent.filter(r => r.placeId !== place.placeId)
      
      // Add to front
      recent.unshift(place)
      
      // Limit to max
      recent = recent.slice(0, MAX_RECENT_SEARCHES)
      
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent))
      setRecentSearches(recent)
    } catch (e) {
      console.error("Failed to save recent search:", e)
    }
  }, [showRecentSearches])

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.removeItem(RECENT_SEARCHES_KEY)
    setRecentSearches([])
  }, [])

  // Search for places
  const searchPlaces = useCallback((query: string) => {
    if (!autocompleteServiceRef.current || !query.trim()) {
      setPredictions([])
      return
    }

    setIsLoading(true)

    const request: google.maps.places.AutocompletionRequest = {
      input: query,
      sessionToken: sessionTokenRef.current || undefined,
      componentRestrictions: { country: "ke" }, // Restrict to Kenya
    }

    // Add location bias if available
    if (currentLocation) {
      request.location = new google.maps.LatLng(currentLocation.lat, currentLocation.lng)
      request.radius = 50000 // 50km radius
    }

    autocompleteServiceRef.current.getPlacePredictions(
      request,
      (results, status) => {
        setIsLoading(false)
        
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const formattedResults: PlaceResult[] = results.map(prediction => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting.main_text,
            secondaryText: prediction.structured_formatting.secondary_text || "",
            types: prediction.types || [],
          }))
          setPredictions(formattedResults)
          setSelectedIndex(-1)
        } else {
          setPredictions([])
        }
      }
    )
  }, [currentLocation])

  // Debounced search
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    if (value.trim().length < 2) {
      setPredictions([])
      return
    }
    
    debounceTimerRef.current = setTimeout(() => {
      searchPlaces(value)
    }, 300)
  }, [searchPlaces])

  // Get place details and coordinates
  const getPlaceDetails = useCallback((place: PlaceResult) => {
    if (!placesServiceRef.current) {
      onPlaceSelect(place)
      saveToRecent(place)
      return
    }

    placesServiceRef.current.getDetails(
      {
        placeId: place.placeId,
        fields: ["geometry", "formatted_address", "name"],
        sessionToken: sessionTokenRef.current || undefined,
      },
      (result, status) => {
        // Create new session token after successful request
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()
        
        if (status === google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
          const enrichedPlace: PlaceResult = {
            ...place,
            location: {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
            },
          }
          onPlaceSelect(enrichedPlace)
          saveToRecent(enrichedPlace)
        } else {
          onPlaceSelect(place)
          saveToRecent(place)
        }
      }
    )
  }, [onPlaceSelect, saveToRecent])

  // Handle place selection
  const handleSelect = useCallback((place: PlaceResult) => {
    setInputValue(place.mainText)
    setPredictions([])
    setIsFocused(false)
    getPlaceDetails(place)
  }, [getPlaceDetails])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = predictions.length > 0 ? predictions : recentSearches
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : items.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && items[selectedIndex]) {
          handleSelect(items[selectedIndex])
        }
        break
      case "Escape":
        setIsFocused(false)
        setPredictions([])
        break
    }
  }, [predictions, recentSearches, selectedIndex, handleSelect])

  // Get icon for place type
  const getPlaceIcon = (types: string[]) => {
    if (types.includes("home") || types.includes("premise")) {
      return <Home className="h-4 w-4 text-blue-500" />
    }
    if (types.includes("establishment") || types.includes("point_of_interest")) {
      return <Building2 className="h-4 w-4 text-purple-500" />
    }
    if (types.includes("route") || types.includes("street_address")) {
      return <Navigation className="h-4 w-4 text-green-500" />
    }
    return <MapPin className="h-4 w-4 text-red-500" />
  }

  // Use current location
  const useCurrentLocation = useCallback(() => {
    if (currentLocation) {
      // Reverse geocode to get address
      if (typeof google !== "undefined") {
        const geocoder = new google.maps.Geocoder()
        geocoder.geocode(
          { location: currentLocation },
          (results, status) => {
            if (status === "OK" && results && results[0]) {
              const place: PlaceResult = {
                placeId: results[0].place_id,
                description: results[0].formatted_address,
                mainText: "Current Location",
                secondaryText: results[0].formatted_address,
                types: ["current_location"],
                location: currentLocation,
              }
              setInputValue("Current Location")
              onPlaceSelect(place)
            }
          }
        )
      }
    }
  }, [currentLocation, onPlaceSelect])

  const showDropdown = isFocused && (predictions.length > 0 || (recentSearches.length > 0 && !inputValue))

  return (
    <div className={cn("relative w-full", className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-20 h-12 text-base rounded-xl border-2 focus:border-primary"
          autoComplete="off"
        />
        {inputValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => {
              setInputValue("")
              setPredictions([])
              inputRef.current?.focus()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {currentLocation && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-primary"
            onClick={useCurrentLocation}
            title="Use current location"
          >
            <Navigation className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-2xl border-2 overflow-hidden">
          <CardContent className="p-0">
            {/* Predictions */}
            {predictions.length > 0 && (
              <div className="py-2">
                {predictions.map((place, index) => (
                  <button
                    key={place.placeId}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                      selectedIndex === index 
                        ? "bg-primary/10" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleSelect(place)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="mt-0.5">
                      {getPlaceIcon(place.types)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{place.mainText}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.secondaryText}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Recent Searches */}
            {predictions.length === 0 && recentSearches.length > 0 && !inputValue && (
              <div className="py-2">
                <div className="px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    <span>Recent Searches</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearRecentSearches}
                  >
                    Clear
                  </Button>
                </div>
                {recentSearches.map((place, index) => (
                  <button
                    key={place.placeId}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                      selectedIndex === index 
                        ? "bg-primary/10" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleSelect(place)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="mt-0.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{place.mainText}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.secondaryText}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Use Current Location Option */}
            {currentLocation && predictions.length === 0 && (
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-t hover:bg-muted/50 transition-colors"
                onClick={useCurrentLocation}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Navigation className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Use current location</p>
                  <p className="text-xs text-muted-foreground">Get your precise GPS location</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  GPS
                </Badge>
              </button>
            )}

            {/* Powered by Google */}
            <div className="px-4 py-2 border-t bg-muted/30">
              <p className="text-[10px] text-muted-foreground text-right">
                Powered by Google
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

