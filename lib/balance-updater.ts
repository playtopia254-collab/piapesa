/**
 * Balance Update Utility
 * Provides real-time balance updates across the application
 */

export const BALANCE_UPDATE_EVENT = "balance-updated"

export interface BalanceUpdateEvent {
  userId: string
  newBalance: number
}

/**
 * Dispatch balance update event to notify all components
 */
export function dispatchBalanceUpdate(userId: string, newBalance: number) {
  if (typeof window !== "undefined") {
    const event = new CustomEvent<BalanceUpdateEvent>(BALANCE_UPDATE_EVENT, {
      detail: { userId, newBalance },
    })
    window.dispatchEvent(event)
    
    // Also update sessionStorage
    const sessionUser = sessionStorage.getItem("currentUser")
    if (sessionUser) {
      try {
        const userData = JSON.parse(sessionUser)
        if (userData.id === userId) {
          const updatedUser = { ...userData, balance: newBalance }
          sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
        }
      } catch (e) {
        console.error("Failed to update sessionStorage:", e)
      }
    }
  }
}

/**
 * Listen for balance update events
 */
export function onBalanceUpdate(
  userId: string,
  callback: (newBalance: number) => void
) {
  if (typeof window === "undefined") return () => {}

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<BalanceUpdateEvent>
    if (customEvent.detail.userId === userId) {
      callback(customEvent.detail.newBalance)
    }
  }

  window.addEventListener(BALANCE_UPDATE_EVENT, handler)

  // Return cleanup function
  return () => {
    window.removeEventListener(BALANCE_UPDATE_EVENT, handler)
  }
}

/**
 * Poll for balance updates from the server
 */
export async function pollBalance(
  userId: string,
  options: {
    interval?: number
    maxAttempts?: number
    onUpdate?: (balance: number) => void
  } = {}
): Promise<number | null> {
  const { interval = 2000, maxAttempts = 30, onUpdate } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`/api/user/balance?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const balance = data.balance
          if (onUpdate) {
            onUpdate(balance)
          }
          dispatchBalanceUpdate(userId, balance)
          return balance
        }
      }
    } catch (error) {
      console.error(`Balance poll attempt ${attempt} failed:`, error)
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  return null
}

