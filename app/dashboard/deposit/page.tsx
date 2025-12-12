"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowUpCircle, ArrowLeft, CheckCircle, Clock, AlertCircle, Smartphone } from "lucide-react"
import Link from "next/link"
import { CurrencyFormatter } from "@/components/currency-formatter"
import mockData from "@/data/mock-data.json"
import { dispatchBalanceUpdate, pollBalance } from "@/lib/balance-updater"

interface User {
  id: string
  name: string
  phone: string
  email: string
  balance: number
  isAgent: boolean
}

export default function DepositPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [step, setStep] = useState(1) // 1: Form, 2: Processing, 3: Receipt
  const [formData, setFormData] = useState({
    amount: "",
    network: "M-Pesa",
    description: "",
  })
  const [transaction, setTransaction] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isBalanceUpdating, setIsBalanceUpdating] = useState(false)

  useEffect(() => {
    // Get user from sessionStorage
    if (typeof window !== "undefined") {
      const sessionUser = sessionStorage.getItem("currentUser")
      if (sessionUser) {
        try {
          const userData = JSON.parse(sessionUser)
          setUser(userData)
          
          // Fetch latest balance from database
          if (userData.id) {
            fetch(`/api/user/balance?userId=${userData.id}`)
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  setUser(prev => prev ? { ...prev, balance: data.balance } : null)
                }
              })
              .catch(err => console.error("Failed to fetch balance:", err))
          }
        } catch (e) {
          console.error("Failed to parse user from session:", e)
          router.push("/login")
        }
      } else {
        router.push("/login")
      }
    }
  }, [router])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!user || !user.id) {
      setError("User not authenticated")
      return
    }

    // Validation
    const amount = Number.parseFloat(formData.amount)
    if (isNaN(amount) || amount < 1 || amount > 250000) {
      setError("Amount must be between KES 1 and KES 250,000")
      return
    }

    setIsLoading(true)
    setStep(2) // Move to processing

    try {
      // Call deposit API
      const depositResponse = await fetch("/api/transactions/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          amount: amount,
          network: formData.network,
          description: formData.description || "Deposit to Pia Pesa",
        }),
      })

      if (!depositResponse.ok) {
        const errorData = await depositResponse.json()
        throw new Error(errorData.error || "Failed to initiate deposit")
      }

      const depositData = await depositResponse.json()

      if (!depositData.success) {
        throw new Error(depositData.error || "Deposit failed")
      }

      setTransaction(depositData.transaction)

      // Update user balance immediately if transaction completed
      if (depositData.userBalance !== undefined && depositData.transaction.status === "completed") {
        const newBalance = depositData.userBalance
        setUser(prev => prev ? { ...prev, balance: newBalance } : null)
        
        // Dispatch balance update event to update all components
        dispatchBalanceUpdate(user.id, newBalance)
      }

      // If transaction is still pending, poll for balance updates
      if (depositData.transaction.status === "pending") {
        setIsBalanceUpdating(true)
        // Poll for balance updates in the background
        pollBalance(user.id, {
          interval: 2000, // Check every 2 seconds
          maxAttempts: 30, // For 60 seconds
          onUpdate: (balance) => {
            const oldBalance = user.balance || 0
            setUser(prev => prev ? { ...prev, balance } : null)
            // Update transaction status if balance changed (payment completed)
            if (balance > oldBalance) {
              setTransaction(prev => prev ? { ...prev, status: "completed" } : null)
              setIsBalanceUpdating(false)
            }
          },
        }).finally(() => {
          setIsBalanceUpdating(false)
        })
      }

      setStep(3) // Move to receipt
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed")
      setStep(1) // Back to form
      setIsLoading(false)
    }
  }

  const getNetworkIcon = (network: string) => {
    const networkData = mockData.networks.find((n) => n.name === network)
    return networkData?.icon || "📱"
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

  // Receipt step
  if (step === 3 && transaction) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              transaction.status === "completed" 
                ? "bg-green-100" 
                : transaction.status === "failed"
                  ? "bg-red-100"
                  : "bg-yellow-100"
            }`}>
              {transaction.status === "completed" ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : transaction.status === "failed" ? (
                <AlertCircle className="w-8 h-8 text-red-600" />
              ) : (
                <Clock className="w-8 h-8 text-yellow-600" />
              )}
            </div>
            <CardTitle className={
              transaction.status === "completed" 
                ? "text-green-600" 
                : transaction.status === "failed"
                  ? "text-red-600"
                  : "text-yellow-600"
            }>
              {transaction.status === "completed" 
                ? "Deposit Successful!" 
                : transaction.status === "failed"
                  ? "Deposit Failed"
                  : "Deposit Pending"}
            </CardTitle>
            <CardDescription>
              {transaction.status === "completed" 
                ? "Your money has been added to your wallet" 
                : transaction.status === "failed"
                  ? "The deposit could not be completed"
                  : "Please complete the payment on your phone"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="text-sm font-mono">{transaction.id}</span>
              </div>
              {transaction.sasapayTransactionCode && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">SasaPay Code</span>
                  <span className="text-sm font-mono font-semibold">{transaction.sasapayTransactionCode}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount Deposited</span>
                <span className="text-sm font-semibold">
                  <CurrencyFormatter amount={transaction.amount} />
                </span>
              </div>
              {transaction.transactionFee && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction Fee</span>
                  <span className="text-sm">
                    <CurrencyFormatter amount={transaction.transactionFee} />
                  </span>
                </div>
              )}
              {transaction.totalCharge && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Charged</span>
                  <span className="text-sm font-semibold">
                    <CurrencyFormatter amount={transaction.totalCharge} />
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Network</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">{getNetworkIcon(transaction.network)}</span>
                  <span className="text-sm font-medium">{transaction.network}</span>
                </div>
              </div>
              {transaction.purpose && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Description</span>
                  <span className="text-sm">{transaction.purpose}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <span className="text-sm">{new Date(transaction.createdAt).toLocaleString()}</span>
              </div>
              {transaction.completedAt && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Completed At</span>
                  <span className="text-sm">{new Date(transaction.completedAt).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">New Balance</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-semibold text-green-600 ${isBalanceUpdating ? 'animate-pulse' : ''}`}>
                    <CurrencyFormatter amount={user.balance} />
                  </span>
                  {transaction.status === "completed" && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                  {isBalanceUpdating && transaction.status === "pending" && (
                    <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant="secondary" 
                  className={
                    transaction.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : transaction.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }
                >
                  {transaction.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                  {transaction.status === "failed" && <AlertCircle className="w-3 h-3 mr-1" />}
                  {transaction.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                  {transaction.status === "completed" ? "Completed" : transaction.status === "failed" ? "Failed" : "Pending"}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {transaction.status === "pending" && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Please check your phone and complete the payment. Your balance will update automatically once payment is confirmed.
                  </AlertDescription>
                </Alert>
              )}
              <Button onClick={() => router.push("/dashboard/deposit")} className="w-full">
                Deposit More
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard")} className="w-full">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Processing step
  if (step === 2) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <CardTitle>Processing Deposit</CardTitle>
            <CardDescription>Please wait while we process your payment request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Validating amount</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Sending STK Push request...</span>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
                <span className="text-sm">Waiting for payment confirmation...</span>
              </div>
            </div>

            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                Check your phone ({user.phone.replace("+254", "0")}) for an STK Push notification. Enter your M-Pesa PIN to complete the payment.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Depositing</span>
                <span className="font-semibold">
                  <CurrencyFormatter amount={Number.parseFloat(formData.amount)} />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Form step
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Deposit Money</h1>
        <p className="text-muted-foreground">Add money to your Pia Pesa wallet</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ArrowUpCircle className="w-5 h-5 text-primary" />
            <span>Deposit Details</span>
          </CardTitle>
          <CardDescription>
            Current Balance: <CurrencyFormatter amount={user.balance} className="font-semibold text-primary" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                min="1"
                max="250000"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Minimum: KES 1 | Maximum: KES 250,000</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="network">Network *</Label>
              <Select value={formData.network} onValueChange={(value) => handleInputChange("network", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  {mockData.networks.filter(n => n.name !== "Bank Transfer").map((network) => (
                    <SelectItem key={network.id} value={network.name}>
                      <div className="flex items-center space-x-2">
                        <span>{network.icon}</span>
                        <span>{network.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                type="text"
                placeholder="e.g., Wallet top-up"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  <CurrencyFormatter amount={formData.amount ? Number.parseFloat(formData.amount) : 0} />
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction Fee (0.25% + KES 1)</span>
                <span className="text-sm">
                  <CurrencyFormatter amount={formData.amount ? (Number.parseFloat(formData.amount) * 0.0025 + 1) : 0} />
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                <span>Total to Pay</span>
                <span>
                  <CurrencyFormatter amount={formData.amount ? (Number.parseFloat(formData.amount) * 1.0025 + 1) : 0} />
                </span>
              </div>
            </div>

            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                You will receive an STK Push notification on your phone ({user.phone.replace("+254", "0")}) to complete the payment.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Request Payment
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

