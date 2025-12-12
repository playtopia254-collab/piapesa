"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  CreditCard,
  Send,
  Download,
  Users,
  FileText,
  HelpCircle,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  UserCheck,
  ArrowUpCircle,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { mockApi, type User } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { cn } from "@/lib/utils"
import { onBalanceUpdate } from "@/lib/balance-updater"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: CreditCard },
  { name: "Deposit", href: "/dashboard/deposit", icon: ArrowUpCircle },
  { name: "Send Money", href: "/dashboard/send", icon: Send },
  { name: "Withdraw", href: "/dashboard/withdraw", icon: Download },
  { name: "Transactions", href: "/dashboard/transactions", icon: FileText },
  { name: "Agent Requests", href: "/dashboard/agent-requests", icon: Users },
  { name: "Become Agent", href: "/dashboard/become-agent", icon: UserCheck },
  { name: "Help & Support", href: "/dashboard/support", icon: HelpCircle },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    let cleanup: (() => void) | undefined
    let balancePollInterval: NodeJS.Timeout | null = null

    const setUserAndSubscribe = async (userData: User) => {
      setUser(userData)
      
      // Fetch latest balance from API
      if (userData.id) {
        try {
          const balanceResponse = await fetch(`/api/user/balance?userId=${userData.id}`)
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json()
            if (balanceData.success) {
              const latestBalance = balanceData.balance
              setUser((prev) => (prev ? { ...prev, balance: latestBalance } : null))
              // Update sessionStorage with latest balance
              const updatedUser = { ...userData, balance: latestBalance }
              sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
            }
          }
        } catch (error) {
          console.error("Failed to fetch balance:", error)
        }

        // Subscribe to real-time balance updates
        cleanup = onBalanceUpdate(userData.id, (newBalance) => {
          setUser((prev) => {
            if (prev) {
              const updated = { ...prev, balance: newBalance }
              // Update sessionStorage
              sessionStorage.setItem("currentUser", JSON.stringify(updated))
              return updated
            }
            return null
          })
        })

        // Also poll balance periodically to catch any missed updates (e.g., when receiving money)
        balancePollInterval = setInterval(async () => {
          try {
            const balanceResponse = await fetch(`/api/user/balance?userId=${userData.id}`)
            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json()
              if (balanceData.success) {
                const currentBalance = balanceData.balance
                // Only update if balance changed
                setUser((prev) => {
                  if (prev && prev.balance !== currentBalance) {
                    const updated = { ...prev, balance: currentBalance }
                    sessionStorage.setItem("currentUser", JSON.stringify(updated))
                    return updated
                  }
                  return prev
                })
              }
            }
          } catch (error) {
            console.error("Balance poll error:", error)
          }
        }, 5000) // Poll every 5 seconds
      }
    }

    const sessionUser = sessionStorage.getItem("currentUser")
    if (sessionUser) {
      try {
        const userData = JSON.parse(sessionUser)
        setUserAndSubscribe(userData)
        return () => {
          if (cleanup) cleanup()
          if (balancePollInterval) clearInterval(balancePollInterval)
        }
      } catch (e) {
        console.error("Failed to parse user from session:", e)
      }
    }

    // Fallback to mockApi current user (for existing sessions)
    const fallbackUser = mockApi.getCurrentUser()
    if (fallbackUser) {
      setUserAndSubscribe(fallbackUser)
      // Store to sessionStorage for consistency
      try {
        sessionStorage.setItem("currentUser", JSON.stringify(fallbackUser))
      } catch (e) {
        console.error("Failed to save user to session:", e)
      }
      return () => {
        if (cleanup) cleanup()
        if (balancePollInterval) clearInterval(balancePollInterval)
      }
    }

    // If no user found, redirect to login
    router.push("/login")

    return () => {
      if (cleanup) cleanup()
      if (balancePollInterval) clearInterval(balancePollInterval)
    }
  }, [router])

  const handleLogout = () => {
    // Clear all session data
    mockApi.logout()
    
    // Clear any other session data
    if (typeof window !== "undefined") {
      sessionStorage.clear()
    }
    
    // Redirect to home page
    router.push("/")
    router.refresh() // Force refresh to clear any cached data
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">Pia Pesa</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <nav className="p-4 space-y-2 flex-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="p-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => {
                  setSidebarOpen(false)
                  handleLogout()
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-full lg:w-64 lg:bg-card lg:border-r lg:border-border lg:flex lg:flex-col lg:block">
        <div className="flex items-center space-x-2 p-4 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">Pia Pesa</span>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full"
            size="sm"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top navbar */}
        <header className="bg-card/50 backdrop-blur-sm border-b border-border sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-4 h-4" />
              </Button>
              <div className="hidden sm:block">
                <div className="text-sm text-muted-foreground">Available Balance</div>
                <div className="text-lg font-semibold text-primary">
                  <CurrencyFormatter amount={user.balance} />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Balance for mobile */}
              <div className="sm:hidden text-right">
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="text-sm font-semibold text-primary transition-all duration-300">
                  <CurrencyFormatter amount={user.balance} />
                </div>
              </div>

              {/* Notifications */}
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 px-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center space-x-1">
                        <span>{user.phone.replace("+254", "0")}</span>
                        {user.isAgent && (
                          <Badge variant="secondary" className="text-xs px-1">
                            Agent
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.phone.replace("+254", "0")}</div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/support">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help & Support
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 pb-20 lg:pb-4">{children}</main>
      </div>
    </div>
  )
}
