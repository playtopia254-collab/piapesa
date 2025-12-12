import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { createChambuClient, getNetworkCode, formatPhoneNumber } from "@/lib/chambu-api"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, amount, network, description } = body

    // Validation
    if (!userId || !amount || !network) {
      return NextResponse.json(
        { error: "userId, amount, and network are required" },
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

    // Get user's phone number
    const userPhone = user.phone
    if (!userPhone) {
      return NextResponse.json(
        { error: "User phone number not found" },
        { status: 400 }
      )
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(userPhone)

    // Get network code
    const networkCode = getNetworkCode(network)

    // Initialize Chambu API client
    const chambu = createChambuClient()

    // Create transaction record in database (pending status)
    const transactionRecord = {
      fromUserId: null,
      toUserId: new ObjectId(userId),
      fromPhone: null,
      toPhone: formattedPhone,
      amount: amountNum,
      network: network,
      purpose: description || "Deposit to Pia Pesa",
      status: "pending",
      type: "deposit",
      createdAt: new Date(),
      completedAt: null,
      chambuTransactionId: null,
      sasapayTransactionCode: null,
    }

    const transactionResult = await transactionsCollection.insertOne(transactionRecord)
    const transactionId = transactionResult.insertedId.toString()

    try {
      // Call Chambu Digital API to initiate payment collection (C2B - STK Push)
      const initiateResponse = await chambu.initiatePayment({
        customer_phone: formattedPhone,
        amount: amountNum,
        network_code: networkCode,
        description: description || "Deposit to Pia Pesa wallet",
        reference: `DEPOSIT_${transactionId}`,
        metadata: {
          userId: userId,
          transactionId: transactionId,
          type: "deposit",
        },
      })

      if (!initiateResponse.success) {
        // Update transaction status to failed
        await transactionsCollection.updateOne(
          { _id: transactionResult.insertedId },
          { $set: { status: "failed", completedAt: new Date() } }
        )
        return NextResponse.json(
          { error: initiateResponse.message || "Failed to initiate payment" },
          { status: 500 }
        )
      }

      const chambuTransactionId = initiateResponse.data.transaction_id

      // Update transaction with Chambu transaction ID
      await transactionsCollection.updateOne(
        { _id: transactionResult.insertedId },
        { $set: { chambuTransactionId: chambuTransactionId } }
      )

      // Poll for transaction status
      const finalStatus = await chambu.pollStatus(chambuTransactionId, {
        maxAttempts: 30,
        pollInterval: 10000,
      })

      // Update transaction with final status
      const completedAtDate = finalStatus.completed_at ? new Date(finalStatus.completed_at) : new Date()
      const updateData: any = {
        status: finalStatus.status === "SUCCESS" ? "completed" : finalStatus.status === "FAILED" || finalStatus.status === "EXPIRED" ? "failed" : "pending",
        completedAt: completedAtDate,
        sasapayTransactionCode: finalStatus.sasapay_transaction_code || null,
      }

      await transactionsCollection.updateOne(
        { _id: transactionResult.insertedId },
        { $set: updateData }
      )

      // If transaction succeeded, update user balance
      if (finalStatus.status === "SUCCESS") {
        // Add to user's balance (amount entered, not total charge - fee is paid by customer)
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $inc: { balance: amountNum }, $set: { updatedAt: new Date() } }
        )
      }

      // Get updated user balance
      const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) })

      return NextResponse.json(
        {
          success: true,
          transaction: {
            id: transactionId,
            toUserId: userId,
            toPhone: formattedPhone,
            amount: amountNum,
            network: network,
            purpose: description || "Deposit to Pia Pesa",
            status: updateData.status,
            type: "deposit",
            createdAt: transactionRecord.createdAt instanceof Date ? transactionRecord.createdAt.toISOString() : new Date(transactionRecord.createdAt).toISOString(),
            completedAt: updateData.completedAt instanceof Date ? updateData.completedAt.toISOString() : (updateData.completedAt ? new Date(updateData.completedAt).toISOString() : null),
            chambuTransactionId: chambuTransactionId,
            sasapayTransactionCode: updateData.sasapayTransactionCode,
            transactionFee: initiateResponse.data.transactionFee,
            totalCharge: initiateResponse.data.totalCharge,
          },
          userBalance: updatedUser?.balance || 0,
        },
        { status: 200 }
      )
    } catch (error) {
      // Update transaction status to failed
      await transactionsCollection.updateOne(
        { _id: transactionResult.insertedId },
        { $set: { status: "failed", completedAt: new Date() } }
      )

      console.error("Chambu API error:", error)
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to process deposit",
          success: false,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Deposit error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process deposit",
        success: false,
      },
      { status: 500 }
    )
  }
}

