"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Calendar,
} from "lucide-react"
import { CurrencyFormatter } from "@/components/currency-formatter"
import mockData from "@/data/mock-data.json"

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadAnalytics = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setIsLoading(false)
    }
    loadAnalytics()
  }, [timeRange])

  // Mock analytics data
  const transactions = mockData.transactions as any[]
  const users = mockData.users as any[]
  const agents = mockData.agents as any[]

  const totalVolume = transactions.reduce((sum, txn) => sum + txn.amount, 0)
  const completedTransactions = transactions.filter((txn) => txn.status === "completed").length
  const avgTransactionAmount = transactions.length > 0 ? totalVolume / transactions.length : 0

  // Network distribution
  const networkStats = transactions.reduce((acc, txn) => {
    acc[txn.network] = (acc[txn.network] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Transaction type distribution
  const typeStats = transactions.reduce((acc, txn) => {
    acc[txn.type] = (acc[txn.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Mock growth data
  const growthData = {
    users: "+12.5%",
    transactions: "+24.1%",
    volume: "+18.2%",
    agents: "+8.3%",
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Reports</h1>
          <p className="text-muted-foreground">Platform performance and insights</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CurrencyFormatter amount={totalVolume} />
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span>{growthData.volume} from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <FileText className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span>{growthData.transactions} from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span>{growthData.users} from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <UserCheck className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.filter((a) => a.isActive).length}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span>{growthData.agents} from last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Statistics</CardTitle>
            <CardDescription>Overview of transaction metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completed Transactions</span>
              <span className="font-semibold">{completedTransactions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Success Rate</span>
              <span className="font-semibold">
                {transactions.length > 0
                  ? ((completedTransactions / transactions.length) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Transaction</span>
              <span className="font-semibold">
                <CurrencyFormatter amount={avgTransactionAmount} />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending Transactions</span>
              <span className="font-semibold text-yellow-600">
                {transactions.filter((txn) => txn.status === "pending").length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Failed Transactions</span>
              <span className="font-semibold text-red-600">
                {transactions.filter((txn) => txn.status === "failed").length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Distribution</CardTitle>
            <CardDescription>Transactions by payment network</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(networkStats).map(([network, count]) => {
              const percentage = transactions.length > 0 ? (count / transactions.length) * 100 : 0
              return (
                <div key={network} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{network}</span>
                    <span className="text-sm text-muted-foreground">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Types</CardTitle>
            <CardDescription>Distribution by transaction type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(typeStats).map(([type, count]) => {
              const percentage = transactions.length > 0 ? (count / transactions.length) * 100 : 0
              const icon =
                type === "send" ? (
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                ) : type === "receive" ? (
                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                ) : (
                  <Download className="w-4 h-4 text-blue-500" />
                )
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {icon}
                      <span className="text-sm font-medium capitalize">{type}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        type === "send"
                          ? "bg-red-500"
                          : type === "receive"
                            ? "bg-green-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
            <CardDescription>Top performing agents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agents
              .sort((a, b) => b.totalTransactions - a.totalTransactions)
              .slice(0, 5)
              .map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{agent.totalTransactions} transactions</p>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs">⭐</span>
                      <span className="text-xs text-muted-foreground">{agent.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Growth Trends</span>
          </CardTitle>
          <CardDescription>Transaction volume over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Chart visualization would go here</p>
              <p className="text-xs text-muted-foreground mt-1">
                Integrate with a charting library like Recharts or Chart.js
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

