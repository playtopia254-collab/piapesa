import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// GET - Get agent statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get("agentId")

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

    // Get today's date range (start of today to now)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const now = new Date()

    // Calculate today's earnings from agent_receive transactions
    const todayTransactions = await transactionsCollection
      .find({
        userId: new ObjectId(agentId),
        type: "agent_receive",
        status: "completed",
        createdAt: {
          $gte: today,
          $lte: now,
        },
      })
      .toArray()

    const todayEarnings = todayTransactions.reduce(
      (sum, txn) => sum + (txn.amount || 0),
      0
    )

    const todayTransactionCount = todayTransactions.length

    // Get active requests (matched or in_progress)
    const activeRequests = await withdrawalRequestsCollection.countDocuments({
      agentId: new ObjectId(agentId),
      status: { $in: ["matched", "in_progress"] },
    })

    // Get pending requests (available for this agent)
    const pendingRequests = await withdrawalRequestsCollection.countDocuments({
      status: "pending",
      expiresAt: { $gt: new Date() },
    })

    // Get total completed transactions (all time)
    const totalCompleted = await transactionsCollection.countDocuments({
      userId: new ObjectId(agentId),
      type: "agent_receive",
      status: "completed",
    })

    // Get total earnings (all time)
    const allTimeTransactions = await transactionsCollection
      .find({
        userId: new ObjectId(agentId),
        type: "agent_receive",
        status: "completed",
      })
      .toArray()

    const totalEarnings = allTimeTransactions.reduce(
      (sum, txn) => sum + (txn.amount || 0),
      0
    )

    return NextResponse.json({
      success: true,
      stats: {
        activeRequests,
        pendingRequests,
        todayEarnings,
        todayTransactionCount,
        totalCompleted,
        totalEarnings,
      },
    })
  } catch (error) {
    console.error("Get agent stats error:", error)
    return NextResponse.json(
      { error: "Failed to fetch agent stats" },
      { status: 500 }
    )
  }
}

