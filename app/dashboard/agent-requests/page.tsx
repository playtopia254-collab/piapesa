"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, CheckCircle, XCircle, Users, Phone } from "lucide-react"
import { mockApi, type User } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"

// Mock withdrawal requests for the current user
const mockUserRequests = [
  {
    id: "req_001",
    amount: 3000,
    method: "Via Agent",
    status: "pending" as const,
    createdAt: "2024-01-21T10:00:00Z",
    matchedAgentId: null,
    estimatedTime: "5-10 minutes",
  },
  {
    id: "req_002",
    amount: 1500,
    method: "Via Agent",
    status: "matched" as const,
    createdAt: "2024-01-20T15:30:00Z",
    matchedAgentId: "agent_001",
    matchedAgent: {
      name: "Mary Wanjiku",
      phone: "+254723456789",
      location: "Nairobi CBD",
      rating: 4.8,
    },
    estimatedTime: "Agent contacted",
  },
]

export default function AgentRequestsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [requests, setRequests] = useState(mockUserRequests)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const currentUser = mockApi.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
    }
    setIsLoading(false)
  }, [])

  const handleCancelRequest = async (requestId: string) => {
    setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, status: "cancelled" as const } : req)))

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  const handleContactAgent = (phone: string) => {
    window.open(`tel:${phone}`, "_self")
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />
      case "matched":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700"
      case "matched":
        return "bg-green-100 text-green-700"
      case "completed":
        return "bg-green-100 text-green-700"
      case "cancelled":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Requests</h1>
        <p className="text-muted-foreground">Track your withdrawal requests and agent matches</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {requests.filter((req) => req.status === "pending").length}
            </div>
            <p className="text-xs text-muted-foreground">Waiting for agent match</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matched Requests</CardTitle>
            <Users className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {requests.filter((req) => req.status === "matched").length}
            </div>
            <p className="text-xs text-muted-foreground">Ready for collection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <CurrencyFormatter
              amount={requests.filter((req) => req.status !== "cancelled").reduce((sum, req) => sum + req.amount, 0)}
              className="text-2xl font-bold text-primary"
            />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">In active requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Withdrawal Requests</CardTitle>
          <CardDescription>Manage your active and recent withdrawal requests</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No withdrawal requests</p>
              <p className="text-sm text-muted-foreground">Your withdrawal requests will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">
                          <CurrencyFormatter amount={request.amount} />
                        </h3>
                        <Badge variant="outline" className={getStatusColor(request.status)}>
                          {getStatusIcon(request.status)}
                          <span className="ml-1 capitalize">{request.status}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {request.method} • {new Date(request.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">ETA: {request.estimatedTime}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Request ID</p>
                      <p className="text-sm font-mono">{request.id}</p>
                    </div>
                  </div>

                  {request.status === "matched" && request.matchedAgent && (
                    <div className="bg-muted/50 p-4 rounded-lg mb-4">
                      <h4 className="font-medium mb-2 text-green-700">Matched with Agent</h4>
                      <div className="grid gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">{request.matchedAgent.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span>
                            <PhoneFormatter phone={request.matchedAgent.phone} />
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span>{request.matchedAgent.location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rating</span>
                          <span>⭐ {request.matchedAgent.rating}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {request.status === "pending" && (
                    <Alert className="mb-4">
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        We're finding the best agent for you. You'll be notified once matched.
                      </AlertDescription>
                    </Alert>
                  )}

                  {request.status === "matched" && (
                    <Alert className="mb-4">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>Your agent is ready! Contact them to arrange cash collection.</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center space-x-2">
                    {request.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelRequest(request.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancel Request
                      </Button>
                    )}

                    {request.status === "matched" && request.matchedAgent && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleContactAgent(request.matchedAgent!.phone)}
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          Call Agent
                        </Button>
                        <Button size="sm">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mark as Collected
                        </Button>
                      </>
                    )}

                    {request.status === "cancelled" && (
                      <Badge variant="outline" className="bg-red-100 text-red-700">
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancelled
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>Common questions about agent requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">How long does agent matching take?</h4>
            <p className="text-sm text-muted-foreground">
              Usually 5-10 minutes. We match you with the nearest available agent.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">What if I can't reach my matched agent?</h4>
            <p className="text-sm text-muted-foreground">
              Try calling again or contact our support team for assistance.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Can I cancel a request after matching?</h4>
            <p className="text-sm text-muted-foreground">
              Yes, but please inform the agent. Frequent cancellations may affect your account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
