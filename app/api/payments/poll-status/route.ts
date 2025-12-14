import { NextRequest, NextResponse } from "next/server"
import { createChambuClient, type ChambuTransactionStatus } from "@/lib/chambu-api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId, maxAttempts, pollInterval } = body

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      )
    }

    // Initialize Chambu API client
    const chambu = createChambuClient()

    // Poll transaction status
    const finalStatus = await chambu.pollStatus(transactionId, {
      maxAttempts: maxAttempts || 30,
      pollInterval: pollInterval || 10000,
    })

    return NextResponse.json(
      {
        success: true,
        data: finalStatus,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Status polling error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to poll transaction status",
        success: false,
      },
      { status: 500 }
    )
  }
}

