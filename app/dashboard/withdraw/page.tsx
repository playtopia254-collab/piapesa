"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Download,
  ArrowLeft,
  MapPin,
  Star,
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  Building,
  Smartphone,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { mockApi, type User, type Agent, type WithdrawalRequest } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"
import { dispatchBalanceUpdate, pollBalance } from "@/lib/balance-updater"
import { AgentWithdrawalFlow } from "@/components/agent-withdrawal-flow"

export default function WithdrawPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [step, setStep] = useState(1) // 1: Method Selection, 2: Amount, 3: Agent Matching, 4: Matched
  const [withdrawalMethod, setWithdrawalMethod] = useState("")
  const [amount, setAmount] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [network, setNetwork] = useState("M-Pesa")
  const [reason, setReason] = useState("")
  const [agents, setAgents] = useState<Agent[]>([])
  const [matchedAgent, setMatchedAgent] = useState<Agent | null>(null)
  const [withdrawalRequest, setWithdrawalRequest] = useState<WithdrawalRequest | null>(null)
  const [withdrawalDetails, setWithdrawalDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showAgentFlow, setShowAgentFlow] = useState(false)
  const [activeRequest, setActiveRequest] = useState<any>(null)

  useEffect(() => {
    // Get user from sessionStorage
    if (typeof window !== "undefined") {
      const sessionUser = sessionStorage.getItem("currentUser")
      if (sessionUser) {
        try {
          const userData = JSON.parse(sessionUser)
          setUser(userData)
          // Set default phone number to user's phone (without +254 prefix for display)
          if (userData.phone && !phoneNumber) {
            setPhoneNumber(userData.phone.replace("+254", "0"))
          }
          // Check for active withdrawal requests
          if (userData.id) {
            checkActiveRequest(userData.id)
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

  // Check for active withdrawal requests
  const checkActiveRequest = async (userId: string) => {
    try {
      const response = await fetch(`/api/agent-withdrawals?userId=${userId}`)
      const data = await response.json()
      
      if (data.success && data.requests && data.requests.length > 0) {
        // Find active requests (pending, matched, in_progress)
        const active = data.requests.find(
          (req: any) => ["pending", "matched", "in_progress"].includes(req.status)
        )
        if (active) {
          setActiveRequest(active)
        }
      }
    } catch (error) {
      console.error("Failed to check active request:", error)
    }
  }

  // Cancel active withdrawal request
  const cancelActiveRequest = async (requestId: string) => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/agent-withdrawals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          userId: user?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel request")
      }

      setActiveRequest(null)
      alert("Withdrawal request cancelled successfully")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to cancel request")
    } finally {
      setIsLoading(false)
    }
  }

  const loadAgents = async () => {
    try {
      const nearbyAgents = await mockApi.getNearbyAgents()
      setAgents(nearbyAgents)
    } catch (error) {
      console.error("Failed to load agents:", error)
    }
  }

  const handleMethodSelect = (method: string) => {
    setWithdrawalMethod(method)
    setStep(2)
  }

  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const withdrawalAmount = Number.parseFloat(amount)
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    if (!user || withdrawalAmount > user.balance) {
      setError("Insufficient balance")
      return
    }

    setIsLoading(true)

    try {
      if (withdrawalMethod === "Mobile Money") {
        // Use provided phone number or default to user's phone
        let withdrawPhone = phoneNumber.trim() || user.phone || ""
        
        // Format phone number
        if (withdrawPhone) {
          if (withdrawPhone.startsWith("0")) {
            withdrawPhone = "+254" + withdrawPhone.slice(1)
          } else if (!withdrawPhone.startsWith("+254")) {
            withdrawPhone = "+254" + withdrawPhone
          }
        }

        if (!withdrawPhone) {
          setError("Please enter a phone number or ensure your account has a phone number")
          setIsLoading(false)
          return
        }

        // Ensure reason is not empty
        const withdrawalReason = reason.trim() || "Withdrawal to mobile money"
        
        if (!withdrawalReason) {
          setError("Please provide a reason for the withdrawal")
          setIsLoading(false)
          return
        }

        console.log("Withdraw request:", {
          phoneNumber: withdrawPhone,
          amount: withdrawalAmount,
          network: network,
          reason: withdrawalReason,
        })

        // Use the new transactions/withdraw endpoint that handles DB, polling, and balance updates
        const withdrawResponse = await fetch("/api/transactions/withdraw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            phoneNumber: withdrawPhone,
            amount: withdrawalAmount,
            network: network,
            reason: withdrawalReason,
          }),
        })

        if (!withdrawResponse.ok) {
          const errorData = await withdrawResponse.json().catch(() => ({}))
          const errorMessage = errorData.error || errorData.message || "Failed to initiate withdrawal"
          console.error("Withdrawal error:", errorData)
          throw new Error(errorMessage)
        }

        const withdrawData = await withdrawResponse.json()

        // Handle case where withdrawal was initiated but status check failed
        if (!withdrawData.success && withdrawData.transaction?.chambuTransactionId) {
          // Transaction was created but status verification failed
          // Try to verify it directly from Chambu Digital API
          try {
            const verifyResponse = await fetch("/api/transactions/verify-withdrawal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chambuTransactionId: withdrawData.transaction.chambuTransactionId,
              }),
            })

            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json()
              if (verifyData.success && verifyData.chambuStatus) {
                // Use verified status from Chambu Digital
                withdrawData.success = true
                withdrawData.transaction.status = verifyData.transaction.status
                withdrawData.transaction.completedAt = verifyData.transaction.completedAt
                withdrawData.transaction.sasapayTransactionCode = verifyData.transaction.sasapayTransactionCode
                if (verifyData.userBalance !== undefined) {
                  withdrawData.userBalance = verifyData.userBalance
                }
              } else if (verifyData.transaction) {
                // Even if Chambu status check failed, we have the transaction
                // Allow it to proceed but mark as pending
                withdrawData.success = true
                withdrawData.transaction = verifyData.transaction
              }
            }
          } catch (verifyError) {
            console.error("Verification error:", verifyError)
            // If verification fails but we have a transaction, still proceed
            if (withdrawData.transaction) {
              withdrawData.success = true
            }
          }
        }

        // If we have a transaction (even if success is false), proceed to show it
        if (!withdrawData.success && !withdrawData.transaction) {
          throw new Error(withdrawData.message || withdrawData.error || "Withdrawal initiation failed")
        }

        // Update user balance immediately if transaction completed
        if (withdrawData.userBalance !== undefined) {
          const newBalance = withdrawData.userBalance
          setUser((prev) => (prev ? { ...prev, balance: newBalance } : null))
          dispatchBalanceUpdate(user.id, newBalance)
        }

        // Create withdrawal request object for UI
        const request: WithdrawalRequest = {
          id: withdrawData.transaction._id || withdrawData.transaction.chambuTransactionId,
          userId: user.id,
          amount: withdrawalAmount,
          method: withdrawalMethod,
          status: withdrawData.transaction.status === "completed" ? "completed" : withdrawData.transaction.status === "failed" ? "cancelled" : "pending",
          createdAt: withdrawData.transaction.createdAt || new Date().toISOString(),
        }

        setWithdrawalRequest(request)
        setWithdrawalDetails({
          transactionId: withdrawData.transaction.chambuTransactionId,
          status: withdrawData.transaction.status,
          sasapay_transaction_code: withdrawData.transaction.sasapayTransactionCode,
          sasapayTransactionCode: withdrawData.transaction.sasapayTransactionCode,
          completed_at: withdrawData.transaction.completedAt,
        })

        // If transaction is still pending, poll for balance updates
        if (withdrawData.transaction.status === "pending" && withdrawData.transaction.chambuTransactionId) {
          // Poll balance in background to update when transaction completes
          pollBalance(user.id, {
            interval: 3000,
            maxAttempts: 20,
            onUpdate: (balance) => {
              setUser((prev) => (prev ? { ...prev, balance } : null))
            },
          })
        }

        setStep(4) // Move to receipt
        setIsLoading(false)
      } else if (withdrawalMethod === "Via Agent") {
        // Use mock API for agent-based withdrawals
      const request = await mockApi.requestWithdrawal({
        amount: withdrawalAmount,
        method: withdrawalMethod,
      })

      setWithdrawalRequest(request)
        await loadAgents()
        setStep(3) // Move to agent matching
        setIsLoading(false)
      } else {
        // For bank deposit, use mock API
        const request = await mockApi.requestWithdrawal({
          amount: withdrawalAmount,
          method: withdrawalMethod,
        })

        setWithdrawalRequest(request)
        setTimeout(() => {
          setStep(4)
          setIsLoading(false)
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal request failed")
        setIsLoading(false)
    }
  }

  const handleAgentMatch = async (agent: Agent) => {
    setIsLoading(true)
    setMatchedAgent(agent)

    try {
      const result = await mockApi.matchWithAgent(withdrawalRequest!.id)
      setMatchedAgent(result.agent)
      setWithdrawalRequest(result.request)
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to match with agent")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCollected = () => {
    // Simulate collection completion
    router.push("/dashboard/transactions")
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

  // Success/Matched step
  if (step === 4) {
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
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className={
              withdrawalRequest?.status === "completed"
                ? "text-green-600"
                : withdrawalRequest?.status === "cancelled"
                  ? "text-red-600"
                  : "text-yellow-600"
            }>
              {withdrawalMethod === "Via Agent" 
                ? "Agent Matched!" 
                : withdrawalRequest?.status === "completed"
                  ? "Withdrawal Successful!"
                  : withdrawalRequest?.status === "cancelled"
                    ? "Withdrawal Failed"
                    : "Withdrawal Requested!"}
            </CardTitle>
            <CardDescription>
              {withdrawalMethod === "Via Agent"
                ? "You've been matched with a nearby agent"
                : withdrawalRequest?.status === "completed"
                  ? "Your withdrawal has been processed successfully"
                  : withdrawalRequest?.status === "cancelled"
                    ? "The withdrawal could not be completed"
                : "Your withdrawal request is being processed"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              {withdrawalRequest && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction ID</span>
                  <span className="text-sm font-mono">{withdrawalRequest.id}</span>
                </div>
              )}
              {(withdrawalDetails?.sasapay_transaction_code || withdrawalDetails?.sasapayTransactionCode) && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">SasaPay Code</span>
                  <span className="text-sm font-mono font-semibold">{withdrawalDetails.sasapay_transaction_code || withdrawalDetails.sasapayTransactionCode}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-sm font-semibold">
                  <CurrencyFormatter amount={Number.parseFloat(amount)} />
                </span>
              </div>
              {withdrawalDetails?.transactionFee && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction Fee</span>
                  <span className="text-sm">
                    <CurrencyFormatter amount={withdrawalDetails.transactionFee} />
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Method</span>
                <span className="text-sm font-medium">{withdrawalMethod}</span>
              </div>
              {withdrawalDetails?.recipient_name && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <span className="text-sm font-medium">{withdrawalDetails.recipient_name}</span>
                </div>
              )}
              {withdrawalRequest?.createdAt && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Requested At</span>
                  <span className="text-sm">{new Date(withdrawalRequest.createdAt).toLocaleString()}</span>
                </div>
              )}
              {withdrawalDetails?.sasapayTransactionCode && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">SasaPay Code</span>
                  <span className="text-sm font-mono">{withdrawalDetails.sasapayTransactionCode}</span>
                </div>
              )}
              {withdrawalRequest?.createdAt && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm">{new Date(withdrawalRequest.createdAt).toLocaleString()}</span>
                </div>
              )}
              {withdrawalDetails?.result_desc && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Result</span>
                  <span className="text-sm">{withdrawalDetails.result_desc}</span>
                </div>
              )}
              {withdrawalRequest && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant="secondary"
                    className={
                      withdrawalRequest.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : withdrawalRequest.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }
                  >
                    {withdrawalRequest.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                    {withdrawalRequest.status === "cancelled" && <AlertCircle className="w-3 h-3 mr-1" />}
                    {withdrawalRequest.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                    {withdrawalRequest.status === "completed" ? "Completed" : withdrawalRequest.status === "cancelled" ? "Failed" : "Pending"}
                  </Badge>
                </div>
              )}
              {matchedAgent && (
                <>
                  <div className="border-t pt-3 mt-3">
                    <h4 className="font-medium mb-2">Agent Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Name</span>
                        <span className="text-sm font-medium">{matchedAgent.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Phone</span>
                        <span className="text-sm">
                          <PhoneFormatter phone={matchedAgent.phone} />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Location</span>
                        <span className="text-sm">{matchedAgent.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Rating</span>
                        <div className="flex items-center space-x-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{matchedAgent.rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {matchedAgent ? (
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Contact the agent to arrange collection. Once you've collected your cash, mark as completed below.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" asChild>
                    <a href={`tel:${matchedAgent.phone}`}>
                      <Phone className="w-4 h-4 mr-2" />
                      Call Agent
                    </a>
                  </Button>
                  <Button onClick={handleCollected}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Collected
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Your withdrawal request is being processed. You'll receive a notification once it's complete.
                  </AlertDescription>
                </Alert>
                <Button onClick={() => router.push("/dashboard/transactions")} className="w-full">
                  View Transaction History
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Agent matching step
  if (step === 3) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => setStep(2)}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Choose an Agent</h1>
          <p className="text-muted-foreground">Select a nearby agent to collect your cash</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Available Agents</CardTitle>
            <CardDescription>
              Withdrawing <CurrencyFormatter amount={Number.parseFloat(amount)} className="font-semibold" /> via agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No agents available in your area</p>
                <p className="text-sm text-muted-foreground">Try again later or choose a different withdrawal method</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{agent.name}</h3>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{agent.location}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span>{agent.rating}</span>
                          </div>
                          <span>•</span>
                          <span>{agent.totalTransactions} transactions</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          {agent.availableNetworks.map((network) => (
                            <Badge key={network} variant="outline" className="text-xs">
                              {network}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-2">
                        Max: <CurrencyFormatter amount={agent.maxAmount} />
                      </p>
                      <Button
                        onClick={() => handleAgentMatch(agent)}
                        disabled={isLoading || Number.parseFloat(amount) > agent.maxAmount}
                        size="sm"
                      >
                        {isLoading && matchedAgent?.id === agent.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Select"
                        )}
                      </Button>
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

  // Amount input step
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
            Back
          </Button>
          <h1 className="text-2xl font-bold">Enter Amount</h1>
          <p className="text-muted-foreground">How much would you like to withdraw?</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-primary" />
              <span>Withdrawal via {withdrawalMethod}</span>
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

            <form onSubmit={handleAmountSubmit} className="space-y-4">
              {withdrawalMethod === "Mobile Money" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Mobile Money Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder={`${user.phone?.replace("+254", "0") || "0712345678"} or enter different number`}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the phone number to receive the money. Leave empty to use your account number ({user.phone?.replace("+254", "0")}).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="network">Network *</Label>
                    <Select value={network} onValueChange={setNetwork}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M-Pesa">
                          <div className="flex items-center space-x-2">
                            <span>📱</span>
                            <span>M-Pesa</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="Airtel Money">
                          <div className="flex items-center space-x-2">
                            <span>📲</span>
                            <span>Airtel Money</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="T-Kash">
                          <div className="flex items-center space-x-2">
                            <span>📱</span>
                            <span>T-Kash</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (KES) *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  min="1"
                  step="0.01"
                  max={user.balance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Minimum: KES 1 | Maximum: KES 250,000</p>
              </div>

              {withdrawalMethod === "Mobile Money" && (
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Personal use, Business payment, etc."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Please provide a reason for this withdrawal</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[1000, 2000, 5000].map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                    disabled={quickAmount > user.balance}
                  >
                    <CurrencyFormatter amount={quickAmount} />
                  </Button>
                ))}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {withdrawalMethod === "Via Agent" ? "Find Agents" : "Withdraw to Mobile Money"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Method selection step - show Agent Flow if active
  if (showAgentFlow && user) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <AgentWithdrawalFlow
          user={{
            id: user.id,
            name: user.name,
            phone: user.phone,
            balance: user.balance,
            location: user.location,
          }}
          onComplete={() => {
            setShowAgentFlow(false)
            router.push("/dashboard")
          }}
          onCancel={() => setShowAgentFlow(false)}
        />
      </div>
    )
  }

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
        <h1 className="text-2xl font-bold">Withdraw Money</h1>
        <p className="text-muted-foreground">Choose how you'd like to access your cash</p>
      </div>

      {/* Show active withdrawal request if exists */}
      {activeRequest && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Clock className="h-5 w-5" />
              Active Withdrawal Request
            </CardTitle>
            <CardDescription>
              You have an active withdrawal request. Cancel it to create a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  <CurrencyFormatter amount={activeRequest.amount} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={
                    activeRequest.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : activeRequest.status === "matched"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                  }
                >
                  {activeRequest.status === "pending"
                    ? "Pending"
                    : activeRequest.status === "matched"
                      ? "Matched"
                      : "In Progress"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Location</span>
                <span className="text-sm">{activeRequest.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm">
                  {new Date(activeRequest.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => cancelActiveRequest(activeRequest._id)}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancel This Request
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-primary"
          onClick={() => setShowAgentFlow(true)}
        >
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Via Agent</CardTitle>
            <CardDescription>Get matched with nearby agents for instant cash pickup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Uber-like matching</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Available 24/7</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>No fees</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => handleMethodSelect("Bank Deposit")}
        >
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Building className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Bank Deposit</CardTitle>
            <CardDescription>Transfer directly to your bank account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Secure transfer</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span>1-2 business days</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Low fees</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => handleMethodSelect("Mobile Money")}
        >
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Mobile Money</CardTitle>
            <CardDescription>Send to M-Pesa, Airtel Money, or other mobile wallets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Instant transfer</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>All networks</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Standard fees</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary mb-2">
            <CurrencyFormatter amount={user.balance} />
          </div>
          <p className="text-sm text-muted-foreground">Available for withdrawal</p>
        </CardContent>
      </Card>
    </div>
  )
}
