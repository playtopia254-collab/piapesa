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
          { fromUserId: new ObjectId(userId) },
          { toUserId: new ObjectId(userId) },
        ],
        status: "completed",
      }).toArray()

      let calculatedBalance = 0

      for (const txn of allTransactions) {
        const isSender = txn.fromUserId?.toString() === userId
        const isReceiver = txn.toUserId?.toString() === userId

        if (txn.type === "deposit" && isReceiver) {
          calculatedBalance += txn.amount
        } else if (txn.type === "withdrawal" && isSender) {
          calculatedBalance -= txn.amount
        } else if (txn.type === "send" && isSender) {
          calculatedBalance -= txn.amount
        } else if (txn.type === "send" && isReceiver) {
          calculatedBalance += txn.amount
        }
      }

      // If calculated balance differs from stored balance, update it
      if (Math.abs(calculatedBalance - balance) > 0.01) {
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { balance: calculatedBalance } }
        )
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

