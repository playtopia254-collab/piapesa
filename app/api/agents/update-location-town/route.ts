import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, location, town, preferredNetworks, maxAmount } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")

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
      return NextResponse.json({ error: "User is not an agent" }, { status: 400 })
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (location !== undefined) {
      updateData.location = location
      // Also update agentDetails if it exists
      if (user.agentDetails) {
        updateData["agentDetails.location"] = location
      }
    }

    if (town !== undefined) {
      updateData.town = town
      if (user.agentDetails) {
        updateData["agentDetails.town"] = town
      }
    }

    if (preferredNetworks !== undefined && Array.isArray(preferredNetworks)) {
      updateData.preferredNetworks = preferredNetworks
      if (user.agentDetails) {
        updateData["agentDetails.preferredNetworks"] = preferredNetworks
      }
    }

    if (maxAmount !== undefined) {
      const maxAmountNum = Number.parseFloat(maxAmount)
      if (isNaN(maxAmountNum) || maxAmountNum < 0) {
        return NextResponse.json({ error: "Invalid max amount" }, { status: 400 })
      }
      updateData.maxAmount = maxAmountNum
      if (user.agentDetails) {
        updateData["agentDetails.maxAmount"] = maxAmountNum
      }
    }

    // Update user
    await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: updateData })

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) })

    return NextResponse.json({
      success: true,
      message: "Agent settings updated successfully",
      agent: {
        id: updatedUser?._id.toString(),
        location: updatedUser?.location,
        town: updatedUser?.town,
        preferredNetworks: updatedUser?.preferredNetworks,
        maxAmount: updatedUser?.maxAmount,
      },
    })
  } catch (error) {
    console.error("Update agent location/town error:", error)
    return NextResponse.json(
      { error: "Failed to update agent settings" },
      { status: 500 }
    )
  }
}

