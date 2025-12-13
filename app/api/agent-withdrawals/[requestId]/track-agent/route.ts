import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { calculateDistance, formatDistance } from "@/lib/location-utils"

// GET - Get agent's current location, distance, and ETA for tracking
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
    let etaSeconds = null
    let etaFormatted = null
    let routeDistance = null
    let routeDuration = null

    if (userLat && userLng && agentLocation?.lat && agentLocation?.lng) {
      const userLatNum = Number.parseFloat(userLat)
      const userLngNum = Number.parseFloat(userLng)

      if (!isNaN(userLatNum) && !isNaN(userLngNum)) {
        // Calculate straight-line distance
        distance = calculateDistance(
          userLatNum,
          userLngNum,
          agentLocation.lat,
          agentLocation.lng
        )
        distanceFormatted = formatDistance(distance)

        // Calculate ETA using Google Directions API
        try {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          if (apiKey) {
            const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${agentLocation.lat},${agentLocation.lng}&destination=${userLatNum},${userLngNum}&key=${apiKey}&travelmode=driving`
            
            const directionsResponse = await fetch(directionsUrl)
            const directionsData = await directionsResponse.json()

            if (directionsData.status === "OK" && directionsData.routes && directionsData.routes.length > 0) {
              const route = directionsData.routes[0]
              const leg = route.legs[0]
              
              routeDistance = leg.distance.value // in meters
              routeDuration = leg.duration.value // in seconds
              etaSeconds = routeDuration
              
              // Format ETA
              if (etaSeconds < 60) {
                etaFormatted = `${etaSeconds} sec`
              } else if (etaSeconds < 3600) {
                const minutes = Math.round(etaSeconds / 60)
                etaFormatted = `${minutes} min`
              } else {
                const hours = Math.floor(etaSeconds / 3600)
                const minutes = Math.round((etaSeconds % 3600) / 60)
                etaFormatted = minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
              }
            }
          }
        } catch (directionsError) {
          console.error("Failed to calculate ETA:", directionsError)
          // Fallback: estimate ETA based on distance (assuming average speed of 30 km/h)
          if (distance) {
            const estimatedSpeedKmh = 30
            const estimatedSpeedMs = (estimatedSpeedKmh * 1000) / 3600
            etaSeconds = Math.round(distance / estimatedSpeedMs)
            if (etaSeconds < 60) {
              etaFormatted = `${etaSeconds} sec`
            } else {
              const minutes = Math.round(etaSeconds / 60)
              etaFormatted = `${minutes} min`
            }
          }
        }
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
      routeDistance, // Route distance in meters
      etaSeconds, // ETA in seconds
      etaFormatted, // Formatted ETA string
      routeDuration, // Route duration in seconds
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

