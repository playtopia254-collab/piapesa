import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// POST - Update agent's current location with accuracy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, lat, lng, accuracy } = body

    if (!agentId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "agentId, lat, and lng are required" },
        { status: 400 }
      )
    }

    const latNum = Number.parseFloat(lat)
    const lngNum = Number.parseFloat(lng)
    const accuracyNum = accuracy !== undefined ? Number.parseFloat(accuracy) : null

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    // Validate coordinates are within reasonable range
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")

    // Verify agent exists
    const agent = await usersCollection.findOne({
      _id: new ObjectId(agentId),
      isAgent: true,
    })

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    // Build location data with accuracy
    const locationData = {
      lat: latNum,
      lng: lngNum,
      accuracy: accuracyNum,
      updatedAt: new Date(),
    }

    // Update agent location (both location and lastKnownLocation for real-time tracking)
    await usersCollection.updateOne(
      { _id: new ObjectId(agentId) },
      {
        $set: {
          location: locationData,
          lastKnownLocation: locationData,
          lastActiveAt: new Date(),
        },
      }
    )

    const accuracyStr = accuracyNum !== null ? ` (±${Math.round(accuracyNum)}m)` : ''
    console.log(`📍 Agent ${agentId} location updated: ${latNum}, ${lngNum}${accuracyStr}`)

    return NextResponse.json({
      success: true,
      message: "Location updated successfully",
      location: locationData,
    })
  } catch (error) {
    console.error("Update agent location error:", error)
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    )
  }
}

