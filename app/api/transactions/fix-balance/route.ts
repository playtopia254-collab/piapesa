import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * Fix user balance by recalculating from all completed transactions
 * This endpoint can be called to fix balance discrepancies
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    const db = await getDb()
    const usersCollection = db.collection("users")
    const transactionsCollection = db.collection("transactions")

    // Get user
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

    // Get all completed transactions for this user
    const allTransactions = await transactionsCollection.find({
      $or: [
        { fromUserId: new ObjectId(userId) },
        { toUserId: new ObjectId(userId) },
      ],
      status: "completed",
    }).toArray()

    // Calculate balance from transactions
    let calculatedBalance = 0

    for (const txn of allTransactions) {
      const isSender = txn.fromUserId?.toString() === userId
      const isReceiver = txn.toUserId?.toString() === userId

      if (txn.type === "deposit" && isReceiver) {
        // Deposit adds to balance
        calculatedBalance += txn.amount
      } else if (txn.type === "withdrawal" && isSender) {
        // Withdrawal subtracts from balance
        calculatedBalance -= txn.amount
      } else if (txn.type === "send" && isSender) {
        // Sending money subtracts from balance
        calculatedBalance -= txn.amount
      } else if (txn.type === "send" && isReceiver) {
        // Receiving money adds to balance
        calculatedBalance += txn.amount
      }
    }

    // Update user balance
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { balance: calculatedBalance } }
    )

    return NextResponse.json({
      success: true,
      previousBalance: user.balance || 0,
      newBalance: calculatedBalance,
      transactionsCount: allTransactions.length,
      message: "Balance recalculated and updated",
    })
  } catch (error) {
    console.error("Fix balance error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fix balance",
        success: false,
      },
      { status: 500 }
    )
  }
}

