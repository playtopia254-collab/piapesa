import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { createChambuClient, getNetworkCode, formatPhoneNumber } from "@/lib/chambu-api"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fromUserId, toPhone, amount, network, purpose } = body

    // Validation
    if (!fromUserId || !toPhone || !amount || !network) {
      return NextResponse.json(
        { error: "fromUserId, toPhone, amount, and network are required" },
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

    // Get sender from database
    let sender
    try {
      sender = await usersCollection.findOne({ _id: new ObjectId(fromUserId) })
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      )
    }
    
    if (!sender) {
      return NextResponse.json(
        { error: "Sender not found" },
        { status: 404 }
      )
    }

    // Check sender balance
    const senderBalance = sender.balance || 0
    if (senderBalance < amountNum) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      )
    }

    // Format recipient phone number for API (254...) and DB lookup (+254...)
    const formattedToPhone = formatPhoneNumber(toPhone) // 254XXXXXXXXX
    const formattedToPhoneWithPlus = formattedToPhone.startsWith("+")
      ? formattedToPhone
      : `+${formattedToPhone}`

    // Check if recipient is a Pia Pesa user (support both +254 and 254 storage)
    const recipient = await usersCollection.findOne({
      phone: { $in: [formattedToPhoneWithPlus, formattedToPhone] },
    })

    const isPiaPesaInternal =
      network.toLowerCase() === "pia pesa" || network.toLowerCase() === "pia pesa wallet"

    // Internal transfer between Pia Pesa users (no Chambu API)
    if (isPiaPesaInternal && recipient) {

      // Ensure sender has enough balance
      if (senderBalance < amountNum) {
        return NextResponse.json(
          { error: "Insufficient balance" },
          { status: 400 }
        )
      }

      const now = new Date()

      // Create transaction record (completed immediately)
      const transactionRecord = {
        fromUserId: new ObjectId(fromUserId),
        toUserId: recipient._id,
        fromPhone: sender.phone,
        toPhone: formattedToPhoneWithPlus,
        amount: amountNum,
        network: "Pia Pesa",
        purpose: purpose || null,
        status: "completed",
        type: "send",
        createdAt: now,
        completedAt: now,
        chambuTransactionId: null,
        sasapayTransactionCode: null,
      }

      const transactionResult = await transactionsCollection.insertOne(transactionRecord)

      // Update balances
      await usersCollection.updateOne(
        { _id: new ObjectId(fromUserId) },
        { $inc: { balance: -amountNum }, $set: { updatedAt: now } }
      )

      await usersCollection.updateOne(
        { _id: recipient._id },
        { $inc: { balance: amountNum }, $set: { updatedAt: now } }
      )

      const updatedSender = await usersCollection.findOne({ _id: new ObjectId(fromUserId) })
      const updatedRecipient = await usersCollection.findOne({ _id: recipient._id })

      return NextResponse.json(
        {
          success: true,
          transaction: {
            id: transactionResult.insertedId.toString(),
            fromUserId: fromUserId,
            toUserId: recipient._id.toString(),
            fromPhone: sender.phone,
            toPhone: formattedToPhoneWithPlus,
            amount: amountNum,
            network: "Pia Pesa",
            purpose: purpose,
            status: "completed",
            type: "send",
            createdAt: now.toISOString(),
            completedAt: now.toISOString(),
            chambuTransactionId: null,
            sasapayTransactionCode: null,
          },
          senderBalance: updatedSender?.balance || 0,
          recipientBalance: updatedRecipient?.balance || null,
          recipientIsPiaPesaUser: true,
        },
        { status: 200 }
      )
    }

    // --- External (mobile money) transfer using Chambu Digital ---
    // If Pia Pesa was selected but recipient is not a Pia Pesa user, use M-Pesa instead
    const actualNetwork = (isPiaPesaInternal && !recipient) ? "M-Pesa" : network
    const networkCode = getNetworkCode(actualNetwork)

    // Initialize Chambu API client
    const chambu = createChambuClient()

    // Create transaction record in database (pending status)
    const transactionRecord = {
      fromUserId: new ObjectId(fromUserId),
      toUserId: recipient?._id ? new ObjectId(recipient._id) : null,
      fromPhone: sender.phone,
      toPhone: formattedToPhoneWithPlus,
      amount: amountNum,
      network: actualNetwork,
      purpose: purpose || null,
      status: "pending",
      type: "send",
      createdAt: new Date(),
      completedAt: null,
      chambuTransactionId: null,
      sasapayTransactionCode: null,
    }

    const transactionResult = await transactionsCollection.insertOne(transactionRecord)
    const transactionId = transactionResult.insertedId.toString()

    try {
      // Call Chambu Digital API to send money (B2C)
      const withdrawResponse = await chambu.withdraw({
        phoneNumber: formattedToPhone,
        amount: amountNum,
        networkCode: networkCode,
        reference: `PIA_PESA_${transactionId}`,
        reason: purpose || "Pia Pesa transfer",
      })

      // Log the full withdraw response to see what we're getting
      console.log("=".repeat(80))
      console.log("📋 SEND MONEY RESPONSE FROM CHAMBU DIGITAL")
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
          { error: withdrawResponse.message || "Failed to initiate transfer" },
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
        console.error("❌ ERROR: Chambu transaction ID is missing from send response!")
        console.error("Response data:", withdrawResponse.data)
        console.error("Full response keys:", Object.keys(withdrawResponse))
        if (withdrawResponse.data) {
          console.error("Response data keys:", Object.keys(withdrawResponse.data))
        }
        
        // Return error but keep transaction as pending
        return NextResponse.json(
          {
            success: false,
            error: "Transaction ID not received from Chambu Digital. Please check the response.",
            transaction: {
              id: transactionId,
              fromUserId: fromUserId,
              toUserId: recipient?._id ? recipient._id.toString() : null,
              toPhone: formattedToPhone,
              amount: amountNum,
              network: actualNetwork,
              purpose: purpose,
              status: "pending",
              type: "send",
              createdAt: transactionRecord.createdAt.toISOString(),
              completedAt: null,
              chambuTransactionId: null,
              sasapayTransactionCode: null,
            },
            senderBalance: senderBalance,
            recipientBalance: recipient?.balance || null,
            recipientIsPiaPesaUser: !!recipient,
            message: "Transfer request sent but transaction ID not received. Please check transaction history.",
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

      // Check the status from the withdraw response
      const initialStatus = withdrawResponse.data?.status
      
      let finalStatus: any = null
      
      if (initialStatus === "SUCCESS" || initialStatus === "COMPLETED") {
        // Transaction completed immediately, verify with status check
        try {
          const statusResponse = await chambu.checkStatus(chambuTransactionId)
          if (statusResponse.success && statusResponse.data) {
            finalStatus = statusResponse.data
          } else {
            // Use initial response data
            finalStatus = {
              status: initialStatus,
              transaction_id: chambuTransactionId,
              amount: amountNum,
              phone_number: formattedToPhone,
              network_code: networkCode,
              completed_at: new Date().toISOString(),
              sasapay_transaction_code: null,
              result_desc: withdrawResponse.message || "Transfer processed",
            }
          }
        } catch (error) {
          // Status check failed, use initial response
          finalStatus = {
            status: initialStatus,
            transaction_id: chambuTransactionId,
            amount: amountNum,
            phone_number: formattedToPhone,
            network_code: networkCode,
            completed_at: new Date().toISOString(),
            sasapay_transaction_code: null,
            result_desc: withdrawResponse.message || "Transfer processed",
          }
        }
      } else if (initialStatus === "PENDING" || !initialStatus) {
        // Transaction is pending, poll for status
        try {
          finalStatus = await chambu.pollStatus(chambuTransactionId, {
            maxAttempts: 30,
            initialDelay: 3000,
            pollInterval: 10000,
          })
        } catch (error: any) {
          // Status polling failed - do NOT assume success
          console.error("Failed to check send transaction status:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Unable to verify transfer status. Please check your transaction history or contact support.",
              transaction: {
                id: transactionId,
                fromUserId: fromUserId,
                toUserId: recipient?._id ? recipient._id.toString() : null,
                toPhone: formattedToPhone,
                amount: amountNum,
                network: actualNetwork,
                purpose: purpose,
                status: "pending",
                type: "send",
                createdAt: transactionRecord.createdAt.toISOString(),
                completedAt: null,
                chambuTransactionId: chambuTransactionId,
                sasapayTransactionCode: null,
              },
              senderBalance: senderBalance,
              recipientBalance: recipient?.balance || null,
              recipientIsPiaPesaUser: !!recipient,
              message: "Transfer initiated but status verification failed. Transaction is pending.",
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
          phone_number: formattedToPhone,
          network_code: networkCode,
          completed_at: new Date().toISOString(),
          sasapay_transaction_code: null,
          result_desc: withdrawResponse.message || "Transfer failed",
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

      // If transaction succeeded, update balances
      if (finalStatus.status === "SUCCESS") {
        // Deduct from sender's balance
        await usersCollection.updateOne(
          { _id: new ObjectId(fromUserId) },
          { $inc: { balance: -amountNum }, $set: { updatedAt: new Date() } }
        )

        // Add to recipient's balance if they're a Pia Pesa user
        if (recipient) {
          await usersCollection.updateOne(
            { phone: formattedToPhone },
            { $inc: { balance: amountNum }, $set: { updatedAt: new Date() } }
          )
        }
      }

      // Get updated sender balance
      const updatedSender = await usersCollection.findOne({ _id: new ObjectId(fromUserId) })
      const updatedRecipient = recipient ? await usersCollection.findOne({ phone: formattedToPhone }) : null

      return NextResponse.json(
        {
          success: true,
          transaction: {
            id: transactionId,
            fromUserId: fromUserId,
            toUserId: recipient?._id ? recipient._id.toString() : null,
            fromPhone: sender.phone,
            toPhone: formattedToPhone,
            amount: amountNum,
            network: actualNetwork,
            purpose: purpose,
            status: updateData.status,
            type: "send",
            createdAt: transactionRecord.createdAt instanceof Date ? transactionRecord.createdAt.toISOString() : new Date(transactionRecord.createdAt).toISOString(),
            completedAt: updateData.completedAt instanceof Date ? updateData.completedAt.toISOString() : (updateData.completedAt ? new Date(updateData.completedAt).toISOString() : null),
            chambuTransactionId: chambuTransactionId,
            sasapayTransactionCode: updateData.sasapayTransactionCode,
          },
          senderBalance: updatedSender?.balance || 0,
          recipientBalance: updatedRecipient?.balance || null,
          recipientIsPiaPesaUser: !!recipient,
          networkChanged: isPiaPesaInternal && !recipient && actualNetwork !== network,
          originalNetwork: network,
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
          error: error instanceof Error ? error.message : "Failed to process transfer",
          success: false,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Send money error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send money",
        success: false,
      },
      { status: 500 }
    )
  }
}

