"use client"

import { useState, useEffect, useCallback } from "react"
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
} from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { getCurrentLocation } from "@/lib/location-utils"
import { dispatchBalanceUpdate } from "@/lib/balance-updater"

// Dynamic import for map to avoid SSR issues
const CustomerLocationMap = dynamic(() => import("@/components/customer-location-map"), {
  ssr: false,
  loading: () => (
    <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
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
  const [stats, setStats] = useState({
    activeRequests: 0,
    pendingRequests: 0,
    todayEarnings: 0,
    todayTransactionCount: 0,
    totalCompleted: 0,
    totalEarnings: 0,
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

  // Continuously update location when online or have active requests
  useEffect(() => {
    if (!user?.id) return
    if (!isAvailable && myRequests.length === 0) return

    // Update location immediately
    updateAgentLocation()

    // Update every 30 seconds while active
    const locationInterval = setInterval(() => {
      updateAgentLocation()
    }, 30000)

    return () => clearInterval(locationInterval)
  }, [user?.id, isAvailable, myRequests.length])

  // Update agent location
  const updateAgentLocation = async () => {
    if (!user?.id) return

    try {
      const coords = await getCurrentLocation()
      setAgentLocation(coords) // Store in state for map display
      
      const response = await fetch("/api/agents/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: user.id,
          lat: coords.lat,
          lng: coords.lng,
        }),
      })

      const data = await response.json()
      if (data.success) {
        console.log("Agent location updated:", data.location)
      }
    } catch (error) {
      console.error("Failed to update location:", error)
      // Don't show error to user, location is optional
    }
  }

  // Open Google Maps for navigation
  const openGoogleMaps = (destLat: number, destLng: number, customerName: string) => {
    let url: string
    
    if (agentLocation) {
      // If we have agent's location, provide directions
      url = `https://www.google.com/maps/dir/?api=1&origin=${agentLocation.lat},${agentLocation.lng}&destination=${destLat},${destLng}&travelmode=driving`
    } else {
      // Otherwise just show the destination
      url = `https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`
    }
    
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

  // Toggle availability
  const toggleAvailability = async () => {
    if (!user?.id) return

    try {
      // If going online, get location and send it with availability update
      let locationData: { lat?: number; lng?: number } = {}
      if (!isAvailable) {
        try {
          const coords = await getCurrentLocation()
          locationData = { lat: coords.lat, lng: coords.lng }
          setAgentLocation(coords)
        } catch (error) {
          console.error("Failed to get location:", error)
          // Continue anyway, location will be updated by the interval
        }
      }

      const response = await fetch("/api/agents/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: user.id,
          isAvailable: !isAvailable,
          ...locationData, // Include location if going online
        }),
      })

      const data = await response.json()
      if (data.success) {
        setIsAvailable(data.isAvailable)
        // Update session storage
        const updatedUser = { ...user, isAvailable: data.isAvailable }
        sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
      }
    } catch (error) {
      console.error("Failed to toggle availability:", error)
      setError("Failed to update availability")
    }
  }

  // Accept a withdrawal request
  const acceptRequest = async (requestId: string) => {
    if (!user?.id) return

    setActionLoading(requestId)
    setError("")
    setSuccessMessage("")

    try {
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

      // Refresh requests and stats
      await fetchRequests()
      await fetchStats()
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
      const previousBalance = (data.agentBalance || 0) - withdrawalAmount
      const newBalance = data.agentBalance || 0
      const customerName = data.request?.user?.name || "Customer"

      // Show success message with transaction details
      setSuccessMessage(
        `💰 Money Received! KES ${withdrawalAmount.toFixed(2)} from ${customerName} has been credited to your account. Balance: KES ${previousBalance.toFixed(2)} → KES ${newBalance.toFixed(2)}`
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Dashboard</h1>
          <p className="text-muted-foreground">Manage your agent activities</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            fetchRequests()
            fetchStats()
          }}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Active Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeRequests}</div>
            <p className="text-sm text-muted-foreground mt-1">Pending withdrawal requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Today's Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              <CurrencyFormatter amount={stats.todayEarnings} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Commission from {stats.todayTransactionCount} {stats.todayTransactionCount === 1 ? "transaction" : "transactions"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              Total Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCompleted}</div>
            <p className="text-sm text-muted-foreground mt-1">
              All-time transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950 animate-in slide-in-from-top-2">
          <CheckCircle className="h-5 w-5 text-green-600 animate-pulse" />
          <AlertDescription className="text-green-800 dark:text-green-200 font-semibold text-base">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Availability Toggle */}
      <Card className={isAvailable ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-2 border-dashed border-orange-300"}>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full ${
                    isAvailable ? "bg-green-500 animate-pulse" : "bg-gray-400"
                  }`}
                />
                <div>
                  <Label className="text-lg font-semibold">
                    {isAvailable ? "You're Online" : "You're Offline"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isAvailable
                      ? "Receiving withdrawal requests from nearby customers"
                      : "Click the button below to start receiving requests"}
                  </p>
                </div>
              </div>
              <Switch
                checked={isAvailable}
                onCheckedChange={toggleAvailability}
                className="scale-150"
              />
            </div>
            
            {/* Big Go Online/Offline Button */}
            <Button
              onClick={toggleAvailability}
              className={`w-full h-14 text-lg font-bold ${
                isAvailable 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-green-500 hover:bg-green-600"
              }`}
              size="lg"
            >
              {isAvailable ? (
                <>
                  <XCircle className="h-6 w-6 mr-2" />
                  Go Offline
                </>
              ) : (
                <>
                  <CheckCircle className="h-6 w-6 mr-2" />
                  Go Online - Start Accepting Requests
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Requests (My Requests) */}
      {myRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Active Requests ({myRequests.length})
            </CardTitle>
            <CardDescription>Requests you've accepted</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {myRequests.map((request) => (
              <div
                key={request._id}
                className="border-2 border-orange-400 rounded-lg p-4 space-y-4 bg-orange-50 dark:bg-orange-950"
              >
                {/* Customer Info Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium text-lg">{request.user?.name || "Customer"}</span>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {request.location}
                      {request.coordinates && agentLocation && (
                        <Badge variant="outline" className="ml-2 text-blue-600 border-blue-400">
                          📍 {getDistanceToClient(request.coordinates)} away
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      <CurrencyFormatter amount={request.amount} />
                    </div>
                  </div>
                </div>

                {/* Map showing customer location */}
                {request.coordinates && (
                  <div className="rounded-lg overflow-hidden border-2 border-gray-200">
                    <CustomerLocationMap
                      customerLocation={request.coordinates}
                      agentLocation={agentLocation}
                      height="200px"
                    />
                    <div className="bg-gray-100 dark:bg-gray-800 p-2 text-center text-sm flex items-center justify-center gap-4">
                      <span>🚗 You</span>
                      <span>📍 Customer</span>
                      <span className="text-purple-600">--- Route</span>
                    </div>
                  </div>
                )}

                {/* Contact & Navigation Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${request.user?.phone}`} className="block">
                    <Button variant="outline" className="w-full">
                      <Phone className="h-4 w-4 mr-2" />
                      Call {request.user?.name?.split(' ')[0] || 'Customer'}
                    </Button>
                  </a>
                  {request.coordinates && (
                    <Button
                      variant="outline"
                      className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                      onClick={() => openGoogleMaps(request.coordinates!.lat, request.coordinates!.lng, request.user?.name || "Customer")}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Navigate in Maps
                    </Button>
                  )}
                </div>

                {request.notes && (
                  <p className="text-sm bg-white dark:bg-gray-800 p-2 rounded border">
                    📝 Note: {request.notes}
                  </p>
                )}

                {/* Confirmation Status */}
                {request.status === "in_progress" && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200">
                    <p className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
                      Confirmation Status:
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Agent Confirmed:</span>
                        <Badge
                          variant={request.agentConfirmed ? "default" : "secondary"}
                          className={request.agentConfirmed ? "bg-green-500" : ""}
                        >
                          {request.agentConfirmed ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {request.agentConfirmed ? "Confirmed" : "Pending"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Customer Confirmed:</span>
                        <Badge
                          variant={request.userConfirmed ? "default" : "secondary"}
                          className={request.userConfirmed ? "bg-green-500" : ""}
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
                        <Alert className="mt-2 border-green-500 bg-green-50 dark:bg-green-950">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            Both parties confirmed! Transaction will complete automatically.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons based on status */}
                <div className="flex gap-2 pt-2 border-t">
                  {request.status === "matched" && (
                    <>
                      <Button
                        onClick={() => markArrived(request._id)}
                        disabled={actionLoading === request._id}
                        className="flex-1 bg-blue-500 hover:bg-blue-600"
                        size="lg"
                      >
                        {actionLoading === request._id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <MapPin className="h-4 w-4 mr-2" />
                        )}
                        I've Arrived at Customer
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => cancelRequest(request._id)}
                        disabled={actionLoading === request._id}
                        size="lg"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {request.status === "in_progress" && (
                    <>
                      {!request.agentConfirmed ? (
                        <Button
                          onClick={() => confirmHandover(request._id)}
                          disabled={actionLoading === request._id}
                          className="flex-1 bg-orange-500 hover:bg-orange-600"
                          size="lg"
                        >
                          {actionLoading === request._id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <DollarSign className="h-4 w-4 mr-2" />
                          )}
                          I've Given Cash
                        </Button>
                      ) : (
                        <Button
                          disabled
                          className="flex-1 bg-green-500"
                          size="lg"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          You Confirmed
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => cancelRequest(request._id)}
                        disabled={actionLoading === request._id || (request.agentConfirmed && request.userConfirmed)}
                        size="lg"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Refuse
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Available Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>
            {isAvailable
              ? "Tap to accept a withdrawal request"
              : "Go online to see and accept requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isAvailable ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>You're currently offline</p>
              <p className="text-sm">Toggle availability to see requests</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending requests</p>
              <p className="text-sm">New requests will appear here automatically</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request._id}
                  className="border rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{request.user?.name || "Customer"}</span>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(request.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {request.location}
                      </div>
                      {request.distanceFormatted && (
                        <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                          <Navigation className="h-3 w-3" />
                          <span>{request.distanceFormatted} away</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        <CurrencyFormatter amount={request.amount} />
                      </div>
                    </div>
                  </div>

                  {/* Mini map preview for pending requests */}
                  {request.coordinates && (
                    <div className="mt-3 rounded-lg overflow-hidden border">
                      <CustomerLocationMap
                        customerLocation={request.coordinates}
                        agentLocation={agentLocation}
                        height="120px"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    {request.coordinates && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openGoogleMaps(request.coordinates!.lat, request.coordinates!.lng, request.user?.name || "Customer")}
                        className="text-blue-600 border-blue-300"
                      >
                        <Navigation className="h-4 w-4 mr-1" />
                        View in Maps
                      </Button>
                    )}
                    <Button
                      onClick={() => acceptRequest(request._id)}
                      disabled={actionLoading === request._id}
                      className="flex-1 bg-green-500 hover:bg-green-600"
                    >
                      {actionLoading === request._id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.activeRequests}</p>
              <p className="text-sm text-muted-foreground">Active Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                <CurrencyFormatter amount={stats.todayEarnings} />
              </p>
              <p className="text-sm text-muted-foreground">Today's Earnings</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.todayTransactionCount}</p>
              <p className="text-sm text-muted-foreground">
                {stats.todayTransactionCount === 1 ? "Transaction" : "Transactions"} Today
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Earnings</CardTitle>
            <CardDescription>All-time commission from completed transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              <CurrencyFormatter amount={stats.totalEarnings} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              From {stats.totalCompleted} {stats.totalCompleted === 1 ? "transaction" : "transactions"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Requests</CardTitle>
            <CardDescription>Available withdrawal requests waiting for agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {stats.pendingRequests}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
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


