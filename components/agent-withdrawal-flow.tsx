"use client"

import { useState, useEffect, useCallback } from "react"
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
} from "lucide-react"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { dispatchBalanceUpdate } from "@/lib/balance-updater"
import { getCurrentLocation } from "@/lib/location-utils"
import { AgentMap } from "@/components/agent-map"
import { GoogleMapsWrapper } from "@/components/google-maps-wrapper"

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
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null)
  const [nearbyAgents, setNearbyAgents] = useState<SelectedAgent[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  // Get user's current location
  const captureLocation = async () => {
    try {
      const coords = await getCurrentLocation()
      setUserCoordinates(coords)
      return coords
    } catch (error) {
      console.error("Failed to get location:", error)
      // Don't block the request if location fails
      return null
    }
  }

  // Fetch nearby agents based on user location
  const fetchNearbyAgents = async (coords: { lat: number; lng: number }) => {
    setIsLoadingAgents(true)
    setError("")

    console.log("🔍 Fetching nearby agents for user at:", coords)

    try {
      const response = await fetch(
        `/api/agents/nearby?lat=${coords.lat}&lng=${coords.lng}&maxDistance=20`
      )
      const data = await response.json()

      console.log("📥 Nearby agents response:", {
        success: data.success,
        agentsFound: data.agents?.length || 0,
        totalFound: data.totalFound,
      })

      if (data.success && data.agents) {
        setNearbyAgents(data.agents.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          phone: agent.phone,
          location: agent.location || agent.lastKnownLocation, // Use exact GPS coordinates
          rating: agent.rating || 5.0,
          totalTransactions: agent.totalTransactions || 0,
          distance: agent.distance || 0,
          distanceFormatted: agent.distanceFormatted || "0m",
        })))
      } else {
        setError(data.error || "No agents found nearby")
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error)
      setError("Failed to find nearby agents")
    } finally {
      setIsLoadingAgents(false)
    }
  }

  // Start map selection after entering amount - automatically get location and show agents
  const startMapSelection = async () => {
    setIsLoading(true)
    setError("")

    try {
      // Get GPS location first
      const coords = await captureLocation()
      if (!coords) {
        setError("Please enable location access to find nearby agents")
        setIsLoading(false)
        return
      }

      // Set location description from coordinates (reverse geocoding would be ideal, but for now use coordinates)
      setLocation(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)

      // Fetch nearby agents
      await fetchNearbyAgents(coords)

      // Move to map step
      setStep("map")
    } catch (error) {
      setError("Failed to get your location. Please enable location access.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle agent selection from map
  const handleAgentSelect = (agent: SelectedAgent) => {
    setSelectedAgent(agent)
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

  // Track agent location and distance
  const trackAgent = useCallback(async () => {
    if (!request?._id || !userCoordinates) return

    try {
      const response = await fetch(
        `/api/agent-withdrawals/${request._id}/track-agent?userLat=${userCoordinates.lat}&userLng=${userCoordinates.lng}`
      )
      const data = await response.json()

      if (data.success && data.distance !== null) {
        setAgentDistance(data.distance)
      }
    } catch (error) {
      console.error("Failed to track agent:", error)
    }
  }, [request?._id, userCoordinates])

  // Poll for request status updates
  const pollStatus = useCallback(async () => {
    if (!request?._id) return

    try {
      const response = await fetch(`/api/agent-withdrawals/${request._id}`)
      const data = await response.json()

      if (data.success && data.request) {
        setRequest(data.request)

        // Update step based on status
        switch (data.request.status) {
          case "pending":
            setStep("searching")
            break
          case "matched":
            setStep("matched")
            // Start tracking agent location
            if (userCoordinates) {
              trackAgent()
            }
            break
          case "in_progress":
            setStep("in_progress")
            // Continue tracking
            if (userCoordinates) {
              trackAgent()
            }
            break
          case "completed":
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
            setStep("cancelled")
            break
        }
      }
    } catch (error) {
      console.error("Failed to poll status:", error)
    }
  }, [request?._id, user.id, userCoordinates, trackAgent])

  // Poll every 3 seconds when searching or matched
  useEffect(() => {
    if (!request?._id) return
    if (step === "completed" || step === "cancelled" || step === "amount") return

    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [request?._id, step, pollStatus])

  // Track agent location every 5 seconds when matched or in progress
  useEffect(() => {
    if (!request?._id || !userCoordinates) return
    if (step !== "matched" && step !== "in_progress") return

    const interval = setInterval(trackAgent, 5000)
    return () => clearInterval(interval)
  }, [request?._id, step, userCoordinates, trackAgent])

  // Search time counter
  useEffect(() => {
    if (step !== "searching") return

    const interval = setInterval(() => {
      setSearchTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [step])

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
    if (!request?._id) return

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

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel")
      }

      setShowCancelDialog(false)
      setCancelReason("")
      setStep("cancelled")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to cancel")
    } finally {
      setIsLoading(false)
    }
  }

  // Amount input step
  if (step === "amount") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Agent Withdrawal</h2>
          <p className="text-muted-foreground">
            Get matched with a nearby agent for instant cash pickup
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
            <CardDescription>
              Available Balance: <CurrencyFormatter amount={user.balance} className="font-semibold" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="10"
                max="100000"
              />
              <p className="text-xs text-muted-foreground">
                Min: KES 10 | Max: KES 100,000
              </p>
            </div>


            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any specific instructions for the agent"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Quick amount buttons */}
            <div className="flex flex-wrap gap-2">
              {[500, 1000, 2000, 5000, 10000].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(amt.toString())}
                  disabled={amt > user.balance}
                >
                  <CurrencyFormatter amount={amt} />
                </Button>
              ))}
            </div>

            <Button
              onClick={startMapSelection}
              disabled={
                isLoading ||
                !amount ||
                Number.parseFloat(amount) < 10 ||
                Number.parseFloat(amount) > user.balance
              }
              className="w-full"
              size="lg"
            >
              {isLoading ? (
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
      <div className="space-y-6">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => setStep("amount")}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Select an Agent</h2>
          <p className="text-muted-foreground">
            Choose an agent near you to collect your KES {amount}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Map Component */}
        {isLoadingAgents ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Finding nearby agents...</p>
              </div>
            </CardContent>
          </Card>
        ) : nearbyAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No agents found nearby</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try again later or expand your search area
                </p>
                <Button
                  variant="outline"
                  onClick={startMapSelection}
                  className="mt-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AgentMap
            userLocation={userCoordinates}
            onSelectAgent={handleAgentSelect}
            selectedAgent={selectedAgent}
            agents={nearbyAgents.map(agent => ({
              id: agent.id,
              name: agent.name,
              phone: agent.phone,
              location: agent.location,
              rating: agent.rating,
              totalTransactions: agent.totalTransactions,
              distance: agent.distance,
              distanceFormatted: agent.distanceFormatted,
            }))}
          />
        )}

        {/* Selected Agent Confirmation */}
        {selectedAgent && (
          <Card className="border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="h-7 w-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedAgent.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{selectedAgent.rating}</span>
                      <span>•</span>
                      <span>{selectedAgent.totalTransactions} trips</span>
                    </div>
                  </div>
                </div>
                <Badge className="bg-primary text-lg px-3 py-1">
                  {selectedAgent.distanceFormatted}
                </Badge>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Withdrawal Amount</span>
                  <span className="font-bold">
                    <CurrencyFormatter amount={Number.parseFloat(amount)} />
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Your Location</span>
                  <span>{location}</span>
                </div>
              </div>

              <Button
                onClick={createRequestWithAgent}
                disabled={isLoading}
                className="w-full bg-green-500 hover:bg-green-600"
                size="lg"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Request This Agent
              </Button>
            </CardContent>
          </Card>
        )}

        {!selectedAgent && (
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Tap on an agent marker or select from the list above
            </p>
          </div>
        )}
      </div>
    )
  }

  // Searching for agents
  if (step === "searching") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              {/* Animated searching indicator */}
              <div className="relative mx-auto w-32 h-32">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
                <div className="absolute inset-4 rounded-full border-4 border-primary/20"></div>
                <div
                  className="absolute inset-4 rounded-full border-4 border-t-primary animate-spin"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold">Finding Nearby Agents</h3>
                <p className="text-muted-foreground">
                  Looking for available agents in your area...
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Amount</span>
                  <span className="font-semibold">
                    <CurrencyFormatter amount={Number.parseFloat(amount)} />
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Location</span>
                  <span>{location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Search Time</span>
                  <span>{Math.floor(searchTime / 60)}:{(searchTime % 60).toString().padStart(2, "0")}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Agents will be notified of your request. You'll be matched once an agent accepts.
              </p>

              <Button variant="destructive" onClick={() => setShowCancelDialog(true)} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Cancel Request
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Withdrawal Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this withdrawal request? Please provide a reason for cancellation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason">Reason for Cancellation *</Label>
                <Textarea
                  id="cancelReason"
                  placeholder="e.g., Taking too long, Changed my mind, Found another agent..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This helps us improve our service
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setCancelReason("")
                }}
                disabled={isLoading}
              >
                Keep Request
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelRequest()}
                disabled={isLoading || !cancelReason.trim()}
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
      <div className="space-y-6">
        <Card className="border-green-500">
          <CardHeader className="bg-green-50 dark:bg-green-950 rounded-t-lg">
            <div className="flex items-center gap-2">
              {step === "matched" ? (
                <Clock className="h-6 w-6 text-orange-500 animate-pulse" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}
              <CardTitle className={step === "matched" ? "text-orange-700 dark:text-orange-300" : "text-green-700 dark:text-green-300"}>
                {step === "matched" ? "Waiting for Agent Confirmation" : "Agent On The Way"}
              </CardTitle>
            </div>
            <CardDescription>
              {step === "matched"
                ? "The agent has been notified. Waiting for them to confirm and start heading to your location."
                : "The agent is heading to your location"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Agent details */}
            {request?.agent && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{request.agent.name}</h4>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{request.agent.rating || "4.5"}</span>
                    </div>
                    {request.agent.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{typeof request.agent.location === 'string' ? request.agent.location : 'Location available'}</span>
                      </div>
                    )}
                    {agentDistance !== null && (
                      <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                        <Navigation className="h-4 w-4" />
                        <span>
                          {agentDistance < 1 
                            ? `${Math.round(agentDistance * 1000)}m away`
                            : `${agentDistance.toFixed(1)}km away`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <a href={`tel:${request.agent.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call Agent: {request.agent.phone}
                  </a>
                </Button>
              </div>
            )}

            {/* Google Maps with Route Visualization */}
            {userCoordinates && request?.agent && (
              <Card>
                <CardContent className="p-0">
                  <GoogleMapsWrapper
                    userLocation={userCoordinates}
                    agents={request.agent ? [{
                      id: request.agent.id,
                      name: request.agent.name,
                      phone: request.agent.phone,
                      location: request.agent.location && typeof request.agent.location === 'object' 
                        ? request.agent.location 
                        : { lat: 0, lng: 0 },
                      rating: request.agent.rating || 5.0,
                      totalTransactions: 0,
                      distance: agentDistance || 0,
                      distanceFormatted: agentDistance !== null 
                        ? (agentDistance < 1 
                            ? `${Math.round(agentDistance * 1000)}m` 
                            : `${agentDistance.toFixed(1)}km`)
                        : "Calculating...",
                    }] : []}
                    selectedAgent={request.agent ? {
                      id: request.agent.id,
                    } : null}
                    onSelectAgent={() => {}}
                    showRoute={step === "in_progress"}
                    agentLocation={
                      step === "in_progress" && request?.agent?.location && typeof request.agent.location === 'object'
                        ? request.agent.location
                        : null
                    }
                  />
                </CardContent>
              </Card>
            )}

            {/* Request details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  <CurrencyFormatter amount={request?.amount || 0} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Location</span>
                <span>{request?.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={step === "in_progress" ? "bg-orange-500" : "bg-green-500"}>
                  {step === "matched" ? "Agent Accepted" : "Agent Arrived"}
                </Badge>
              </div>
            </div>

            {/* Confirmation Status */}
            {step === "in_progress" && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
                  Confirmation Status:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Agent Confirmed:</span>
                    <Badge
                      variant={request?.agentConfirmed ? "default" : "secondary"}
                      className={request?.agentConfirmed ? "bg-green-500" : ""}
                    >
                      {request?.agentConfirmed ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {request?.agentConfirmed ? "Confirmed" : "Waiting"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">You Confirmed:</span>
                    <Badge
                      variant={request?.userConfirmed ? "default" : "secondary"}
                      className={request?.userConfirmed ? "bg-green-500" : ""}
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

            {/* Instructions */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {step === "matched" ? (
                  <>
                    Wait for the agent to arrive at your location. You can call them to coordinate.
                  </>
                ) : (
                  <>
                    The agent should be with you now. Once you receive the cash, tap "I've Received Cash" below.
                    {request?.agentConfirmed && !request?.userConfirmed && (
                      <span className="block mt-2 font-semibold text-orange-600">
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
                    className="w-full bg-green-500 hover:bg-green-600"
                    size="lg"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    I've Received Cash
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="w-full bg-green-500"
                    size="lg"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    You Confirmed
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isLoading || (request?.agentConfirmed && request?.userConfirmed)}
                  className="w-full"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Refuse / Cancel
                </Button>
              </>
            )}

            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              disabled={isLoading}
              className="w-full"
            >
              <XCircle className="h-4 w-4 mr-2" />
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Withdrawal Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this withdrawal request? Please provide a reason for cancellation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason">Reason for Cancellation *</Label>
                <Textarea
                  id="cancelReason"
                  placeholder="e.g., Agent taking too long, Changed my mind, Found another agent..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This helps us improve our service
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setCancelReason("")
                }}
                disabled={isLoading}
              >
                Keep Request
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelRequest()}
                disabled={isLoading || !cancelReason.trim()}
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
      <div className="space-y-6">
        <Card className="border-green-500">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-green-600">Withdrawal Complete!</h3>
                <p className="text-muted-foreground">
                  You've successfully withdrawn cash from your wallet
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Withdrawn</span>
                  <span className="font-bold text-lg">
                    <CurrencyFormatter amount={request?.amount || 0} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent</span>
                  <span>{request?.agent?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
              </div>

              <Button onClick={onComplete} className="w-full" size="lg">
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Cancelled
  if (step === "cancelled") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>

              <div>
                <h3 className="text-xl font-bold">Request Cancelled</h3>
                <p className="text-muted-foreground">
                  Your withdrawal request has been cancelled
                </p>
              </div>

              <Button onClick={onCancel} className="w-full">
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

