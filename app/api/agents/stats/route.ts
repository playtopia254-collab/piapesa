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

    // Get today's date range (start of today to now) - use UTC to avoid timezone issues
    const now = new Date()
    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)
    today.setUTCMilliseconds(0)
    
    // Also check completedAt field in case createdAt is not set correctly
    const todayEnd = new Date(now)
    todayEnd.setUTCHours(23, 59, 59, 999)

    // Calculate today's earnings from agent_receive transactions (full amount received)
    const todayTransactions = await transactionsCollection
      .find({
        userId: new ObjectId(agentId),
        type: "agent_receive",
        status: "completed",
        $or: [
          {
            createdAt: {
              $gte: today,
              $lte: todayEnd,
            },
          },
          {
            completedAt: {
              $gte: today,
              $lte: todayEnd,
            },
          },
        ],
      })
      .toArray()

    // Calculate today's commission earnings
    // First, let's find ALL commission transactions to debug
    const allCommissionTransactions = await transactionsCollection
      .find({
        userId: new ObjectId(agentId),
        type: "agent_commission",
        status: "completed",
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
    
    console.log(`📊 Found ${allCommissionTransactions.length} total commission transactions for agent ${agentId}`)
    if (allCommissionTransactions.length > 0) {
      allCommissionTransactions.forEach((txn, idx) => {
        console.log(`   ${idx + 1}. Amount: KES ${txn.amount}, createdAt: ${txn.createdAt}, completedAt: ${txn.completedAt || 'N/A'}`)
      })
    }
    
    // Now filter for today's transactions
    const todayCommissionTransactions = allCommissionTransactions.filter((txn) => {
      const txnDate = txn.completedAt || txn.createdAt
      if (!txnDate) return false
      const txnDateObj = txnDate instanceof Date ? txnDate : new Date(txnDate)
      return txnDateObj >= today && txnDateObj <= todayEnd
    })

    const todayEarnings = todayTransactions.reduce(
      (sum, txn) => sum + (txn.amount || 0),
      0
    )

    const todayCommission = todayCommissionTransactions.reduce(
      (sum, txn) => sum + (txn.amount || 0),
      0
    )

    // Debug logging for commission transactions
    if (todayCommissionTransactions.length > 0) {
      console.log(`💰 Found ${todayCommissionTransactions.length} commission transactions today for agent ${agentId}:`)
      todayCommissionTransactions.forEach((txn) => {
        console.log(`   - KES ${txn.amount} on ${txn.createdAt || txn.completedAt}`)
      })
      console.log(`   Total today's commission: KES ${todayCommission}`)
    } else {
      console.log(`⚠️ No commission transactions found today for agent ${agentId}`)
      console.log(`   Date range: ${today.toISOString()} to ${todayEnd.toISOString()}`)
    }

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

    // Get total earnings (all time) - withdrawal amounts received
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

    // Get total commission (all time)
    const allTimeCommissionTransactions = await transactionsCollection
      .find({
        userId: new ObjectId(agentId),
        type: "agent_commission",
        status: "completed",
      })
      .toArray()

    const totalCommission = allTimeCommissionTransactions.reduce(
      (sum, txn) => sum + (txn.amount || 0),
      0
    )

    // Debug: Log total commission found
    console.log(`💰 Total commission for agent ${agentId}: KES ${totalCommission} from ${allTimeCommissionTransactions.length} transactions`)
    if (allTimeCommissionTransactions.length > 0) {
      console.log(`   Commission transactions:`)
      allTimeCommissionTransactions.forEach((txn, idx) => {
        const txnDate = txn.completedAt || txn.createdAt
        console.log(`   ${idx + 1}. KES ${txn.amount} on ${txnDate instanceof Date ? txnDate.toISOString() : new Date(txnDate).toISOString()}`)
      })
    }

    return NextResponse.json({
      success: true,
      stats: {
        activeRequests,
        pendingRequests,
        todayEarnings,
        todayCommission,
        todayTransactionCount,
        totalCompleted,
        totalEarnings,
        totalCommission,
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

