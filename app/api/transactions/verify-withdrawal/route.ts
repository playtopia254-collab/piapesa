import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { createChambuClient } from "@/lib/chambu-api"
import { ObjectId } from "mongodb"

/**
 * Verify withdrawal transaction status from Chambu Digital API
 * This endpoint can be called to check if a transaction exists and get its status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId, chambuTransactionId } = body

    if (!transactionId && !chambuTransactionId) {
      return NextResponse.json(
        { error: "transactionId or chambuTransactionId is required" },
        { status: 400 }
      )
    }

    const db = await getDb()
    const transactionsCollection = db.collection("transactions")
    const usersCollection = db.collection("users")

    // Get transaction from database
    let transaction
    try {
      transaction = await transactionsCollection.findOne({
        $or: [
          { _id: new ObjectId(transactionId) },
          { chambuTransactionId: chambuTransactionId || transactionId },
        ],
      })
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid transaction ID format" },
        { status: 400 }
      )
    }

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found in database" },
        { status: 404 }
      )
    }

    const chambuId = transaction.chambuTransactionId || chambuTransactionId

    if (!chambuId) {
      return NextResponse.json(
        { error: "Chambu transaction ID not found" },
        { status: 404 }
      )
    }

    // Check status from Chambu Digital API
    const chambu = createChambuClient()
    let chambuStatus = null
    let statusCheckError = null

    console.log("=".repeat(80))
    console.log("🔍 VERIFYING TRANSACTION STATUS FROM CHAMBU DIGITAL")
    console.log("=".repeat(80))
    console.log("Transaction ID from DB:", chambuId)
    console.log("Transaction from DB:", {
      _id: transaction._id.toString(),
      status: transaction.status,
      type: transaction.type,
      amount: transaction.amount,
      chambuTransactionId: transaction.chambuTransactionId,
    })
    console.log("=".repeat(80))

    try {
      console.log("📞 Calling Chambu Digital API to check transaction status...")
      const statusResponse = await chambu.checkStatus(chambuId)
      if (statusResponse.success && statusResponse.data) {
        chambuStatus = statusResponse.data
        console.log("✅ Transaction found in Chambu Digital!")
        console.log("Status:", chambuStatus.status)
        console.log("Completed At:", chambuStatus.completed_at)
        console.log("SasaPay Code:", chambuStatus.sasapay_transaction_code)
      } else {
        console.log("⚠️ Status check returned but no data:", statusResponse)
      }
    } catch (error: any) {
      statusCheckError = error.message
      console.error("❌ Chambu status check error:", error)
      console.error("Error message:", error.message)
    }
    
    console.log("=".repeat(80))

    // Update transaction in database if we got status from Chambu
    if (chambuStatus) {
      const completedAtDate = chambuStatus.completed_at ? new Date(chambuStatus.completed_at) : new Date()
      const updateData: any = {
        status: chambuStatus.status === "SUCCESS" ? "completed" : chambuStatus.status === "FAILED" || chambuStatus.status === "EXPIRED" ? "failed" : "pending",
        completedAt: completedAtDate,
        sasapayTransactionCode: chambuStatus.sasapay_transaction_code || null,
      }

      await transactionsCollection.updateOne(
        { _id: transaction._id },
        { $set: updateData }
      )

      // If transaction succeeded, update balance
      if (chambuStatus.status === "SUCCESS" && transaction.fromUserId) {
        const user = await usersCollection.findOne({ _id: transaction.fromUserId })
        if (user) {
          const currentBalance = user.balance || 0
          const transactionAmount = transaction.amount || 0
          
          // Only update if balance hasn't been updated yet
          if (transaction.status !== "completed") {
            await usersCollection.updateOne(
              { _id: transaction.fromUserId },
              { $inc: { balance: -transactionAmount } }
            )
          }

          const updatedUser = await usersCollection.findOne({ _id: transaction.fromUserId })
          
          return NextResponse.json({
            success: true,
            transaction: {
              ...transaction,
              _id: transaction._id.toString(),
              fromUserId: transaction.fromUserId?.toString(),
              toUserId: transaction.toUserId?.toString(),
              status: updateData.status,
              completedAt: updateData.completedAt?.toISOString(),
              sasapayTransactionCode: updateData.sasapayTransactionCode,
            },
            chambuStatus: chambuStatus,
            userBalance: updatedUser?.balance || 0,
            message: "Transaction status verified and updated",
          })
        }
      }
    }

    return NextResponse.json({
      success: chambuStatus !== null,
      transaction: {
        ...transaction,
        _id: transaction._id.toString(),
        fromUserId: transaction.fromUserId?.toString(),
        toUserId: transaction.toUserId?.toString(),
        createdAt: transaction.createdAt?.toISOString(),
        completedAt: transaction.completedAt?.toISOString(),
      },
      chambuStatus: chambuStatus,
      error: statusCheckError,
      message: chambuStatus 
        ? "Transaction status retrieved from Chambu Digital" 
        : `Unable to retrieve status from Chambu Digital: ${statusCheckError || "Transaction not found"}`,
    })
  } catch (error) {
    console.error("Verify withdrawal error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to verify withdrawal",
        success: false,
      },
      { status: 500 }
    )
  }
}

