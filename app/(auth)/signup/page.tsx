"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { mockApi } from "@/lib/mock-api"

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAgentSignup = searchParams.get("agent") === "true"

  const [step, setStep] = useState(1) // 1: Form, 2: OTP Verification
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    pin: "",
    confirmPin: "",
    isAgent: isAgentSignup,
    location: "",
    idNumber: "",
    preferredNetworks: [] as string[],
  })
  const [signedUpUser, setSignedUpUser] = useState<any>(null) // Store user data from signup
  const [showPin, setShowPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [resendingOTP, setResendingOTP] = useState(false)
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null) // When OTP expires
  const [timeRemaining, setTimeRemaining] = useState<number>(0) // Time remaining in seconds

  useEffect(() => {
    if (isAgentSignup) {
      setFormData((prev) => ({ ...prev, isAgent: true }))
    }
  }, [isAgentSignup])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Validation
      if (formData.pin !== formData.confirmPin) {
        throw new Error("PINs do not match")
      }

      if (formData.pin.length !== 4) {
        throw new Error("PIN must be 4 digits")
      }

      // Format phone number
      let phone = formData.phone.trim()
      if (phone.startsWith("0")) {
        phone = "+254" + phone.slice(1)
      } else if (!phone.startsWith("+254")) {
        phone = "+254" + phone
      }

      const userData = {
        name: formData.name,
        phone,
        email: formData.email,
        pin: formData.pin,
        isAgent: formData.isAgent,
        location: formData.isAgent ? formData.location : undefined,
        idNumber: formData.isAgent ? formData.idNumber : undefined,
        preferredNetworks: formData.isAgent ? formData.preferredNetworks : [],
      }

      // Call API route to save to database
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Signup failed")
      }

      if (result.success) {
        // Store user data for later use
        setSignedUpUser(result.user)
        
        // Send OTP via SMS
        try {
          const otpResponse = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ phone: phone }),
          })

          const otpResult = await otpResponse.json()

          if (!otpResponse.ok) {
            throw new Error(otpResult.error || "Failed to send OTP")
          }

          // Set OTP expiration time (59 seconds from now)
          const expiresAt = Date.now() + 59 * 1000
          setOtpExpiresAt(expiresAt)
          setTimeRemaining(59) // 59 seconds

          // OTP should be sent via SMS - no need to show alert
          setStep(2) // Move to OTP verification
        } catch (otpError) {
          console.error("OTP send error:", otpError)
          setError(otpError instanceof Error ? otpError.message : "Failed to send OTP SMS")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Validate OTP format
      if (!/^\d{6}$/.test(otpCode)) {
        throw new Error("OTP must be 6 digits")
      }

      // Format phone number (same as in handleSubmit)
      let phone = formData.phone.trim()
      if (phone.startsWith("0")) {
        phone = "+254" + phone.slice(1)
      } else if (!phone.startsWith("+254")) {
        phone = "+254" + phone
      }

      // Verify OTP with API
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          code: otpCode,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Invalid OTP code")
      }

      if (result.success) {
        // Store user in session for login using data from signup API
        // In production, use proper session management (JWT, cookies, etc.)
        if (typeof window !== "undefined" && signedUpUser) {
          sessionStorage.setItem("currentUser", JSON.stringify(signedUpUser))
        }
        router.push("/dashboard")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  const handleNetworkToggle = (network: string) => {
    const networks = formData.preferredNetworks.includes(network)
      ? formData.preferredNetworks.filter((n) => n !== network)
      : [...formData.preferredNetworks, network]
    handleInputChange("preferredNetworks", networks)
  }

  // Countdown timer effect
  useEffect(() => {
    if (step === 2 && otpExpiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000))
        setTimeRemaining(remaining)
        
        if (remaining === 0) {
          clearInterval(interval)
        }
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [step, otpExpiresAt])

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Verify Your Phone</h1>
          <p className="text-muted-foreground">
            We've sent a verification code to{" "}
            {(() => {
              const phone = formData.phone.trim()
              if (phone.startsWith("+254")) return phone
              if (phone.startsWith("254")) return "+" + phone
              if (phone.startsWith("0")) return "+254" + phone.slice(1)
              return "+254" + phone
            })()}
          </p>
          <p className="text-sm text-muted-foreground">Please check your SMS and enter the 6-digit code</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleOTPSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              id="otp"
              type="text"
              placeholder="Enter 6-digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to your phone
            </p>
            {otpExpiresAt && timeRemaining > 0 && (
              <p className="text-xs text-muted-foreground font-medium">
                Code expires in: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
              </p>
            )}
            {otpExpiresAt && timeRemaining === 0 && (
              <p className="text-xs text-orange-600 font-medium">
                Code has expired. Please request a new one.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify & Complete Signup
          </Button>
        </form>

        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={async () => {
              setResendingOTP(true)
              setError("")
              try {
                // Format phone number
                let phone = formData.phone.trim()
                if (phone.startsWith("0")) {
                  phone = "+254" + phone.slice(1)
                } else if (phone.startsWith("254")) {
                  phone = "+" + phone
                } else if (!phone.startsWith("+254")) {
                  phone = "+254" + phone
                }
                
                const response = await fetch("/api/auth/send-otp", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ phone: phone }),
                })

                const result = await response.json()

                if (!response.ok) {
                  throw new Error(result.error || "Failed to resend OTP")
                }

                // Reset expiration timer
                const expiresAt = Date.now() + 59 * 1000
                setOtpExpiresAt(expiresAt)
                setTimeRemaining(59)

                // Show success message
                setError("") // Clear any errors
                alert("OTP resent successfully! Please check your SMS.")
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to resend OTP")
              } finally {
                setResendingOTP(false)
              }
            }}
            className="w-full"
            disabled={resendingOTP || (timeRemaining > 0)}
          >
            {resendingOTP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {timeRemaining > 0 
              ? `Resend OTP (${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, "0")})`
              : "Resend OTP Code"}
          </Button>

          <Button variant="ghost" onClick={() => setStep(1)} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Form
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{formData.isAgent ? "Become an Agent" : "Create Account"}</h1>
        <p className="text-muted-foreground">
          {formData.isAgent
            ? "Join our agent network and earn money helping others"
            : "Join thousands of Kenyans using Pia Pesa"}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="John Kamau"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="0712345678 or +254712345678"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            required
          />
        </div>

        {formData.isAgent && (
          <>
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
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
              <Label htmlFor="location">Current Location</Label>
              <Input
                id="location"
                type="text"
                placeholder="Nairobi CBD"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Preferred Networks</Label>
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
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="pin">Create PIN</Label>
          <div className="relative">
            <Input
              id="pin"
              type={showPin ? "text" : "password"}
              placeholder="4-digit PIN"
              value={formData.pin}
              onChange={(e) => handleInputChange("pin", e.target.value)}
              maxLength={4}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPin(!showPin)}
            >
              {showPin ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPin">Confirm PIN</Label>
          <div className="relative">
            <Input
              id="confirmPin"
              type={showConfirmPin ? "text" : "password"}
              placeholder="Confirm 4-digit PIN"
              value={formData.confirmPin}
              onChange={(e) => handleInputChange("confirmPin", e.target.value)}
              maxLength={4}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowConfirmPin(!showConfirmPin)}
            >
              {showConfirmPin ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isAgent"
            checked={formData.isAgent}
            onCheckedChange={(checked) => handleInputChange("isAgent", checked)}
          />
          <Label htmlFor="isAgent" className="text-sm">
            I want to become an agent and help others withdraw cash
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {formData.isAgent ? "Apply to Become Agent" : "Create Account"}
        </Button>
      </form>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
