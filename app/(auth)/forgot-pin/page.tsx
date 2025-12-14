"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function ForgotPinPage() {
  const [step, setStep] = useState(1) // 1: Phone, 2: OTP, 3: New PIN, 4: Success
  const [phone, setPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Simulate sending OTP
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setStep(2)
    } catch (err) {
      setError("Failed to send verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Simulate OTP verification
      await new Promise((resolve) => setTimeout(resolve, 800))
      if (!/^\d{4,6}$/.test(otpCode)) {
        throw new Error("Invalid OTP code")
      }
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (newPin !== confirmPin) {
        throw new Error("PINs do not match")
      }
      if (newPin.length !== 4) {
        throw new Error("PIN must be 4 digits")
      }

      // Simulate PIN reset
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset PIN")
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 4) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">PIN Reset Successful</h1>
          <p className="text-muted-foreground">
            Your PIN has been successfully reset. You can now sign in with your new PIN.
          </p>
        </div>

        <Link href="/login">
          <Button className="w-full">Continue to Sign In</Button>
        </Link>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Create New PIN</h1>
          <p className="text-muted-foreground">Enter your new 4-digit PIN</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPin">New PIN</Label>
            <Input
              id="newPin"
              type="password"
              placeholder="4-digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              maxLength={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm New PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              placeholder="Confirm 4-digit PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              maxLength={4}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset PIN
          </Button>
        </form>

        <Button variant="ghost" onClick={() => setStep(2)} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Verify Your Phone</h1>
          <p className="text-muted-foreground">We've sent a verification code to {phone}</p>
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
              placeholder="Enter 4-6 digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">Demo: Enter any 4-6 digit code to continue</p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify Code
          </Button>
        </form>

        <Button variant="ghost" onClick={() => setStep(1)} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Reset Your PIN</h1>
        <p className="text-muted-foreground">Enter your phone number to receive a verification code</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handlePhoneSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="0712345678 or +254712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Verification Code
        </Button>
      </form>

      <div className="text-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
