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

          // Deduct from user balance
          await usersCollection.updateOne(
            { _id: withdrawalRequest.userId },
            { $inc: { balance: -withdrawalRequest.amount } }
          )

          // Add to agent balance
          await usersCollection.updateOne(
            { _id: withdrawalRequest.agentId },
            { $inc: { balance: withdrawalRequest.amount } }
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

          // Deduct from user balance
          await usersCollection.updateOne(
            { _id: withdrawalRequest.userId },
            { $inc: { balance: -withdrawalRequest.amount } }
          )

          // Add to agent balance
          await usersCollection.updateOne(
            { _id: withdrawalRequest.agentId },
            { $inc: { balance: withdrawalRequest.amount } }
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

        // Deduct from user balance (customer gives digital money)
        await usersCollection.updateOne(
          { _id: withdrawalRequest.userId },
          { $inc: { balance: -withdrawalRequest.amount } }
        )

        // Add to agent balance (agent receives digital money for giving cash)
        await usersCollection.updateOne(
          { _id: withdrawalRequest.agentId },
          { $inc: { balance: withdrawalRequest.amount } }
        )

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

        // Create transaction record for the agent (receive - money in)
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
      agentBalance: agentData?.balance,
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

