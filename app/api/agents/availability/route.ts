import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// GET - Get agent availability status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get("agentId")

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")

    const agent = await usersCollection.findOne({
      _id: new ObjectId(agentId),
      isAgent: true,
    })

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      isAvailable: agent.isAvailable || false,
      lastActiveAt: agent.lastActiveAt?.toISOString(),
    })
  } catch (error) {
    console.error("Get agent availability error:", error)
    return NextResponse.json(
      { error: "Failed to get agent availability" },
      { status: 500 }
    )
  }
}

// POST - Toggle agent availability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, isAvailable, lat, lng } = body

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")

    const agent = await usersCollection.findOne({
      _id: new ObjectId(agentId),
      isAgent: true,
    })

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    // Toggle or set availability
    const newAvailability = isAvailable !== undefined ? isAvailable : !agent.isAvailable

    // Prepare update data
    const updateData: any = {
      isAvailable: newAvailability,
      lastActiveAt: new Date(),
    }

    // If going online and location provided, store it
    if (newAvailability && lat !== undefined && lng !== undefined) {
      const latNum = Number.parseFloat(lat)
      const lngNum = Number.parseFloat(lng)
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        updateData.lastKnownLocation = {
          lat: latNum,
          lng: lngNum,
          updatedAt: new Date(),
        }
        // Always update location field (not just if missing) for real-time tracking
        updateData.location = {
          lat: latNum,
          lng: lngNum,
          updatedAt: new Date(),
        }
        console.log(`📍 Agent ${agentId} going online at: ${latNum}, ${lngNum}`)
      }
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(agentId) },
      { $set: updateData }
    )

    return NextResponse.json({
      success: true,
      isAvailable: newAvailability,
      message: newAvailability
        ? "You are now available for withdrawal requests"
        : "You are now offline",
    })
  } catch (error) {
    console.error("Toggle agent availability error:", error)
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 }
    )
  }
}

