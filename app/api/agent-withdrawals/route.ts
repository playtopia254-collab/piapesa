import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// GET - List withdrawal requests (for agents or users)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const agentId = searchParams.get("agentId")
    const status = searchParams.get("status")
    const role = searchParams.get("role") // 'user' or 'agent'

    const db = await getDb()
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")
    const usersCollection = db.collection("users")

    let query: any = {}

    if (role === "agent") {
      // Agent sees pending requests in their area or requests assigned to them
      if (status === "pending") {
        query = { status: "pending" }
      } else if (agentId) {
        query = { agentId: new ObjectId(agentId) }
      }
    } else if (userId) {
      // User sees their own requests
      query = { userId: new ObjectId(userId) }
    }

    if (status && role !== "agent") {
      query.status = status
    }

    const requests = await withdrawalRequestsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    // Enrich with user/agent details
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        let userData = null
        let agentData = null

        if (req.userId) {
          const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) })
          if (user) {
            userData = {
              id: user._id.toString(),
              name: user.name,
              phone: user.phone,
            }
          }
        }

        if (req.agentId) {
          const agent = await usersCollection.findOne({ _id: new ObjectId(req.agentId) })
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

        return {
          ...req,
          _id: req._id.toString(),
          userId: req.userId?.toString(),
          agentId: req.agentId?.toString(),
          user: userData,
          agent: agentData,
          createdAt: req.createdAt?.toISOString(),
          updatedAt: req.updatedAt?.toISOString(),
          acceptedAt: req.acceptedAt?.toISOString(),
          completedAt: req.completedAt?.toISOString(),
        }
      })
    )

    return NextResponse.json({
      success: true,
      requests: enrichedRequests,
    })
  } catch (error) {
    console.error("Get withdrawal requests error:", error)
    return NextResponse.json(
      { error: "Failed to fetch withdrawal requests" },
      { status: 500 }
    )
  }
}

// POST - Create a new withdrawal request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, amount, location, notes, lat, lng } = body

    // Validation
    if (!userId || !amount) {
      return NextResponse.json(
        { error: "userId and amount are required" },
        { status: 400 }
      )
    }

    const amountNum = Number.parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 10 || amountNum > 100000) {
      return NextResponse.json(
        { error: "Amount must be between KES 10 and KES 100,000 for agent withdrawals" },
        { status: 400 }
      )
    }

    const db = await getDb()
    const usersCollection = db.collection("users")
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")

    // Verify user exists and has sufficient balance
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if ((user.balance || 0) < amountNum) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
    }

    // Check for existing pending request
    const existingRequest = await withdrawalRequestsCollection.findOne({
      userId: new ObjectId(userId),
      status: { $in: ["pending", "matched", "in_progress"] },
    })

    if (existingRequest) {
      return NextResponse.json(
        {
          error: "You already have an active withdrawal request",
          existingRequest: {
            _id: existingRequest._id.toString(),
            amount: existingRequest.amount,
            status: existingRequest.status,
            createdAt: existingRequest.createdAt?.toISOString(),
            location: existingRequest.location,
          },
        },
        { status: 400 }
      )
    }

    // Create withdrawal request with location coordinates
    const withdrawalRequest: any = {
      userId: new ObjectId(userId),
      amount: amountNum,
      location: location || user.location || "Not specified",
      notes: notes || "",
      status: "pending", // pending, matched, in_progress, completed, cancelled, expired
      agentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      acceptedAt: null,
      completedAt: null,
      userConfirmed: false,
      agentConfirmed: false,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes expiry
    }

    // Add coordinates if provided
    if (lat !== undefined && lng !== undefined) {
      const latNum = Number.parseFloat(lat)
      const lngNum = Number.parseFloat(lng)
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        withdrawalRequest.coordinates = {
          lat: latNum,
          lng: lngNum,
        }
      }
    }

    const result = await withdrawalRequestsCollection.insertOne(withdrawalRequest)

    return NextResponse.json({
      success: true,
      request: {
        ...withdrawalRequest,
        _id: result.insertedId.toString(),
        userId: userId,
        createdAt: withdrawalRequest.createdAt.toISOString(),
        updatedAt: withdrawalRequest.updatedAt.toISOString(),
        expiresAt: withdrawalRequest.expiresAt.toISOString(),
      },
      message: "Withdrawal request created. Looking for nearby agents...",
    })
  } catch (error) {
    console.error("Create withdrawal request error:", error)
    return NextResponse.json(
      { error: "Failed to create withdrawal request" },
      { status: 500 }
    )
  }
}

