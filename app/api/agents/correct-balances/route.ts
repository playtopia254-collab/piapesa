import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// POST - Correct all agent balances based on transactions
export async function POST(request: NextRequest) {
  try {
    const db = await getDb()
    const usersCollection = db.collection("users")
    const transactionsCollection = db.collection("transactions")
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")

    // Get all agents
    const agents = await usersCollection.find({ isAgent: true }).toArray()

    console.log(`🔍 Found ${agents.length} agents to correct balances`)

    const results = {
      totalAgents: agents.length,
      corrected: 0,
      alreadyCorrect: 0,
      errors: [] as string[],
      corrections: [] as Array<{
        agentId: string
        agentName: string
        oldBalance: number
        newBalance: number
        difference: number
        missingCommissions: number
      }>,
    }

    for (const agent of agents) {
      try {
        const agentId = agent._id.toString()

        // Get all transactions for this agent
        const allTransactions = await transactionsCollection
          .find({
            $or: [
              { userId: agent._id },
              { fromUserId: agent._id },
              { toUserId: agent._id },
            ],
            status: "completed",
          })
          .sort({ createdAt: 1 })
          .toArray()

        // Calculate balance from transactions
        let calculatedBalance = agent.balance || 0 // Start with current balance

        // Recalculate from scratch based on transaction types
        calculatedBalance = 0
        for (const txn of allTransactions) {
          const txnUserId = txn.userId?.toString()
          const fromUserId = txn.fromUserId?.toString()
          const toUserId = txn.toUserId?.toString()
          const isSender = fromUserId === agentId
          const isReceiver = toUserId === agentId
          const isOwner = txnUserId === agentId

          // Deposit - money coming in
          if (txn.type === "deposit" && isOwner) {
            calculatedBalance += txn.amount || 0
          }
          // Agent receive - agent gets paid for providing cash (money in for agent)
          else if (txn.type === "agent_receive" && (isOwner || isReceiver)) {
            calculatedBalance += txn.amount || 0
          }
          // Agent commission - agent earns commission (money in for agent)
          else if (txn.type === "agent_commission" && (isOwner || isReceiver)) {
            calculatedBalance += txn.amount || 0
          }
          // Receive (internal) - money coming in
          else if (txn.type === "send" && isReceiver) {
            calculatedBalance += txn.amount || 0
          }
          // Withdrawal - money going out
          else if (txn.type === "withdrawal" && isOwner) {
            calculatedBalance -= txn.amount || 0
          }
          // Agent withdrawal - customer pays agent for cash (money out for customer, not agent)
          // This doesn't affect agent balance
          // Send - money going out
          else if (txn.type === "send" && isSender) {
            calculatedBalance -= txn.amount || 0
          }
        }

        // Check for missing commission transactions
        const completedWithdrawals = await withdrawalRequestsCollection
          .find({
            agentId: agent._id,
            status: "completed",
          })
          .toArray()

        let missingCommissions = 0
        let missingCommissionAmount = 0

        for (const withdrawal of completedWithdrawals) {
          const commissionRate = 0.02
          const expectedCommission = Math.max(withdrawal.amount * commissionRate, 10)

          // Check if commission transaction exists
          const existingCommission = await transactionsCollection.findOne({
            agentWithdrawalRequestId: withdrawal._id,
            type: "agent_commission",
            userId: agent._id,
          })

          if (!existingCommission) {
            missingCommissions++
            missingCommissionAmount += expectedCommission

            // Create missing commission transaction
            try {
              const customer = await usersCollection.findOne({
                _id: withdrawal.userId,
              })

              await transactionsCollection.insertOne({
                userId: agent._id,
                fromUserId: null,
                toUserId: agent._id,
                amount: expectedCommission,
                type: "agent_commission",
                network: "System",
                purpose: `Commission earned from withdrawal transaction (corrected)`,
                status: "completed",
                agentWithdrawalRequestId: withdrawal._id,
                customerId: withdrawal.userId,
                customerName: customer?.name || "Customer",
                withdrawalAmount: withdrawal.amount,
                commissionRate: commissionRate,
                createdAt: withdrawal.completedAt || withdrawal.createdAt || new Date(),
                completedAt: withdrawal.completedAt || withdrawal.createdAt || new Date(),
              })

              // Add missing commission to calculated balance
              calculatedBalance += expectedCommission
              console.log(
                `✅ Created missing commission transaction for agent ${agent.name}: KES ${expectedCommission}`
              )
            } catch (error) {
              console.error(
                `❌ Failed to create commission for withdrawal ${withdrawal._id}: ${error}`
              )
            }
          }
        }

        const oldBalance = agent.balance || 0
        const difference = calculatedBalance - oldBalance

        // Update balance if different
        if (Math.abs(difference) > 0.01) {
          await usersCollection.updateOne(
            { _id: agent._id },
            {
              $set: {
                balance: calculatedBalance,
                updatedAt: new Date(),
              },
            }
          )

          results.corrected++
          results.corrections.push({
            agentId: agentId,
            agentName: agent.name || "Unknown",
            oldBalance,
            newBalance: calculatedBalance,
            difference,
            missingCommissions,
          })

          console.log(
            `✅ Corrected balance for agent ${agent.name}: KES ${oldBalance} → KES ${calculatedBalance} (diff: KES ${difference.toFixed(2)})`
          )
        } else {
          results.alreadyCorrect++
        }
      } catch (error) {
        const errorMsg = `Failed to correct balance for agent ${agent.name || agent._id}: ${
          error instanceof Error ? error.message : String(error)
        }`
        console.error(`❌ ${errorMsg}`)
        results.errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Balance correction completed`,
      results,
    })
  } catch (error) {
    console.error("Correct agent balances error:", error)
    return NextResponse.json(
      {
        error: "Failed to correct agent balances",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

