import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// POST - Register as an agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, idNumber, location, preferredNetworks, maxAmount } = body

    // Validation
    if (!userId || !idNumber || !location || !preferredNetworks?.length || !maxAmount) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    const db = await getDb()
    const usersCollection = db.collection("users")

    // Verify user exists
    let user
    try {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    } catch (e) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.isAgent) {
      return NextResponse.json(
        { error: "You are already an agent" },
        { status: 400 }
      )
    }

    // Update user to become an agent
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          isAgent: true,
          agentDetails: {
            idNumber,
            location,
            preferredNetworks,
            maxAmount: Number.parseFloat(maxAmount),
            registeredAt: new Date(),
          },
          location,
          rating: 5.0,
          totalTransactions: 0,
          isAvailable: false,
        },
      }
    )

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) })

    return NextResponse.json({
      success: true,
      message: "You are now registered as an agent!",
      user: {
        id: updatedUser?._id.toString(),
        name: updatedUser?.name,
        phone: updatedUser?.phone,
        email: updatedUser?.email,
        balance: updatedUser?.balance,
        isAgent: updatedUser?.isAgent,
        location: updatedUser?.location,
        rating: updatedUser?.rating,
        isAvailable: updatedUser?.isAvailable,
      },
    })
  } catch (error) {
    console.error("Agent registration error:", error)
    return NextResponse.json(
      { error: "Failed to register as agent" },
      { status: 500 }
    )
  }
}

