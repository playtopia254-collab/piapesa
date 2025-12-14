"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Send, Download, Users, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, ArrowUpCircle } from "lucide-react"
import Link from "next/link"
import { mockApi, type User, type Transaction } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"
import { onBalanceUpdate } from "@/lib/balance-updater"

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ moneySent: 0, moneyReceived: 0, cashWithdrawn: 0 })

  useEffect(() => {
    const loadData = async () => {
      if (typeof window === "undefined") return

      let cleanup: (() => void) | undefined

      const setUserAndSubscribe = async (userData: User) => {
        setUser(userData)

        // Fetch latest balance from database
        if (userData.id) {
        try {
            const balanceResponse = await fetch(`/api/user/balance?userId=${userData.id}`)
            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json()
              if (balanceData.success) {
                setUser((prev) => (prev ? { ...prev, balance: balanceData.balance } : null))
                // Update sessionStorage with latest balance
                const updatedUser = { ...userData, balance: balanceData.balance }
                sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
              }
            }
          } catch (error) {
            console.error("Failed to fetch balance:", error)
          }

          // Listen for real-time balance updates
          cleanup = onBalanceUpdate(userData.id, (newBalance) => {
            setUser((prev) => (prev ? { ...prev, balance: newBalance } : null))
          })
        }

        // Load transactions from API
        try {
          const response = await fetch(`/api/transactions?userId=${userData.id}&limit=5`)
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              setTransactions(data.transactions)
            }
          }
        } catch (error) {
          console.error("Failed to load transactions:", error)
        }
      }

      try {
        const sessionUser = sessionStorage.getItem("currentUser")
        if (sessionUser) {
          const userData = JSON.parse(sessionUser)
          await setUserAndSubscribe(userData)
        } else {
          // Fallback to mockApi current user (for existing sessions)
          const fallbackUser = mockApi.getCurrentUser()
          if (fallbackUser) {
            await setUserAndSubscribe(fallbackUser)
            sessionStorage.setItem("currentUser", JSON.stringify(fallbackUser))
          } else {
            // No user; redirect to login
            window.location.href = "/login"
          }
        }
      } catch (error) {
        console.error("Failed to load user:", error)
        window.location.href = "/login"
      } finally {
      setIsLoading(false)
      }

      return () => {
        if (cleanup) cleanup()
      }
    }

    loadData()
  }, [])

  // Calculate stats from all transactions
  useEffect(() => {
    const fetchStats = async () => {
      if (!user || !user.id) {
        setStats({ moneySent: 0, moneyReceived: 0, cashWithdrawn: 0 })
        return
      }

      try {
        const response = await fetch(`/api/transactions?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.transactions) {
            const allTransactions = data.transactions
            
            const moneySent = allTransactions
              .filter((txn: Transaction) => txn.type === "send" && txn.status === "completed")
              .reduce((sum: number, txn: Transaction) => sum + txn.amount, 0)
            
            const moneyReceived = allTransactions
              .filter((txn: Transaction) => (txn.type === "receive" || txn.type === "deposit") && txn.status === "completed")
              .reduce((sum: number, txn: Transaction) => sum + txn.amount, 0)
            
            const cashWithdrawn = allTransactions
              .filter((txn: Transaction) => txn.type === "withdrawal" && txn.status === "completed")
              .reduce((sum: number, txn: Transaction) => sum + txn.amount, 0)
            
            setStats({ moneySent, moneyReceived, cashWithdrawn })
          }
        }
      } catch (error) {
        console.error("Failed to fetch transactions for stats:", error)
        setStats({ moneySent: 0, moneyReceived: 0, cashWithdrawn: 0 })
      }
    }

    fetchStats()
  }, [user])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!user) return null

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === "send") return <ArrowUpRight className="w-4 h-4 text-red-500" />
    if (transaction.type === "receive") return <ArrowDownRight className="w-4 h-4 text-green-500" />
    if (transaction.type === "deposit") return <ArrowUpCircle className="w-4 h-4 text-green-500" />
    if (transaction.type === "withdrawal") return <Download className="w-4 h-4 text-blue-500" />
    return <Clock className="w-4 h-4 text-muted-foreground" />
  }

  const getTransactionAmount = (transaction: Transaction) => {
    if (transaction.type === "receive" || transaction.type === "deposit") return transaction.amount
    return -transaction.amount
  }

  const getTransactionDescription = (transaction: Transaction) => {
    if (transaction.type === "send") {
      return `Sent to ${transaction.toPhone?.replace("+254", "0") || "Unknown"}`
    }
    if (transaction.type === "receive") {
      return `Received from ${transaction.fromPhone?.replace("+254", "0") || "Unknown"}`
    }
    if (transaction.type === "deposit") {
      return "Deposit to wallet"
    }
    if (transaction.type === "withdrawal") {
      return "Cash withdrawal"
    }
    return "Transaction"
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-balance">Welcome back, {user.name.split(" ")[0]}!</h1>
        <p className="text-muted-foreground">Here's what's happening with your money today.</p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 border-primary/20">
          <Link href="/dashboard/deposit">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deposit Money</CardTitle>
              <ArrowUpCircle className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Add Funds</div>
              <p className="text-xs text-muted-foreground">Top up via M-Pesa, Airtel, T-Kash</p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/send">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Send Money</CardTitle>
              <Send className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Quick Send</div>
              <p className="text-xs text-muted-foreground">Transfer to any network</p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/dashboard/withdraw">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Withdraw Cash</CardTitle>
              <Download className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Get Cash</div>
              <p className="text-xs text-muted-foreground">Via agents or bank</p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Balance overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Account Balance
              {user.isAgent && <Badge variant="secondary">Agent</Badge>}
            </CardTitle>
            <CardDescription>Your available funds across all networks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary mb-4">
              <CurrencyFormatter amount={user.balance} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Account Type</span>
                <span className="font-medium">{user.isAgent ? "Agent Account" : "Personal Account"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone Number</span>
                <span className="font-medium">
                  <PhoneFormatter phone={user.phone} />
                </span>
              </div>
              {user.isAgent && user.rating && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agent Rating</span>
                  <span className="font-medium">⭐ {user.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Your activity summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowUpRight className="w-4 h-4 text-red-500" />
                <span className="text-sm">Money Sent</span>
              </div>
              <span className="font-medium">
                <CurrencyFormatter amount={stats.moneySent} />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowDownRight className="w-4 h-4 text-green-500" />
                <span className="text-sm">Money Received</span>
              </div>
              <span className="font-medium">
                <CurrencyFormatter amount={stats.moneyReceived} />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Cash Withdrawn</span>
              </div>
              <span className="font-medium">
                <CurrencyFormatter amount={stats.cashWithdrawn} />
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div>
            <CardTitle className="text-lg sm:text-xl">Recent Transactions</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Your latest money movements</CardDescription>
          </div>
          <Link href="/dashboard/transactions" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground">Start by sending money or making a withdrawal</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 py-2 sm:py-2"
                >
                  <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                    {getTransactionIcon(transaction)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getTransactionDescription(transaction)}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
                        <span className="whitespace-nowrap">{transaction.network}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">{new Date(transaction.createdAt).toLocaleDateString()}</span>
                        <span className="hidden sm:inline">•</span>
                        <div className="flex items-center space-x-1">
                          {transaction.status === "completed" ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <Clock className="w-3 h-3 text-yellow-500" />
                          )}
                          <span className="capitalize">{transaction.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0 sm:ml-4">
                    <p
                      className={`text-sm sm:text-base font-medium ${
                        getTransactionAmount(transaction) > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {getTransactionAmount(transaction) > 0 ? "+" : ""}
                      <CurrencyFormatter amount={getTransactionAmount(transaction)} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent-specific section */}
      {user.isAgent && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Dashboard</CardTitle>
            <CardDescription>Manage your agent activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Requests</p>
                <p className="text-2xl font-bold text-primary">2</p>
                <p className="text-xs text-muted-foreground">Pending withdrawal requests</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Today's Earnings</p>
                <p className="text-2xl font-bold text-green-600">
                  <CurrencyFormatter amount={450} />
                </p>
                <p className="text-xs text-muted-foreground">Commission from 3 transactions</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/dashboard/become-agent">
                <Button className="w-full">Manage Agent Requests</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
