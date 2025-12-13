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
  ExternalLink,
  Footprints,
} from "lucide-react"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { dispatchBalanceUpdate } from "@/lib/balance-updater"
import { getCurrentLocation } from "@/lib/location-utils"
import { AgentReviewModal } from "@/components/agent-review-modal"

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

type Step = "amount" | "searching" | "matched" | "in_progress" | "completed" | "cancelled"
type MeetingType = "client_goes" | "agent_comes"

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
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [meetingType, setMeetingType] = useState<MeetingType | null>(null)
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

  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationStatus, setLocationStatus] = useState<string>("")
  const [straightLineDistanceMeters, setStraightLineDistanceMeters] = useState<number | null>(null)
  const hasSearchedAgents = useRef(false)
  const locationWatchId = useRef<number | null>(null)

  const TARGET_ACCURACY = 50 // Target 50m, but accept up to 100m
  const MAX_ACCEPTABLE_ACCURACY = 100 // Maximum acceptable accuracy

  // Open Google Maps with directions
  const openInMaps = useCallback((destination: { lat: number; lng: number }, label?: string) => {
    const destLabel = label || "Agent Location"
    // Try Google Maps first, fallback to generic geo URL
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&destination_place_id=&travelmode=driving`
    window.open(googleMapsUrl, '_blank')
  }, [])

  // Calculate straight-line distance
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3 // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }, [])

  // Format distance for display
  const formatDistance = useCallback((meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }, [])

  // GOLD STANDARD FLOW: Request permission first, then Google Geolocation API
  // Step 1: Request browser permission (unlocks sensors)
  // Step 2: Call Google Geolocation API (10-30m accuracy, <1 second)
  // Step 3: Verify accuracy before placing pin
  const getLocationWithAccuracy = useCallback(async (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    // Check if geolocation is available
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by your browser")
      return null
    }

    setIsGettingLocation(true)
    setLocationStatus("Requesting location permission...")
    const TARGET_ACCURACY = 50 // Lock at ≤50m accuracy

    try {
      // STEP 1: Request browser permission (MANDATORY - unlocks sensors)
      // This must be done first to unlock GPS sensors
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            // Permission granted - sensors unlocked
            resolve()
          },
          (error) => {
            // Permission denied or error
            let errorMessage = ""
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = "Location permission denied. Please enable location in your browser settings and set Location Mode to 'High Accuracy'."
                break
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Location unavailable. Please check your GPS/WiFi settings and enable High Accuracy mode."
                break
              case error.TIMEOUT:
                errorMessage = "Location request timed out. Please ensure High Accuracy mode is enabled."
                break
              default:
                errorMessage = "Could not get location. Please ensure location services are enabled."
            }
            reject(new Error(errorMessage))
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
          }
        )
      })

      // Permission granted - now try Google Geolocation API
      setLocationStatus("Getting precise location...")

      // STEP 2: Call Google Geolocation API (THE MAGIC - 10-30m accuracy, <1 second)
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (apiKey) {
        try {
          const response = await fetch(
            `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                considerIp: true // Use IP as fallback
              })
            }
          )

          if (response.ok) {
            const data = await response.json()
            
            if (data.location && data.accuracy) {
              const location = {
                lat: data.location.lat,
                lng: data.location.lng,
                accuracy: data.accuracy
              }

              // STEP 3: Verify accuracy before placing pin
              if (location.accuracy <= TARGET_ACCURACY) {
                setLocationAccuracy(location.accuracy)
                setUserCoordinates({ lat: location.lat, lng: location.lng })
                setIsGettingLocation(false)
                setLocationStatus("Location found! ✓ Excellent (±" + Math.round(location.accuracy) + "m)")
                return location
              } else {
                // Google API gave location but accuracy not perfect - use it but note it
                setLocationAccuracy(location.accuracy)
                setUserCoordinates({ lat: location.lat, lng: location.lng })
                setIsGettingLocation(false)
                setLocationStatus("Location found! (±" + Math.round(location.accuracy) + "m)")
                return location
              }
            }
          }
        } catch (error) {
          console.log("Google Geolocation API not available, using browser GPS fallback")
          // Fall through to browser GPS fallback
        }
      }

      // FALLBACK: Use watchPosition if Google API fails or not available
      // First reading = rough, second/third = GPS lock
      setLocationStatus("Refining location with GPS...")
      
      return new Promise((resolve) => {
        let watchId: number | null = null
        let bestLocation: { lat: number; lng: number; accuracy: number } | null = null
        let resolved = false

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords
            const location = { lat: latitude, lng: longitude, accuracy: accuracy || 100 }
            
            // Update UI
            setLocationAccuracy(accuracy)
            setUserCoordinates({ lat: latitude, lng: longitude })
            
            // Track best location
            if (!bestLocation || accuracy < bestLocation.accuracy) {
              bestLocation = location
            }

            // Update status
            if (accuracy <= 20) {
              setLocationStatus("Location found! ✓ Excellent (±" + Math.round(accuracy) + "m)")
            } else if (accuracy <= TARGET_ACCURACY) {
              setLocationStatus("Location found! ✓ Very Good (±" + Math.round(accuracy) + "m)")
            } else if (accuracy <= 100) {
              setLocationStatus("Refining location... ±" + Math.round(accuracy) + "m (GPS locking...)")
            } else {
              setLocationStatus("Getting better location... ±" + Math.round(accuracy) + "m")
            }

            // Lock accuracy: Stop only when accuracy is good (≤50m)
            if (accuracy <= TARGET_ACCURACY && !resolved) {
              resolved = true
              setIsGettingLocation(false)
              setLocationStatus("Location found! ✓ Excellent (±" + Math.round(accuracy) + "m)")
              
              // Stop GPS tracking once accuracy is sufficient
              if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId)
              }
              
              resolve(location)
            }
          },
          (error) => {
            if (resolved) return
            
            // If we have a location, use it
            if (bestLocation) {
              resolved = true
              setIsGettingLocation(false)
              setLocationStatus("Location found! (±" + Math.round(bestLocation.accuracy) + "m)")
              if (watchId !== null) navigator.geolocation.clearWatch(watchId)
              resolve(bestLocation)
              return
            }
            
            // No location - show error
            let errorMessage = ""
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = "Location permission denied. Please enable location in your browser settings."
                break
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Location unavailable. Please check your GPS/WiFi settings."
                break
              case error.TIMEOUT:
                // Timeout - use best location if we have one
                if (bestLocation) {
                  resolved = true
                  setIsGettingLocation(false)
                  setLocationStatus("Location found! (±" + Math.round(bestLocation.accuracy) + "m)")
                  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
                  resolve(bestLocation)
                  return
                }
                errorMessage = "Location request timed out. Please ensure High Accuracy mode is enabled."
                break
              default:
                errorMessage = "Could not get location. Please ensure location services are enabled."
            }
            
            resolved = true
            setIsGettingLocation(false)
            setError(errorMessage)
            if (watchId !== null) navigator.geolocation.clearWatch(watchId)
            resolve(null)
          },
          {
            enableHighAccuracy: true, // Use GPS, not just network
            timeout: 30000, // Long timeout
            maximumAge: 0 // Always get fresh location
          }
        )

        // Maximum wait time - accept best location we have
        setTimeout(() => {
          if (resolved) return
          
          if (bestLocation) {
            resolved = true
            setIsGettingLocation(false)
            setLocationStatus("Location found! (±" + Math.round(bestLocation.accuracy) + "m)")
            if (watchId !== null) navigator.geolocation.clearWatch(watchId)
            resolve(bestLocation)
          } else {
            // No location after max time
            resolved = true
            setIsGettingLocation(false)
            setError("Could not get location. Please ensure Location Mode is set to 'High Accuracy' in your device settings.")
            if (watchId !== null) navigator.geolocation.clearWatch(watchId)
            resolve(null)
          }
        }, 30000) // 30 second max wait
      })

    } catch (error) {
      setIsGettingLocation(false)
      const errorMessage = error instanceof Error ? error.message : "Could not get location. Please ensure location services are enabled."
      setError(errorMessage)
      return null
    }
  }, [])

  // Search for nearby agents
  const searchNearbyAgents = useCallback(async (coords: { lat: number; lng: number }) => {
    if (hasSearchedAgents.current) return
    hasSearchedAgents.current = true
    setIsLoadingAgents(true)

    try {
      const response = await fetch(`/api/agents/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=5000`)
      if (!response.ok) throw new Error("Failed to fetch agents")
      
      const data = await response.json()
      if (data.agents && data.agents.length > 0) {
        setNearbyAgents(data.agents)
      } else {
        setError("No agents available nearby. Please try again later.")
      }
    } catch (error) {
      console.error("Failed to fetch nearby agents:", error)
      setError("Failed to find agents. Please try again.")
    } finally {
      setIsLoadingAgents(false)
    }
  }, [])

  // Handle amount submission and find agents
  const handleSubmit = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      setError("Please enter a valid amount")
      return
    }
    if (!meetingType) {
      setError("Please select how you want to meet")
      return
    }

    const amountNum = parseFloat(amount)
    if (amountNum < 10) {
      setError("Minimum amount is KES 10")
      return
    }
    if (amountNum > 100000) {
      setError("Maximum amount is KES 100,000")
      return
    }
    if (amountNum > user.balance) {
      setError("Insufficient balance")
      return
    }

    setError("")
    setIsLoading(true)
    setLocationStatus("")

    try {
      // Get location with accuracy gate
      const location = await getLocationWithAccuracy()
      if (!location) {
        // Error message already set by getLocationWithAccuracy
        setIsLoading(false)
        setIsGettingLocation(false)
        return
      }

      setUserCoordinates({ lat: location.lat, lng: location.lng })
      setLocation(`${location.lat.toFixed(6)},${location.lng.toFixed(6)}`)
      setLocationStatus("Location found! Searching agents...")

      // Immediately search for agents
      await searchNearbyAgents({ lat: location.lat, lng: location.lng })
      
      setIsLoading(false)
      setIsGettingLocation(false)
      setLocationStatus("")
      setStep("searching")
    } catch (error) {
      console.error("Error:", error)
      setError("Something went wrong. Please try again.")
      setIsLoading(false)
      setIsGettingLocation(false)
      setLocationStatus("")
    }
  }

  // Select an agent and create request
  const handleSelectAgent = async (agent: SelectedAgent) => {
    setSelectedAgent(agent)
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          location: location,
          notes: notes || undefined,
          agentId: agent.id,
          meetingType: meetingType,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create request")
      }

      const data = await response.json()
      setRequest(data.request)
      setStep("matched")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create request")
    } finally {
      setIsLoading(false)
    }
  }

  // Track agent location
  const trackAgent = useCallback(async () => {
    if (!request?._id || !userCoordinates) return

    try {
      const response = await fetch(`/api/agents/track?requestId=${request._id}&lat=${userCoordinates.lat}&lng=${userCoordinates.lng}`)
      if (!response.ok) return

      const data = await response.json()
      if (data.agentLocation) {
        setAgentRealTimeLocation(data.agentLocation)
        
        // Calculate distance
        const dist = calculateDistance(
          userCoordinates.lat, userCoordinates.lng,
          data.agentLocation.lat, data.agentLocation.lng
        )
        setStraightLineDistanceMeters(dist)
        setAgentDistance(dist)
      }
    } catch (error) {
      console.error("Failed to track agent:", error)
    }
  }, [request?._id, userCoordinates, calculateDistance])

  // Poll for status updates
  const pollStatus = useCallback(async () => {
    if (!request?._id) return

    try {
      const response = await fetch(`/api/withdrawals/status?id=${request._id}`)
      if (!response.ok) return

      const data = await response.json()
      if (data.request) {
        setRequest(data.request)

        switch (data.request.status) {
          case "matched":
            setStep("matched")
            break
          case "in_progress":
            setStep("in_progress")
            break
          case "completed":
            setStep("completed")
            break
          case "cancelled":
            setStep("cancelled")
            break
        }
      }
    } catch (error) {
      console.error("Failed to poll status:", error)
    }
  }, [request?._id])

  // Confirm transaction completion
  const confirmTransaction = async () => {
    if (!request?._id) return
    setIsLoading(true)

    try {
      const response = await fetch("/api/withdrawals/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request._id,
          confirmedBy: "user",
        }),
      })

      if (!response.ok) throw new Error("Failed to confirm")

      const data = await response.json()
      if (data.request.status === "completed") {
        setStep("completed")
        dispatchBalanceUpdate()
        setShowReviewModal(true)
      }
    } catch (error) {
      setError("Failed to confirm. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Cancel request
  const cancelRequest = async () => {
    if (!request?._id) {
      setStep("amount")
      setShowCancelDialog(false)
      return
    }

    setIsLoading(true)
    try {
      await fetch("/api/withdrawals/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request._id,
          cancelledBy: "user",
          reason: cancelReason || "User cancelled",
        }),
      })
      setStep("cancelled")
    } catch (error) {
      setError("Failed to cancel")
    } finally {
      setIsLoading(false)
      setShowCancelDialog(false)
    }
  }

  // Poll status when matched or in_progress
  useEffect(() => {
    if (!request?._id) return
    if (step !== "matched" && step !== "in_progress") return

    pollStatus()
    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [request?._id, step, pollStatus])

  // Track agent location
  useEffect(() => {
    if (!request?._id || !userCoordinates) return
    if (step !== "matched" && step !== "in_progress") return

    trackAgent()
    const interval = setInterval(trackAgent, 3000)
    return () => clearInterval(interval)
  }, [request?._id, step, userCoordinates, trackAgent])

  // Update user location continuously
  useEffect(() => {
    if (step !== "matched" && step !== "in_progress") {
      if (locationWatchId.current !== null) {
        navigator.geolocation?.clearWatch(locationWatchId.current)
        locationWatchId.current = null
      }
      return
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) return

    locationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationAccuracy(position.coords.accuracy)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    return () => {
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current)
        locationWatchId.current = null
      }
    }
  }, [step])

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
            Get matched with a nearby agent for instant cash
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Request Details</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Balance: <CurrencyFormatter amount={user.balance} className="font-semibold" />
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

            <div className="space-y-3">
              <Label className="text-sm">How do you want to meet?</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={meetingType === "client_goes" ? "default" : "outline"}
                  onClick={() => setMeetingType("client_goes")}
                  className="h-auto py-4 flex flex-col gap-2"
                >
                  <Footprints className="h-6 w-6" />
                  <span className="text-xs font-medium">I'll go to agent</span>
                </Button>
                <Button
                  type="button"
                  variant={meetingType === "agent_comes" ? "default" : "outline"}
                  onClick={() => setMeetingType("agent_comes")}
                  className="h-auto py-4 flex flex-col gap-2"
                >
                  <Car className="h-6 w-6" />
                  <span className="text-xs font-medium">Agent comes to me</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isLoading || !amount || !meetingType}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isGettingLocation ? (locationStatus || "Getting your location...") : "Finding agents..."}
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  Find Nearby Agents
                </>
              )}
            </Button>

            {isLoading && (
              <div className="space-y-1">
                {locationStatus && (
                  <p className="text-xs text-center text-primary font-medium">
                    {locationStatus}
                  </p>
                )}
                {locationAccuracy !== null && (
                  <p className="text-xs text-center text-muted-foreground">
                    📍 Accuracy: ±{Math.round(locationAccuracy)}m
                    {locationAccuracy <= 50 && " ✓ Excellent"}
                    {locationAccuracy > 50 && locationAccuracy <= 100 && " ✓ Good"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Searching/selecting agent step
  if (step === "searching") {
    return (
      <div className="space-y-6 px-4 sm:px-0 pb-6">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => {
              setStep("amount")
              hasSearchedAgents.current = false
            }}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h2 className="text-xl font-bold">Select an Agent</h2>
          <p className="text-sm text-muted-foreground">
            {meetingType === "client_goes" 
              ? "Choose an agent to go to" 
              : "Choose an agent to come to you"}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoadingAgents ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">Finding nearby agents...</p>
            </CardContent>
          </Card>
        ) : nearbyAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium">No agents available</p>
              <p className="text-sm text-muted-foreground mt-1">Please try again later</p>
              <Button
                onClick={() => {
                  hasSearchedAgents.current = false
                  setStep("amount")
                }}
                className="mt-4"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {nearbyAgents.map((agent) => (
              <Card 
                key={agent.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleSelectAgent(agent)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <Star className="h-3 w-3 text-yellow-500 mr-0.5" />
                            {agent.rating?.toFixed(1) || "New"}
                          </div>
                          <span>•</span>
                          <span>{agent.totalTransactions || 0} transactions</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {agent.distanceFormatted}
                      </Badge>
                      {agent.location && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            openInMaps(agent.location, agent.name)
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View in Maps
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => {
            hasSearchedAgents.current = false
            if (userCoordinates) searchNearbyAgents(userCoordinates)
          }}
          disabled={isLoadingAgents}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingAgents ? 'animate-spin' : ''}`} />
          Refresh Agents
        </Button>
      </div>
    )
  }

  // Agent matched / in progress
  if (step === "matched" || step === "in_progress") {
    return (
      <div className="space-y-6 px-4 sm:px-0 pb-6">
        <Card>
          <CardHeader className={step === "matched" ? "bg-orange-50 dark:bg-orange-950" : "bg-green-50 dark:bg-green-950"}>
            <div className="flex items-center gap-2">
              {step === "matched" ? (
                <Clock className="h-5 w-5 text-orange-500 animate-pulse" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <CardTitle className={`text-base ${step === "matched" ? "text-orange-700 dark:text-orange-300" : "text-green-700 dark:text-green-300"}`}>
                {step === "matched" ? "Agent Notified" : "Agent On The Way"}
              </CardTitle>
            </div>
            <CardDescription>
              {step === "matched" 
                ? "Waiting for agent to confirm and head to your location"
                : "Agent is heading to your location"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Agent Info */}
            {(selectedAgent || request?.agent) && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedAgent?.name || request?.agent?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedAgent?.phone || request?.agent?.phone}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`tel:${selectedAgent?.phone || request?.agent?.phone}`, '_self')}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  {agentRealTimeLocation && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openInMaps(agentRealTimeLocation, selectedAgent?.name || "Agent")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Distance Info */}
            {straightLineDistanceMeters !== null && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatDistance(straightLineDistanceMeters)}
                  </p>
                  <p className="text-xs text-muted-foreground">Distance</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ±{Math.round(locationAccuracy || 0)}m
                  </p>
                  <p className="text-xs text-muted-foreground">GPS Accuracy</p>
                </div>
              </div>
            )}

            {/* View in Maps Button */}
            {agentRealTimeLocation && (
              <Button
                onClick={() => openInMaps(agentRealTimeLocation, selectedAgent?.name || "Agent")}
                className="w-full"
                variant="outline"
              >
                <Navigation className="w-4 h-4 mr-2" />
                {meetingType === "client_goes" ? "Navigate to Agent" : "Track Agent Location"}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}

            {/* Transaction Details */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <CurrencyFormatter amount={parseFloat(amount)} className="font-semibold" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Meeting Type</span>
                <span>{meetingType === "client_goes" ? "You go to agent" : "Agent comes to you"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge className={step === "in_progress" ? "bg-green-500" : "bg-orange-500"}>
                  {step === "matched" ? "Waiting" : "In Progress"}
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {step === "in_progress" && (
                <Button onClick={confirmTransaction} disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Received
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(true)}
                disabled={isLoading}
                className={step === "in_progress" ? "" : "flex-1"}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {meetingType === "client_goes" 
                  ? "Use 'Navigate to Agent' to get directions in Google Maps"
                  : "Track the agent's location in real-time using 'Track Agent Location'"}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this withdrawal request?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling?"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                Keep Request
              </Button>
              <Button variant="destructive" onClick={cancelRequest} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel Request"}
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
        <Card>
          <CardHeader className="bg-green-50 dark:bg-green-950 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-green-700 dark:text-green-300">
              Withdrawal Complete!
            </CardTitle>
            <CardDescription>
              You have successfully withdrawn <CurrencyFormatter amount={parseFloat(amount)} />
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button onClick={onComplete} className="w-full">
              Done
            </Button>
          </CardContent>
        </Card>

        {/* Review Modal */}
        {showReviewModal && request?.agentId && (
          <AgentReviewModal
            isOpen={showReviewModal}
            onClose={() => {
              setShowReviewModal(false)
              setHasReviewed(true)
            }}
            agentId={request.agentId}
            agentName={selectedAgent?.name || request?.agent?.name || "Agent"}
            requestId={request._id}
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
          <CardHeader className="bg-red-50 dark:bg-red-950 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-700 dark:text-red-300">
              Request Cancelled
            </CardTitle>
            <CardDescription>
              Your withdrawal request has been cancelled
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button onClick={onCancel} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
