"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  MapPin,
  Phone,
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Navigation,
  XCircle,
  ArrowLeft,
  RefreshCw,
  X,
  Car,
  Shield,
} from "lucide-react"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { dispatchBalanceUpdate } from "@/lib/balance-updater"
import { getCurrentLocation } from "@/lib/location-utils"
import { BoltMapboxMap } from "@/components/bolt-mapbox-map"
import { AgentReviewModal } from "@/components/agent-review-modal"
import { PositionSmoother } from "@/lib/smooth-marker"
import { PremiumPlacesAutocomplete } from "@/components/premium-places-autocomplete"
import { PremiumStreetView } from "@/components/premium-street-view"

interface AgentWithdrawalFlowProps {
  user: {
    id: string
    name: string
    phone: string
    balance: number
    location?: string
  }
  onComplete: () => void
  onCancel: () => void
}

interface WithdrawalRequest {
  _id: string
  userId: string
  amount: number
  location: string
  notes?: string
  status: string
  agentId?: string
  agent?: {
    id: string
    name: string
    phone: string
    location?: string
    rating?: number
  }
  user?: any
  createdAt: string
  expiresAt?: string
  acceptedAt?: string
  userConfirmed?: boolean
  agentConfirmed?: boolean
}

type Step = "amount" | "map" | "searching" | "matched" | "in_progress" | "completed" | "cancelled"

interface SelectedAgent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  distance: number
  distanceFormatted: string
}

export function AgentWithdrawalFlow({ user, onComplete, onCancel }: AgentWithdrawalFlowProps) {
  const [step, setStep] = useState<Step>("amount")
  const [amount, setAmount] = useState("")
  const [location, setLocation] = useState("") // Will be set from GPS coordinates
  const [notes, setNotes] = useState("")
  const [request, setRequest] = useState<WithdrawalRequest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchTime, setSearchTime] = useState(0)
  const [userCoordinates, setUserCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [agentDistance, setAgentDistance] = useState<number | null>(null)
  const [agentRealTimeLocation, setAgentRealTimeLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null)
  const [nearbyAgents, setNearbyAgents] = useState<SelectedAgent[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [showMeetingPoint, setShowMeetingPoint] = useState(false)
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [etaFormatted, setEtaFormatted] = useState<string | null>(null)
  const [routeDistance, setRouteDistance] = useState<number | null>(null)

  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [isRefiningLocation, setIsRefiningLocation] = useState(false)
  const [clientLocationLocked, setClientLocationLocked] = useState(false)
  const [isWaitingForAccuracy, setIsWaitingForAccuracy] = useState(false)
  const [agentAccuracy, setAgentAccuracy] = useState<number | null>(null) // Agent's GPS accuracy
  const [straightLineDistanceMeters, setStraightLineDistanceMeters] = useState<number | null>(null) // Precise distance in meters
  const locationWatchCleanup = useRef<(() => void) | null>(null)
  const trackingLocationWatchId = useRef<number | null>(null) // Continuous location tracking during matched/in_progress
  const hasSearchedAgents = useRef(false) // Prevent multiple searches
  const isSearchingLocation = useRef(false) // Prevent multiple location searches
  const locationPermissionDenied = useRef(false) // Track if permission was denied
  const mapInitialized = useRef(false) // Prevent map re-initialization
  const agentPositionSmoother = useRef<PositionSmoother>(new PositionSmoother(0.35)) // Smooth agent location updates
  
  // Snap location to nearest road for smoother tracking (premium feature)
  const snapToRoad = useCallback(async (location: { lat: number; lng: number }): Promise<{ lat: number; lng: number }> => {
    try {
      const response = await fetch(`/api/google/roads?lat=${location.lat}&lng=${location.lng}`)
      const data = await response.json()
      
      if (data.success && data.snapped && data.location) {
        return data.location
      }
    } catch (error) {
      console.error("Failed to snap to road:", error)
    }
    return location // Return original if snap fails
  }, [])
  
  const ACCURACY_THRESHOLD = 100 // Only search when accuracy ≤ 100m (for initial search)
  const MIN_WAIT_TIME = 6000 // Minimum 6 seconds wait time

  // Get user's current location with accuracy gate (Uber-like)
  // Waits for ≤100m accuracy before proceeding
  const captureLocationWithAccuracyGate = async (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      setIsWaitingForAccuracy(true)
      setIsRefiningLocation(true)
      const startTime = Date.now()
      
      // Check if geolocation is available
      if (typeof window === "undefined" || !navigator.geolocation) {
        locationPermissionDenied.current = true
        setIsWaitingForAccuracy(false)
        setIsRefiningLocation(false)
        resolve(null)
        return
      }
      
      // Import watchLocation
      import("@/lib/location-utils").then(({ watchLocation }) => {
        let bestLocation: { lat: number; lng: number; accuracy: number } | null = null
        let hasLocked = false
        
        // Watch for location updates - wait for accuracy ≤ 100m
        locationWatchCleanup.current = watchLocation(
          (location) => {
            // Location received - permission is granted
            locationPermissionDenied.current = false
            
            const accuracy = location.accuracy || Infinity
            
            // Update UI with current accuracy
            setUserCoordinates({ lat: location.lat, lng: location.lng })
            setLocationAccuracy(accuracy)
            
            // Track best location
            if (!bestLocation || accuracy < bestLocation.accuracy) {
              bestLocation = { lat: location.lat, lng: location.lng, accuracy }
            }
            
            // Check if we meet accuracy threshold AND minimum wait time
            const elapsed = Date.now() - startTime
            const meetsAccuracy = accuracy <= ACCURACY_THRESHOLD
            const meetsMinTime = elapsed >= MIN_WAIT_TIME
            
            // Lock location when both conditions are met
            if (meetsAccuracy && meetsMinTime && !hasLocked) {
              hasLocked = true
              setClientLocationLocked(true)
              setIsWaitingForAccuracy(false)
              
              // Stop watching GPS
              if (locationWatchCleanup.current) {
                locationWatchCleanup.current()
                locationWatchCleanup.current = null
              }
              
              // Freeze for 1-2 seconds for smooth UX
              setTimeout(() => {
                setIsRefiningLocation(false)
                // Resolve with locked location
                resolve({ lat: location.lat, lng: location.lng })
              }, 1500)
            }
          },
          (error) => {
            console.error("Location watch error:", error)
            
            // Check if it's a permission denied error
            if (error.message && (
              error.message.includes("permission") || 
              error.message.includes("denied") ||
              error.message.includes("PERMISSION_DENIED")
            )) {
              locationPermissionDenied.current = true
            }
            
            setIsWaitingForAccuracy(false)
            setIsRefiningLocation(false)
            // Resolve with best location we have, or null
            resolve(bestLocation ? { lat: bestLocation.lat, lng: bestLocation.lng } : null)
          }
        )
        
        // Fallback: If 30 seconds pass without meeting threshold, use best location
        setTimeout(() => {
          if (!hasLocked && bestLocation) {
            hasLocked = true
            setClientLocationLocked(true)
            setIsWaitingForAccuracy(false)
            
            if (locationWatchCleanup.current) {
              locationWatchCleanup.current()
              locationWatchCleanup.current = null
            }
            
            setTimeout(() => {
              setIsRefiningLocation(false)
              resolve({ lat: bestLocation!.lat, lng: bestLocation!.lng })
            }, 1500)
          } else if (!hasLocked && !bestLocation) {
            // No location received at all - likely permission denied
            locationPermissionDenied.current = true
            setIsWaitingForAccuracy(false)
            setIsRefiningLocation(false)
            resolve(null)
          }
        }, 30000)
      }).catch((error) => {
        console.error("Failed to import watchLocation:", error)
        locationPermissionDenied.current = true
        setIsWaitingForAccuracy(false)
        setIsRefiningLocation(false)
        resolve(null)
      })
    })
  }

  // Cleanup location watch on unmount
  useEffect(() => {
    return () => {
      if (locationWatchCleanup.current) {
        locationWatchCleanup.current()
      }
    }
  }, [])

  // Fetch nearby agents - CONTINUOUS SEARCH with 2km radius (keeps searching until found)
  // Enrich agents with accurate ETAs using Distance Matrix API
  const enrichAgentsWithETAs = useCallback(async (agents: Agent[], userCoords: { lat: number; lng: number }) => {
    if (agents.length === 0) return agents
    
    try {
      const destinations = agents.map(a => a.location).filter(loc => loc && loc.lat && loc.lng)
      
      if (destinations.length === 0) return agents
      
      const response = await fetch("/api/google/distance-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: userCoords,
          destinations,
          mode: "driving",
          trafficModel: "best_guess",
        }),
      })
      
      const data = await response.json()
      
      if (data.success && data.results) {
        // Enrich agents with ETA data
        return agents.map((agent, index) => {
          const etaData = data.results[index]
          if (etaData && etaData.status === "OK") {
            return {
              ...agent,
              etaSeconds: etaData.durationInTraffic?.value || etaData.duration?.value || null,
              etaFormatted: etaData.durationInTraffic?.text || etaData.duration?.text || null,
              drivingDistance: etaData.distance?.value || null,
              drivingDistanceFormatted: etaData.distance?.text || null,
            }
          }
          return agent
        }).sort((a, b) => {
          // Sort by ETA (fastest first)
          const etaA = (a as any).etaSeconds || Infinity
          const etaB = (b as any).etaSeconds || Infinity
          return etaA - etaB
        })
      }
    } catch (error) {
      console.error("Failed to fetch ETAs:", error)
    }
    
    return agents
  }, [])

  const fetchNearbyAgents = useCallback(async (coords: { lat: number; lng: number }) => {
    // Don't set loading on every call - only on first call
    if (!hasSearchedAgents.current) {
      setIsLoadingAgents(true)
    }
    setError("")
    
    console.log(`🔍 Searching agents at: ${coords.lat}, ${coords.lng} (accuracy: ${locationAccuracy ? `±${Math.round(locationAccuracy)}m` : 'unknown'})`)

    try {
      // Search with 2km radius
      const response = await fetch(
        `/api/agents/nearby?lat=${coords.lat}&lng=${coords.lng}&maxDistance=2`
      )
      const data = await response.json()

      console.log("📥 Nearby agents response:", {
        success: data.success,
        agentsFound: data.agents?.length || 0,
        totalFound: data.totalFound,
      })

      if (data.success && data.agents) {
        if (data.agents.length === 0) {
          // No agents found - silently continue passive scanning (don't show error, don't stop loading)
          setError("")
          // Keep isLoadingAgents true to show searching state
          // Will continue searching via passive scan interval
        } else {
          // Agents found! Clear any errors and show them
          setError("")
          setIsLoadingAgents(false)
          
          // Map agents to our format
          let mappedAgents = data.agents.map((agent: any) => ({
            id: agent.id,
            name: agent.name,
            phone: agent.phone,
            location: agent.location || agent.lastKnownLocation,
            rating: agent.rating || 5.0,
            totalTransactions: agent.totalTransactions || 0,
            distance: agent.distance || 0,
            distanceFormatted: agent.distanceFormatted || "0m",
          }))
          
          // Enrich with accurate ETAs using Distance Matrix API
          mappedAgents = await enrichAgentsWithETAs(mappedAgents, coords)
          
          setNearbyAgents(mappedAgents)
        }
      } else {
        // API error - but don't show error, just keep searching
        setError("")
        // Keep isLoadingAgents true to continue searching
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error)
      // Don't show error to user - silently retry
      setError("")
      // Keep isLoadingAgents true to continue searching
    }
    // Don't set isLoadingAgents to false in finally - let it stay true until agents found
  }, [locationAccuracy, enrichAgentsWithETAs])

  // Search agents ONLY ONCE when location is locked and accurate
  // No repeated searches - single discovery
  useEffect(() => {
    if (!clientLocationLocked || !userCoordinates || step !== "map" || hasSearchedAgents.current) {
      return
    }

    // Mark as searched to prevent re-searching
    hasSearchedAgents.current = true
    
    // Single agent search with 2km radius
    fetchNearbyAgents(userCoordinates)
  }, [clientLocationLocked, userCoordinates, step, fetchNearbyAgents])

  // Passive scanning: Continuously scan every 3 seconds until agents found (no reloads)
  useEffect(() => {
    if (!clientLocationLocked || !userCoordinates || step !== "map" || nearbyAgents.length > 0) {
      return
    }

    // Keep searching every 3 seconds until agents are found
    const scanInterval = setInterval(() => {
      if (userCoordinates && nearbyAgents.length === 0) {
        console.log("🔄 Passive scan: Searching for agents...")
        fetchNearbyAgents(userCoordinates)
      }
    }, 3000) // Scan every 3 seconds

    return () => clearInterval(scanInterval)
  }, [clientLocationLocked, userCoordinates, step, nearbyAgents.length, fetchNearbyAgents])

  // Real-time distance updates for agents (every 2 seconds, no reload)
  useEffect(() => {
    if (!userCoordinates || nearbyAgents.length === 0 || step !== "map") {
      return
    }

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000 // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c // Distance in meters
    }

    const updateDistances = () => {
      setNearbyAgents(prevAgents => 
        prevAgents.map(agent => {
          if (!agent.location || !userCoordinates) return agent
          
          // Calculate real-time distance using Haversine formula
          const distanceMeters = Math.round(
            calculateDistance(
              userCoordinates.lat,
              userCoordinates.lng,
              agent.location.lat,
              agent.location.lng
            )
          )
          
          return {
            ...agent,
            distance: distanceMeters / 1000, // Convert to km
            distanceFormatted: distanceMeters < 1000 
              ? `${distanceMeters}m away` 
              : `${(distanceMeters / 1000).toFixed(1)}km away`
          }
        })
      )
    }

    // Update immediately
    updateDistances()
    
    // Then update every 2 seconds for real-time feel
    const distanceInterval = setInterval(updateDistances, 2000)

    return () => clearInterval(distanceInterval)
  }, [userCoordinates, step, nearbyAgents.length])

  // Start map selection - wait for accurate GPS before searching
  const startMapSelection = async () => {
    // Prevent multiple simultaneous searches
    if (isSearchingLocation.current) {
      console.log("⏸️ Location search already in progress, ignoring duplicate request")
      return
    }

    isSearchingLocation.current = true
    setIsLoading(true)
    setError("")
    hasSearchedAgents.current = false // Reset search flag
    setClientLocationLocked(false)
    locationPermissionDenied.current = false // Reset permission flag

    try {
      // Wait for accurate location (≤100m) - this will show loading screen
      const coords = await captureLocationWithAccuracyGate()
      
      if (!coords) {
        // Only show permission error if permission was actually denied
        if (locationPermissionDenied.current) {
          setError("Please enable location access to find nearby agents. Check your browser settings.")
        } else {
          setError("Unable to get accurate location. Please try again or move to an area with better GPS signal.")
        }
        setIsLoading(false)
        setIsRefiningLocation(false)
        setIsWaitingForAccuracy(false)
        isSearchingLocation.current = false
        return
      }

      // Set location description
      setLocation(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)

      // Move to map step - agent search will happen automatically via useEffect
      setStep("map")
    } catch (error) {
      console.error("Location capture error:", error)
      // Check if it's a permission error
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes("permission") || errorMessage.includes("denied")) {
        setError("Please enable location access to find nearby agents. Check your browser settings.")
      } else {
        setError("Failed to get your location. Please try again.")
      }
      setIsRefiningLocation(false)
      setIsWaitingForAccuracy(false)
    } finally {
      setIsLoading(false)
      isSearchingLocation.current = false
    }
  }

  // Handle agent selection from map
  const handleAgentSelect = (agent: SelectedAgent) => {
    setSelectedAgent(agent)
    // Scroll to the selected agent card after a short delay to ensure it's rendered
    setTimeout(() => {
      const card = document.getElementById("selected-agent-card")
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  // Create withdrawal request and match with selected agent
  const createRequestWithAgent = async () => {
    if (!selectedAgent || !userCoordinates) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/agent-withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: Number.parseFloat(amount),
          location,
          notes,
          lat: userCoordinates?.lat,
          lng: userCoordinates?.lng,
          agentId: selectedAgent.id, // Pass the selected agent ID
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.existingRequest) {
          throw new Error(
            `${data.error}. Request ID: ${data.existingRequest._id}. Please cancel it first.`
          )
        }
        throw new Error(data.error || "Failed to create request")
      }

      setRequest(data.request)
      
      // Now notify the selected agent (in a real system, this would send a push notification)
      // For now, we'll move to searching and the agent will see it in their dashboard
      setStep("searching")
      setSearchTime(0)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create request")
    } finally {
      setIsLoading(false)
    }
  }

  // Track agent location, distance, and ETA
  const trackAgent = useCallback(async () => {
    if (!request?._id || !userCoordinates) return

    try {
      const response = await fetch(
        `/api/agent-withdrawals/${request._id}/track-agent?userLat=${userCoordinates.lat}&userLng=${userCoordinates.lng}`
      )
      const data = await response.json()

      if (data.success) {
        // Update distance (use straight line distance in meters for accuracy)
        if (data.distance !== null) {
          setAgentDistance(data.distance)
        }
        
        // Update straight-line distance in meters for precise tracking
        if (data.straightLineDistanceMeters !== null && data.straightLineDistanceMeters !== undefined) {
          setStraightLineDistanceMeters(data.straightLineDistanceMeters)
        }
        
        // Update agent accuracy
        if (data.agent?.accuracy !== null && data.agent?.accuracy !== undefined) {
          setAgentAccuracy(data.agent.accuracy)
        }
        
        // Update ETA
        if (data.etaSeconds !== null && data.etaSeconds !== undefined) {
          setEtaSeconds(data.etaSeconds)
        }
        if (data.etaFormatted) {
          setEtaFormatted(data.etaFormatted)
        }
        if (data.routeDistance !== null && data.routeDistance !== undefined) {
          setRouteDistance(data.routeDistance)
        }
        
        // Update agent's real-time location with smoothing for Uber-like movement
        if (data.agent?.location && typeof data.agent.location === 'object' && 
            typeof data.agent.location.lat === 'number' && typeof data.agent.location.lng === 'number') {
          // Apply GPS smoothing to reduce jitter and jumps
          const smoother = agentPositionSmoother.current
          let smoothedLocation = { lat: data.agent.location.lat, lng: data.agent.location.lng }
          
          if (smoother) {
            smoothedLocation = smoother.update(data.agent.location.lat, data.agent.location.lng)
          }
          
          setAgentRealTimeLocation({
            lat: smoothedLocation.lat,
            lng: smoothedLocation.lng,
          })
          
          // Also update the request object with the latest agent location
          if (request?.agent) {
            setRequest(prev => prev ? {
              ...prev,
              agent: {
                ...prev.agent!,
                location: data.agent.location,
              }
            } : null)
          }
        }
      }
    } catch (error) {
      console.error("Failed to track agent:", error)
    }
  }, [request?._id, userCoordinates, request?.agent])

  // Poll for request status updates
  const pollStatus = useCallback(async () => {
    if (!request?._id) {
      console.log("pollStatus: No request ID, skipping poll")
      return
    }

    const requestId = request._id // Capture the ID to avoid stale reference
    const currentStatus = request.status // Capture current status

    try {
      console.log("pollStatus: Polling request", requestId, "current status:", currentStatus)
      const response = await fetch(`/api/agent-withdrawals/${requestId}`)
      const data = await response.json()
      
      console.log("pollStatus: Got response", { 
        success: data.success, 
        status: data.request?.status,
        hasAgent: !!data.request?.agent,
        agentName: data.request?.agent?.name
      })

      if (data.success && data.request) {
        const previousStatus = currentStatus
        setRequest(data.request)

        // Update step based on status
        switch (data.request.status) {
          case "pending":
            setStep("searching")
            break
          case "matched":
            console.log("pollStatus: Agent matched! Updating step to matched")
            setStep("matched")
            // Start tracking agent location
            if (userCoordinates) {
              trackAgent()
            }
            break
          case "in_progress":
            console.log("pollStatus: Agent in progress! Updating step to in_progress")
            setStep("in_progress")
            // Continue tracking
            if (userCoordinates) {
              trackAgent()
            }
            break
          case "completed":
            console.log("pollStatus: Request completed!")
            setStep("completed")
            // Update user balance from response
            if (data.request.user?.balance !== undefined) {
              dispatchBalanceUpdate(user.id, data.request.user.balance)
            } else {
              // If balance not in response, fetch it directly
              fetch(`/api/user/balance?userId=${user.id}`)
                .then((res) => res.json())
                .then((balanceData) => {
                  if (balanceData.success && balanceData.balance !== undefined) {
                    dispatchBalanceUpdate(user.id, balanceData.balance)
                  }
                })
                .catch((err) => console.error("Failed to fetch balance:", err))
            }
            break
          case "cancelled":
          case "expired":
            console.log("pollStatus: Request cancelled/expired")
            setStep("cancelled")
            break
        }
        
        if (previousStatus !== data.request.status) {
          console.log("pollStatus: Status changed from", previousStatus, "to", data.request.status)
        }
      }
    } catch (error) {
      console.error("Failed to poll status:", error)
    }
  }, [request?._id, request?.status, user.id, userCoordinates, trackAgent])

  // Poll every 3 seconds when searching or matched
  useEffect(() => {
    if (!request?._id) return
    if (step === "completed" || step === "cancelled" || step === "amount") return

    // Poll immediately when effect runs (don't wait 3 seconds for first poll)
    pollStatus()
    
    // Then continue polling every 3 seconds
    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [request?._id, step, pollStatus])

  // Track agent location every 2-3 seconds when matched or in progress for smooth real-time updates
  useEffect(() => {
    if (!request?._id || !userCoordinates) return
    if (step !== "matched" && step !== "in_progress") return

    // Initial track
    trackAgent()
    
    // Then track every 2.5 seconds for smooth updates (like Bolt/Uber)
    const interval = setInterval(trackAgent, 2500)
    return () => clearInterval(interval)
  }, [request?._id, step, userCoordinates, trackAgent])

  // Continuously watch client's location during matched/in_progress for <100m accuracy
  useEffect(() => {
    if (step !== "matched" && step !== "in_progress") {
      // Clear watch when not in tracking mode
      if (trackingLocationWatchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(trackingLocationWatchId.current)
        trackingLocationWatchId.current = null
      }
      return
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) return

    // Start watching client's location for precise tracking
    trackingLocationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        
        // Update client location and accuracy
        setUserCoordinates({ lat: latitude, lng: longitude })
        setLocationAccuracy(accuracy)
        
        // Log accuracy for debugging
        if (accuracy <= 100) {
          console.log(`📍 Client location: ±${Math.round(accuracy)}m (excellent)`)
        } else {
          console.log(`📍 Client location: ±${Math.round(accuracy)}m (refining...)`)
        }
      },
      (error) => {
        console.error("Location watch error:", error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000, // Accept positions up to 3 seconds old
        timeout: 10000,
      }
    )

    return () => {
      if (trackingLocationWatchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(trackingLocationWatchId.current)
        trackingLocationWatchId.current = null
      }
    }
  }, [step])

  // Search time counter
  useEffect(() => {
    if (step !== "searching") return

    const interval = setInterval(() => {
      setSearchTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [step])

  // Check for existing active request on mount
  useEffect(() => {
    const checkExistingRequest = async () => {
      if (!user?.id) return

      try {
        const response = await fetch(`/api/agent-withdrawals?userId=${user.id}`)
        const data = await response.json()

        if (data.success && data.requests && data.requests.length > 0) {
          // Find active requests (matched, in_progress)
          const active = data.requests.find(
            (req: any) => ["matched", "in_progress"].includes(req.status)
          )

          if (active) {
            // Set the request
            setRequest(active)
            
            // Set amount and location from the request
            if (active.amount) {
              setAmount(active.amount.toString())
            }
            if (active.location) {
              setLocation(active.location)
            }
            
            let coords: { lat: number; lng: number } | null = null
            if (active.coordinates) {
              coords = {
                lat: active.coordinates.lat,
                lng: active.coordinates.lng,
              }
              setUserCoordinates(coords)
            } else {
              // Get current location if coordinates not available
              coords = await captureLocation()
              if (coords) {
                setUserCoordinates(coords)
              }
            }

            // Set the appropriate step based on status
            if (active.status === "matched") {
              setStep("matched")
            } else if (active.status === "in_progress") {
              setStep("in_progress")
            } else if (active.status === "pending") {
              setStep("searching")
            }
          }
        }
      } catch (error) {
        console.error("Failed to check existing request:", error)
      }
    }

    checkExistingRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Show review modal when transaction completes
  useEffect(() => {
    if (step === "completed" && request?.agentId && !hasReviewed) {
      setShowReviewModal(true)
    }
  }, [step, request?.agentId, hasReviewed])

  // User confirms receipt
  const confirmReceipt = async () => {
    if (!request?._id) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/agent-withdrawals/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user_confirm",
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm")
      }

      // Try to complete the transaction
      const completeResponse = await fetch(`/api/agent-withdrawals/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          userId: user.id,
        }),
      })

      const completeData = await completeResponse.json()

      if (completeData.success) {
        setRequest(completeData.request)
        setStep("completed")
        if (completeData.userBalance !== undefined) {
          dispatchBalanceUpdate(user.id, completeData.userBalance)
        } else {
          // If balance not in response, fetch it directly
          fetch(`/api/user/balance?userId=${user.id}`)
            .then((res) => res.json())
            .then((balanceData) => {
              if (balanceData.success && balanceData.balance !== undefined) {
                dispatchBalanceUpdate(user.id, balanceData.balance)
              }
            })
            .catch((err) => console.error("Failed to fetch balance:", err))
        }
      } else {
        // Just update status, agent hasn't confirmed yet
        await pollStatus()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to confirm")
    } finally {
      setIsLoading(false)
    }
  }

  // Cancel request
  const cancelRequest = async (reason?: string) => {
    if (!request?._id) {
      console.error("Cannot cancel: No request ID")
      setError("Cannot cancel: No active request found")
      return
    }

    console.log("Cancelling request:", request._id, "with reason:", reason || cancelReason)
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/agent-withdrawals/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          userId: user.id,
          cancelReason: reason || cancelReason || "No reason provided",
        }),
      })

      const data = await response.json()
      console.log("Cancel response:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel")
      }

      setShowCancelDialog(false)
      setCancelReason("")
      setStep("cancelled")
      setRequest(null) // Clear the request
    } catch (error) {
      console.error("Cancel request error:", error)
      setError(error instanceof Error ? error.message : "Failed to cancel")
    } finally {
      setIsLoading(false)
    }
  }

  // Amount input step
  if (step === "amount") {
    return (
      <div className="space-y-6 px-4 sm:px-0 pb-6">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h2 className="text-xl sm:text-2xl font-bold">Agent Withdrawal</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Get matched with a nearby agent for instant cash pickup
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Request Details</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Available Balance: <CurrencyFormatter amount={user.balance} className="font-semibold" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6 pb-6">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="10"
                max="100000"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Min: KES 10 | Max: KES 100,000
              </p>
            </div>


            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any specific instructions for the agent"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-base resize-none"
              />
            </div>

            {/* Premium Address Search */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Meeting Location (Optional)
              </Label>
              <PremiumPlacesAutocomplete
                placeholder="Search for a landmark or address..."
                currentLocation={userCoordinates}
                onPlaceSelect={(place) => {
                  if (place.location) {
                    setUserCoordinates(place.location)
                    setLocation(place.description)
                  } else {
                    setLocation(place.description)
                  }
                }}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                💡 Your GPS location will be used. Add a landmark to help agents find you faster.
              </p>
            </div>

            {/* Street View Preview */}
            {userCoordinates && (
              <div className="space-y-2">
                <Label className="text-sm">Location Preview</Label>
                <PremiumStreetView
                  location={userCoordinates}
                  showControls={false}
                  showLocationBadge={true}
                  className="h-40"
                />
              </div>
            )}

            {/* Quick amount buttons */}
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
              {[500, 1000, 2000, 5000, 10000].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(amt.toString())}
                  disabled={amt > user.balance}
                  className="text-xs sm:text-sm"
                >
                  <CurrencyFormatter amount={amt} />
                </Button>
              ))}
            </div>

            <Button
              onClick={startMapSelection}
              disabled={
                isLoading ||
                isSearchingLocation.current ||
                !amount ||
                Number.parseFloat(amount) < 10 ||
                Number.parseFloat(amount) > user.balance
              }
              className="w-full text-base"
              size="lg"
            >
              {isLoading || isSearchingLocation.current ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Find Nearby Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Map selection step - Bolt/Uber style
  if (step === "map") {
    return (
      <div className="space-y-6 px-4 sm:px-0 pb-6">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => setStep("amount")}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h2 className="text-xl sm:text-2xl font-bold">Select an Agent</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Choose an agent near you to collect your KES {amount}
          </p>
        </div>

        {/* Full-Screen Loading: Waiting for GPS Accuracy */}
        {isWaitingForAccuracy && (
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardContent className="py-12 sm:py-16 px-4 sm:px-6">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 animate-spin text-blue-600" />
                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-semibold">Finding nearby agents...</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">Getting a more accurate location</p>
                </div>
                {locationAccuracy !== null && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                      GPS Accuracy
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300">
                      ±{Math.round(locationAccuracy)}m
                    </p>
                    {locationAccuracy > ACCURACY_THRESHOLD && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        Waiting for accuracy ≤ {ACCURACY_THRESHOLD}m...
                      </p>
                    )}
                    {locationAccuracy <= ACCURACY_THRESHOLD && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        ✓ Location locked! Searching for agents...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Map Component - Only show when location is locked */}
        {isWaitingForAccuracy ? null : isLoadingAgents ? (
          <Card>
            <CardContent className="py-8 sm:py-12 px-4 sm:px-6">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  Searching for agents within 2km...
                </p>
              </div>
            </CardContent>
          </Card>
        ) : nearbyAgents.length === 0 ? (
          // Keep showing searching state - don't show "no agents found"
          <Card>
            <CardContent className="py-8 sm:py-12 px-4 sm:px-6">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground font-semibold">
                  Searching for agents...
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Looking for agents within 2km
                </p>
                {locationAccuracy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Location accuracy: ±{Math.round(locationAccuracy)}m
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-3 animate-pulse">
                  Please wait, agents will appear automatically...
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Bolt-style Mapbox Map with agents - smooth vector-based rendering */}
            <BoltMapboxMap
              userLocation={userCoordinates}
              agents={nearbyAgents.map(agent => ({
                id: agent.id,
                name: agent.name,
                phone: agent.phone,
                location: agent.location,
                rating: agent.rating,
                totalTransactions: agent.totalTransactions,
                distance: agent.distance || 0,
                distanceFormatted: agent.distanceFormatted || "0m",
                isAvailable: true,
              }))}
              selectedAgent={selectedAgent ? {
                id: selectedAgent.id,
                name: selectedAgent.name,
                phone: selectedAgent.phone,
                location: selectedAgent.location,
                rating: selectedAgent.rating,
                totalTransactions: selectedAgent.totalTransactions,
                distance: selectedAgent.distance || 0,
                distanceFormatted: selectedAgent.distanceFormatted || "0m",
              } : null}
              onSelectAgent={(agent) => {
                handleAgentSelect({
                  id: agent.id,
                  name: agent.name,
                  phone: agent.phone,
                  location: agent.location,
                  rating: agent.rating,
                  totalTransactions: agent.totalTransactions,
                  distance: agent.distance || 0,
                  distanceFormatted: agent.distanceFormatted || "0m",
                })
              }}
              showRoute={false}
              height="600px"
              className="rounded-2xl overflow-hidden"
            />
            
            {/* Real-time distance updates for agents */}
            {nearbyAgents.length > 0 && userCoordinates && (
              <div className="space-y-2">
                  {nearbyAgents.map((agent) => {
                  // Use distance from agent object (updated in real-time)
                  const realTimeDistance = agent.distance ? Math.round(agent.distance * 1000) : 0
                  
                  // Get ETA info if available
                  const agentWithETA = agent as any
                  const hasETA = agentWithETA.etaFormatted
                  
                  return (
                    <Card
                      key={agent.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        selectedAgent?.id === agent.id
                          ? "border-2 border-green-500 bg-green-50 dark:bg-green-950 shadow-lg shadow-green-500/20"
                          : "hover:border-primary hover:shadow-md"
                      }`}
                      onClick={() => handleAgentSelect(agent)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                {agent.name.charAt(0)}
                              </div>
                              {/* Online indicator */}
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                            </div>
                            <div>
                              <p className="font-semibold text-base">{agent.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                <span className="font-medium">{agent.rating.toFixed(1)}</span>
                                <span className="text-muted-foreground/50">•</span>
                                <span>{agent.totalTransactions} trips</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {/* ETA Badge - Premium feature */}
                            {hasETA ? (
                              <div className="flex flex-col items-end gap-1">
                                <Badge className="bg-primary text-sm font-bold px-2.5 py-1">
                                  <Clock className="h-3.5 w-3.5 mr-1" />
                                  {agentWithETA.etaFormatted}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {agentWithETA.drivingDistanceFormatted || `${realTimeDistance < 1000 ? `${realTimeDistance}m` : `${(realTimeDistance / 1000).toFixed(1)}km`}`}
                                </span>
                              </div>
                            ) : (
                              <Badge className="text-sm font-semibold">
                                {realTimeDistance < 1000 ? `${realTimeDistance}m away` : `${(realTimeDistance / 1000).toFixed(1)}km away`}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Selected Agent Confirmation */}
        {selectedAgent && (
          <Card 
            id="selected-agent-card"
            className="border-green-500 bg-green-50 dark:bg-green-950 mt-6 relative z-10 scroll-mt-4"
          >
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
              {/* Close button */}
              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAgent(null)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg truncate">{selectedAgent.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                      <span>{selectedAgent.rating}</span>
                      <span>•</span>
                      <span>{selectedAgent.totalTransactions} {selectedAgent.totalTransactions === 1 ? "transaction" : "transactions"}</span>
                    </div>
                  </div>
                </div>
                <Badge className="bg-primary text-sm sm:text-lg px-2 sm:px-3 py-1 self-start sm:self-auto">
                  {selectedAgent.distanceFormatted}
                </Badge>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm">
                  <span>Withdrawal Amount</span>
                  <span className="font-bold">
                    <CurrencyFormatter amount={Number.parseFloat(amount)} />
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm">
                  <span>Your Location</span>
                  <span className="break-words">{location}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={createRequestWithAgent}
                  disabled={isLoading}
                  className="w-full bg-green-500 hover:bg-green-600 text-base"
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Request This Agent
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedAgent(null)}
                  className="w-full text-base"
                  size="lg"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    )
  }

  // Searching for agents
  if (step === "searching") {
    const formatCoordinates = () => {
      if (userCoordinates) {
        return `${userCoordinates.lat.toFixed(4)}, ${userCoordinates.lng.toFixed(4)}`
      }
      return location || "Getting location..."
    }

    return (
      <div className="space-y-6 px-4 sm:px-0 pb-6">
        <Card className="border-2">
          <CardContent className="pt-8 sm:pt-12 pb-8 sm:pb-12 px-4 sm:px-6">
            <div className="text-center space-y-6 sm:space-y-8">
              {/* Connection Animation - User and Agent trying to connect */}
              <div className="relative mx-auto w-full max-w-lg h-48 sm:h-56 flex items-center justify-center overflow-hidden">
                {/* User Avatar (Left) */}
                <div className="absolute left-2 sm:left-4 md:left-8 flex flex-col items-center space-y-2 z-10">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-blue-500 border-2 sm:border-4 border-white shadow-xl flex items-center justify-center">
                      <User className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-white" />
                    </div>
                    {/* Pulsing ring around user */}
                    <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-blue-400 animate-ping opacity-75"></div>
                    <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-foreground">You</span>
                </div>

                {/* Connection Lines and Animation */}
                <div className="absolute inset-0 flex items-center justify-center overflow-visible">
                  <div className="relative w-full max-w-md h-1 sm:h-2">
                    {/* Base connecting line */}
                    <div className="absolute left-16 sm:left-20 md:left-24 right-16 sm:right-20 md:right-24 h-0.5 sm:h-1 bg-gradient-to-r from-blue-500/20 via-orange-500/30 to-orange-500/20 rounded-full"></div>
                    
                    {/* Animated connection waves */}
                    <div className="absolute left-16 sm:left-20 md:left-24 right-16 sm:right-20 md:right-24 h-0.5 sm:h-1 bg-gradient-to-r from-blue-500 via-orange-500 to-orange-500 rounded-full opacity-60 animate-pulse"></div>
                    
                    {/* Moving connection particles */}
                    <div 
                      className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-orange-500 rounded-full shadow-lg animate-move-connection"
                      style={{ left: '16px', top: '-4px' }}
                    ></div>
                    <div 
                      className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded-full shadow-lg animate-move-connection-reverse"
                      style={{ right: '16px', top: '-4px' }}
                    ></div>
                    
                    {/* Additional smaller particles */}
                    <div 
                      className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-400 rounded-full animate-move-connection opacity-70"
                      style={{ left: '16px', top: '1px', animationDelay: '0.5s' }}
                    ></div>
                    <div 
                      className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-move-connection-reverse opacity-70"
                      style={{ right: '16px', top: '1px', animationDelay: '0.5s' }}
                    ></div>
                  </div>
                </div>

                {/* Agent Avatar (Right) */}
                <div className="absolute right-2 sm:right-4 md:right-8 flex flex-col items-center space-y-2 z-10">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-orange-500 border-2 sm:border-4 border-white shadow-xl flex items-center justify-center">
                      <User className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-white" />
                    </div>
                    {/* Pulsing ring around agent */}
                    <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-orange-400 animate-ping opacity-75"></div>
                    <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-foreground">Agent</span>
                </div>
              </div>

              {/* Title and Description */}
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold">Connecting with Agent</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Waiting for an agent to accept your withdrawal request...
                </p>
              </div>

              {/* Request Details */}
              <div className="bg-muted/50 rounded-lg p-4 sm:p-5 space-y-2.5 sm:space-y-3 border">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 items-start sm:items-center text-xs sm:text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold text-sm sm:text-base">
                    <CurrencyFormatter amount={Number.parseFloat(amount)} />
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 items-start sm:items-center text-xs sm:text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-mono text-xs break-all">{formatCoordinates()}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 items-start sm:items-center text-xs sm:text-sm">
                  <span className="text-muted-foreground">Search Time</span>
                  <span className="font-semibold text-sm sm:text-base">
                    {Math.floor(searchTime / 60)}:{(searchTime % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              </div>

              {/* Info Message */}
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed px-2">
                Your request has been sent to nearby agents. You'll be matched once an agent accepts your request.
              </p>

              {/* Error Display */}
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Cancel Button */}
              <Button 
                variant="destructive" 
                onClick={() => setShowCancelDialog(true)} 
                disabled={isLoading}
                className="mt-4 w-full sm:w-auto"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Cancel Request
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Cancel Withdrawal Request</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Are you sure you want to cancel this withdrawal request? Please provide a reason for cancellation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason" className="text-sm">Reason for Cancellation *</Label>
                <Textarea
                  id="cancelReason"
                  placeholder="e.g., Taking too long, Changed my mind, Found another agent..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  required
                  className="text-base resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This helps us improve our service
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setCancelReason("")
                }}
                disabled={isLoading}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Keep Request
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelRequest()}
                disabled={isLoading || !cancelReason.trim()}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Agent matched
  if (step === "matched" || step === "in_progress") {
    return (
      <div className="space-y-6 -mx-4 sm:mx-0 pb-6">
        <Card className="border-green-500 rounded-none sm:rounded-lg">
          <CardHeader className="bg-green-50 dark:bg-green-950 rounded-none sm:rounded-t-lg px-4 sm:px-6">
            <div className="flex items-center gap-2">
              {step === "matched" ? (
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 animate-pulse" />
              ) : (
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              )}
              <CardTitle className={`text-base sm:text-lg ${step === "matched" ? "text-orange-700 dark:text-orange-300" : "text-green-700 dark:text-green-300"}`}>
                {step === "matched" ? "Waiting for Agent Confirmation" : "Agent On The Way"}
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {step === "matched"
                ? "The agent has been notified. Waiting for them to confirm and start heading to your location."
                : "The agent is heading to your location"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 px-4 sm:px-6 pb-6">
            {/* Agent details */}
            {request?.agent && (
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base sm:text-lg truncate">{request.agent.name}</h4>
                    <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                      <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                      <span>{request.agent.rating || "4.5"}</span>
                    </div>
                    {request.agent.location && (
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{typeof request.agent.location === 'string' ? request.agent.location : 'Location available'}</span>
                      </div>
                    )}
                    {agentDistance !== null && (
                      <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary">
                        <Navigation className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span>
                          {agentDistance < 1 
                            ? `${Math.round(agentDistance * 1000)}m away`
                            : `${agentDistance.toFixed(1)}km away`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full text-sm sm:text-base h-11 sm:h-12 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-950 border-green-300 dark:border-green-700 font-semibold" asChild>
                    <a href={`tel:${request.agent.phone}`}>
                      <Phone className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="truncate">Call Agent</span>
                    </a>
                  </Button>
                  {agentRealTimeLocation && (
                    <Button
                      variant="outline"
                      className="w-full text-sm sm:text-base h-11 sm:h-12 bg-blue-500 hover:bg-blue-600 text-white border-blue-500 font-semibold"
                      onClick={() => {
                        // Open Google Maps with agent's location
                        const url = `https://www.google.com/maps/search/?api=1&query=${agentRealTimeLocation.lat},${agentRealTimeLocation.lng}`
                        window.open(url, "_blank")
                      }}
                    >
                      <Navigation className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="truncate">View in Maps</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Google Maps with Route Visualization - Hide when either party has confirmed arrival */}
            {userCoordinates && !request?.agentConfirmed && !request?.userConfirmed && (
              <Card className="border-2 border-primary/20 rounded-none sm:rounded-lg -mx-4 sm:mx-0">
                <CardHeader className="pb-3 px-4 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <CardTitle className="text-base sm:text-lg">Live Map</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {agentRealTimeLocation && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Open Google Maps with agent's location
                            const url = `https://www.google.com/maps/search/?api=1&query=${agentRealTimeLocation.lat},${agentRealTimeLocation.lng}`
                            window.open(url, "_blank")
                          }}
                          className="text-xs h-9 bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                        >
                          <Navigation className="h-3.5 w-3.5 mr-1.5" />
                          Open Maps
                        </Button>
                      )}
                      <Button
                        variant={showMeetingPoint ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowMeetingPoint(!showMeetingPoint)}
                        className="text-xs h-9"
                      >
                        <MapPin className="h-3.5 w-3.5 mr-1.5" />
                        {showMeetingPoint ? "Hide" : "Show"} Meeting Point
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    {step === "matched" 
                      ? "Track the agent as they head to your location"
                      : "Real-time view of agent location and route"}
                  </CardDescription>
                  {/* Live ETA, Distance, and Accuracy Display */}
                  {(step === "matched" || step === "in_progress") && (
                    <div className="mt-3 space-y-2">
                      {/* Main stats row */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                        {etaFormatted && (
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-bold text-blue-700 dark:text-blue-300 text-sm sm:text-base">{etaFormatted}</span>
                          </div>
                        )}
                        {straightLineDistanceMeters !== null && (
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
                            <Navigation className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-bold text-green-700 dark:text-green-300 text-sm sm:text-base">
                              {straightLineDistanceMeters < 1000 
                                ? `${straightLineDistanceMeters}m` 
                                : `${(straightLineDistanceMeters / 1000).toFixed(1)}km`}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Accuracy indicators */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Client accuracy */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                          locationAccuracy !== null && locationAccuracy <= 100 
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            locationAccuracy !== null && locationAccuracy <= 100 
                              ? 'bg-green-500 animate-pulse' 
                              : 'bg-yellow-500'
                          }`} />
                          <span className="font-medium">You: ±{locationAccuracy ? Math.round(locationAccuracy) : '...'}m</span>
                        </div>
                        
                        {/* Agent accuracy */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                          agentAccuracy !== null && agentAccuracy <= 100 
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            agentAccuracy !== null && agentAccuracy <= 100 
                              ? 'bg-green-500 animate-pulse' 
                              : 'bg-yellow-500'
                          }`} />
                          <span className="font-medium">Agent: ±{agentAccuracy ? Math.round(agentAccuracy) : '...'}m</span>
                        </div>
                        
                        {/* Both accurate indicator */}
                        {locationAccuracy !== null && locationAccuracy <= 100 && 
                         agentAccuracy !== null && agentAccuracy <= 100 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                            <Shield className="h-3 w-3" />
                            <span className="font-medium">Precise</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {/* Bolt-style Mapbox Map for real-time agent tracking */}
                  <BoltMapboxMap
                    userLocation={userCoordinates}
                    agents={request?.agent ? [{
                      id: request.agent.id,
                      name: request.agent.name,
                      phone: request.agent.phone,
                      location: agentRealTimeLocation || 
                               (request.agent.location && typeof request.agent.location === 'object' 
                                ? request.agent.location 
                                : userCoordinates),
                      rating: request.agent.rating || 5.0,
                      totalTransactions: 0,
                      distance: agentDistance || 0,
                      distanceFormatted: agentDistance !== null 
                        ? (agentDistance < 1 
                            ? `${Math.round(agentDistance * 1000)}m` 
                            : `${agentDistance.toFixed(1)}km`)
                        : "Calculating...",
                      isAvailable: true,
                    }] : []}
                    selectedAgent={request?.agent ? {
                      id: request.agent.id,
                      name: request.agent.name,
                      phone: request.agent.phone,
                      location: agentRealTimeLocation || 
                               (request.agent.location && typeof request.agent.location === 'object' 
                                ? request.agent.location 
                                : userCoordinates),
                      rating: request.agent.rating || 5.0,
                      totalTransactions: 0,
                      distance: agentDistance || 0,
                      distanceFormatted: agentDistance !== null 
                        ? (agentDistance < 1 
                            ? `${Math.round(agentDistance * 1000)}m` 
                            : `${agentDistance.toFixed(1)}km`)
                        : "Calculating...",
                    } : null}
                    onSelectAgent={() => {}}
                    showRoute={step === "in_progress"}
                    agentLocation={
                      (step === "matched" || step === "in_progress") && agentRealTimeLocation
                        ? agentRealTimeLocation
                        : (request?.agent?.location && typeof request.agent.location === 'object'
                          ? request.agent.location
                          : null)
                    }
                    etaSeconds={etaSeconds}
                    etaFormatted={etaFormatted}
                    requestStatus={step}
                    height="600px"
                  />
                </CardContent>
              </Card>
            )}

            {/* Arrival Confirmation Message - Show when map is hidden */}
            {(request?.agentConfirmed || request?.userConfirmed) && (
              <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 rounded-none sm:rounded-lg -mx-4 sm:mx-0">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base sm:text-lg text-green-800 dark:text-green-200 mb-1">
                        {request?.agentConfirmed && request?.userConfirmed
                          ? "Both Parties Confirmed - Transaction Complete!"
                          : request?.agentConfirmed
                          ? "Agent Has Arrived"
                          : "You've Confirmed Receipt"}
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {request?.agentConfirmed && request?.userConfirmed
                          ? "The transaction will be completed automatically. Map navigation is no longer needed."
                          : request?.agentConfirmed
                          ? "The agent has confirmed arrival. Please confirm when you receive the cash."
                          : "You've confirmed receiving the cash. Waiting for agent confirmation."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Request details */}
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  <CurrencyFormatter amount={request?.amount || 0} />
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-muted-foreground">Your Location</span>
                <span className="break-words">{request?.location}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 items-start sm:items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge className={step === "in_progress" ? "bg-orange-500" : "bg-green-500"}>
                  {step === "matched" ? "Agent Accepted" : "Agent Arrived"}
                </Badge>
              </div>
            </div>

            {/* Confirmation Status */}
            {step === "in_progress" && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200">
                <p className="text-xs sm:text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
                  Confirmation Status:
                </p>
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm">Agent Confirmed:</span>
                    <Badge
                      variant={request?.agentConfirmed ? "default" : "secondary"}
                      className={`text-xs ${request?.agentConfirmed ? "bg-green-500" : ""}`}
                    >
                      {request?.agentConfirmed ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {request?.agentConfirmed ? "Confirmed" : "Waiting"}
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm">You Confirmed:</span>
                    <Badge
                      variant={request?.userConfirmed ? "default" : "secondary"}
                      className={`text-xs ${request?.userConfirmed ? "bg-green-500" : ""}`}
                    >
                      {request?.userConfirmed ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {request?.userConfirmed ? "Confirmed" : "Pending"}
                    </Badge>
                  </div>
                  {request?.agentConfirmed && request?.userConfirmed && (
                    <Alert className="mt-2 border-green-500 bg-green-50 dark:bg-green-950 text-xs sm:text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200 text-xs sm:text-sm">
                        Both parties confirmed! Transaction will complete automatically.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <Alert className="text-xs sm:text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                {step === "matched" ? (
                  <>
                    Wait for the agent to arrive at your location. You can call them to coordinate.
                  </>
                ) : (
                  <>
                    The agent should be with you now. Once you receive the cash, tap "I've Received Cash" below.
                    {request?.agentConfirmed && !request?.userConfirmed && (
                      <span className="block mt-2 font-semibold text-orange-600 text-xs sm:text-sm">
                        ⚠️ Agent has confirmed giving cash. Please confirm if you received it.
                      </span>
                    )}
                  </>
                )}
              </AlertDescription>
            </Alert>

            {/* Action buttons */}
            {step === "in_progress" && (
              <>
                {!request?.userConfirmed ? (
                  <Button
                    onClick={confirmReceipt}
                    disabled={isLoading}
                    className="w-full bg-green-500 hover:bg-green-600 text-base font-semibold h-12 sm:h-14"
                    size="lg"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-5 w-5 mr-2" />
                    )}
                    I've Received Cash
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="w-full bg-green-500 text-base font-semibold h-12 sm:h-14"
                    size="lg"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    You Confirmed
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isLoading || (request?.agentConfirmed && request?.userConfirmed)}
                  className="w-full h-11 sm:h-12 font-semibold"
                  size="lg"
                >
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Refuse / Cancel
                </Button>
              </>
            )}

            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              disabled={isLoading}
              className="w-full h-11 sm:h-12 font-semibold"
              size="lg"
            >
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Cancel Request
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Cancel Withdrawal Request</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Are you sure you want to cancel this withdrawal request? Please provide a reason for cancellation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason" className="text-sm">Reason for Cancellation *</Label>
                <Textarea
                  id="cancelReason"
                  placeholder="e.g., Agent taking too long, Changed my mind, Found another agent..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  required
                  className="text-base resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This helps us improve our service
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setCancelReason("")
                }}
                disabled={isLoading}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Keep Request
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelRequest()}
                disabled={isLoading || !cancelReason.trim()}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Completed
  if (step === "completed") {
    return (
      <div className="space-y-6 px-4 sm:px-0 pb-6">
        <Card className="border-green-500">
          <CardContent className="pt-6 sm:pt-8 pb-6 sm:pb-8 px-4 sm:px-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-500" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-green-600">Withdrawal Complete!</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  You've successfully withdrawn cash from your wallet
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-2 text-left">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-xs sm:text-sm text-muted-foreground">Amount Withdrawn</span>
                  <span className="text-sm sm:text-base font-bold">
                    <CurrencyFormatter amount={request?.amount || 0} />
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-xs sm:text-sm text-muted-foreground">Agent</span>
                  <span className="text-xs sm:text-sm break-words">{request?.agent?.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-xs sm:text-sm text-muted-foreground">Completed</span>
                  <span className="text-xs sm:text-sm break-words">{new Date().toLocaleString()}</span>
                </div>
              </div>

              <Button onClick={onComplete} className="w-full text-base" size="lg">
                Done
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review Modal */}
        {request?.agentId && request?.agent && !hasReviewed && (
          <AgentReviewModal
            open={showReviewModal}
            onClose={() => {
              setShowReviewModal(false)
            }}
            agentId={request.agentId}
            agentName={request.agent.name}
            userId={user.id}
            transactionId={request._id}
            onReviewSubmitted={() => {
              setHasReviewed(true)
              setShowReviewModal(false)
            }}
          />
        )}
      </div>
    )
  }

  // Cancelled
  if (step === "cancelled") {
    return (
      <div className="space-y-6 px-4 sm:px-0 pb-6">
        <Card>
          <CardContent className="pt-6 sm:pt-8 pb-6 sm:pb-8 px-4 sm:px-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-500" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold">Request Cancelled</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Your withdrawal request has been cancelled
                </p>
              </div>

              <Button onClick={onCancel} className="w-full text-base">
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}


