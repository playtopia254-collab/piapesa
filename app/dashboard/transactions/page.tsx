"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  FileDown,
  ArrowUpCircle,
} from "lucide-react"
import { mockApi, type User, type Transaction } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"
import mockData from "@/data/mock-data.json"

export default function TransactionsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    const loadData = async () => {
      // Get user from sessionStorage
      if (typeof window !== "undefined") {
        const sessionUser = sessionStorage.getItem("currentUser")
        if (sessionUser) {
          try {
            const userData = JSON.parse(sessionUser)
            setUser(userData)
            
            // Fetch transactions from API
            if (userData.id) {
        try {
                const response = await fetch(`/api/transactions?userId=${userData.id}`)
                if (response.ok) {
                  const data = await response.json()
                  if (data.success) {
                    setTransactions(data.transactions)
                    setFilteredTransactions(data.transactions)
                  }
                } else {
                  console.error("Failed to load transactions")
                }
        } catch (error) {
          console.error("Failed to load transactions:", error)
              }
            }
          } catch (error) {
            console.error("Failed to parse user from session:", error)
          }
        }
      }
      setIsLoading(false)
    }

    loadData()
  }, [])

  useEffect(() => {
    let filtered = transactions

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (txn) =>
          txn.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          txn.toPhone?.includes(searchTerm) ||
          txn.fromPhone?.includes(searchTerm) ||
          txn.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          txn.network.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((txn) => txn.type === typeFilter)
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((txn) => txn.status === statusFilter)
    }

    setFilteredTransactions(filtered)
  }, [transactions, searchTerm, typeFilter, statusFilter])

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === "send") return <ArrowUpRight className="w-4 h-4 text-red-500" />
    if (transaction.type === "receive") return <ArrowDownRight className="w-4 h-4 text-green-500" />
    if (transaction.type === "deposit") return <ArrowUpCircle className="w-4 h-4 text-green-500" />
    if (transaction.type === "withdrawal") return <Download className="w-4 h-4 text-blue-500" />
    if (transaction.type === "agent_withdrawal") return <Download className="w-4 h-4 text-orange-500" />
    if (transaction.type === "agent_receive") return <ArrowDownRight className="w-4 h-4 text-green-500" />
    return <Clock className="w-4 h-4 text-muted-foreground" />
  }

  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-3 h-3 text-green-500" />
    if (status === "failed") return <XCircle className="w-3 h-3 text-red-500" />
    return <Clock className="w-3 h-3 text-yellow-500" />
  }

  const getTransactionAmount = (transaction: Transaction) => {
    // Money coming in (positive)
    if (["receive", "deposit", "agent_receive"].includes(transaction.type)) return transaction.amount
    // Money going out (negative)
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
      return `Deposit to wallet`
    }
    if (transaction.type === "withdrawal") {
      return "Cash withdrawal via M-Pesa"
    }
    if (transaction.type === "agent_withdrawal") {
      return `Cash from Agent ${(transaction as any).agentName || ""}`
    }
    if (transaction.type === "agent_receive") {
      return `Cash out to ${(transaction as any).customerName || "Customer"}`
    }
    return "Transaction"
  }

  const getNetworkIcon = (network: string) => {
    const networkData = mockData.networks.find((n) => n.name === network)
    return networkData?.icon || "📱"
  }

  const exportTransactions = () => {
    const csvContent = [
      ["Date", "Type", "Amount", "Network", "Status", "Description", "Transaction ID"].join(","),
      ...filteredTransactions.map((txn) =>
        [
          new Date(txn.createdAt).toLocaleDateString(),
          txn.type,
          getTransactionAmount(txn),
          txn.network,
          txn.status,
          getTransactionDescription(txn),
          txn.id,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pia-pesa-transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Transaction History</h1>
          <p className="text-sm sm:text-base text-muted-foreground">View and manage all your money movements</p>
        </div>
        <Button onClick={exportTransactions} variant="outline" size="sm" className="w-full sm:w-auto">
          <FileDown className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="send">Sent</SelectItem>
                  <SelectItem value="receive">Received</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdrawal">M-Pesa Withdrawals</SelectItem>
                  <SelectItem value="agent_withdrawal">Agent Cash Outs</SelectItem>
                  <SelectItem value="agent_receive">Agent Earnings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
          <CardDescription>
            {filteredTransactions.length === 0 && searchTerm
              ? "No transactions match your search criteria"
              : "Click on any transaction to view details"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{searchTerm ? "No transactions found" : "No transactions yet"}</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search criteria" : "Start by sending money or making a withdrawal"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedTransaction(transaction)}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                      {getTransactionIcon(transaction)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getTransactionDescription(transaction)}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center space-x-1">
                          <span>{getNetworkIcon(transaction.network)}</span>
                          <span className="hidden sm:inline">{transaction.network}</span>
                          <span className="sm:hidden">{transaction.network.substring(0, 8)}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">{new Date(transaction.createdAt).toLocaleDateString()}</span>
                        <span className="hidden sm:inline">•</span>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(transaction.status)}
                          <span className="capitalize">{transaction.status}</span>
                        </div>
                      </div>
                      {transaction.purpose && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">Purpose: {transaction.purpose}</p>
                      )}
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
                    <p className="text-xs text-muted-foreground sm:mt-0.5">
                      {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transaction Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(null)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm text-muted-foreground">Transaction ID</span>
                  <span className="text-sm font-mono break-all sm:break-normal">{selectedTransaction.id}</span>
                </div>
                {(selectedTransaction as any).sasapayTransactionCode && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-sm text-muted-foreground">SasaPay Code</span>
                    <span className="text-sm font-mono font-semibold break-all sm:break-normal">
                      {(selectedTransaction as any).sasapayTransactionCode}
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <Badge variant="outline" className="capitalize w-fit">
                    {selectedTransaction.type}
                  </Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span
                    className={`text-sm font-semibold ${
                      getTransactionAmount(selectedTransaction) > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {getTransactionAmount(selectedTransaction) > 0 ? "+" : ""}
                    <CurrencyFormatter amount={getTransactionAmount(selectedTransaction)} />
                  </span>
                </div>
                {selectedTransaction.toPhone && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-sm text-muted-foreground">To</span>
                    <span className="text-sm break-all sm:break-normal">
                      <PhoneFormatter phone={selectedTransaction.toPhone} />
                    </span>
                  </div>
                )}
                {selectedTransaction.fromPhone && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-sm text-muted-foreground">From</span>
                    <span className="text-sm break-all sm:break-normal">
                      <PhoneFormatter phone={selectedTransaction.fromPhone} />
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm text-muted-foreground">Network</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-sm">{getNetworkIcon(selectedTransaction.network)}</span>
                    <span className="text-sm">{selectedTransaction.network}</span>
                  </div>
                </div>
                {selectedTransaction.purpose && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-sm text-muted-foreground">Purpose</span>
                    <span className="text-sm break-words text-right sm:text-left">{selectedTransaction.purpose}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm text-muted-foreground">Date & Time</span>
                  <span className="text-sm whitespace-nowrap">{new Date(selectedTransaction.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(selectedTransaction.status)}
                    <span className="text-sm capitalize">{selectedTransaction.status}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
