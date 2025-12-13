"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, CreditCard, Users, AlertCircle, Info, CheckCircle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  type: "transaction" | "agent_request" | "system" | "security" | "info"
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string
  metadata?: {
    transactionId?: string
    amount?: number
    status?: string
    requestId?: string
  }
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    // Poll for new notifications every 5 seconds for real-time updates
    const interval = setInterval(loadNotifications, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      const sessionUser = sessionStorage.getItem("currentUser")
      if (!sessionUser) return

      const user = JSON.parse(sessionUser)
      const response = await fetch(`/api/notifications?userId=${user.id}&limit=5`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const newUnreadCount = data.unreadCount || 0
          
          // Check if there's a new notification (unread count increased)
          if (newUnreadCount > previousUnreadCount) {
            setHasNewNotification(true)
            // Reset the alert after 3 seconds
            setTimeout(() => setHasNewNotification(false), 3000)
          }
          
          setNotifications(data.notifications || [])
          setUnreadCount(newUnreadCount)
          setPreviousUnreadCount(newUnreadCount)
        }
      }
    } catch (error) {
      console.error("Failed to load notifications:", error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Failed to mark as read:", error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "transaction":
        return <CreditCard className="w-4 h-4 text-blue-500" />
      case "agent_request":
        return <Users className="w-4 h-4 text-orange-500" />
      case "security":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case "system":
        return <Info className="w-4 h-4 text-purple-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "relative transition-all cursor-pointer hover:bg-muted/50 active:scale-95",
              hasNewNotification && "animate-pulse",
              isOpen && "bg-muted"
            )}
            title="Click to view notifications"
            type="button"
            aria-label="Notifications"
          >
            <Bell className={cn(
              "w-4 h-4 transition-all",
              unreadCount > 0 && "text-primary",
              isOpen && "text-primary"
            )} />
            {unreadCount > 0 && (
              <>
                <span className={cn(
                  "absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 z-10 pointer-events-none",
                  hasNewNotification && "ring-2 ring-red-400 ring-offset-2"
                )}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
                {hasNewNotification && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full animate-ping opacity-75 pointer-events-none" />
                )}
              </>
            )}
          </Button>
        </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 z-50" 
        align="end" 
        onOpenAutoFocus={(e) => e.preventDefault()}
        sideOffset={5}
      >
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="default" className="h-5 px-1.5 text-xs bg-red-500">
                {unreadCount} {unreadCount === 1 ? "new" : "new"}
              </Badge>
            )}
          </div>
          <Link href="/dashboard/notifications" onClick={() => setIsOpen(false)}>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 text-xs bg-primary hover:bg-primary/90"
            >
              View All
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Bell className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center mb-4">No notifications</p>
              <Link href="/dashboard/notifications" onClick={() => setIsOpen(false)}>
                <Button variant="outline" size="sm" className="text-xs">
                  Go to Notifications Page
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-muted/80 transition-all cursor-pointer border-l-2 border-transparent",
                    !notification.read && "bg-muted/50 border-l-primary"
                  )}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id)
                    }
                    if (notification.link) {
                      window.location.href = notification.link
                    }
                    setIsOpen(false)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateX(2px)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateX(0)"
                  }}
                >
                  <div className="flex items-start space-x-2">
                    <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium line-clamp-1">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <Badge variant="default" className="h-1.5 w-1.5 p-0 rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          {notification.metadata?.amount && (
                            <p className="text-xs font-medium text-primary mt-1">
                              <CurrencyFormatter amount={notification.metadata.amount} />
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="border-t p-3 bg-muted/20">
            <Link href="/dashboard/notifications" onClick={() => setIsOpen(false)}>
              <Button 
                variant="default" 
                className="w-full justify-center text-xs bg-primary hover:bg-primary/90" 
                size="sm"
              >
                Go to Notifications Page
                <ArrowRight className="w-3 h-3 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
      </Popover>
    </div>
  )
}

