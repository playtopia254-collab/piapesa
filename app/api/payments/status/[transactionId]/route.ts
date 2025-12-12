import { NextRequest, NextResponse } from "next/server"
import { createChambuClient, type ChambuTransactionStatus } from "@/lib/chambu-api"

export async function GET(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const { transactionId } = params

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      )
    }

    // Initialize Chambu API client
    const chambu = createChambuClient()

    // Check transaction status
    const response: ChambuTransactionStatus = await chambu.checkStatus(transactionId)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("Status check error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check transaction status",
        success: false,
      },
      { status: 500 }
    )
  }
}

