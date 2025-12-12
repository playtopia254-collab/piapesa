import { NextRequest, NextResponse } from "next/server"
import { createChambuClient, getNetworkCode, type ChambuInitiatePaymentResponse } from "@/lib/chambu-api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customer_phone, amount, network, description, reference, metadata } = body

    // Validation
    if (!customer_phone || !amount || !network || !description) {
      return NextResponse.json(
        { error: "customer_phone, amount, network, and description are required" },
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

    // Initiate payment
    const response: ChambuInitiatePaymentResponse = await chambu.initiatePayment({
      customer_phone,
      amount: amountNum,
      network_code: networkCode,
      description,
      reference,
      metadata,
    })

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("Payment initiation error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to initiate payment",
        success: false,
      },
      { status: 500 }
    )
  }
}

