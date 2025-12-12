import { NextRequest, NextResponse } from "next/server"
import { createChambuClient, getNetworkCode, type ChambuWithdrawResponse } from "@/lib/chambu-api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, amount, network, reference, reason } = body

    // Validation
    if (!phoneNumber || !amount || !network) {
      return NextResponse.json(
        { error: "phoneNumber, amount, and network are required" },
        { status: 400 }
      )
    }

    // Reason is required for withdrawals
    if (!reason || reason.trim() === "") {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      )
    }

    const amountNum = Number.parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 1 || amountNum > 250000) {
      return NextResponse.json(
        { error: "Amount must be between KES 1 and KES 250,000" },
        { status: 400 }
      )
    }

    // Get network code
    const networkCode = getNetworkCode(network)

    // Initialize Chambu API client
    const chambu = createChambuClient()

    // Ensure reason is not empty
    const withdrawalReason = reason?.trim() || "Withdrawal to mobile money"
    
    console.log("Chambu withdraw request:", {
      phoneNumber: phoneNumber,
      amount: amountNum,
      networkCode,
      reason: withdrawalReason,
    })

    // Initiate withdrawal - phone number will be formatted inside chambu.withdraw()
    const response: ChambuWithdrawResponse = await chambu.withdraw({
      phoneNumber: phoneNumber, // Will be formatted inside the method
      amount: amountNum,
      networkCode,
      reference: reference || `WITHDRAW_${Date.now()}`,
      reason: withdrawalReason,
    })

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("Withdrawal error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to initiate withdrawal",
        success: false,
      },
      { status: 500 }
    )
  }
}

