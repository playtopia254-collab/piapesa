import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { createChambuClient, getNetworkCode, formatPhoneNumber } from "@/lib/chambu-api"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phoneNumber, amount, network, reason } = body

    // Validation
    if (!userId || !phoneNumber || !amount || !network) {
      return NextResponse.json(
        { error: "userId, phoneNumber, amount, and network are required" },
        { status: 400 }
      )
    }

    // Reason is required
    if (!reason || reason.trim() === "") {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      )
    }

    const amountNum = Number.parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 10 || amountNum > 250000) {
      return NextResponse.json(
        { error: "Amount must be between KES 10 and KES 250,000" },
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

    // Check balance
    const userBalance = user.balance || 0
    if (userBalance < amountNum) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      )
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber)
    const networkCode = getNetworkCode(network)

    // Initialize Chambu API client
    const chambu = createChambuClient()

    // Create transaction record in database (pending status)
    const transactionRecord = {
      fromUserId: new ObjectId(userId),
      toUserId: null,
      fromPhone: user.phone || null,
      toPhone: formattedPhone,
      amount: amountNum,
      network: network,
      purpose: reason || "Withdrawal to mobile money",
      status: "pending",
      type: "withdrawal",
      createdAt: new Date(),
      completedAt: null,
      chambuTransactionId: null,
      sasapayTransactionCode: null,
    }

    const transactionResult = await transactionsCollection.insertOne(transactionRecord)
    const transactionId = transactionResult.insertedId.toString()

    try {
      // Call Chambu Digital API to withdraw money (B2C)
      const withdrawResponse = await chambu.withdraw({
        phoneNumber: formattedPhone,
        amount: amountNum,
        networkCode: networkCode,
        reference: `WITHDRAW_${transactionId}`,
        reason: reason || "Withdrawal to mobile money",
      })

      // Log the full withdraw response to see what we're getting
      console.log("=".repeat(80))
      console.log("📋 WITHDRAW RESPONSE FROM CHAMBU DIGITAL")
      console.log("=".repeat(80))
      console.log("Full Response:", JSON.stringify(withdrawResponse, null, 2))
      console.log("Response Data:", withdrawResponse.data)
      console.log("Transaction ID:", withdrawResponse.data?.transactionId)
      console.log("=".repeat(80))

      if (!withdrawResponse.success) {
        // Update transaction status to failed
        await transactionsCollection.updateOne(
          { _id: transactionResult.insertedId },
          { $set: { status: "failed", completedAt: new Date() } }
        )
        return NextResponse.json(
          { error: withdrawResponse.message || "Failed to initiate withdrawal" },
          { status: 500 }
        )
      }

      // Try multiple possible field names for transaction ID
      const chambuTransactionId = 
        withdrawResponse.data?.transactionId || 
        withdrawResponse.data?.transaction_id ||
        withdrawResponse.data?.id ||
        withdrawResponse.transactionId ||
        withdrawResponse.transaction_id ||
        withdrawResponse.id

      // Validate that we have a transaction ID
      if (!chambuTransactionId) {
        console.error("❌ ERROR: Chambu transaction ID is missing from response!")
        console.error("Response data:", withdrawResponse.data)
        console.error("Full response keys:", Object.keys(withdrawResponse))
        if (withdrawResponse.data) {
          console.error("Response data keys:", Object.keys(withdrawResponse.data))
        }
        return NextResponse.json(
          {
            success: false,
            error: "Transaction ID not received from Chambu Digital. Please check the response.",
            transaction: {
              _id: transactionId,
              fromUserId: userId,
              toUserId: null,
              toPhone: formattedPhone,
              amount: amountNum,
              network: network,
              purpose: reason || "Withdrawal to mobile money",
              status: "pending",
              type: "withdrawal",
              createdAt: transactionRecord.createdAt.toISOString(),
              completedAt: null,
              chambuTransactionId: null,
              sasapayTransactionCode: null,
            },
            userBalance: userBalance,
            message: "Withdrawal request sent but transaction ID not received. Please check transaction history.",
            rawResponse: withdrawResponse, // Include raw response for debugging
          },
          { status: 200 }
        )
      }

      console.log("✅ Chambu Transaction ID received:", chambuTransactionId)

      // Update transaction with Chambu transaction ID
      await transactionsCollection.updateOne(
        { _id: transactionResult.insertedId },
        { $set: { chambuTransactionId: chambuTransactionId } }
      )

      // Always check the actual status from Chambu Digital API response
      // First, check the initial response status
      let finalStatus: any = null
      
      // Check the status from the withdraw response
      const initialStatus = withdrawResponse.data?.status
      
      if (initialStatus === "SUCCESS" || initialStatus === "COMPLETED") {
        // If the withdrawal response already indicates success, use it
        // But still verify by checking status endpoint
        try {
          const statusResponse = await chambu.checkStatus(chambuTransactionId)
          if (statusResponse.success && statusResponse.data) {
            finalStatus = statusResponse.data
          } else {
            // If status check fails but initial response says success, use initial response data
            finalStatus = {
              status: initialStatus,
              transaction_id: chambuTransactionId,
              amount: amountNum,
              phone_number: formattedPhone,
              network_code: networkCode,
              completed_at: new Date().toISOString(),
              sasapay_transaction_code: null,
              result_desc: withdrawResponse.message || "Withdrawal processed",
            }
          }
        } catch (error) {
          // Status check failed, but initial response indicates success
          // Use the initial response data
          finalStatus = {
            status: initialStatus,
            transaction_id: chambuTransactionId,
            amount: amountNum,
            phone_number: formattedPhone,
            network_code: networkCode,
            completed_at: new Date().toISOString(),
            sasapay_transaction_code: null,
            result_desc: withdrawResponse.message || "Withdrawal processed",
          }
        }
      } else if (initialStatus === "PENDING" || !initialStatus) {
        // Transaction is pending, poll for status until we get a definitive answer
        try {
          finalStatus = await chambu.pollStatus(chambuTransactionId, {
            maxAttempts: 30,
            initialDelay: 3000, // Wait 3 seconds before first status check
            pollInterval: 10000,
          })
        } catch (error: any) {
          // Status polling failed - do NOT assume success
          // Keep transaction as pending and return error
          console.error("Failed to check withdrawal status:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Unable to verify withdrawal status. Please check your transaction history or contact support.",
              transaction: {
                _id: transactionId,
                fromUserId: userId,
                toUserId: null,
                toPhone: formattedPhone,
                amount: amountNum,
                network: network,
                purpose: reason || "Withdrawal to mobile money",
                status: "pending",
                type: "withdrawal",
                createdAt: transactionRecord.createdAt.toISOString(),
                completedAt: null,
                chambuTransactionId: chambuTransactionId,
                sasapayTransactionCode: null,
              },
              userBalance: userBalance,
              message: "Withdrawal initiated but status verification failed. Transaction is pending.",
            },
            { status: 200 }
          )
        }
      } else {
        // Status is FAILED or other error state
        finalStatus = {
          status: initialStatus,
          transaction_id: chambuTransactionId,
          amount: amountNum,
          phone_number: formattedPhone,
          network_code: networkCode,
          completed_at: new Date().toISOString(),
          sasapay_transaction_code: null,
          result_desc: withdrawResponse.message || "Withdrawal failed",
        }
      }

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

      // If transaction succeeded, update balance
      if (finalStatus.status === "SUCCESS") {
        // Use $inc to atomically decrement balance to avoid race conditions
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $inc: { balance: -amountNum } }
        )
        
        // Get updated balance
        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) })
        const newBalance = updatedUser?.balance || 0

        // Return transaction with updated balance
        const updatedTransaction = await transactionsCollection.findOne({
          _id: transactionResult.insertedId,
        })

        return NextResponse.json({
          success: true,
          transaction: {
            ...updatedTransaction,
            _id: updatedTransaction?._id.toString(),
            fromUserId: updatedTransaction?.fromUserId?.toString(),
            toUserId: updatedTransaction?.toUserId?.toString(),
            createdAt: updatedTransaction?.createdAt?.toISOString(),
            completedAt: updatedTransaction?.completedAt?.toISOString(),
          },
          userBalance: newBalance,
          message: "Withdrawal completed successfully",
        })
      } else {
        // Transaction failed or pending
        const updatedTransaction = await transactionsCollection.findOne({
          _id: transactionResult.insertedId,
        })

        return NextResponse.json({
          success: finalStatus.status === "SUCCESS",
          transaction: {
            ...updatedTransaction,
            _id: updatedTransaction?._id.toString(),
            fromUserId: updatedTransaction?.fromUserId?.toString(),
            toUserId: updatedTransaction?.toUserId?.toString(),
            createdAt: updatedTransaction?.createdAt?.toISOString(),
            completedAt: updatedTransaction?.completedAt?.toISOString(),
          },
          userBalance: userBalance,
          message: finalStatus.status === "PENDING" ? "Withdrawal is being processed" : "Withdrawal failed",
        })
      }
    } catch (error) {
      // Update transaction status to failed
      await transactionsCollection.updateOne(
        { _id: transactionResult.insertedId },
        { $set: { status: "failed", completedAt: new Date() } }
      )

      console.error("Chambu withdrawal error:", error)
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to process withdrawal",
          success: false,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Withdrawal transaction error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process withdrawal",
        success: false,
      },
      { status: 500 }
    )
  }
}

