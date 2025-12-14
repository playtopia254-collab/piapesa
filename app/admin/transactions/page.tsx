"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Filter,
  FileDown,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Eye,
} from "lucide-react"
import { mockApi, type Transaction } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"
import mockData from "@/data/mock-data.json"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    const loadTransactions = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setTransactions(mockData.transactions as Transaction[])
      setFilteredTransactions(mockData.transactions as Transaction[])
      setIsLoading(false)
    }
    loadTransactions()
  }, [])

  useEffect(() => {
    let filtered = transactions

    if (searchTerm) {
      filtered = filtered.filter(
        (txn) =>
          txn.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          txn.toPhone?.includes(searchTerm) ||
          txn.fromPhone?.includes(searchTerm) ||
          txn.network.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((txn) => txn.type === typeFilter)
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((txn) => txn.status === statusFilter)
    }

    setFilteredTransactions(filtered)
  }, [transactions, searchTerm, typeFilter, statusFilter])

  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-500" />
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />
    return <Clock className="w-4 h-4 text-yellow-500" />
  }

  const getTransactionIcon = (type: string) => {
    if (type === "send") return <ArrowUpRight className="w-4 h-4 text-red-500" />
    if (type === "receive") return <ArrowDownRight className="w-4 h-4 text-green-500" />
    if (type === "withdrawal") return <Download className="w-4 h-4 text-blue-500" />
    return <Clock className="w-4 h-4 text-muted-foreground" />
  }

  const getNetworkIcon = (network: string) => {
    const networkData = mockData.networks.find((n) => n.name === network)
    return networkData?.icon || "📱"
  }

  const exportTransactions = () => {
    const csvContent = [
      ["Date", "Type", "Amount", "Network", "Status", "From", "To", "Transaction ID"].join(","),
      ...filteredTransactions.map((txn) =>
        [
          new Date(txn.createdAt).toLocaleDateString(),
          txn.type,
          txn.amount,
          txn.network,
          txn.status,
          txn.fromPhone || "N/A",
          txn.toPhone || "N/A",
          txn.id,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `admin-transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleStatusChange = (transactionId: string, newStatus: "completed" | "failed" | "pending") => {
    setTransactions((prev) =>
      prev.map((txn) => (txn.id === transactionId ? { ...txn, status: newStatus } : txn)),
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  const totalVolume = filteredTransactions.reduce((sum, txn) => sum + txn.amount, 0)
  const completedCount = filteredTransactions.filter((txn) => txn.status === "completed").length
  const pendingCount = filteredTransactions.filter((txn) => txn.status === "pending").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Transaction Management</h1>
          <p className="text-muted-foreground">Monitor and manage all platform transactions</p>
        </div>
        <Button onClick={exportTransactions} variant="outline">
          <FileDown className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <CurrencyFormatter amount={totalVolume} className="text-2xl font-bold text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across {filteredTransactions.length} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {filteredTransactions.length > 0
                ? ((completedCount / filteredTransactions.length) * 100).toFixed(1)
                : 0}
              % success rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Requiring attention</p>
          </CardContent>
        </Card>
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
          <div className="grid gap-4 md:grid-cols-3">
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
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
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

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
          <CardDescription>All transactions across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From/To</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getTransactionIcon(transaction.type)}
                          <div>
                            <div className="font-medium text-sm">{transaction.id}</div>
                            {transaction.purpose && (
                              <div className="text-xs text-muted-foreground">{transaction.purpose}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {transaction.fromPhone && (
                            <div>
                              From: <PhoneFormatter phone={transaction.fromPhone} />
                            </div>
                          )}
                          {transaction.toPhone && (
                            <div>
                              To: <PhoneFormatter phone={transaction.toPhone} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span>{getNetworkIcon(transaction.network)}</span>
                          <span className="text-sm">{transaction.network}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <CurrencyFormatter amount={transaction.amount} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(transaction.status)}
                          <Badge
                            variant={
                              transaction.status === "completed"
                                ? "secondary"
                                : transaction.status === "failed"
                                  ? "destructive"
                                  : "outline"
                            }
                            className="capitalize"
                          >
                            {transaction.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleTimeString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      {selectedTransaction && (
        <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>Complete information about transaction {selectedTransaction.id}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
                  <p className="text-sm font-mono">{selectedTransaction.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="text-sm font-medium capitalize">{selectedTransaction.type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="text-sm font-semibold">
                    <CurrencyFormatter amount={selectedTransaction.amount} />
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Network</label>
                  <p className="text-sm font-medium">{selectedTransaction.network}</p>
                </div>
                {selectedTransaction.fromPhone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">From</label>
                    <p className="text-sm font-medium">
                      <PhoneFormatter phone={selectedTransaction.fromPhone} />
                    </p>
                  </div>
                )}
                {selectedTransaction.toPhone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">To</label>
                    <p className="text-sm font-medium">
                      <PhoneFormatter phone={selectedTransaction.toPhone} />
                    </p>
                  </div>
                )}
                {selectedTransaction.purpose && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Purpose</label>
                    <p className="text-sm">{selectedTransaction.purpose}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(selectedTransaction.status)}
                    <Badge
                      variant={
                        selectedTransaction.status === "completed"
                          ? "secondary"
                          : selectedTransaction.status === "failed"
                            ? "destructive"
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {selectedTransaction.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p className="text-sm">{new Date(selectedTransaction.createdAt).toLocaleString()}</p>
                </div>
                {selectedTransaction.completedAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Completed At</label>
                    <p className="text-sm">{new Date(selectedTransaction.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {selectedTransaction.status === "pending" && (
                <div className="flex space-x-2 pt-4 border-t">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleStatusChange(selectedTransaction.id, "completed")
                      setSelectedTransaction(null)
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Completed
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      handleStatusChange(selectedTransaction.id, "failed")
                      setSelectedTransaction(null)
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Mark as Failed
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

