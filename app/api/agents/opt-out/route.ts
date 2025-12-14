import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// POST - Opt out of being an agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")

    // Verify user exists and is an agent
    let user
    try {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    } catch (e) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.isAgent) {
      return NextResponse.json(
        { error: "You are not registered as an agent" },
        { status: 400 }
      )
    }

    // Check for active withdrawal requests
    const activeRequests = await withdrawalRequestsCollection.countDocuments({
      agentId: new ObjectId(userId),
      status: { $in: ["pending", "matched", "in_progress"] },
    })

    if (activeRequests > 0) {
      return NextResponse.json(
        {
          error: `You have ${activeRequests} active withdrawal request(s). Please complete or cancel them before opting out.`,
          activeRequests,
        },
        { status: 400 }
      )
    }

    // Update user to remove agent status
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          isAgent: false,
          isAvailable: false,
          updatedAt: new Date(),
        },
        $unset: {
          agentDetails: "",
          agentStatus: "",
        },
      }
    )

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) })

    return NextResponse.json({
      success: true,
      message: "You have successfully opted out of being an agent.",
      user: {
        id: updatedUser?._id.toString(),
        name: updatedUser?.name,
        phone: updatedUser?.phone,
        email: updatedUser?.email,
        balance: updatedUser?.balance,
        isAgent: updatedUser?.isAgent,
      },
    })
  } catch (error) {
    console.error("Agent opt-out error:", error)
    return NextResponse.json(
      { error: "Failed to opt out of being an agent" },
      { status: 500 }
    )
  }
}

