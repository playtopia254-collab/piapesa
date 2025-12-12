"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: Credentials, 2: OTP Verification
  const [formData, setFormData] = useState({
    phone: "",
    pin: "",
  })
  const [otpCode, setOtpCode] = useState("")
  const [userEmail, setUserEmail] = useState("") // Store email for OTP step
  const [showPin, setShowPin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null) // When OTP expires
  const [timeRemaining, setTimeRemaining] = useState<number>(0) // Time remaining in seconds

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Format phone number
      let phone = formData.phone.trim()
      if (phone.startsWith("0")) {
        phone = "+254" + phone.slice(1)
      } else if (!phone.startsWith("+254")) {
        phone = "+254" + phone
      }

      // Call API to verify credentials and send OTP
      const loginData: any = {
        phone: phone,
        pin: formData.pin,
      }

      const response = await fetch("/api/auth/login-send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Login failed")
      }

      if (result.success) {
        // Store phone for OTP verification
        setUserEmail(result.phone || formData.phone)
        
        // Set OTP expiration time (5 minutes from now)
        const expiresAt = Date.now() + 5 * 60 * 1000
        setOtpExpiresAt(expiresAt)
        setTimeRemaining(5 * 60) // 5 minutes in seconds
        
        // OTP should be sent via SMS - no need to show alert
        setStep(2) // Move to OTP verification
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
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

      // Verify OTP and complete login
      const response = await fetch("/api/auth/login-verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formData.phone.trim().startsWith("0") 
            ? "+254" + formData.phone.trim().slice(1)
            : formData.phone.trim().startsWith("+254")
            ? formData.phone.trim()
            : "+254" + formData.phone.trim(),
          code: otpCode,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Invalid OTP code")
      }

      if (result.success && result.user) {
        // Store user in session
        if (typeof window !== "undefined") {
          sessionStorage.setItem("currentUser", JSON.stringify(result.user))
        }
        router.push("/dashboard")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed")
    } finally {
      setIsLoading(false)
    }
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

  // OTP Verification Step
  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Verify Your Phone</h1>
          <p className="text-muted-foreground">We've sent a verification code to {userEmail}</p>
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
            Verify & Login
          </Button>
        </form>

        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={async () => {
              setIsLoading(true)
              setError("")
              try {
                const loginData: any = {
                  pin: formData.pin,
                }

                if (formData.useEmail) {
                  loginData.email = formData.email.trim()
                } else {
                  let phone = formData.phone.trim()
                  if (phone.startsWith("0")) {
                    phone = "+254" + phone.slice(1)
                  } else if (!phone.startsWith("+254")) {
                    phone = "+254" + phone
                  }
                  loginData.phone = phone
                }

                const response = await fetch("/api/auth/login-send-otp", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                  phone: formData.phone.trim().startsWith("0") 
                    ? "+254" + formData.phone.trim().slice(1)
                    : formData.phone.trim().startsWith("+254")
                    ? formData.phone.trim()
                    : "+254" + formData.phone.trim(),
                  pin: formData.pin,
                }),
                })

                const result = await response.json()

                if (!response.ok) {
                  throw new Error(result.error || "Failed to resend OTP")
                }

                // Reset expiration timer
                const expiresAt = Date.now() + 5 * 60 * 1000
                setOtpExpiresAt(expiresAt)
                setTimeRemaining(5 * 60)
                
                alert("OTP resent successfully! Please check your SMS.")
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to resend OTP")
              } finally {
                setIsLoading(false)
              }
            }}
            className="w-full"
            disabled={isLoading || (timeRemaining > 0)}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {timeRemaining > 0 
              ? `Resend OTP (${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, "0")})`
              : "Resend OTP Code"}
          </Button>

          <Button variant="ghost" onClick={() => setStep(1)} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </div>
      </div>
    )
  }

  // Credentials Step
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Welcome Back</h1>
        <p className="text-muted-foreground">Sign in to your Pia Pesa account</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
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
          <Label htmlFor="pin">PIN</Label>
          <div className="relative">
            <Input
              id="pin"
              type={showPin ? "text" : "password"}
              placeholder="Enter your 4-digit PIN"
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

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </form>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
        <Link href="/forgot-pin" className="text-sm text-primary hover:underline">
          Forgot your PIN?
        </Link>
      </div>
    </div>
  )
}
