"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  UserCheck,
  ArrowLeft,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  TrendingUp,
  MapPin,
  Phone,
} from "lucide-react"
import Link from "next/link"
import { mockApi, type User } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"

// Mock agent requests data
const mockAgentRequests = [
  {
    id: "req_001",
    userId: "user_001",
    userName: "John Kamau",
    userPhone: "+254712345678",
    amount: 3000,
    status: "pending",
    createdAt: "2024-01-21T10:00:00Z",
    location: "Nairobi CBD",
  },
  {
    id: "req_002",
    userId: "user_004",
    userName: "Sarah Mwangi",
    userPhone: "+254734567890",
    amount: 1500,
    status: "pending",
    createdAt: "2024-01-21T11:30:00Z",
    location: "Westlands",
  },
]

export default function BecomeAgentPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [agentRequests, setAgentRequests] = useState(mockAgentRequests)
  const [formData, setFormData] = useState({
    idNumber: "",
    location: "",
    preferredNetworks: [] as string[],
    maxAmount: "",
  })

  useEffect(() => {
    const currentUser = mockApi.getCurrentUser()
    if (!currentUser) {
      router.push("/login")
      return
    }
    setUser(currentUser)
  }, [router])

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  const handleNetworkToggle = (network: string) => {
    const networks = formData.preferredNetworks.includes(network)
      ? formData.preferredNetworks.filter((n) => n !== network)
      : [...formData.preferredNetworks, network]
    handleInputChange("preferredNetworks", networks)
  }

  const handleAgentApplication = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Simulate agent application
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Update user to be an agent
      if (user) {
        const updatedUser = { ...user, isAgent: true, location: formData.location, rating: 5.0 }
        setUser(updatedUser)
      }

      alert("Agent application submitted successfully! You are now an agent.")
    } catch (err) {
      setError("Failed to submit agent application")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRequestAction = async (requestId: string, action: "accept" | "reject") => {
    setAgentRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, status: action === "accept" ? "accepted" : "rejected" } : req,
      ),
    )

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  const handleCompleteRequest = async (requestId: string) => {
    setAgentRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, status: "completed" } : req)))

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Agent Dashboard
  if (user.isAgent) {
    const pendingRequests = agentRequests.filter((req) => req.status === "pending")
    const acceptedRequests = agentRequests.filter((req) => req.status === "accepted")
    const completedRequests = agentRequests.filter((req) => req.status === "completed")

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agent Dashboard</h1>
            <p className="text-muted-foreground">Manage your agent activities and earnings</p>
          </div>
          <Badge variant="secondary" className="w-fit">
            <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
            Agent Rating: {user.rating?.toFixed(1) || "5.0"}
          </Badge>
        </div>

        {/* Agent Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <Clock className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting your response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{acceptedRequests.length}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedRequests.length}</div>
              <p className="text-xs text-muted-foreground">Transactions completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                <CurrencyFormatter amount={450} />
              </div>
              <p className="text-xs text-muted-foreground">Commission earned</p>
            </CardContent>
          </Card>
        </div>

        {/* Withdrawal Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal Requests</CardTitle>
            <CardDescription>Manage incoming withdrawal requests from users</CardDescription>
          </CardHeader>
          <CardContent>
            {agentRequests.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No withdrawal requests</p>
                <p className="text-sm text-muted-foreground">New requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{request.userName}</h3>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <PhoneFormatter phone={request.userPhone} />
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{request.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-lg font-semibold">
                          <CurrencyFormatter amount={request.amount} />
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {request.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRequestAction(request.id, "reject")}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                            <Button size="sm" onClick={() => handleRequestAction(request.id, "accept")}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Accept
                            </Button>
                          </>
                        )}
                        {request.status === "accepted" && (
                          <Button size="sm" onClick={() => handleCompleteRequest(request.id)}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Complete
                          </Button>
                        )}
                        {request.status === "completed" && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {request.status === "rejected" && (
                          <Badge variant="secondary" className="bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Agent Application Form
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Become an Agent</h1>
        <p className="text-muted-foreground">Join our agent network and earn money helping others access cash</p>
      </div>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Why Become an Agent?</CardTitle>
          <CardDescription>Earn money while helping your community</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Earn Commission</p>
                <p className="text-sm text-muted-foreground">Get paid for every transaction</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Flexible Hours</p>
                <p className="text-sm text-muted-foreground">Work when you want</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Help Community</p>
                <p className="text-sm text-muted-foreground">Provide essential service</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Easy Setup</p>
                <p className="text-sm text-muted-foreground">Quick application process</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>Agent Application</span>
          </CardTitle>
          <CardDescription>Fill out the form below to become an agent</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAgentApplication} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number *</Label>
              <Input
                id="idNumber"
                type="text"
                placeholder="12345678"
                value={formData.idNumber}
                onChange={(e) => handleInputChange("idNumber", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Current Location *</Label>
              <Input
                id="location"
                type="text"
                placeholder="e.g., Nairobi CBD, Westlands, Kisumu"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAmount">Maximum Transaction Amount (KES) *</Label>
              <Input
                id="maxAmount"
                type="number"
                placeholder="50000"
                min="1000"
                step="1000"
                value={formData.maxAmount}
                onChange={(e) => handleInputChange("maxAmount", e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">The maximum amount you can handle per transaction</p>
            </div>

            <div className="space-y-3">
              <Label>Preferred Networks *</Label>
              <div className="space-y-2">
                {["M-Pesa", "Airtel Money", "Bank Transfer"].map((network) => (
                  <div key={network} className="flex items-center space-x-2">
                    <Checkbox
                      id={network}
                      checked={formData.preferredNetworks.includes(network)}
                      onCheckedChange={() => handleNetworkToggle(network)}
                    />
                    <Label htmlFor={network} className="text-sm font-normal">
                      {network}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Select the networks you can handle transactions for</p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                By applying to become an agent, you agree to our terms and conditions. You'll be responsible for
                handling cash transactions securely and professionally.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
