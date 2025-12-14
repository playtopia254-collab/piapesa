"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  FileText,
  UserCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { mockApi, type User, type Transaction } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import mockData from "@/data/mock-data.json"

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAgents: 0,
    totalTransactions: 0,
    totalVolume: 0,
    pendingTransactions: 0,
    activeUsers: 0,
  })
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      // Simulate loading
      await new Promise((resolve) => setTimeout(resolve, 500))

      const users = mockData.users
      const agents = mockData.agents
      const transactions = mockData.transactions

      const totalVolume = transactions.reduce((sum, txn) => sum + txn.amount, 0)
      const pendingTransactions = transactions.filter((txn) => txn.status === "pending").length

      setStats({
        totalUsers: users.length,
        totalAgents: agents.filter((a) => a.isActive).length,
        totalTransactions: transactions.length,
        totalVolume,
        pendingTransactions,
        activeUsers: users.length, // In real app, this would be users active in last 30 days
      })

      setRecentTransactions(transactions.slice(0, 5))
      setIsLoading(false)
    }

    loadStats()
  }, [])

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

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      change: "+12.5%",
      trend: "up",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      href: "/admin/users",
    },
    {
      title: "Total Agents",
      value: stats.totalAgents,
      change: "+3",
      trend: "up",
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
      href: "/admin/agents",
    },
    {
      title: "Total Transactions",
      value: stats.totalTransactions,
      change: "+24.1%",
      trend: "up",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      href: "/admin/transactions",
    },
    {
      title: "Total Volume",
      value: stats.totalVolume,
      change: "+18.2%",
      trend: "up",
      icon: DollarSign,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      isCurrency: true,
    },
  ]

  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-3 h-3 text-green-500" />
    if (status === "failed") return <XCircle className="w-3 h-3 text-red-500" />
    return <Clock className="w-3 h-3 text-yellow-500" />
  }

  const getTransactionTypeIcon = (type: string) => {
    if (type === "send") return <ArrowUpRight className="w-4 h-4 text-red-500" />
    if (type === "receive") return <ArrowDownRight className="w-4 h-4 text-green-500" />
    return <Clock className="w-4 h-4 text-blue-500" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Pia Pesa platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href || "#"}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stat.isCurrency ? (
                    <CurrencyFormatter amount={stat.value} />
                  ) : (
                    stat.value.toLocaleString()
                  )}
                </div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                  {stat.trend === "up" ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span>{stat.change}</span>
                  <span>from last month</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <span>Pending Actions</span>
            </CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Pending Transactions</span>
              </div>
              <Badge variant="secondary">{stats.pendingTransactions}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Active Users</span>
              </div>
              <Badge variant="secondary">{stats.activeUsers}</Badge>
            </div>
            <Link href="/admin/transactions?status=pending">
              <Button variant="outline" className="w-full">
                View Pending Items
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/users">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
            </Link>
            <Link href="/admin/agents">
              <Button variant="outline" className="w-full justify-start">
                <UserCheck className="w-4 h-4 mr-2" />
                Manage Agents
              </Button>
            </Link>
            <Link href="/admin/transactions">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="w-4 h-4 mr-2" />
                View All Transactions
              </Button>
            </Link>
            <Link href="/admin/analytics">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest money movements across the platform</CardDescription>
          </div>
          <Link href="/admin/transactions">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {getTransactionTypeIcon(transaction.type)}
                    <div>
                      <p className="text-sm font-medium capitalize">{transaction.type}</p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{transaction.network}</span>
                        <span>•</span>
                        <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(transaction.status)}
                          <span className="capitalize">{transaction.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      <CurrencyFormatter amount={transaction.amount} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleTimeString()}
                    </p>
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

