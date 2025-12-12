import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const type = searchParams.get("type") // Optional: filter by type
    const status = searchParams.get("status") // Optional: filter by status
    const limit = searchParams.get("limit") // Optional: limit results

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    // Connect to database
    const db = await getDb()
    const transactionsCollection = db.collection("transactions")

    // Build query - get transactions where user is sender or recipient
    let query: any = {
      $or: [
        { fromUserId: new ObjectId(userId) },
        { toUserId: new ObjectId(userId) },
      ],
    }

    // Add type filter if provided
    if (type && type !== "all") {
      query.type = type
    }

    // Add status filter if provided
    if (status && status !== "all") {
      query.status = status
    }

    // Fetch transactions
    let transactionsQuery = transactionsCollection.find(query).sort({ createdAt: -1 })

    // Apply limit if provided
    if (limit) {
      transactionsQuery = transactionsQuery.limit(Number.parseInt(limit))
    }

    const transactions = await transactionsQuery.toArray()

    // Transform transactions to match frontend format
    const formattedTransactions = transactions.map((txn) => {
      // Determine if this is a send or receive transaction for the current user
      const isSender = txn.fromUserId?.toString() === userId
      const isReceiver = txn.toUserId?.toString() === userId

      // For send transactions, show as "send"
      // For receive transactions (where user is recipient), show as "receive"
      // For deposits (toUserId is user), show as "deposit"
      // For withdrawals, show as "withdrawal"
      let transactionType = txn.type
      if (txn.type === "send" && isReceiver) {
        transactionType = "receive"
      }

      return {
        id: txn._id.toString(),
        fromUserId: txn.fromUserId?.toString(),
        toUserId: txn.toUserId?.toString(),
        fromPhone: txn.fromPhone,
        toPhone: txn.toPhone,
        agentId: txn.agentId,
        amount: txn.amount,
        network: txn.network,
        purpose: txn.purpose,
        status: txn.status,
        type: transactionType,
        createdAt: txn.createdAt instanceof Date ? txn.createdAt.toISOString() : new Date(txn.createdAt).toISOString(),
        completedAt: txn.completedAt
          ? txn.completedAt instanceof Date
            ? txn.completedAt.toISOString()
            : new Date(txn.completedAt).toISOString()
          : undefined,
        chambuTransactionId: txn.chambuTransactionId,
        sasapayTransactionCode: txn.sasapayTransactionCode,
      }
    })

    return NextResponse.json(
      {
        success: true,
        transactions: formattedTransactions,
        count: formattedTransactions.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get transactions error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get transactions",
        success: false,
      },
      { status: 500 }
    )
  }
}

