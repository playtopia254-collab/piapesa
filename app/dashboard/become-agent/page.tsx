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
  AlertCircle,
  Users,
  TrendingUp,
  MapPin,
} from "lucide-react"
import Link from "next/link"
import { mockApi, type User } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"

export default function BecomeAgentPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
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
      const response = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          idNumber: formData.idNumber,
          location: formData.location,
          preferredNetworks: formData.preferredNetworks,
          maxAmount: formData.maxAmount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit application")
      }

      // Update local user state
      if (data.user) {
        const updatedUser = { ...user, ...data.user }
        setUser(updatedUser as User)
        // Update session storage
        sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
      }

      alert("Congratulations! You are now registered as an agent. Go to Agent Dashboard to start accepting requests.")
      router.push("/dashboard/agent-dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit agent application")
    } finally {
      setIsLoading(false)
    }
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

  // If user is already an agent, redirect to agent dashboard
  if (user.isAgent) {
    return (
      <div className="max-w-md mx-auto space-y-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        <h1 className="text-2xl font-bold">You're Already an Agent!</h1>
        <p className="text-muted-foreground">
          You're already registered as an agent. Go to your Agent Dashboard to manage requests.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="text-sm">
            <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
            Rating: {user.rating?.toFixed(1) || "5.0"}
          </Badge>
          <Badge variant="outline" className="text-sm">
            <MapPin className="w-3 h-3 mr-1" />
            {user.location || "Location not set"}
          </Badge>
        </div>
        <Button onClick={() => router.push("/dashboard/agent-dashboard")} className="w-full">
          <Users className="w-4 h-4 mr-2" />
          Go to Agent Dashboard
                          </Button>
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
