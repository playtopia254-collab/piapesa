"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Settings,
  User,
  Shield,
  Bell,
  MapPin,
  CreditCard,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Key,
  LogOut,
} from "lucide-react"
import { mockApi, type User } from "@/lib/mock-api"
import { PhoneFormatter } from "@/components/phone-formatter"

interface AgentDetails {
  location?: string
  town?: string
  isAvailable?: boolean
  preferredNetworks?: string[]
  maxAmount?: number
  idNumber?: string
}

const kenyanTowns = [
  "Nairobi",
  "Mombasa",
  "Kisumu",
  "Nakuru",
  "Eldoret",
  "Thika",
  "Malindi",
  "Kitale",
  "Garissa",
  "Kakamega",
  "Nyeri",
  "Meru",
  "Machakos",
  "Homa Bay",
  "Bungoma",
  "Busia",
  "Kericho",
  "Embu",
  "Lamu",
  "Other",
]

const networks = ["M-Pesa", "Airtel Money", "T-Kash", "Bank"]

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Profile settings
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
  })

  // Security settings
  const [pinData, setPinData] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  })
  const [showPins, setShowPins] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  // Agent settings
  const [agentData, setAgentData] = useState<AgentDetails>({
    location: "",
    town: "",
    isAvailable: false,
    preferredNetworks: [],
    maxAmount: 50000,
  })

  // Notification settings
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: true,
    transactionAlerts: true,
    agentRequests: true,
  })

  // Status messages
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [isOptingOut, setIsOptingOut] = useState(false)
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      if (typeof window === "undefined") return

      try {
        const sessionUser = sessionStorage.getItem("currentUser")
        if (sessionUser) {
          const userData = JSON.parse(sessionUser)
          setUser(userData)
          setProfileData({
            name: userData.name || "",
            email: userData.email || "",
            phone: userData.phone || "",
          })

          // Load agent-specific data
          if (userData.isAgent) {
            try {
              const agentResponse = await fetch(`/api/agents/stats?userId=${userData.id}`)
              if (agentResponse.ok) {
                const agentInfo = await agentResponse.json()
                if (agentInfo.success) {
                  setAgentData({
                    location: userData.location || agentInfo.location || "",
                    town: userData.town || extractTown(userData.location) || "",
                    isAvailable: userData.isAvailable !== false,
                    preferredNetworks: userData.preferredNetworks || agentInfo.preferredNetworks || [],
                    maxAmount: userData.maxAmount || agentInfo.maxAmount || 50000,
                    idNumber: userData.idNumber || "",
                  })
                }
              }
            } catch (error) {
              console.error("Failed to load agent data:", error)
            }
          }
        } else {
          router.push("/login")
        }
      } catch (error) {
        console.error("Failed to load user:", error)
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [router])

  const extractTown = (location?: string): string => {
    if (!location) return ""
    // Try to extract town from location string
    for (const town of kenyanTowns) {
      if (location.toLowerCase().includes(town.toLowerCase())) {
        return town
      }
    }
    return location
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      const response = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update session storage
        const updatedUser = { ...user, ...profileData }
        sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
        setUser(updatedUser)
        setSaveStatus({ type: "success", message: "Profile updated successfully!" })
      } else {
        setSaveStatus({ type: "error", message: data.error || "Failed to update profile" })
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Failed to update profile. Please try again." })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000)
    }
  }

  const handleChangePin = async () => {
    if (!user) return

    if (pinData.newPin !== pinData.confirmPin) {
      setSaveStatus({ type: "error", message: "New PINs do not match" })
      return
    }

    if (pinData.newPin.length !== 4) {
      setSaveStatus({ type: "error", message: "PIN must be exactly 4 digits" })
      return
    }

    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      const response = await fetch("/api/user/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          currentPin: pinData.currentPin,
          newPin: pinData.newPin,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSaveStatus({ type: "success", message: "PIN changed successfully!" })
        setPinData({ currentPin: "", newPin: "", confirmPin: "" })
      } else {
        setSaveStatus({ type: "error", message: data.error || "Failed to change PIN" })
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Failed to change PIN. Please try again." })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000)
    }
  }

  const handleSaveAgentSettings = async () => {
    if (!user || !user.isAgent) return

    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      // Update agent location/town
      const locationResponse = await fetch("/api/agents/update-location-town", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          location: agentData.location,
          town: agentData.town,
          preferredNetworks: agentData.preferredNetworks,
          maxAmount: agentData.maxAmount,
        }),
      })

      const locationData = await locationResponse.json()

      // Update availability
      if (locationData.success) {
        const availabilityResponse = await fetch("/api/agents/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            isAvailable: agentData.isAvailable,
          }),
        })

        const availabilityData = await availabilityResponse.json()

        if (availabilityData.success) {
          // Update session storage
          const updatedUser = {
            ...user,
            location: agentData.location,
            town: agentData.town,
            isAvailable: agentData.isAvailable,
            preferredNetworks: agentData.preferredNetworks,
            maxAmount: agentData.maxAmount,
          }
          sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
          setUser(updatedUser)
          setSaveStatus({ type: "success", message: "Agent settings updated successfully!" })
        } else {
          setSaveStatus({ type: "error", message: availabilityData.error || "Failed to update availability" })
        }
      } else {
        setSaveStatus({ type: "error", message: locationData.error || "Failed to update agent settings" })
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Failed to update agent settings. Please try again." })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000)
    }
  }

  const handleOptOut = async () => {
    if (!user || !user.isAgent) return

    setIsOptingOut(true)
    setSaveStatus({ type: null, message: "" })

    try {
      const response = await fetch("/api/agents/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to opt out")
      }

      // Update session storage
      if (data.user) {
        const updatedUser = { ...user, ...data.user }
        sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
        setUser(updatedUser)
      }

      setSaveStatus({ type: "success", message: data.message || "You have successfully opted out of being an agent." })
      setShowOptOutConfirm(false)
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    } catch (error) {
      setSaveStatus({ 
        type: "error", 
        message: error instanceof Error ? error.message : "Failed to opt out of being an agent" 
      })
    } finally {
      setIsOptingOut(false)
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000)
    }
  }

  const handleSaveNotifications = async () => {
    if (!user) return

    setIsSaving(true)
    setSaveStatus({ type: null, message: "" })

    try {
      const response = await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...notifications,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSaveStatus({ type: "success", message: "Notification preferences updated!" })
      } else {
        setSaveStatus({ type: "error", message: data.error || "Failed to update notifications" })
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Failed to update notifications. Please try again." })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000)
    }
  }

  const toggleNetwork = (network: string) => {
    setAgentData((prev) => ({
      ...prev,
      preferredNetworks: prev.preferredNetworks?.includes(network)
        ? prev.preferredNetworks.filter((n) => n !== network)
        : [...(prev.preferredNetworks || []), network],
    }))
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* Status Alert */}
      {saveStatus.type && (
        <Alert variant={saveStatus.type === "error" ? "destructive" : "default"}>
          {saveStatus.type === "success" ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <AlertDescription>{saveStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-primary" />
            <CardTitle>Profile Information</CardTitle>
          </div>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={profileData.name}
              onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                placeholder="your.email@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                placeholder="+254712345678"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current: <PhoneFormatter phone={user.phone} />
            </p>
          </div>

          <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Change your PIN to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPin">Current PIN</Label>
            <div className="relative">
              <Input
                id="currentPin"
                type={showPins.current ? "text" : "password"}
                value={pinData.currentPin}
                onChange={(e) => setPinData({ ...pinData, currentPin: e.target.value })}
                placeholder="Enter current PIN"
                maxLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPins({ ...showPins, current: !showPins.current })}
              >
                {showPins.current ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPin">New PIN</Label>
            <div className="relative">
              <Input
                id="newPin"
                type={showPins.new ? "text" : "password"}
                value={pinData.newPin}
                onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })}
                placeholder="Enter new PIN (4 digits)"
                maxLength={4}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPins({ ...showPins, new: !showPins.new })}
              >
                {showPins.new ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm New PIN</Label>
            <div className="relative">
              <Input
                id="confirmPin"
                type={showPins.confirm ? "text" : "password"}
                value={pinData.confirmPin}
                onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })}
                placeholder="Confirm new PIN"
                maxLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPins({ ...showPins, confirm: !showPins.confirm })}
              >
                {showPins.confirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <Button onClick={handleChangePin} disabled={isSaving} className="w-full" variant="outline">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Changing PIN...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Change PIN
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Agent Settings */}
      {user.isAgent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-primary" />
                <CardTitle>Agent Settings</CardTitle>
              </div>
              <Badge variant="secondary">Agent Account</Badge>
            </div>
            <CardDescription>Manage your agent location, availability, and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="town">Town / City</Label>
              <Select
                value={agentData.town || ""}
                onValueChange={(value) => setAgentData({ ...agentData, town: value })}
              >
                <SelectTrigger id="town">
                  <SelectValue placeholder="Select your town" />
                </SelectTrigger>
                <SelectContent>
                  {kenyanTowns.map((town) => (
                    <SelectItem key={town} value={town}>
                      {town}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location / Address</Label>
              <Input
                id="location"
                value={agentData.location || ""}
                onChange={(e) => setAgentData({ ...agentData, location: e.target.value })}
                placeholder="e.g., Nairobi CBD, Westlands, etc."
              />
              <p className="text-xs text-muted-foreground">
                Enter your specific location or area where you operate
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="availability">Agent Availability</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle to accept or decline withdrawal requests
                </p>
              </div>
              <Switch
                id="availability"
                checked={agentData.isAvailable}
                onCheckedChange={(checked) => setAgentData({ ...agentData, isAvailable: checked })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Preferred Networks</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select the payment networks you accept
              </p>
              <div className="flex flex-wrap gap-2">
                {networks.map((network) => (
                  <Badge
                    key={network}
                    variant={agentData.preferredNetworks?.includes(network) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => toggleNetwork(network)}
                  >
                    {network}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAmount">Maximum Withdrawal Amount (KES)</Label>
              <Input
                id="maxAmount"
                type="number"
                value={agentData.maxAmount || ""}
                onChange={(e) =>
                  setAgentData({ ...agentData, maxAmount: Number.parseFloat(e.target.value) || 0 })
                }
                placeholder="50000"
                min={1000}
                max={1000000}
              />
              <p className="text-xs text-muted-foreground">
                Maximum amount you can process per withdrawal request
              </p>
            </div>

            <Button onClick={handleSaveAgentSettings} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Agent Settings
                </>
              )}
            </Button>

            <Separator className="my-6" />

            {/* Opt Out Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground">
                  Once you opt out, you will no longer receive withdrawal requests and will lose access to agent features.
                </p>
              </div>

              {!showOptOutConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowOptOutConfirm(true)}
                  className="w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Opt Out of Being an Agent
                </Button>
              ) : (
                <div className="space-y-3 p-4 border border-destructive rounded-lg bg-destructive/5">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Are you sure you want to opt out? This action cannot be undone. You will need to register again to become an agent.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleOptOut}
                      disabled={isOptingOut}
                      className="flex-1"
                    >
                      {isOptingOut ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Opting Out...
                        </>
                      ) : (
                        <>
                          <LogOut className="w-4 h-4 mr-2" />
                          Yes, Opt Out
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowOptOutConfirm(false)}
                      disabled={isOptingOut}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Manage how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notif">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              id="email-notif"
              checked={notifications.email}
              onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms-notif">SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive updates via SMS</p>
            </div>
            <Switch
              id="sms-notif"
              checked={notifications.sms}
              onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notif">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive push notifications</p>
            </div>
            <Switch
              id="push-notif"
              checked={notifications.push}
              onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="transaction-alerts">Transaction Alerts</Label>
              <p className="text-sm text-muted-foreground">Get notified about all transactions</p>
            </div>
            <Switch
              id="transaction-alerts"
              checked={notifications.transactionAlerts}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, transactionAlerts: checked })
              }
            />
          </div>

          {user.isAgent && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="agent-requests">Agent Request Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about new withdrawal requests
                  </p>
                </div>
                <Switch
                  id="agent-requests"
                  checked={notifications.agentRequests}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, agentRequests: checked })
                  }
                />
              </div>
            </>
          )}

          <Button onClick={handleSaveNotifications} disabled={isSaving} className="w-full mt-4">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Notification Preferences
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

