/**
 * Chambu Digital Payment API Client
 * Documentation: https://www.chambudigital.co.ke
 */

const BASE_URL = "https://www.chambudigital.co.ke"

// Network codes
export const NETWORK_CODES = {
  MPESA: "63902",
  AIRTEL: "63903",
  TKASH: "63907",
} as const

export type NetworkCode = typeof NETWORK_CODES[keyof typeof NETWORK_CODES]

// Network name to code mapping
export const NETWORK_NAME_TO_CODE: Record<string, NetworkCode> = {
  "M-Pesa": NETWORK_CODES.MPESA,
  "M-PESA": NETWORK_CODES.MPESA,
  "Airtel Money": NETWORK_CODES.AIRTEL,
  "Airtel": NETWORK_CODES.AIRTEL,
  "T-Kash": NETWORK_CODES.TKASH,
  "TKash": NETWORK_CODES.TKASH,
}

// Transaction status types
export type TransactionStatus = "SUCCESS" | "PENDING" | "FAILED" | "EXPIRED"

// API Response Types
export interface ChambuInitiatePaymentResponse {
  success: boolean
  message: string
  data: {
    transaction_id: string
    checkout_request_id: string
    merchant_request_id: string
    status: TransactionStatus
    amountEntered: number
    transactionFee: number
    totalCharge: number
    customer_phone: string
    description: string
  }
}

export interface ChambuWithdrawResponse {
  success: boolean
  message: string
  data: {
    transactionId: string
    conversationId: string
    originatorConversationId: string
    status: TransactionStatus
    amount: number
    phoneNumber: string
    reference?: string
  }
}

export interface ChambuTransactionStatus {
  success: boolean
  data: {
    transaction_id: string
    status: TransactionStatus
    amount?: number
    amountEntered?: number
    transactionFee?: number
    totalCharge?: number
    customer_phone: string
    description?: string
    network?: string
    sasapay_transaction_code?: string | null
    transaction_code_available: boolean
    checkout_request_id?: string
    b2c_request_id?: string
    source_channel?: string
    destination_channel?: string
    recipient_name?: string
    result_desc?: string
    initiated_at: string
    completed_at?: string | null
  }
}

export interface ChambuError {
  success: false
  error?: string
  message?: string
}

/**
 * Format phone number to Chambu Digital format (254XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  let formatted = phone.trim().replace(/\s+/g, "")

  // Remove + if present
  if (formatted.startsWith("+")) {
    formatted = formatted.slice(1)
  }

  // Convert 0XXXXXXXXX to 254XXXXXXXXX
  if (formatted.startsWith("0")) {
    formatted = "254" + formatted.slice(1)
  }

  // Ensure it starts with 254
  if (!formatted.startsWith("254")) {
    formatted = "254" + formatted
  }

  return formatted
}

/**
 * Get network code from network name
 */
export function getNetworkCode(networkName: string): NetworkCode {
  return NETWORK_NAME_TO_CODE[networkName] || NETWORK_CODES.MPESA
}

/**
 * Calculate transaction fee
 * Fee: 0.25% + KES 1.00
 */
export function calculateFee(amount: number): number {
  return amount * 0.0025 + 1.0
}

/**
 * Calculate total charge (amount + fee)
 */
export function calculateTotalCharge(amount: number): number {
  return amount + calculateFee(amount)
}

/**
 * Chambu Digital API Client
 */
export class ChambuAPI {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = BASE_URL) {
    if (!apiKey) {
      throw new Error("Chambu Digital API key is required")
    }
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
      ...options.headers,
    }

    // Log the request details
    const requestBody = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null
    console.log("=".repeat(80))
    console.log("📤 CHAMBU DIGITAL API REQUEST")
    console.log("=".repeat(80))
    console.log("Method:", options.method || "GET")
    console.log("URL:", url)
    console.log("Headers:", {
      "Content-Type": headers["Content-Type"],
      "X-API-Key": this.apiKey ? `${this.apiKey.substring(0, 10)}...${this.apiKey.substring(this.apiKey.length - 4)}` : "NOT SET",
    })
    if (requestBody) {
      console.log("Request Body:", JSON.stringify(requestBody, null, 2))
    }
    console.log("=".repeat(80))

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Log response details
    const responseClone = response.clone()
    const responseData = await responseClone.json().catch(() => ({}))
    
    console.log("=".repeat(80))
    console.log("📥 CHAMBU DIGITAL API RESPONSE")
    console.log("=".repeat(80))
    console.log("Status:", response.status, response.statusText)
    console.log("Response Headers:", Object.fromEntries(response.headers.entries()))
    console.log("Response Body:", JSON.stringify(responseData, null, 2))
    console.log("=".repeat(80))

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.message || errorData.error || errorData.data?.message || `HTTP ${response.status}: ${response.statusText}`
      console.error("❌ Chambu API Error:", {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
      })
      throw new Error(errorMessage)
    }

    return response.json()
  }

  /**
   * Initiate payment collection (C2B - STK Push)
   */
  async initiatePayment(data: {
    customer_phone: string
    amount: number
    network_code: NetworkCode
    description: string
    reference?: string
    metadata?: Record<string, any>
  }): Promise<ChambuInitiatePaymentResponse> {
    const payload = {
      customer_phone: formatPhoneNumber(data.customer_phone),
      amount: data.amount,
      network_code: data.network_code,
      description: data.description,
      ...(data.reference && { reference: data.reference }),
      ...(data.metadata && { metadata: data.metadata }),
    }

    return this.makeRequest<ChambuInitiatePaymentResponse>(
      "/api/v1/payments/initiate",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )
  }

  /**
   * Send money (B2C - Withdrawal)
   */
  async withdraw(data: {
    phoneNumber: string
    amount: number
    networkCode: NetworkCode
    reference?: string
    reason?: string
  }): Promise<ChambuWithdrawResponse> {
    // Format phone number (only once)
    const formattedPhone = formatPhoneNumber(data.phoneNumber)
    
    // Build payload - Chambu API expects snake_case field names
    // Based on error message "Customer phone", they likely expect "customer_phone"
    const payload: any = {
      customer_phone: formattedPhone, // Changed from phoneNumber to customer_phone
      amount: data.amount,
      network_code: data.networkCode, // Changed from networkCode to network_code
    }
    
    // Add optional fields if provided
    if (data.reference) {
      payload.reference = data.reference
    }
    
    // Reason is required by Chambu API, so always include it
    payload.reason = data.reason || "Withdrawal to mobile money"

    console.log("Chambu withdraw payload:", payload)

    return this.makeRequest<ChambuWithdrawResponse>(
      "/api/v1/payments/withdraw",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )
  }

  /**
   * Check transaction status
   * Uses GET request: GET /api/v1/payments/status/{transactionId}
   * Headers: X-API-Key: {apiKey}
   */
  async checkStatus(transactionId: string): Promise<ChambuTransactionStatus> {
    const endpoint = `/api/v1/payments/status/${transactionId}`
    console.log(`Checking Chambu transaction status: GET ${this.baseUrl}${endpoint}`)
    return this.makeRequest<ChambuTransactionStatus>(endpoint, {
      method: "GET",
    })
  }

  /**
   * Poll transaction status until completion or timeout
   */
  async pollStatus(
    transactionId: string,
    options: {
      maxAttempts?: number
      initialDelay?: number
      pollInterval?: number
      onStatusUpdate?: (status: ChambuTransactionStatus["data"]) => void
    } = {}
  ): Promise<ChambuTransactionStatus["data"]> {
    const {
      maxAttempts = 30,
      initialDelay = 0,
      pollInterval = 10000, // 10 seconds for first minute
      onStatusUpdate,
    } = options

    // Wait initial delay if specified
    if (initialDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, initialDelay))
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const statusResponse = await this.checkStatus(transactionId)
        const status = statusResponse.data

        if (onStatusUpdate) {
          onStatusUpdate(status)
        }

        if (status.status === "SUCCESS" || status.status === "FAILED" || status.status === "EXPIRED") {
          return status
        }

        // Wait before next poll
        // First 6 attempts (1 minute) use pollInterval, then 30 seconds
        const delay = attempt <= 6 ? pollInterval : 30000
        await new Promise((resolve) => setTimeout(resolve, delay))
      } catch (error) {
        console.error(`Status check attempt ${attempt} failed:`, error)
        // Continue polling on error
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
        }
      }
    }

    // Final check
    const finalStatus = await this.checkStatus(transactionId)
    return finalStatus.data
  }
}

/**
 * Create Chambu API client instance
 */
export function createChambuClient(apiKey?: string): ChambuAPI {
  const key = apiKey || process.env.CHAMBU_API_KEY || ""
  return new ChambuAPI(key)
}

