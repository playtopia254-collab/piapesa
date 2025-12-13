"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Loader2,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  User,
  DollarSign,
  Navigation,
  AlertCircle,
  RefreshCw,
  Radio,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import dynamic from "next/dynamic"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { getCurrentLocation } from "@/lib/location-utils"
import { dispatchBalanceUpdate } from "@/lib/balance-updater"

// Dynamic import for Google Maps with Bolt-style styling
const GoogleMapsWrapper = dynamic(() => import("@/components/google-maps-wrapper").then(mod => ({ default: mod.GoogleMapsWrapper })), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading Bolt-style map...</div>
    </div>
  ),
})

interface WithdrawalRequest {
  _id: string
  userId: string
  amount: number
  location: string
  notes?: string
  status: string
  agentId?: string
  coordinates?: {
    lat: number
    lng: number
  }
  user?: {
    id: string
    name: string
    phone: string
    location?: string
  }
  createdAt: string
  expiresAt?: string
  acceptedAt?: string
  distance?: number
  distanceFormatted?: string
}

interface User {
  id: string
  name: string
  phone: string
  isAgent: boolean
  location?: string
  balance: number
}

export default function AgentDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<WithdrawalRequest[]>([])
  const [myRequests, setMyRequests] = useState<WithdrawalRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [agentLocation, setAgentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [isWaitingForAccuracy, setIsWaitingForAccuracy] = useState(false)
  const locationWatchIdRef = useRef<number | null>(null)
  const isGettingLocationRef = useRef(false) // Prevent duplicate GPS requests
  const locationPermissionDeniedRef = useRef(false) // Track permission denial
  const receivedAnyPositionRef = useRef(false) // Track if any GPS position was received
  const ACCURACY_THRESHOLD = 150 // Agent must have ≤150m accuracy to go online (relaxed for reliability)
  const GPS_TIMEOUT = 40000 // 40 seconds timeout for GPS accuracy check
  const [stats, setStats] = useState({
    activeRequests: 0,
    pendingRequests: 0,
    todayEarnings: 0,
    todayCommission: 0,
    todayTransactionCount: 0,
    totalCompleted: 0,
    totalEarnings: 0,
    totalCommission: 0,
  })

  // Load user from session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sessionUser = sessionStorage.getItem("currentUser")
      if (sessionUser) {
        try {
          const userData = JSON.parse(sessionUser)
          if (!userData.isAgent) {
            router.push("/dashboard")
            return
          }
          setUser(userData)
          setIsAvailable(userData.isAvailable || false)
        } catch (e) {
          console.error("Failed to parse user:", e)
          router.push("/login")
        }
      } else {
        router.push("/login")
      }
    }
  }, [router])

  // Fetch pending requests
  const fetchRequests = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsRefreshing(true)
      const response = await fetch(`/api/agents/pending-requests?agentId=${user.id}`)
      const data = await response.json()

      if (data.success) {
        setPendingRequests(data.pendingRequests || [])
        setMyRequests(data.myRequests || [])
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user?.id])

  // Fetch agent statistics
  const fetchStats = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/agents/stats?agentId=${user.id}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    }
  }, [user?.id])

  // Poll for new requests when available
  useEffect(() => {
    if (!user?.id) return

    fetchRequests()
    fetchStats()

    // Poll every 5 seconds when available
    const interval = setInterval(() => {
      if (isAvailable) {
        fetchRequests()
        fetchStats()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [user?.id, isAvailable, fetchRequests, fetchStats])

  // Background location updates are handled by watchPosition in startBackgroundLocationUpdates
  // No need for interval-based updates when using watchPosition

  // Update agent location with accuracy (called from background GPS watcher)
  const updateAgentLocation = useCallback(async () => {
    if (!user?.id || !agentLocation) return

    try {
      const response = await fetch("/api/agents/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: user.id,
          lat: agentLocation.lat,
          lng: agentLocation.lng,
          accuracy: gpsAccuracy, // Include accuracy for precise tracking
        }),
      })

      const data = await response.json()
      if (data.success) {
        console.log(`✅ Agent location updated: ${data.location.lat}, ${data.location.lng} (accuracy: ±${gpsAccuracy ? Math.round(gpsAccuracy) : 'unknown'}m)`)
      } else {
        console.error("❌ Failed to update agent location:", data.error)
      }
    } catch (error) {
      console.error("❌ Failed to update location:", error)
      // Don't show error to user, location is optional
    }
  }, [user?.id, agentLocation, gpsAccuracy])

  // Open Google Maps for navigation
  const openGoogleMaps = (destLat: number, destLng: number, customerName: string) => {
    let url: string
    
    if (agentLocation) {
      // If we have agent's location, provide directions
      // Using Google Maps URL that works on both web and mobile (opens app if available)
      url = `https://www.google.com/maps/dir/?api=1&origin=${agentLocation.lat},${agentLocation.lng}&destination=${destLat},${destLng}&travelmode=driving&dir_action=navigate`
    } else {
      // Otherwise just show the destination
      url = `https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`
    }
    
    // On mobile, this will open the Google Maps app if installed, otherwise opens in browser
    // On desktop, opens in a new tab
    window.open(url, "_blank")
  }

  // Calculate distance to client
  const getDistanceToClient = (coords: { lat: number; lng: number }) => {
    if (!agentLocation) return null
    
    const R = 6371 // Earth's radius in km
    const dLat = (coords.lat - agentLocation.lat) * (Math.PI / 180)
    const dLng = (coords.lng - agentLocation.lng) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(agentLocation.lat * (Math.PI / 180)) *
        Math.cos(coords.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`
    }
    return `${distance.toFixed(1)}km`
  }

  // Start GPS accuracy check before going online - Gold Standard Flow
  const startAccuracyCheck = async () => {
    if (!user?.id || isAvailable) return
    // Prevent duplicate GPS requests
    if (isWaitingForAccuracy || isGettingLocationRef.current) return

    // Reset flags
    locationPermissionDeniedRef.current = false
    receivedAnyPositionRef.current = false
    isGettingLocationRef.current = true

    setIsWaitingForAccuracy(true)
    setGpsAccuracy(null)
    setError("")

    // Ensure browser environment
    if (typeof window === "undefined" || !window.navigator) {
      setError("Geolocation is not available in this environment")
      setIsWaitingForAccuracy(false)
      isGettingLocationRef.current = false
      return
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser")
      setIsWaitingForAccuracy(false)
      isGettingLocationRef.current = false
      return
    }

    // STEP 1: Request permission first (unlocks sensors)
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(), // Permission granted
          (error) => {
            // Only reject on permission denied
            if (error.code === error.PERMISSION_DENIED) {
              locationPermissionDeniedRef.current = true
              reject(new Error("Location permission denied. Please enable location in your browser settings."))
            } else {
              // Timeout or other error - continue anyway
              resolve()
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )
      })
    } catch (permissionError) {
      setIsWaitingForAccuracy(false)
      isGettingLocationRef.current = false
      setError(permissionError instanceof Error ? permissionError.message : "Location permission denied")
      return
    }

    // STEP 2: Try Google Geolocation API (more accurate)
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (apiKey) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ considerIp: true })
          }
        )

        if (response.ok) {
          const data = await response.json()
          if (data.location && data.accuracy) {
            const lat = data.location.lat
            const lng = data.location.lng
            const accuracy = data.accuracy

            setGpsAccuracy(accuracy)
            setAgentLocation({ lat, lng })
            receivedAnyPositionRef.current = true

            // If accuracy is good, go online immediately
            if (accuracy <= ACCURACY_THRESHOLD) {
              markAgentOnline({ lat, lng, accuracy })
              setIsWaitingForAccuracy(false)
              isGettingLocationRef.current = false
              return
            }
          }
        }
      } catch (error) {
        console.log("Google Geolocation API not available, using browser GPS")
      }
    }

    // STEP 3: Fallback to watchPosition (continuous GPS tracking)
    let bestLocation: { lat: number; lng: number; accuracy: number } | null = null
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        locationPermissionDeniedRef.current = false
        receivedAnyPositionRef.current = true

        setGpsAccuracy(accuracy)
        setAgentLocation({ lat, lng })

        // Track best location
        if (!bestLocation || accuracy < bestLocation.accuracy) {
          bestLocation = { lat, lng, accuracy }
        }

        console.log(`📍 Agent GPS: ±${Math.round(accuracy)}m at ${lat}, ${lng}`)

        // Go online when accuracy ≤ threshold
        if (accuracy <= ACCURACY_THRESHOLD && !isAvailable) {
          markAgentOnline({ lat, lng, accuracy })
          if (typeof window !== "undefined" && navigator.geolocation && watchId !== null) {
            navigator.geolocation.clearWatch(watchId)
          }
          setIsWaitingForAccuracy(false)
          isGettingLocationRef.current = false
        }
      },
      (error) => {
        // Only show error for permission denied
        // Timeout and other errors are OK - we'll use best location
        if (error.code === error.PERMISSION_DENIED) {
          locationPermissionDeniedRef.current = true
          setError("Location permission denied. Please enable location in your browser settings.")
          setIsWaitingForAccuracy(false)
          isGettingLocationRef.current = false
        }
        // Don't show timeout or other errors - just keep trying
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 30000, // Long timeout - no rush
      }
    )

    locationWatchIdRef.current = watchId

    // Timeout after max time - use best location we have
    setTimeout(() => {
      if (!isGettingLocationRef.current) return
      
      if (typeof window !== "undefined" && navigator.geolocation && watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      setIsWaitingForAccuracy(false)
      isGettingLocationRef.current = false
      
      // Only show error if permission denied or no location at all
      if (locationPermissionDeniedRef.current) {
        setError("Location permission denied. Please enable location in your browser settings.")
      } else if (!receivedAnyPositionRef.current) {
        setError("No GPS signal received. Please enable location permissions and try again.")
      } else if (bestLocation) {
        // Use best location we have - go online anyway
        console.log(`⚠️ Using best GPS location: ±${Math.round(bestLocation.accuracy)}m`)
        markAgentOnline(bestLocation)
      } else if (agentLocation) {
        // Use current location
        markAgentOnline({ 
          lat: agentLocation.lat, 
          lng: agentLocation.lng, 
          accuracy: gpsAccuracy || 200 
        })
      }
    }, GPS_TIMEOUT)
  }

  // Mark agent online (only called when accuracy ≤ 100m)
  const markAgentOnline = async (locationData: { lat: number; lng: number; accuracy: number }) => {
    if (!user?.id) return

    try {
      const response = await fetch("/api/agents/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: user.id,
          isAvailable: true,
          lat: locationData.lat,
          lng: locationData.lng,
          accuracy: locationData.accuracy, // Send accuracy for server validation
        }),
      })

      const data = await response.json()
      if (data.success) {
        setIsAvailable(true)
        // Update session storage
        const updatedUser = { ...user, isAvailable: true }
        sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
        setUser(updatedUser)
        
        console.log(`✅ Agent ${user.id} is now ONLINE at: ${locationData.lat}, ${locationData.lng} (accuracy: ±${Math.round(locationData.accuracy)}m)`)
        
        // Start background location updates
        startBackgroundLocationUpdates()
      } else {
        setError(data.error || "Failed to go online")
        setIsWaitingForAccuracy(false)
      }
    } catch (error) {
      console.error("Failed to mark agent online:", error)
      setError("Failed to go online")
      setIsWaitingForAccuracy(false)
    }
  }

  // Background location updates (runs after agent is online)
  const startBackgroundLocationUpdates = () => {
    if (typeof window === "undefined" || !window.navigator || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        // Update accuracy display
        setGpsAccuracy(accuracy)
        setAgentLocation({ lat, lng })

        // Update location in database (every 2-3 seconds via updateAgentLocation)
        updateAgentLocation()
      },
      (error) => {
        console.error("Background GPS watch error:", error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000, // Allow 2 second old data for continuous updates
        timeout: 10000,
      }
    )

    locationWatchIdRef.current = watchId
  }

  // Toggle availability (go offline or start accuracy check)
  const toggleAvailability = async () => {
    if (!user?.id) return

    // If going offline
    if (isAvailable) {
      try {
        // Stop GPS watching
        if (typeof window !== "undefined" && navigator.geolocation && locationWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(locationWatchIdRef.current)
          locationWatchIdRef.current = null
        }

        const response = await fetch("/api/agents/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: user.id,
            isAvailable: false,
          }),
        })

        const data = await response.json()
        if (data.success) {
          setIsAvailable(false)
          setGpsAccuracy(null)
          // Update session storage
          const updatedUser = { ...user, isAvailable: false }
          sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
          setUser(updatedUser)
        }
      } catch (error) {
        console.error("Failed to toggle availability:", error)
        setError("Failed to update availability")
      }
    } else {
      // Going online - start accuracy check
      startAccuracyCheck()
    }
  }

  // Cleanup GPS watcher on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && navigator.geolocation && locationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current)
      }
    }
  }, [])

  // Accept a withdrawal request
  const acceptRequest = async (requestId: string) => {
    if (!user?.id) return

    setActionLoading(requestId)
    setError("")
    setSuccessMessage("")

    try {
      // Find the request to get coordinates for auto-navigation
      const request = pendingRequests.find(r => r._id === requestId)
      const requestCoordinates = request?.coordinates

      const response = await fetch(`/api/agent-withdrawals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          agentId: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept request")
      }

      // Automatically open Google Maps navigation after accepting
      if (requestCoordinates) {
        // Small delay to ensure the request is processed
        setTimeout(() => {
          openGoogleMaps(
            requestCoordinates.lat,
            requestCoordinates.lng,
            request?.user?.name || "Customer"
          )
        }, 500)
      }

      // Refresh requests and stats
      await fetchRequests()
      await fetchStats()
      
      setSuccessMessage("Request accepted! Opening navigation...")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to accept request")
    } finally {
      setActionLoading(null)
    }
  }

  // Mark as arrived
  const markArrived = async (requestId: string) => {
    setActionLoading(requestId)
    setError("")
    setSuccessMessage("")

    try {
      const response = await fetch(`/api/agent-withdrawals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_arrived",
          agentId: user?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status")
      }

      await fetchRequests()
      await fetchStats()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setActionLoading(null)
    }
  }

  // Confirm cash handover
  const confirmHandover = async (requestId: string) => {
    setActionLoading(requestId)
    setError("")
    setSuccessMessage("")

    try {
      const response = await fetch(`/api/agent-withdrawals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_confirm",
          agentId: user?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm")
      }

      await fetchRequests()
      await fetchStats()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to confirm")
    } finally {
      setActionLoading(null)
    }
  }

  // Complete transaction
  const completeTransaction = async (requestId: string) => {
    setActionLoading(requestId)
    setError("")
    setSuccessMessage("")

    try {
      const response = await fetch(`/api/agent-withdrawals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          agentId: user?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete")
      }

      // Get the withdrawal amount from the request
      const withdrawalAmount = data.request?.amount || 0
      const commission = data.commission || Math.max(withdrawalAmount * 0.02, 10) // 2% commission, min KES 10
      const totalReceived = withdrawalAmount + commission
      const previousBalance = (data.agentBalance || 0) - totalReceived
      const newBalance = data.agentBalance || 0
      const customerName = data.request?.user?.name || "Customer"

      // Show success message with transaction details including commission
      setSuccessMessage(
        `💰 Transaction Complete! Received KES ${withdrawalAmount.toFixed(2)} + KES ${commission.toFixed(2)} commission from ${customerName}. Balance: KES ${previousBalance.toFixed(2)} → KES ${newBalance.toFixed(2)}`
      )

      // Dispatch balance update to refresh the UI
      if (data.agentBalance !== undefined) {
        dispatchBalanceUpdate(data.agentBalance)
      }

      // Refresh stats to show updated earnings
      await fetchStats()

      // Clear success message after 8 seconds
      setTimeout(() => {
        setSuccessMessage("")
      }, 8000)

      await fetchRequests()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to complete")
    } finally {
      setActionLoading(null)
    }
  }

  // Cancel request
  const cancelRequest = async (requestId: string) => {
    setActionLoading(requestId)
    setError("")

    try {
      const response = await fetch(`/api/agent-withdrawals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          agentId: user?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel")
      }

      await fetchRequests()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to cancel")
    } finally {
      setActionLoading(null)
    }
  }

  // Format time ago
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return "Just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "matched":
        return <Badge className="bg-blue-500">Matched</Badge>
      case "in_progress":
        return <Badge className="bg-orange-500">In Progress</Badge>
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user?.isAgent) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to be an agent to access this page.
          </AlertDescription>
        </Alert>
        <Link href="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Agent Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your agent activities and earnings</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            fetchRequests()
            fetchStats()
          }}
          disabled={isRefreshing}
          className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Summary Stats */}
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Active Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-bold">{stats.activeRequests}</div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">Pending withdrawal requests</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Today's Commission
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-bold text-green-600">
                <CurrencyFormatter amount={stats.todayCommission || 0} />
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              From {stats.todayTransactionCount} {stats.todayTransactionCount === 1 ? "transaction" : "transactions"}
            </p>
            {stats.todayEarnings > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Total received: <CurrencyFormatter amount={stats.todayEarnings} />
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Total Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-bold">{stats.totalCompleted}</div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">All-time transactions</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive" className="text-xs sm:text-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950 animate-in slide-in-from-top-2 text-xs sm:text-sm">
          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 animate-pulse" />
          <AlertDescription className="text-green-800 dark:text-green-200 font-semibold text-sm sm:text-base">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Availability Toggle - Fully Redesigned */}
      <Card className={`relative overflow-hidden transition-all duration-300 ${
        isAvailable 
          ? "border-green-500/40 bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 dark:from-green-950/50 dark:via-emerald-950/30 dark:to-green-950/50 shadow-lg shadow-green-500/5" 
          : "border-2 border-dashed border-orange-300/70 bg-gradient-to-br from-orange-50/70 via-amber-50/70 to-orange-50/70 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-orange-950/40"
      }`}>
        <CardContent className="p-4 sm:p-6">
          {/* Top Section: Status and Toggle */}
          <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
            {/* Left: Status Info */}
            <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
              {/* Status Dot Indicator */}
              <div className="relative flex-shrink-0 mt-1">
                {isAvailable ? (
                  <>
                    <div className="absolute inset-0 rounded-full bg-green-500/40 animate-ping" />
                    <div className="relative w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50 ring-2 ring-green-500/20" />
                  </>
                ) : (
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-gray-400 dark:bg-gray-500 ring-2 ring-gray-300/20 dark:ring-gray-600/20" />
                )}
              </div>
              
              {/* Status Text */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-1 sm:mb-1.5">
                  <h3 className={`text-lg sm:text-xl font-bold ${
                    isAvailable ? "text-green-700 dark:text-green-400" : "text-gray-800 dark:text-gray-200"
                  }`}>
                    {isAvailable ? "You're Online" : "You're Offline"}
                  </h3>
                  <Badge 
                    variant={isAvailable ? "default" : "secondary"}
                    className={`text-xs font-semibold px-2 sm:px-2.5 py-0.5 ${
                      isAvailable 
                        ? "bg-green-500 hover:bg-green-600" 
                        : "bg-purple-500 hover:bg-purple-600 text-white"
                    }`}
                  >
                    {isAvailable ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {isAvailable
                    ? "You're actively receiving withdrawal requests from nearby customers"
                    : "Turn on availability to start receiving withdrawal requests from customers"}
                </p>
              </div>
            </div>

            {/* Right: Toggle Switch */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 pt-1">
              <Label 
                htmlFor="availability-toggle" 
                className={`text-xs sm:text-sm font-medium cursor-pointer ${
                  isAvailable ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {isAvailable ? "Online" : "Offline"}
              </Label>
              <Switch
                id="availability-toggle"
                checked={isAvailable}
                onCheckedChange={toggleAvailability}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>

          {/* GPS Accuracy Badge (when online) */}
          {isAvailable && gpsAccuracy !== null && (
            <div className="pt-2 border-t border-border/50">
              <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm ${
                gpsAccuracy <= 5 
                  ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                  : gpsAccuracy <= 20
                  ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                  : gpsAccuracy <= 100
                  ? "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300"
                  : "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  gpsAccuracy <= 20 ? "bg-green-500" : gpsAccuracy <= 100 ? "bg-yellow-500" : "bg-orange-500"
                }`} />
                <span className="font-semibold">ONLINE</span>
                <span>•</span>
                <span>Location accuracy: ±{Math.round(gpsAccuracy)}m</span>
              </div>
            </div>
          )}

          {/* Bottom Section: Action Button */}
          <div className="pt-3 sm:pt-4 border-t border-border/50">
            <Button
              onClick={toggleAvailability}
              disabled={isWaitingForAccuracy}
              className={`w-full h-11 sm:h-12 font-semibold text-sm sm:text-base transition-all duration-300 ${
                isAvailable 
                  ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30" 
                  : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md shadow-green-500/20 hover:shadow-lg hover:shadow-green-500/30"
              }`}
              size="lg"
            >
              {isWaitingForAccuracy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Checking GPS Accuracy...</span>
                </>
              ) : isAvailable ? (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Go Offline - Stop Accepting Requests</span>
                  <span className="sm:hidden">Go Offline</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Go Online - Start Accepting Requests</span>
                  <span className="sm:hidden">Go Online</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* GPS Accuracy Check Dialog (when trying to go online) */}
      <Dialog open={isWaitingForAccuracy} onOpenChange={(open) => {
        if (!open && !isAvailable) {
          // Only allow closing if not online yet
          setIsWaitingForAccuracy(false)
          if (typeof window !== "undefined" && navigator.geolocation && locationWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(locationWatchIdRef.current)
            locationWatchIdRef.current = null
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-blue-600" />
              Getting your location...
            </DialogTitle>
            <DialogDescription>
              We need accurate GPS to ensure reliable agent discovery
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Live Accuracy Display */}
            {gpsAccuracy !== null ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">
                    ±{Math.round(gpsAccuracy)}m
                  </div>
                  <div className={`text-sm font-medium ${
                    gpsAccuracy <= 5
                      ? "text-green-600 dark:text-green-400"
                      : gpsAccuracy <= 20
                      ? "text-green-600 dark:text-green-400"
                      : gpsAccuracy <= 100
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}>
                    {gpsAccuracy <= 5
                      ? "✓ Excellent GPS signal"
                      : gpsAccuracy <= 20
                      ? "✓ Good GPS signal"
                      : gpsAccuracy <= 100
                      ? "🟡 Almost there..."
                      : "🟠 Improving GPS signal..."}
                  </div>
                </div>
                
                {/* Progress indicator */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>GPS Accuracy</span>
                    <span>Target: ≤100m</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        gpsAccuracy <= 100
                          ? "bg-green-500"
                          : "bg-orange-500"
                      }`}
                      style={{
                        width: `${Math.min((100 / Math.max(gpsAccuracy, 1)) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Status message */}
                {gpsAccuracy > 100 && (
                  <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg text-sm text-orange-800 dark:text-orange-200">
                    <p className="font-medium mb-1">Need better GPS signal</p>
                    <p className="text-xs">Move closer to a window or go outside for better accuracy</p>
                  </div>
                )}
                
                {gpsAccuracy <= 100 && (
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-sm text-green-800 dark:text-green-200">
                    <p className="font-medium">✓ Location ready! Going online...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Initializing GPS...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Requests (My Requests) */}
      {myRequests.length > 0 && (
        <div className="-mx-4 sm:-mx-6 lg:mx-0">
          <Card className="border-l-4 border-l-orange-500 rounded-none sm:rounded-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
              </div>
                <div className="min-w-0">
                  <div className="text-lg sm:text-xl font-bold">Active Requests</div>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">{myRequests.length} request{myRequests.length !== 1 ? "s" : ""} in progress</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
            <CardContent className="space-y-4 pt-4 sm:pt-6 px-0 sm:px-6 pb-0 sm:pb-6">
            {myRequests.map((request) => (
              <div
                key={request._id}
                  className="border-2 border-orange-200 dark:border-orange-800 rounded-none sm:rounded-xl bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20 hover:shadow-md transition-all overflow-hidden"
              >
                  {/* Side-by-side layout for larger screens */}
                  <div className="flex flex-col lg:flex-row gap-0 lg:gap-4">
                    {/* Left Side: Customer Info & Actions */}
                    <div className="flex-1 p-4 sm:p-5 space-y-4 min-w-0">
                {/* Customer Info Header */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <User className="h-4 w-4 flex-shrink-0 text-orange-600" />
                            <span className="font-semibold text-lg sm:text-xl truncate">{request.user?.name || "Customer"}</span>
                      {getStatusBadge(request.status)}
                    </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1.5">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="font-mono text-xs break-all">{request.coordinates ? `${request.coordinates.lat.toFixed(4)}, ${request.coordinates.lng.toFixed(4)}` : request.location}</span>
                          </div>
                      {request.coordinates && agentLocation && (
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                              <Navigation className="h-4 w-4 flex-shrink-0" />
                              <span>{getDistanceToClient(request.coordinates)} away</span>
                            </div>
                      )}
                    </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl sm:text-3xl font-bold text-green-600">
                      <CurrencyFormatter amount={request.amount} />
                    </div>
                  </div>
                </div>
                    </div>

                    {/* Contact & Navigation Buttons - Fixed at bottom for easy access */}
                    <div className="sticky bottom-0 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 border-t border-orange-200 dark:border-orange-800 z-10">
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${request.user?.phone}`} className="block">
                          <Button variant="outline" className="w-full text-sm sm:text-base h-11 sm:h-12 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-950 border-green-300 dark:border-green-700">
                            <Phone className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                            <span className="truncate font-semibold">Call</span>
                    </Button>
                  </a>
                  {request.coordinates && (
                    <Button
                      variant="outline"
                            className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500 text-sm sm:text-base w-full h-11 sm:h-12 font-semibold"
                      onClick={() => openGoogleMaps(request.coordinates!.lat, request.coordinates!.lng, request.user?.name || "Customer")}
                    >
                            <Navigation className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                            <span className="truncate">Navigate</span>
                    </Button>
                  )}
                      </div>
                </div>

                {request.notes && (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">📝 Note:</span> {request.notes}
                  </p>
                      </div>
                )}

                {/* Confirmation Status */}
                {request.status === "in_progress" && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200">
                        <p className="text-xs sm:text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
                      Confirmation Status:
                    </p>
                    <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                            <span className="text-xs sm:text-sm">Agent Confirmed:</span>
                        <Badge
                          variant={request.agentConfirmed ? "default" : "secondary"}
                              className={`text-xs ${request.agentConfirmed ? "bg-green-500" : ""}`}
                        >
                          {request.agentConfirmed ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {request.agentConfirmed ? "Confirmed" : "Pending"}
                        </Badge>
                      </div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                            <span className="text-xs sm:text-sm">Customer Confirmed:</span>
                        <Badge
                          variant={request.userConfirmed ? "default" : "secondary"}
                              className={`text-xs ${request.userConfirmed ? "bg-green-500" : ""}`}
                        >
                          {request.userConfirmed ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {request.userConfirmed ? "Confirmed" : "Waiting"}
                        </Badge>
                      </div>
                      {request.agentConfirmed && request.userConfirmed && (
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

                {/* Action Buttons based on status */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-orange-200 dark:border-orange-800">
                  {request.status === "matched" && (
                    <>
                      <Button
                        onClick={() => markArrived(request._id)}
                        disabled={actionLoading === request._id}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-sm sm:text-base h-11 sm:h-12 font-semibold"
                        size="lg"
                      >
                        {actionLoading === request._id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        )}
                            <span className="hidden sm:inline">I've Arrived at Customer</span>
                            <span className="sm:hidden">I've Arrived</span>
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => cancelRequest(request._id)}
                        disabled={actionLoading === request._id}
                        size="lg"
                            className="w-full sm:w-auto h-11 sm:h-12"
                      >
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </>
                  )}

                  {request.status === "in_progress" && (
                    <>
                      {!request.agentConfirmed ? (
                        <Button
                          onClick={() => confirmHandover(request._id)}
                          disabled={actionLoading === request._id}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-sm sm:text-base h-11 sm:h-12 font-semibold"
                          size="lg"
                        >
                          {actionLoading === request._id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          )}
                              <span className="hidden sm:inline">I've Given Cash</span>
                              <span className="sm:hidden">Given Cash</span>
                        </Button>
                      ) : (
                        <Button
                          disabled
                              className="flex-1 bg-green-500 text-sm sm:text-base h-11 sm:h-12 font-semibold"
                          size="lg"
                        >
                              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          You Confirmed
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => cancelRequest(request._id)}
                        disabled={actionLoading === request._id || (request.agentConfirmed && request.userConfirmed)}
                        size="lg"
                            className="w-full sm:w-auto h-11 sm:h-12"
                      >
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        Refuse
                      </Button>
                    </>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Live Navigation Map - Hide when either party has confirmed */}
                  {request.coordinates && !request.agentConfirmed && !request.userConfirmed && (
                    <div className="w-full lg:w-1/2 lg:min-w-[400px] border-t lg:border-t-0 lg:border-l border-orange-200 dark:border-orange-800">
                      <Card className="border-0 rounded-none h-full bg-transparent shadow-none">
                        <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                            <CardTitle className="text-base sm:text-lg">Live Navigation</CardTitle>
                            {request.coordinates && agentLocation && (
                              <Badge className="bg-blue-500 text-white text-xs sm:text-sm px-2.5 sm:px-3 py-1 self-start sm:self-auto">
                                <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                                {getDistanceToClient(request.coordinates)} away
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs sm:text-sm mt-1">
                            Real-time route to customer • Distance updates automatically
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          {/* Google Maps with Bolt-style for agent navigation */}
                            {agentLocation ? (
                              <GoogleMapsWrapper
                                userLocation={request.coordinates} // Customer location
                                agents={[{
                                  id: user?.id || "agent",
                                  name: "You",
                                  phone: user?.phone || "",
                                  location: agentLocation, // Agent's real-time location
                                  rating: 5.0,
                                  totalTransactions: 0,
                                  distance: (() => {
                                    if (!request.coordinates || !agentLocation) return 0
                                    const R = 6371
                                    const dLat = (request.coordinates.lat - agentLocation.lat) * (Math.PI / 180)
                                    const dLng = (request.coordinates.lng - agentLocation.lng) * (Math.PI / 180)
                                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                      Math.cos(agentLocation.lat * (Math.PI / 180)) *
                                      Math.cos(request.coordinates.lat * (Math.PI / 180)) *
                                      Math.sin(dLng / 2) * Math.sin(dLng / 2)
                                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                                    return R * c
                                  })(),
                                  distanceFormatted: getDistanceToClient(request.coordinates) || "Calculating...",
                                }]}
                              selectedAgent={{
                                id: user?.id || "agent",
                                name: "You",
                                phone: user?.phone || "",
                                location: agentLocation,
                                rating: 5.0,
                                totalTransactions: 0,
                                distance: 0,
                                distanceFormatted: getDistanceToClient(request.coordinates) || "Calculating...",
                              }}
                                onSelectAgent={() => {}}
                              showRoute={true}
                              agentLocation={agentLocation}
                              />
                            ) : (
                            <div className="h-96 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                <div className="text-center">
                                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                                  <p className="text-sm text-muted-foreground">Getting your location...</p>
                                </div>
                              </div>
                            )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Arrival Confirmation Message - Show when map is hidden */}
                  {(request.agentConfirmed || request.userConfirmed) && (
                    <div className="w-full lg:w-1/2 lg:min-w-[400px] border-t lg:border-t-0 lg:border-l border-green-200 dark:border-green-800">
                      <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 h-full">
                        <CardContent className="p-4 sm:p-6 flex items-center justify-center h-full min-h-[400px] lg:min-h-[500px]">
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg sm:text-xl text-green-800 dark:text-green-200 mb-2">
                                {request.agentConfirmed && request.userConfirmed
                                  ? "Both Parties Confirmed!"
                                  : request.agentConfirmed
                                  ? "You've Confirmed Arrival"
                                  : "Customer Has Confirmed"}
                              </h4>
                              <p className="text-sm text-green-700 dark:text-green-300">
                                {request.agentConfirmed && request.userConfirmed
                                  ? "The transaction will be completed automatically. Map navigation is no longer needed."
                                  : request.agentConfirmed
                                  ? "You've confirmed giving cash. Waiting for customer confirmation."
                                  : "Customer has confirmed receiving cash. Please confirm if you've given the cash."}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        </div>
      )}

      {/* Pending Requests */}
      <Card className="border-l-4 border-l-blue-500">
        {/* Uber-style Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-5 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Available Requests</h2>
              <p className="text-sm text-blue-100 mt-0.5">
                {isAvailable
                  ? pendingRequests.length > 0
                    ? `${pendingRequests.length} new request${pendingRequests.length !== 1 ? "s" : ""} available`
                    : "No new requests at the moment"
                  : "Go online to see and accept requests"}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {!isAvailable ? (
            <div className="text-center py-12 px-4">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">You're currently offline</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Toggle availability to see requests</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-10 w-10 text-blue-500" />
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">No pending requests</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">New requests will appear here automatically</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
              {pendingRequests.map((request) => {
                return (
                <div
                  key={request._id}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-xl"
                  >
                    {/* Request Header */}
                    <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg truncate">
                              {request.user?.name || "Customer"}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {timeAgo(request.createdAt)}
                        </span>
                      </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
                            <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-mono text-xs truncate">
                              {request.coordinates 
                                ? `${request.coordinates.lat.toFixed(4)}, ${request.coordinates.lng.toFixed(4)}`
                                : request.location}
                            </span>
                      </div>

                      {request.distanceFormatted && (
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                          <span>{request.distanceFormatted} away</span>
                        </div>
                      )}
                    </div>

                        {/* Amount Badge */}
                        <div className="flex-shrink-0">
                          <div className="bg-green-500 text-white px-3 sm:px-4 py-2 rounded-xl shadow-md">
                            <div className="text-lg sm:text-xl font-bold">
                        <CurrencyFormatter amount={request.amount} />
                            </div>
                          </div>
                      </div>
                    </div>
                  </div>

                    {/* Mini Map Visualization */}
                    {request.coordinates && agentLocation && (
                      <div className="px-4 sm:px-5 pb-4">
                        <div className="relative bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 h-32 sm:h-40 overflow-hidden">
                          {/* Map Background Pattern */}
                          <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0" style={{
                              backgroundImage: `radial-gradient(circle at 20% 50%, #3b82f6 2px, transparent 2px),
                                                radial-gradient(circle at 80% 50%, #ef4444 2px, transparent 2px)`,
                              backgroundSize: '40px 40px',
                            }}></div>
                          </div>

                          {/* Agent and Customer Icons */}
                          <div className="relative h-full flex items-center justify-between">
                            {/* Agent (You) */}
                            <div className="flex flex-col items-center z-10">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                                <Navigation className="h-6 w-6 sm:h-7 sm:w-7 text-white rotate-45" />
                              </div>
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 mt-1.5">You</span>
                            </div>

                            {/* Connection Line */}
                            <div className="flex-1 relative h-1 mx-2 sm:mx-4">
                              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 h-0.5 rounded-full"></div>
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                                {request.distanceFormatted?.replace(" away", "") || "0m"}
                              </div>
                            </div>

                            {/* Customer */}
                            <div className="flex flex-col items-center z-10">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                                <MapPin className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                              </div>
                              <span className="text-xs font-medium text-red-700 dark:text-red-300 mt-1.5">Customer</span>
                            </div>
                          </div>

                          {/* Coordinates at bottom */}
                          <div className="absolute bottom-2 left-0 right-0 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {request.coordinates.lat.toFixed(4)}, {request.coordinates.lng.toFixed(4)}
                            </p>
                          </div>
                        </div>
                    </div>
                  )}

                    {/* Action Buttons */}
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2">
                    {request.coordinates && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = `https://www.google.com/maps/search/?api=1&query=${request.coordinates!.lat},${request.coordinates!.lng}`
                              window.open(url, "_blank")
                            }}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Navigation className="h-4 w-4 mr-1.5" />
                            <span className="text-xs sm:text-sm">View in Maps</span>
                          </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openGoogleMaps(request.coordinates!.lat, request.coordinates!.lng, request.user?.name || "Customer")}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                            <Navigation className="h-4 w-4 mr-1.5" />
                            <span className="text-xs sm:text-sm">Get Directions</span>
                      </Button>
                        </div>
                    )}
                      
                      {/* Accept Button - Full Width */}
                    <Button
                      onClick={() => acceptRequest(request._id)}
                      disabled={actionLoading === request._id}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 sm:py-3.5 text-base sm:text-lg shadow-lg hover:shadow-xl transition-all"
                        size="lg"
                    >
                      {actionLoading === request._id ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span>Accepting...</span>
                          </>
                      ) : (
                          <>
                            <CheckCircle className="h-5 w-5 mr-2" />
                            <span>Accept</span>
                          </>
                      )}
                    </Button>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold">{stats.activeRequests}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Active Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                <CurrencyFormatter amount={stats.todayCommission} />
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Today's Commission</p>
            </div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold">{stats.todayTransactionCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {stats.todayTransactionCount === 1 ? "Transaction" : "Transactions"} Today
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Total Commission</CardTitle>
            <CardDescription className="text-xs sm:text-sm">All-time commission earned from completed transactions</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              <CurrencyFormatter amount={stats.totalCommission} />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              From {stats.totalCompleted} {stats.totalCompleted === 1 ? "transaction" : "transactions"}
            </p>
            {stats.totalEarnings > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Withdrawal amount received: <CurrencyFormatter amount={stats.totalEarnings} />
              </p>
            )}
            {(stats.totalEarnings + stats.totalCommission) > 0 && (
              <p className="text-xs font-semibold text-green-600 mt-1">
                Total (withdrawal + commission): <CurrencyFormatter amount={stats.totalEarnings + stats.totalCommission} />
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Pending Requests</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Available withdrawal requests waiting for agents</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-2xl sm:text-3xl font-bold text-orange-600">
              {stats.pendingRequests}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              {stats.pendingRequests === 0 
                ? "No requests available" 
                : `${stats.pendingRequests} ${stats.pendingRequests === 1 ? "request" : "requests"} waiting`}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


