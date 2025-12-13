import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { calculateDistance, formatDistance } from "@/lib/location-utils"

// GET - Find nearby agents for a withdrawal request
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get("requestId")
    const userLat = searchParams.get("lat")
    const userLng = searchParams.get("lng")
    const maxDistance = Number.parseFloat(searchParams.get("maxDistance") || "20") // Default 20km

    if (!userLat || !userLng) {
      return NextResponse.json(
        { error: "User location (lat, lng) required" },
        { status: 400 }
      )
    }

    const userLatNum = Number.parseFloat(userLat)
    const userLngNum = Number.parseFloat(userLng)

    if (isNaN(userLatNum) || isNaN(userLngNum)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")
    const reviewsCollection = db.collection("agent_reviews")
    const transactionsCollection = db.collection("transactions")

    // If requestId provided, verify it exists (optional)
    if (requestId) {
      const withdrawalRequestsCollection = db.collection("withdrawal_requests")
      try {
        const withdrawalRequest = await withdrawalRequestsCollection.findOne({
          _id: new ObjectId(requestId),
        })
        if (!withdrawalRequest) {
          return NextResponse.json({ error: "Request not found" }, { status: 404 })
        }
      } catch (e) {
        return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
      }
    }

    console.log("=".repeat(80))
    console.log("🔍 FINDING NEARBY AGENTS")
    console.log("=".repeat(80))
    console.log("User location:", { lat: userLatNum, lng: userLngNum })
    console.log("Max distance:", maxDistance, "km")

    // First, check how many agents exist at all
    const allAgents = await usersCollection
      .find({ isAgent: true })
      .toArray()
    console.log(`Total agents in database: ${allAgents.length}`)
    
    const availableAgents = await usersCollection
      .find({ isAgent: true, isAvailable: true })
      .toArray()
    console.log(`Available agents: ${availableAgents.length}`)

    // Find ALL agents (both available and offline) with exact GPS coordinates
    const agents = await usersCollection
      .find({
        isAgent: true,
        $or: [
          { 
            lastKnownLocation: { $exists: true, $ne: null },
            "lastKnownLocation.lat": { $exists: true },
            "lastKnownLocation.lng": { $exists: true },
          },
          {
            location: { $exists: true, $ne: null },
            "location.lat": { $exists: true },
            "location.lng": { $exists: true },
          }
        ]
      })
      .toArray()

    console.log(`Found ${agents.length} agents with GPS coordinates`)
    
    // Log details of each agent found
    agents.forEach((agent) => {
      console.log(`  - Agent ${agent._id} (${agent.name}):`, {
        isAvailable: agent.isAvailable || false,
        hasLastKnownLocation: !!agent.lastKnownLocation,
        hasLocation: !!agent.location,
        lastKnownLocation: agent.lastKnownLocation,
        location: agent.location,
      })
    })

    // Calculate distance for each agent using exact coordinates and filter by max distance
    const agentsWithDistance = agents
      .map((agent) => {
        // Use lastKnownLocation (real-time GPS) if available, otherwise use location
        const agentLocation = agent.lastKnownLocation || agent.location
        if (!agentLocation?.lat || !agentLocation?.lng) {
          console.log(`⚠️ Agent ${agent._id} (${agent.name}) has no valid location`)
          return null
        }

        console.log(`📍 Agent ${agent._id} (${agent.name}) at: ${agentLocation.lat}, ${agentLocation.lng}`)

        // Calculate exact distance using Haversine formula
        const distance = calculateDistance(
          userLatNum,
          userLngNum,
          agentLocation.lat,
          agentLocation.lng
        )

        console.log(`   Distance: ${distance.toFixed(2)}km (max: ${maxDistance}km)`)

        if (distance > maxDistance) return null

        return {
          id: agent._id.toString(),
          name: agent.name,
          phone: agent.phone,
          location: agentLocation, // Use exact GPS coordinates
          lastKnownLocation: agent.lastKnownLocation, // Include for tracking
          rating: agent.rating || 5.0,
          totalTransactions: agent.totalTransactions || 0,
          isAvailable: agent.isAvailable === true, // Only true if explicitly set to true (agent pressed "Go Online")
          distance,
          distanceFormatted: formatDistance(distance),
          agentId: agent._id, // Store for review count lookup
        }
      })
      .filter((agent) => agent !== null)
      .sort((a, b) => {
        // First sort by availability (available first), then by distance
        if (a!.isAvailable !== b!.isAvailable) {
          return a!.isAvailable ? -1 : 1
        }
        return a!.distance - b!.distance
      })

    // Get review counts and transaction counts for each agent
    const agentsWithReviews = await Promise.all(
      agentsWithDistance.map(async (agent) => {
        if (!agent) return null
        
        // Get review count
        const reviewCount = await reviewsCollection.countDocuments({
          agentId: new ObjectId(agent.agentId),
        })
        
        // Get actual transaction count from completed agent_receive transactions
        const transactionCount = await transactionsCollection.countDocuments({
          userId: new ObjectId(agent.agentId),
          type: "agent_receive",
          status: "completed",
        })
        
        return {
          ...agent,
          totalTransactions: transactionCount, // Use actual count from transactions collection
          totalReviews: reviewCount,
        }
      })
    )

    const finalAgents = agentsWithReviews.filter((agent) => agent !== null)

    console.log(`✅ Returning ${finalAgents.length} agents within ${maxDistance}km`)
    console.log("=".repeat(80))

    return NextResponse.json({
      success: true,
      agents: finalAgents,
      userLocation: {
        lat: userLatNum,
        lng: userLngNum,
      },
      totalFound: finalAgents.length,
    })
  } catch (error) {
    console.error("Find nearby agents error:", error)
    return NextResponse.json(
      { error: "Failed to find nearby agents" },
      { status: 500 }
    )
  }
}

