import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { calculateDistance, formatDistance } from "@/lib/location-utils"

// GET - Get agent's current location and distance for tracking
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const { requestId } = params
    const { searchParams } = new URL(request.url)
    const userLat = searchParams.get("userLat")
    const userLng = searchParams.get("userLng")

    const db = await getDb()
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")
    const usersCollection = db.collection("users")

    // Get withdrawal request
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

    if (!withdrawalRequest.agentId) {
      return NextResponse.json(
        { error: "No agent assigned to this request" },
        { status: 400 }
      )
    }

    // Get agent's current location
    const agent = await usersCollection.findOne({
      _id: withdrawalRequest.agentId,
    })

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const agentLocation = agent.location

    // Calculate distance if user coordinates provided
    let distance = null
    let distanceFormatted = null
    if (userLat && userLng && agentLocation?.lat && agentLocation?.lng) {
      const userLatNum = Number.parseFloat(userLat)
      const userLngNum = Number.parseFloat(userLng)

      if (!isNaN(userLatNum) && !isNaN(userLngNum)) {
        distance = calculateDistance(
          userLatNum,
          userLngNum,
          agentLocation.lat,
          agentLocation.lng
        )
        distanceFormatted = formatDistance(distance)
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent._id.toString(),
        name: agent.name,
        phone: agent.phone,
        location: agentLocation,
      },
      distance,
      distanceFormatted,
      requestStatus: withdrawalRequest.status,
    })
  } catch (error) {
    console.error("Track agent error:", error)
    return NextResponse.json(
      { error: "Failed to track agent" },
      { status: 500 }
    )
  }
}

