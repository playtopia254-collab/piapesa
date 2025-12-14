import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { calculateDistance, formatDistance } from "@/lib/location-utils"

// GET - Get pending withdrawal requests for agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get("agentId")
    const location = searchParams.get("location")

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")
    const withdrawalRequestsCollection = db.collection("withdrawal_requests")

    // Verify agent
    const agent = await usersCollection.findOne({
      _id: new ObjectId(agentId),
      isAgent: true,
    })

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    // Get agent's current location
    const agentLat = agent.location?.lat
    const agentLng = agent.location?.lng

    // Get pending requests that aren't expired
    const pendingRequests = await withdrawalRequestsCollection
      .find({
        status: "pending",
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()

    // Get requests assigned to this agent
    const myRequests = await withdrawalRequestsCollection
      .find({
        agentId: new ObjectId(agentId),
        status: { $in: ["matched", "in_progress"] },
      })
      .sort({ createdAt: -1 })
      .toArray()

    // Enrich with user details and calculate distance
    const enrichRequests = async (requests: any[]) => {
      return Promise.all(
        requests.map(async (req) => {
          let userData = null
          if (req.userId) {
            const user = await usersCollection.findOne({ _id: req.userId })
            if (user) {
              userData = {
                id: user._id.toString(),
                name: user.name,
                phone: user.phone,
                location: user.location,
              }
            }
          }

          // Calculate distance if both agent and request have coordinates
          let distance = null
          let distanceFormatted = null
          if (
            agentLat !== undefined &&
            agentLng !== undefined &&
            req.coordinates?.lat !== undefined &&
            req.coordinates?.lng !== undefined
          ) {
            distance = calculateDistance(
              agentLat,
              agentLng,
              req.coordinates.lat,
              req.coordinates.lng
            )
            distanceFormatted = formatDistance(distance)
          }

          return {
            ...req,
            _id: req._id.toString(),
            userId: req.userId?.toString(),
            agentId: req.agentId?.toString(),
            user: userData,
            distance,
            distanceFormatted,
            createdAt: req.createdAt?.toISOString(),
            updatedAt: req.updatedAt?.toISOString(),
            expiresAt: req.expiresAt?.toISOString(),
            acceptedAt: req.acceptedAt?.toISOString(),
          }
        })
      )
    }

    const enrichedPending = await enrichRequests(pendingRequests)
    const enrichedMyRequests = await enrichRequests(myRequests)

    // Sort pending requests by distance (closest first) if distance is available
    const sortedPending = enrichedPending.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return a.distance - b.distance
    })

    return NextResponse.json({
      success: true,
      pendingRequests: sortedPending,
      myRequests: enrichedMyRequests,
      totalPending: sortedPending.length,
      totalActive: enrichedMyRequests.length,
    })
  } catch (error) {
    console.error("Get pending requests error:", error)
    return NextResponse.json(
      { error: "Failed to fetch pending requests" },
      { status: 500 }
    )
  }
}

