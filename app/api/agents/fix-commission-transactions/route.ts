import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// POST - Create missing commission transactions for completed withdrawals
export async function POST(request: NextRequest) {
  try {
    const { agentId } = await request.json()

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")
    const transactionsCollection = db.collection("transactions")
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")

    // Verify agent exists
    const agent = await usersCollection.findOne({
      _id: new ObjectId(agentId),
      isAgent: true,
    })

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    // Find all completed withdrawal requests for this agent
    const completedWithdrawals = await withdrawalRequestsCollection
      .find({
        agentId: new ObjectId(agentId),
        status: "completed",
      })
      .toArray()

    console.log(`🔍 Found ${completedWithdrawals.length} completed withdrawals for agent ${agentId}`)

    let createdCount = 0
    let skippedCount = 0
    let errors: string[] = []

    for (const withdrawal of completedWithdrawals) {
      // Check if commission transaction already exists
      const existingCommission = await transactionsCollection.findOne({
        agentWithdrawalRequestId: withdrawal._id,
        type: "agent_commission",
        userId: new ObjectId(agentId),
      })

      if (existingCommission) {
        console.log(`⏭️  Commission transaction already exists for withdrawal ${withdrawal._id}`)
        skippedCount++
        continue
      }

      // Calculate commission (2% of withdrawal amount, minimum KES 10)
      const commissionRate = 0.02
      const commission = Math.max(withdrawal.amount * commissionRate, 10)

      // Get customer info
      const customer = await usersCollection.findOne({
        _id: withdrawal.userId instanceof ObjectId ? withdrawal.userId : new ObjectId(withdrawal.userId),
      })

      // Create missing commission transaction
      try {
        const commissionTransaction = {
          userId: new ObjectId(agentId),
          fromUserId: null, // System commission
          toUserId: new ObjectId(agentId),
          amount: commission,
          type: "agent_commission",
          network: "System",
          purpose: `Commission earned from withdrawal transaction`,
          status: "completed",
          agentWithdrawalRequestId: withdrawal._id instanceof ObjectId ? withdrawal._id : new ObjectId(withdrawal._id),
          customerId: withdrawal.userId instanceof ObjectId ? withdrawal.userId : new ObjectId(withdrawal.userId),
          customerName: customer?.name || "Customer",
          withdrawalAmount: withdrawal.amount,
          commissionRate: commissionRate,
          createdAt: withdrawal.completedAt || withdrawal.createdAt || new Date(),
          completedAt: withdrawal.completedAt || withdrawal.createdAt || new Date(),
        }

        const result = await transactionsCollection.insertOne(commissionTransaction)
        console.log(`✅ Created commission transaction for withdrawal ${withdrawal._id}: KES ${commission}`)
        createdCount++
      } catch (error) {
        const errorMsg = `Failed to create commission for withdrawal ${withdrawal._id}: ${error instanceof Error ? error.message : String(error)}`
        console.error(`❌ ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed commission transactions for agent`,
      stats: {
        totalWithdrawals: completedWithdrawals.length,
        created: createdCount,
        skipped: skippedCount,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Fix commission transactions error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { 
        error: "Failed to fix commission transactions",
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}

