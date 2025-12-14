import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// GET - Get single withdrawal request
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { requestId } = params

    const db = await getDb()
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")
    const usersCollection = db.collection("users")

    let withdrawalRequest
    try {
      withdrawalRequest = await withdrawalRequestsCollection.findOne({
        _id: new ObjectId(requestId),
      })
    } catch (e) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    if (!withdrawalRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // Get user and agent details
    let userData = null
    let agentData = null

    if (withdrawalRequest.userId) {
      const user = await usersCollection.findOne({ _id: withdrawalRequest.userId })
      if (user) {
        userData = {
          id: user._id.toString(),
          name: user.name,
          phone: user.phone,
          location: user.location,
        }
      }
    }

    if (withdrawalRequest.agentId) {
      const agent = await usersCollection.findOne({ _id: withdrawalRequest.agentId })
      if (agent) {
        agentData = {
          id: agent._id.toString(),
          name: agent.name,
          phone: agent.phone,
          location: agent.location,
          rating: agent.rating,
        }
      }
    }

    return NextResponse.json({
      success: true,
      request: {
        ...withdrawalRequest,
        _id: withdrawalRequest._id.toString(),
        userId: withdrawalRequest.userId?.toString(),
        agentId: withdrawalRequest.agentId?.toString(),
        user: userData,
        agent: agentData,
        createdAt: withdrawalRequest.createdAt?.toISOString(),
        updatedAt: withdrawalRequest.updatedAt?.toISOString(),
        acceptedAt: withdrawalRequest.acceptedAt?.toISOString(),
        completedAt: withdrawalRequest.completedAt?.toISOString(),
        expiresAt: withdrawalRequest.expiresAt?.toISOString(),
        userConfirmed: withdrawalRequest.userConfirmed || false,
        agentConfirmed: withdrawalRequest.agentConfirmed || false,
        userConfirmedAt: withdrawalRequest.userConfirmedAt?.toISOString(),
        agentConfirmedAt: withdrawalRequest.agentConfirmedAt?.toISOString(),
        dispute: withdrawalRequest.dispute || false,
        disputeReason: withdrawalRequest.disputeReason,
      },
    })
  } catch (error) {
    console.error("Get withdrawal request error:", error)
    return NextResponse.json(
      { error: "Failed to fetch withdrawal request" },
      { status: 500 }
    )
  }
}

// PATCH - Update withdrawal request (accept, confirm, cancel, complete)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { requestId } = params
    const body = await request.json()
    const { action, agentId, userId } = body

    const db = await getDb()
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")
    const usersCollection = db.collection("users")
    const transactionsCollection = db.collection("transactions")

    let withdrawalRequest
    try {
      withdrawalRequest = await withdrawalRequestsCollection.findOne({
        _id: new ObjectId(requestId),
      })
    } catch (e) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    if (!withdrawalRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    let updateData: any = { updatedAt: new Date() }
    let message = ""

    switch (action) {
      case "accept":
        // Agent accepts the request
        if (!agentId) {
          return NextResponse.json({ error: "Agent ID required" }, { status: 400 })
        }
        if (withdrawalRequest.status !== "pending") {
          return NextResponse.json(
            { error: "Request is no longer available" },
            { status: 400 }
          )
        }

        // Verify agent exists and is an agent
        const agent = await usersCollection.findOne({
          _id: new ObjectId(agentId),
          isAgent: true,
        })
        if (!agent) {
          return NextResponse.json({ error: "Agent not found" }, { status: 404 })
        }

        updateData = {
          ...updateData,
          agentId: new ObjectId(agentId),
          status: "matched",
          acceptedAt: new Date(),
        }
        message = "Request accepted! Please proceed to meet the customer."
        break

      case "agent_arrived":
        // Agent confirms they've arrived
        if (withdrawalRequest.status !== "matched") {
          return NextResponse.json({ error: "Invalid request state" }, { status: 400 })
        }
        updateData = {
          ...updateData,
          status: "in_progress",
          agentArrivedAt: new Date(),
        }
        message = "Agent has arrived at the location."
        break

      case "agent_confirm":
        // Agent confirms cash handover
        if (withdrawalRequest.status !== "in_progress") {
          return NextResponse.json({ error: "Invalid request state" }, { status: 400 })
        }
        
        // Check if user already confirmed
        const userAlreadyConfirmed = withdrawalRequest.userConfirmed === true
        
        updateData = {
          ...updateData,
          agentConfirmed: true,
          agentConfirmedAt: new Date(),
        }
        
        // If both confirmed, auto-complete
        if (userAlreadyConfirmed) {
          // Both confirmed - complete transaction
          const userToUpdate = await usersCollection.findOne({
            _id: withdrawalRequest.userId,
          })
          if (!userToUpdate || (userToUpdate.balance || 0) < withdrawalRequest.amount) {
            return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
          }

          const agentToCredit = await usersCollection.findOne({
            _id: withdrawalRequest.agentId,
          })
          if (!agentToCredit) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 })
          }

          // Calculate commission (2% of withdrawal amount, minimum KES 10)
          const commissionRate = 0.02 // 2% commission
          const commission = Math.max(withdrawalRequest.amount * commissionRate, 10)
          const totalAgentReceives = withdrawalRequest.amount + commission // Full amount + commission

          console.log(`💰 Auto-complete Commission Calculation for Request ${withdrawalRequest._id}:`)
          console.log(`   Withdrawal Amount: KES ${withdrawalRequest.amount}`)
          console.log(`   Commission: KES ${commission}`)
          console.log(`   Total Agent Receives: KES ${totalAgentReceives}`)

          // Deduct from user balance
          await usersCollection.updateOne(
            { _id: withdrawalRequest.userId },
            { $inc: { balance: -withdrawalRequest.amount } }
          )

          // Add to agent balance (WITH COMMISSION)
          await usersCollection.updateOne(
            { _id: withdrawalRequest.agentId },
            { 
              $inc: { 
                balance: totalAgentReceives, // Full amount + commission
              },
              $set: {
                totalCommissionEarned: ((agentToCredit.totalCommissionEarned || 0) + commission),
                updatedAt: new Date(),
              }
            }
          )

          // Create transaction records
          await transactionsCollection.insertOne({
            userId: withdrawalRequest.userId,
            fromUserId: withdrawalRequest.userId,
            toUserId: withdrawalRequest.agentId,
            amount: withdrawalRequest.amount,
            type: "agent_withdrawal",
            network: "Agent",
            purpose: `Cash withdrawal from agent ${agentToCredit.name}`,
            status: "completed",
            agentWithdrawalRequestId: withdrawalRequest._id,
            agentId: withdrawalRequest.agentId,
            agentName: agentToCredit.name,
            createdAt: new Date(),
            completedAt: new Date(),
          })

          await transactionsCollection.insertOne({
            userId: withdrawalRequest.agentId,
            fromUserId: withdrawalRequest.userId,
            toUserId: withdrawalRequest.agentId,
            amount: withdrawalRequest.amount,
            type: "agent_receive",
            network: "Agent",
            purpose: `Received from ${userToUpdate.name} for cash withdrawal`,
            status: "completed",
            agentWithdrawalRequestId: withdrawalRequest._id,
            customerId: withdrawalRequest.userId,
            customerName: userToUpdate.name,
            createdAt: new Date(),
            completedAt: new Date(),
          })

          // Create commission transaction record
          try {
            await transactionsCollection.insertOne({
              userId: withdrawalRequest.agentId,
              fromUserId: null, // System commission
              toUserId: withdrawalRequest.agentId,
              amount: commission,
              type: "agent_commission",
              network: "System",
              purpose: `Commission earned from withdrawal transaction`,
              status: "completed",
              agentWithdrawalRequestId: withdrawalRequest._id,
              customerId: withdrawalRequest.userId,
              customerName: userToUpdate.name,
              withdrawalAmount: withdrawalRequest.amount,
              commissionRate: commissionRate,
              createdAt: new Date(),
              completedAt: new Date(),
            })
            console.log(`✅ Created commission transaction: KES ${commission}`)
          } catch (commissionError) {
            console.error(`❌ Failed to create commission transaction: ${commissionError}`)
            // Balance was already updated, so continue
          }

          updateData = {
            ...updateData,
            status: "completed",
            completedAt: new Date(),
          }
          message = `Withdrawal completed! KES ${withdrawalRequest.amount} transferred to agent.`
        } else {
          message = "Agent confirmed cash handover. Waiting for user confirmation."
        }
        break

      case "user_confirm":
        // User confirms receipt of cash
        if (withdrawalRequest.status !== "in_progress") {
          return NextResponse.json({ error: "Invalid request state" }, { status: 400 })
        }
        
        // Check if agent already confirmed
        const agentAlreadyConfirmed = withdrawalRequest.agentConfirmed === true
        
        updateData = {
          ...updateData,
          userConfirmed: true,
          userConfirmedAt: new Date(),
        }
        
        // If both confirmed, auto-complete
        if (agentAlreadyConfirmed) {
          // Both confirmed - complete transaction
          const userToUpdate = await usersCollection.findOne({
            _id: withdrawalRequest.userId,
          })
          if (!userToUpdate || (userToUpdate.balance || 0) < withdrawalRequest.amount) {
            return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
          }

          const agentToCredit = await usersCollection.findOne({
            _id: withdrawalRequest.agentId,
          })
          if (!agentToCredit) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 })
          }

          // Calculate commission (2% of withdrawal amount, minimum KES 10)
          const commissionRate = 0.02 // 2% commission
          const commission = Math.max(withdrawalRequest.amount * commissionRate, 10)
          const totalAgentReceives = withdrawalRequest.amount + commission // Full amount + commission

          console.log(`💰 Auto-complete Commission Calculation for Request ${withdrawalRequest._id}:`)
          console.log(`   Withdrawal Amount: KES ${withdrawalRequest.amount}`)
          console.log(`   Commission: KES ${commission}`)
          console.log(`   Total Agent Receives: KES ${totalAgentReceives}`)

          // Deduct from user balance
          await usersCollection.updateOne(
            { _id: withdrawalRequest.userId },
            { $inc: { balance: -withdrawalRequest.amount } }
          )

          // Add to agent balance (WITH COMMISSION)
          await usersCollection.updateOne(
            { _id: withdrawalRequest.agentId },
            { 
              $inc: { 
                balance: totalAgentReceives, // Full amount + commission
              },
              $set: {
                totalCommissionEarned: ((agentToCredit.totalCommissionEarned || 0) + commission),
                updatedAt: new Date(),
              }
            }
          )

          // Create transaction records
          await transactionsCollection.insertOne({
            userId: withdrawalRequest.userId,
            fromUserId: withdrawalRequest.userId,
            toUserId: withdrawalRequest.agentId,
            amount: withdrawalRequest.amount,
            type: "agent_withdrawal",
            network: "Agent",
            purpose: `Cash withdrawal from agent ${agentToCredit.name}`,
            status: "completed",
            agentWithdrawalRequestId: withdrawalRequest._id,
            agentId: withdrawalRequest.agentId,
            agentName: agentToCredit.name,
            createdAt: new Date(),
            completedAt: new Date(),
          })

          await transactionsCollection.insertOne({
            userId: withdrawalRequest.agentId,
            fromUserId: withdrawalRequest.userId,
            toUserId: withdrawalRequest.agentId,
            amount: withdrawalRequest.amount,
            type: "agent_receive",
            network: "Agent",
            purpose: `Received from ${userToUpdate.name} for cash withdrawal`,
            status: "completed",
            agentWithdrawalRequestId: withdrawalRequest._id,
            customerId: withdrawalRequest.userId,
            customerName: userToUpdate.name,
            createdAt: new Date(),
            completedAt: new Date(),
          })

          // Create commission transaction record
          try {
            await transactionsCollection.insertOne({
              userId: withdrawalRequest.agentId,
              fromUserId: null, // System commission
              toUserId: withdrawalRequest.agentId,
              amount: commission,
              type: "agent_commission",
              network: "System",
              purpose: `Commission earned from withdrawal transaction`,
              status: "completed",
              agentWithdrawalRequestId: withdrawalRequest._id,
              customerId: withdrawalRequest.userId,
              customerName: userToUpdate.name,
              withdrawalAmount: withdrawalRequest.amount,
              commissionRate: commissionRate,
              createdAt: new Date(),
              completedAt: new Date(),
            })
            console.log(`✅ Created commission transaction: KES ${commission}`)
          } catch (commissionError) {
            console.error(`❌ Failed to create commission transaction: ${commissionError}`)
            // Balance was already updated, so continue
          }

          updateData = {
            ...updateData,
            status: "completed",
            completedAt: new Date(),
          }
          message = `Withdrawal completed! KES ${withdrawalRequest.amount} transferred to agent.`
        } else {
          message = "User confirmed receiving cash. Waiting for agent confirmation."
        }
        break

      case "complete":
        // Complete the transaction (after both confirmations)
        if (withdrawalRequest.status !== "in_progress") {
          return NextResponse.json({ error: "Invalid request state" }, { status: 400 })
        }

        // Verify both parties confirmed
        if (!withdrawalRequest.agentConfirmed || !withdrawalRequest.userConfirmed) {
          return NextResponse.json(
            { error: "Both parties must confirm before completing" },
            { status: 400 }
          )
        }

        // Verify user has sufficient balance
        const userToUpdate = await usersCollection.findOne({
          _id: withdrawalRequest.userId,
        })
        if (!userToUpdate || (userToUpdate.balance || 0) < withdrawalRequest.amount) {
          return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
        }

        // Verify agent exists
        const agentToCredit = await usersCollection.findOne({
          _id: withdrawalRequest.agentId,
        })
        if (!agentToCredit) {
          return NextResponse.json({ error: "Agent not found" }, { status: 404 })
        }

        // Calculate commission (2% of withdrawal amount, minimum KES 10)
        const commissionRate = 0.02 // 2% commission
        const commission = Math.max(withdrawalRequest.amount * commissionRate, 10)
        const totalDeducted = withdrawalRequest.amount // Customer pays full amount
        const totalAgentReceives = withdrawalRequest.amount + commission // Full amount + commission

        console.log(`💰 Commission Calculation for Request ${withdrawalRequest._id}:`)
        console.log(`   Withdrawal Amount: KES ${withdrawalRequest.amount}`)
        console.log(`   Commission Rate: ${commissionRate * 100}%`)
        console.log(`   Commission: KES ${commission}`)
        console.log(`   Total Agent Receives: KES ${totalAgentReceives}`)
        console.log(`   Agent Previous Balance: KES ${agentToCredit.balance || 0}`)

        // Deduct from user balance (customer gives digital money - full amount)
        await usersCollection.updateOne(
          { _id: withdrawalRequest.userId },
          { $inc: { balance: -totalDeducted } }
        )

        // Add to agent balance (agent receives full withdrawal amount + commission)
        // Agent gives customer cash, receives digital money + commission as earnings
        const balanceUpdateResult = await usersCollection.updateOne(
          { _id: withdrawalRequest.agentId },
          { 
            $inc: { 
              balance: totalAgentReceives, // Full amount + commission
            },
            $set: {
              totalCommissionEarned: ((agentToCredit.totalCommissionEarned || 0) + commission),
              updatedAt: new Date(),
            }
          }
        )

        // Verify the balance was updated
        const updatedAgent = await usersCollection.findOne({ _id: withdrawalRequest.agentId })
        console.log(`   Agent New Balance: KES ${updatedAgent?.balance || 0}`)
        console.log(`   Balance Update Success: ${balanceUpdateResult.modifiedCount > 0}`)

        // Create transaction record for the customer (withdrawal - money out)
        await transactionsCollection.insertOne({
          userId: withdrawalRequest.userId,
          fromUserId: withdrawalRequest.userId,
          toUserId: withdrawalRequest.agentId,
          amount: withdrawalRequest.amount,
          type: "agent_withdrawal",
          network: "Agent",
          purpose: `Cash withdrawal from agent ${agentToCredit.name}`,
          status: "completed",
          agentWithdrawalRequestId: withdrawalRequest._id,
          agentId: withdrawalRequest.agentId,
          agentName: agentToCredit.name,
          createdAt: new Date(),
          completedAt: new Date(),
        })

        // Create transaction record for the agent (receive - money in for cash exchange)
        await transactionsCollection.insertOne({
          userId: withdrawalRequest.agentId,
          fromUserId: withdrawalRequest.userId,
          toUserId: withdrawalRequest.agentId,
          amount: withdrawalRequest.amount,
          type: "agent_receive",
          network: "Agent",
          purpose: `Received from ${userToUpdate.name} for cash withdrawal`,
          status: "completed",
          agentWithdrawalRequestId: withdrawalRequest._id,
          customerId: withdrawalRequest.userId,
          customerName: userToUpdate.name,
          withdrawalAmount: withdrawalRequest.amount,
          createdAt: new Date(),
          completedAt: new Date(),
        })

        // Create commission transaction record - CRITICAL: This must always succeed
        try {
          const commissionTransaction = {
            userId: withdrawalRequest.agentId,
            fromUserId: null, // System commission
            toUserId: withdrawalRequest.agentId,
            amount: commission,
            type: "agent_commission",
            network: "System",
            purpose: `Commission earned from withdrawal transaction`,
            status: "completed",
            agentWithdrawalRequestId: withdrawalRequest._id,
            customerId: withdrawalRequest.userId,
            customerName: userToUpdate.name,
            withdrawalAmount: withdrawalRequest.amount,
            commissionRate: commissionRate,
            createdAt: new Date(),
            completedAt: new Date(),
          }
          
          console.log(`💰 Creating commission transaction:`, {
            agentId: withdrawalRequest.agentId.toString(),
            amount: commission,
            type: "agent_commission",
            requestId: withdrawalRequest._id.toString(),
          })
          
          const commissionResult = await transactionsCollection.insertOne(commissionTransaction)
          
          if (!commissionResult.insertedId) {
            throw new Error("Commission transaction insertion returned no ID")
          }
          
          console.log(`✅ Commission transaction created:`, {
            insertedId: commissionResult.insertedId.toString(),
            agentId: withdrawalRequest.agentId.toString(),
            amount: commission,
          })
          
          // CRITICAL: Verify the transaction was actually inserted - retry if needed
          let verifyCommission = await transactionsCollection.findOne({
            _id: commissionResult.insertedId,
          })
          
          // If not found immediately, wait a bit and retry (MongoDB eventual consistency)
          if (!verifyCommission) {
            console.warn(`⚠️ Commission transaction not found immediately, retrying...`)
            await new Promise(resolve => setTimeout(resolve, 100))
            verifyCommission = await transactionsCollection.findOne({
              _id: commissionResult.insertedId,
            })
          }
          
          if (!verifyCommission) {
            // Last resort: try to find by request ID
            verifyCommission = await transactionsCollection.findOne({
              agentWithdrawalRequestId: withdrawalRequest._id,
              type: "agent_commission",
              userId: withdrawalRequest.agentId,
            })
          }
          
          if (!verifyCommission) {
            const errorMsg = `CRITICAL ERROR: Commission transaction was not found after insertion! Request ID: ${withdrawalRequest._id}, Inserted ID: ${commissionResult.insertedId}`
            console.error(`❌ ${errorMsg}`)
            // Don't throw - balance was already updated, but log the error
            // The fix-commission-transactions endpoint can recover this later
          } else {
            console.log(`✅ Verified commission transaction exists in database`)
          }
        } catch (commissionError) {
          // CRITICAL: Log error but don't fail the entire transaction
          // The balance was already updated, so we need to track this for recovery
          const errorMsg = `Failed to create commission transaction: ${commissionError instanceof Error ? commissionError.message : String(commissionError)}`
          console.error(`❌ ${errorMsg}`)
          console.error(`   Request ID: ${withdrawalRequest._id}`)
          console.error(`   Agent ID: ${withdrawalRequest.agentId}`)
          console.error(`   Commission Amount: KES ${commission}`)
          // Note: Balance was already updated with commission, so the fix endpoint can create the missing transaction record
        }

        updateData = {
          ...updateData,
          status: "completed",
          completedAt: new Date(),
        }
        message = `Withdrawal completed! KES ${withdrawalRequest.amount} transferred to agent.`
        break

      case "cancel":
        // Cancel the request - handle dispute if one party already confirmed
        if (["completed", "cancelled"].includes(withdrawalRequest.status)) {
          return NextResponse.json({ error: "Cannot cancel this request" }, { status: 400 })
        }
        
        const { cancelReason } = body
        const cancellerId = userId || agentId
        const isUserCancelling = !!userId
        const isAgentCancelling = !!agentId
        
        // Check if this is a dispute (one party confirmed, other is cancelling)
        const isDispute = 
          (withdrawalRequest.agentConfirmed && isUserCancelling) ||
          (withdrawalRequest.userConfirmed && isAgentCancelling)
        
        updateData = {
          ...updateData,
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: cancellerId,
          cancelReason: cancelReason || "No reason provided",
        }
        
        // If dispute, lock both accounts
        if (isDispute) {
          const lockReason = `Dispute in withdrawal request ${requestId}: ${cancelReason || "One party refused after the other confirmed"}`
          
          // Lock user account
          await usersCollection.updateOne(
            { _id: withdrawalRequest.userId },
            {
              $set: {
                isLocked: true,
                lockReason: lockReason,
                lockedAt: new Date(),
                lockedBy: "system",
              },
            }
          )
          
          // Lock agent account
          if (withdrawalRequest.agentId) {
            await usersCollection.updateOne(
              { _id: withdrawalRequest.agentId },
              {
                $set: {
                  isLocked: true,
                  lockReason: lockReason,
                  lockedAt: new Date(),
                  lockedBy: "system",
                },
              }
            )
          }
          
          updateData = {
            ...updateData,
            dispute: true,
            disputeReason: lockReason,
          }
          
          message = "Request cancelled. Both accounts have been locked due to dispute. Contact support to resolve."
        } else {
          message = "Request cancelled."
        }
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Update the request
    await withdrawalRequestsCollection.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: updateData }
    )

    // Fetch updated request
    const updatedRequest = await withdrawalRequestsCollection.findOne({
      _id: new ObjectId(requestId),
    })

    // Create notifications based on action
    const notificationsCollection = db.collection("notifications")
    
    if (updatedRequest) {
      // Get user and agent details for notifications
      const userForNotification = await usersCollection.findOne({ _id: updatedRequest.userId })
      const agentForNotification = updatedRequest.agentId 
        ? await usersCollection.findOne({ _id: updatedRequest.agentId })
        : null

      switch (action) {
        case "accept":
          // Notify user that agent accepted their request
          if (userForNotification && agentForNotification) {
            await notificationsCollection.insertOne({
              userId: updatedRequest.userId,
              type: "agent_request",
              title: "Agent Accepted Your Request",
              message: `${agentForNotification.name} has accepted your withdrawal request of KES ${updatedRequest.amount.toLocaleString()}. They will be on their way soon.`,
              read: false,
              link: `/dashboard/agent-requests`,
              metadata: {
                requestId: requestId,
                amount: updatedRequest.amount,
                status: "matched",
              },
              createdAt: new Date(),
            })
          }
          break

        case "agent_arrived":
          // Notify user that agent has arrived
          if (userForNotification && agentForNotification) {
            await notificationsCollection.insertOne({
              userId: updatedRequest.userId,
              type: "agent_request",
              title: "Agent Has Arrived",
              message: `${agentForNotification.name} has arrived at your location. Please meet them to complete your withdrawal.`,
              read: false,
              link: `/dashboard/agent-requests`,
              metadata: {
                requestId: requestId,
                amount: updatedRequest.amount,
                status: "in_progress",
              },
              createdAt: new Date(),
            })
          }
          break

        case "complete":
          // Notify both user and agent about completion
          if (userForNotification) {
            await notificationsCollection.insertOne({
              userId: updatedRequest.userId,
              type: "transaction",
              title: "Withdrawal Completed",
              message: `Your withdrawal of KES ${updatedRequest.amount.toLocaleString()} has been completed successfully.`,
              read: false,
              link: `/dashboard/transactions`,
              metadata: {
                requestId: requestId,
                amount: updatedRequest.amount,
                status: "completed",
              },
              createdAt: new Date(),
            })
          }
          if (agentForNotification) {
            const commission = Math.max(updatedRequest.amount * 0.02, 10)
            await notificationsCollection.insertOne({
              userId: updatedRequest.agentId,
              type: "transaction",
              title: "Withdrawal Transaction Completed",
              message: `You've completed a withdrawal transaction of KES ${updatedRequest.amount.toLocaleString()}. Commission: KES ${commission.toLocaleString()}.`,
              read: false,
              link: `/dashboard/agent-dashboard`,
              metadata: {
                requestId: requestId,
                amount: updatedRequest.amount,
                status: "completed",
              },
              createdAt: new Date(),
            })
          }
          break
      }
    }

    // Get user and agent details
    let userData = null
    let agentData = null

    if (updatedRequest?.userId) {
      const user = await usersCollection.findOne({ _id: updatedRequest.userId })
      if (user) {
        userData = {
          id: user._id.toString(),
          name: user.name,
          phone: user.phone,
          location: user.location,
          balance: user.balance,
        }
      }
    }

    if (updatedRequest?.agentId) {
      const agentUser = await usersCollection.findOne({ _id: updatedRequest.agentId })
      if (agentUser) {
        agentData = {
          id: agentUser._id.toString(),
          name: agentUser.name,
          phone: agentUser.phone,
          location: agentUser.location,
          rating: agentUser.rating,
          balance: agentUser.balance,
        }
      }
    }

    // Get agent balance for "complete" action - fetch AFTER balance update to get accurate balance
    let agentBalance = null
    if (action === "complete" && updatedRequest?.agentId) {
      const agentUser = await usersCollection.findOne({ _id: updatedRequest.agentId })
      agentBalance = agentUser?.balance || 0
      // Update agentData with the latest balance if it exists
      if (agentData && agentUser) {
        agentData.balance = agentUser.balance
      }
    }

    return NextResponse.json({
      success: true,
      message,
      request: {
        ...updatedRequest,
        _id: updatedRequest?._id.toString(),
        userId: updatedRequest?.userId?.toString(),
        agentId: updatedRequest?.agentId?.toString(),
        user: userData,
        agent: agentData,
        createdAt: updatedRequest?.createdAt?.toISOString(),
        updatedAt: updatedRequest?.updatedAt?.toISOString(),
        acceptedAt: updatedRequest?.acceptedAt?.toISOString(),
        completedAt: updatedRequest?.completedAt?.toISOString(),
        userConfirmed: updatedRequest?.userConfirmed || false,
        agentConfirmed: updatedRequest?.agentConfirmed || false,
        userConfirmedAt: updatedRequest?.userConfirmedAt?.toISOString(),
        agentConfirmedAt: updatedRequest?.agentConfirmedAt?.toISOString(),
        dispute: updatedRequest?.dispute || false,
        disputeReason: updatedRequest?.disputeReason,
      },
      userBalance: userData?.balance,
      agentBalance: agentBalance !== null ? agentBalance : (agentData?.balance || 0), // Use post-update balance
      ...(action === "complete" && updatedRequest?.amount && {
        commission: Math.max(updatedRequest.amount * 0.02, 10),
        commissionRate: 0.02,
      }),
    })
  } catch (error) {
    console.error("Update withdrawal request error:", error)
    return NextResponse.json(
      { error: "Failed to update withdrawal request" },
      { status: 500 }
    )
  }
}

// DELETE - Cancel/delete withdrawal request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { requestId } = params

    const db = await getDb()
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")

    let withdrawalRequest
    try {
      withdrawalRequest = await withdrawalRequestsCollection.findOne({
        _id: new ObjectId(requestId),
      })
    } catch (e) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    if (!withdrawalRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (["completed", "in_progress"].includes(withdrawalRequest.status)) {
      return NextResponse.json(
        { error: "Cannot delete a completed or in-progress request" },
        { status: 400 }
      )
    }

    await withdrawalRequestsCollection.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: "Request cancelled successfully",
    })
  } catch (error) {
    console.error("Delete withdrawal request error:", error)
    return NextResponse.json(
      { error: "Failed to cancel withdrawal request" },
      { status: 500 }
    )
  }
}

