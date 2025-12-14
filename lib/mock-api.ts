import mockData from "../data/mock-data.json"

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface User {
  id: string
  phone: string
  name: string
  email: string
  balance: number
  isAgent: boolean
  pin: string
  location?: string
  rating?: number
  createdAt: string
}

export interface Agent {
  id: string
  userId: string
  name: string
  phone: string
  location: string
  coordinates: [number, number]
  rating: number
  totalTransactions: number
  availableNetworks: string[]
  maxAmount: number
  isActive: boolean
}

export interface Transaction {
  id: string
  fromUserId?: string
  toUserId?: string
  fromPhone?: string
  toPhone?: string
  agentId?: string
  amount: number
  network: string
  purpose?: string
  status: "pending" | "completed" | "failed"
  type: "send" | "receive" | "withdrawal" | "deposit"
  createdAt: string
  completedAt?: string
}

export interface WithdrawalRequest {
  id: string
  userId: string
  amount: number
  method: string
  status: "pending" | "matched" | "completed" | "cancelled"
  createdAt: string
  matchedAgentId?: string
}

// Mock authentication
let currentUser: User | null = null

export const mockApi = {
  // Authentication
  async login(phone: string, pin: string): Promise<{ user: User; success: boolean }> {
    await delay(1000)
    const user = mockData.users.find((u) => u.phone === phone && u.pin === pin)
    if (user) {
      currentUser = user as User
      return { user: user as User, success: true }
    }
    throw new Error("Invalid credentials")
  },

  async signup(userData: Partial<User>): Promise<{ user: User; success: boolean }> {
    await delay(1500)
    const newUser: User = {
      id: `user_${Date.now()}`,
      phone: userData.phone!,
      name: userData.name!,
      email: userData.email!,
      balance: 0,
      isAgent: userData.isAgent || false,
      pin: userData.pin!,
      location: userData.location,
      rating: userData.isAgent ? 5.0 : undefined,
      createdAt: new Date().toISOString(),
    }
    currentUser = newUser
    return { user: newUser, success: true }
  },

  async verifyOTP(code: string): Promise<boolean> {
    await delay(800)
    // Accept any 4-6 digit code for demo
    return /^\d{4,6}$/.test(code)
  },

  getCurrentUser(): User | null {
    // Check sessionStorage first (for newly signed up users)
    if (typeof window !== "undefined") {
      const sessionUser = sessionStorage.getItem("currentUser")
      if (sessionUser) {
        try {
          const user = JSON.parse(sessionUser)
          // Add required fields if missing
          return {
            ...user,
            id: user.id || `user_${Date.now()}`,
            pin: "", // Don't store PIN in session
            createdAt: user.createdAt || new Date().toISOString(),
          } as User
        } catch (e) {
          console.error("Failed to parse session user", e)
        }
      }
    }
    return currentUser
  },

  logout(): void {
    currentUser = null
    // Clear session storage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("currentUser")
    }
  },

  // Transactions
  async sendMoney(data: {
    toPhone: string
    amount: number
    network: string
    purpose?: string
  }): Promise<Transaction> {
    await delay(2000)

    if (!currentUser) throw new Error("Not authenticated")
    if (currentUser.balance < data.amount) throw new Error("Insufficient balance")

    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      fromUserId: currentUser.id,
      toPhone: data.toPhone,
      amount: data.amount,
      network: data.network,
      purpose: data.purpose,
      status: "pending",
      type: "send",
      createdAt: new Date().toISOString(),
    }

    // Simulate processing
    setTimeout(() => {
      transaction.status = "completed"
      transaction.completedAt = new Date().toISOString()
      // Update balance
      currentUser!.balance -= data.amount
    }, 3000)

    return transaction
  },

  async getTransactions(userId: string): Promise<Transaction[]> {
    await delay(500)
    return mockData.transactions.filter((t) => t.fromUserId === userId || t.toUserId === userId) as Transaction[]
  },

  // Agents
  async getNearbyAgents(): Promise<Agent[]> {
    await delay(800)
    return mockData.agents.filter((a) => a.isActive) as Agent[]
  },

  async requestWithdrawal(data: {
    amount: number
    method: string
  }): Promise<WithdrawalRequest> {
    await delay(1000)

    if (!currentUser) throw new Error("Not authenticated")
    if (currentUser.balance < data.amount) throw new Error("Insufficient balance")

    const request: WithdrawalRequest = {
      id: `req_${Date.now()}`,
      userId: currentUser.id,
      amount: data.amount,
      method: data.method,
      status: "pending",
      createdAt: new Date().toISOString(),
    }

    return request
  },

  async matchWithAgent(requestId: string): Promise<{ agent: Agent; request: WithdrawalRequest }> {
    await delay(1500)

    const agents = mockData.agents.filter((a) => a.isActive) as Agent[]
    const randomAgent = agents[Math.floor(Math.random() * agents.length)]

    const request: WithdrawalRequest = {
      id: requestId,
      userId: currentUser!.id,
      amount: 3000,
      method: "Via Agent",
      status: "matched",
      createdAt: new Date().toISOString(),
      matchedAgentId: randomAgent.id,
    }

    return { agent: randomAgent, request }
  },
}
