import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    // Connect to database
    const db = await getDb()
    const usersCollection = db.collection("users")
    const transactionsCollection = db.collection("transactions")

    // Get user from database
    let user
    try {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    let balance = user.balance || 0

    // Automatically recalculate balance from completed transactions to fix any discrepancies
    try {
      const allTransactions = await transactionsCollection.find({
        $or: [
          { userId: new ObjectId(userId) },
          { fromUserId: new ObjectId(userId) },
          { toUserId: new ObjectId(userId) },
        ],
        status: "completed",
      })
      .sort({ createdAt: 1 }) // Sort by creation time to process in order
      .toArray()

      let calculatedBalance = 0

      for (const txn of allTransactions) {
        const txnUserId = txn.userId?.toString()
        const isSender = txn.fromUserId?.toString() === userId
        const isReceiver = txn.toUserId?.toString() === userId

        // Deposit - money coming in
        if (txn.type === "deposit" && (txnUserId === userId || isReceiver)) {
          calculatedBalance += txn.amount
        }
        // M-Pesa/Bank Withdrawal - money going out
        else if (txn.type === "withdrawal" && (txnUserId === userId || isSender)) {
          calculatedBalance -= txn.amount
        }
        // Send - money going out
        else if (txn.type === "send" && isSender) {
          calculatedBalance -= txn.amount
        }
        // Receive (internal) - money coming in
        else if (txn.type === "send" && isReceiver) {
          calculatedBalance += txn.amount
        }
        // Agent withdrawal - customer pays agent for cash (money out for customer)
        else if (txn.type === "agent_withdrawal" && (txnUserId === userId || isSender)) {
          calculatedBalance -= txn.amount
        }
        // Agent receive - agent gets paid for providing cash (money in for agent)
        else if (txn.type === "agent_receive" && (txnUserId === userId || isReceiver)) {
          calculatedBalance += txn.amount
        }
        // Agent commission - agent earns commission (money in for agent)
        else if (txn.type === "agent_commission" && (txnUserId === userId || isReceiver)) {
          calculatedBalance += txn.amount
          // Debug logging for commission transactions
          if (user.isAgent) {
            console.log(`💰 Adding commission to balance: KES ${txn.amount} (Total: KES ${calculatedBalance})`)
          }
        }
      }

      // Debug: Log commission totals for agents
      if (user.isAgent) {
        const commissionTxns = allTransactions.filter(
          (txn) => txn.type === "agent_commission" && 
          (txn.userId?.toString() === userId || txn.toUserId?.toString() === userId) &&
          txn.status === "completed"
        )
        const totalCommission = commissionTxns.reduce((sum, txn) => sum + (txn.amount || 0), 0)
        const receiveTxns = allTransactions.filter(
          (txn) => txn.type === "agent_receive" && 
          (txn.userId?.toString() === userId || txn.toUserId?.toString() === userId) &&
          txn.status === "completed"
        )
        const totalReceived = receiveTxns.reduce((sum, txn) => sum + (txn.amount || 0), 0)
        console.log(`📊 Agent Balance Breakdown for ${userId}:`)
        console.log(`   Commission transactions: ${commissionTxns.length}, Total: KES ${totalCommission}`)
        console.log(`   Receive transactions: ${receiveTxns.length}, Total: KES ${totalReceived}`)
        console.log(`   Calculated Balance: KES ${calculatedBalance}`)
        console.log(`   Stored Balance: KES ${balance}`)
      }

      // Always use calculated balance to ensure accuracy
      // If calculated balance differs from stored balance, update it
      if (Math.abs(calculatedBalance - balance) > 0.01) {
        console.log(`Correcting balance for user ${userId}: ${balance} -> ${calculatedBalance}`)
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { balance: calculatedBalance } }
        )
        balance = calculatedBalance
      } else {
        // Even if they match, use calculated to ensure consistency
        balance = calculatedBalance
      }
    } catch (error) {
      console.error("Error recalculating balance:", error)
      // Continue with stored balance if recalculation fails
    }

    return NextResponse.json(
      {
        success: true,
        balance: balance,
        userId: user._id.toString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get balance error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get balance",
        success: false,
      },
      { status: 500 }
    )
  }
}

