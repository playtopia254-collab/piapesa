"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, Shield, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AdminLoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Check if already logged in
  useEffect(() => {
    if (typeof window !== "undefined") {
      const adminSession = sessionStorage.getItem("adminUser")
      if (adminSession) {
        router.push("/admin")
      }
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // For demo purposes, we'll accept any credentials
      // In production, this would check against admin users in the database
      // For now, we'll use a simple check - you can use any email/password
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Simulate admin login - in real app, verify admin credentials
      // For demo: accept any login and set admin session
      const adminUser = {
        id: "admin_001",
        email: formData.email,
        name: "Admin User",
        phone: "+254700000000",
        balance: 0,
        isAgent: false,
        pin: "",
        createdAt: new Date().toISOString(),
      }

      // Store admin session (in real app, use proper session management)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("adminUser", JSON.stringify(adminUser))
      }

      router.push("/admin")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-muted-foreground">Sign in to access the admin dashboard</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Administrator Access</CardTitle>
            <CardDescription>Enter your admin credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@piapesa.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Shield className="w-4 h-4 mr-2" />
                Sign In as Admin
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <p className="text-sm font-medium">Demo Admin Credentials:</p>
          <div className="text-xs space-y-1">
            <p>
              <span className="font-medium">Email:</span> admin@piapesa.com
            </p>
            <p>
              <span className="font-medium">Password:</span> (any password works in demo)
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: In production, this would require proper admin authentication
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

