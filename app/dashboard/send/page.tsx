"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, ArrowLeft, CheckCircle, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"
import { mockApi, type User, type Transaction } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import mockData from "@/data/mock-data.json"
import { onBalanceUpdate, dispatchBalanceUpdate } from "@/lib/balance-updater"

export default function SendMoneyPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [step, setStep] = useState(1) // 1: Form, 2: Confirm, 3: Processing, 4: Receipt
  const [formData, setFormData] = useState({
    toPhone: "",
    amount: "",
    network: "M-Pesa",
    purpose: "",
  })
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [transactionDetails, setTransactionDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    // Get user from sessionStorage (set during login)
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
            
            // Listen for real-time balance updates
            const cleanup = onBalanceUpdate(userData.id, (newBalance) => {
              setUser(prev => prev ? { ...prev, balance: newBalance } : null)
            })
            
            return cleanup
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

    // Validation
    const amount = Number.parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    if (!user || amount > user.balance) {
      setError("Insufficient balance")
      return
    }

    if (!formData.toPhone || !formData.network) {
      setError("Please fill in all required fields")
      return
    }

    // Format phone number
    let phone = formData.toPhone.trim()
    if (phone.startsWith("0")) {
      phone = "+254" + phone.slice(1)
    } else if (!phone.startsWith("+254")) {
      phone = "+254" + phone
    }

    setFormData((prev) => ({ ...prev, toPhone: phone }))
    setStep(2) // Move to confirmation
  }

  const handleConfirm = async () => {
    if (!user || !user.id) {
      setError("User not authenticated")
      return
    }

    setIsLoading(true)
    setStep(3) // Move to processing

    try {
      // Call Pia Pesa transfer API (handles Chambu Digital + database updates)
      const transferResponse = await fetch("/api/transactions/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromUserId: user.id,
          toPhone: formData.toPhone,
          amount: Number.parseFloat(formData.amount),
          network: formData.network,
          purpose: formData.purpose || undefined,
        }),
      })

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json()
        throw new Error(errorData.error || "Failed to initiate transfer")
      }

      const transferData = await transferResponse.json()

      if (!transferData.success) {
        throw new Error(transferData.error || "Transfer failed")
      }

      // Create transaction object for UI
      const newTransaction: Transaction = {
        id: transferData.transaction.id,
        fromUserId: transferData.transaction.fromUserId,
        toUserId: transferData.transaction.toUserId || undefined,
        toPhone: transferData.transaction.toPhone,
        amount: transferData.transaction.amount,
        network: transferData.transaction.network,
        purpose: transferData.transaction.purpose,
        status: transferData.transaction.status,
        type: "send",
        createdAt: new Date(transferData.transaction.createdAt).toISOString(),
        completedAt: transferData.transaction.completedAt 
          ? new Date(transferData.transaction.completedAt).toISOString() 
          : undefined,
      }

      setTransaction(newTransaction)
      
      // Store transaction details including recipient info
      setTransactionDetails({
        ...transferData.transaction,
        recipientIsPiaPesaUser: transferData.recipientIsPiaPesaUser,
        recipientBalance: transferData.recipientBalance,
      })

      // Update user balance
      if (transferData.senderBalance !== undefined) {
        const newBalance = transferData.senderBalance
        setUser(prev => prev ? { ...prev, balance: newBalance } : null)
        // Dispatch balance update event to update all components
        dispatchBalanceUpdate(user.id, newBalance)
      }

      // If external transfer is still pending, we could poll status here (optional)

      setStep(4) // Move to receipt
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed")
      setStep(2) // Back to confirmation
      setIsLoading(false)
    }
  }

  const getNetworkColor = (network: string) => {
    const networkData = mockData.networks.find((n) => n.name === network)
    return networkData?.color || "#000000"
  }

  const getNetworkIcon = (network: string) => {
    if (network === "Pia Pesa" || network === "Pia Pesa Wallet") return "💳"
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
  if (step === 4 && transaction) {
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
                ? "Transaction Successful!" 
                : transaction.status === "failed"
                  ? "Transaction Failed"
                  : "Transaction Pending"}
            </CardTitle>
            <CardDescription>
              {transaction.status === "completed" 
                ? "Your money has been sent successfully" 
                : transaction.status === "failed"
                  ? "The transaction could not be completed"
                  : "Please wait while we process your transaction"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="text-sm font-mono">{transaction.id}</span>
              </div>
              {transactionDetails?.sasapay_transaction_code && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">SasaPay Code</span>
                  <span className="text-sm font-mono font-semibold">{transactionDetails.sasapay_transaction_code}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount Sent</span>
                <span className="text-sm font-semibold">
                  <CurrencyFormatter amount={transaction.amount} />
                </span>
              </div>
              {transactionDetails?.transactionFee && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction Fee</span>
                  <span className="text-sm">
                    <CurrencyFormatter amount={transactionDetails.transactionFee} />
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="text-sm font-medium">{transaction.toPhone?.replace("+254", "0")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Network</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">{getNetworkIcon(transaction.network)}</span>
                  <span className="text-sm font-medium">{transaction.network}</span>
                </div>
              </div>
              {transaction.purpose && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Purpose</span>
                  <span className="text-sm">{transaction.purpose}</span>
                </div>
              )}
              {transactionDetails?.networkChanged && (
                <Alert className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Recipient is not a Pia Pesa user. Payment sent via {transaction.network} instead.
                  </AlertDescription>
                </Alert>
              )}
              {transactionDetails?.recipientIsPiaPesaUser && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <span className="text-sm font-medium text-green-600">Pia Pesa User ✓</span>
                </div>
              )}
              {transactionDetails?.recipientBalance !== null && transactionDetails?.recipientBalance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Recipient Balance</span>
                  <span className="text-sm font-semibold">
                    <CurrencyFormatter amount={transactionDetails.recipientBalance} />
                  </span>
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
              {transactionDetails?.result_desc && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Result</span>
                  <span className="text-sm">{transactionDetails.result_desc}</span>
                </div>
              )}
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
              <Button onClick={() => router.push("/dashboard/send")} className="w-full">
                Send Another
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard/transactions")} className="w-full">
                View All Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Processing step
  if (step === 3) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <CardTitle>Processing Transaction</CardTitle>
            <CardDescription>Please wait while we process your payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Validating recipient</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Checking balance</span>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
                <span className="text-sm">Processing payment...</span>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sending</span>
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

  // Confirmation step
  if (step === 2) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => setStep(1)}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Form
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Confirm Transaction</CardTitle>
            <CardDescription>Please review the details before sending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-lg font-semibold text-primary">
                  <CurrencyFormatter amount={Number.parseFloat(formData.amount)} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="text-sm font-medium">{formData.toPhone.replace("+254", "0")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Network</span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm">{getNetworkIcon(formData.network)}</span>
                  <span className="text-sm font-medium">{formData.network}</span>
                </div>
              </div>
              {formData.purpose && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Purpose</span>
                  <span className="text-sm">{formData.purpose}</span>
                </div>
              )}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Your Balance</span>
                  <span className="text-sm">
                    <CurrencyFormatter amount={user.balance} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">After Transaction</span>
                  <span className="text-sm font-medium">
                    <CurrencyFormatter amount={user.balance - Number.parseFloat(formData.amount)} />
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button onClick={handleConfirm} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Send Money
              </Button>
              <Button variant="outline" onClick={() => setStep(1)} className="w-full">
                Edit Details
              </Button>
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
        <h1 className="text-2xl font-bold">Send Money</h1>
        <p className="text-muted-foreground">Transfer money to any phone number</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Send className="w-5 h-5 text-primary" />
            <span>Transfer Details</span>
          </CardTitle>
          <CardDescription>
            Available Balance: <CurrencyFormatter amount={user.balance} className="font-semibold text-primary" />
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
              <Label htmlFor="toPhone">Recipient Phone Number *</Label>
              <Input
                id="toPhone"
                type="tel"
                placeholder="0712345678 or +254712345678"
                value={formData.toPhone}
                onChange={(e) => handleInputChange("toPhone", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                min="1"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="network">Network *</Label>
              <Select value={formData.network} onValueChange={(value) => handleInputChange("network", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pia Pesa">
                    <div className="flex items-center space-x-2">
                      <span>💳</span>
                      <span>Pia Pesa Wallet</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="M-Pesa">
                    <div className="flex items-center space-x-2">
                      <span>📱</span>
                      <span>M-Pesa</span>
                    </div>
                  </SelectItem>
                  {mockData.networks
                    .filter((n) => n.name !== "M-Pesa" && n.name !== "Bank Transfer")
                    .map((network) => (
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
              <Label htmlFor="purpose">Purpose (Optional)</Label>
              <Textarea
                id="purpose"
                placeholder="e.g., School fees, Lunch money, etc."
                value={formData.purpose}
                onChange={(e) => handleInputChange("purpose", e.target.value)}
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
