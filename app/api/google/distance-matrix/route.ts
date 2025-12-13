import { NextRequest, NextResponse } from "next/server"

// Premium Distance Matrix API endpoint
// Calculates accurate driving distance and ETA for multiple destinations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { origin, destinations, mode = "driving", trafficModel = "best_guess" } = body

    if (!origin || !destinations || !Array.isArray(destinations)) {
      return NextResponse.json(
        { error: "Origin and destinations array required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      )
    }

    // Format origin
    const originStr = typeof origin === "string" 
      ? origin 
      : `${origin.lat},${origin.lng}`

    // Format destinations (max 25 per request)
    const destStrings = destinations.slice(0, 25).map((dest: any) => 
      typeof dest === "string" ? dest : `${dest.lat},${dest.lng}`
    )

    // Build Distance Matrix API URL
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
    url.searchParams.set("origins", originStr)
    url.searchParams.set("destinations", destStrings.join("|"))
    url.searchParams.set("mode", mode)
    url.searchParams.set("departure_time", "now") // For traffic-based ETA
    url.searchParams.set("traffic_model", trafficModel)
    url.searchParams.set("units", "metric")
    url.searchParams.set("key", apiKey)

    console.log(`📊 Distance Matrix API request: ${destinations.length} destinations`)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== "OK") {
      console.error("Distance Matrix API error:", data)
      return NextResponse.json(
        { error: data.error_message || "Distance Matrix API error" },
        { status: 500 }
      )
    }

    // Parse results
    const results = data.rows[0]?.elements?.map((element: any, index: number) => {
      if (element.status !== "OK") {
        return {
          index,
          status: element.status,
          distance: null,
          duration: null,
          durationInTraffic: null,
        }
      }

      return {
        index,
        status: "OK",
        distance: {
          value: element.distance.value, // meters
          text: element.distance.text,
        },
        duration: {
          value: element.duration.value, // seconds
          text: element.duration.text,
        },
        durationInTraffic: element.duration_in_traffic ? {
          value: element.duration_in_traffic.value,
          text: element.duration_in_traffic.text,
        } : null,
      }
    }) || []

    // Sort by ETA (traffic-aware if available)
    const sortedResults = [...results].sort((a, b) => {
      const etaA = a.durationInTraffic?.value || a.duration?.value || Infinity
      const etaB = b.durationInTraffic?.value || b.duration?.value || Infinity
      return etaA - etaB
    })

    return NextResponse.json({
      success: true,
      origin: data.origin_addresses?.[0],
      destinations: data.destination_addresses,
      results,
      sortedByETA: sortedResults,
      fastestIndex: sortedResults[0]?.index ?? null,
    })
  } catch (error) {
    console.error("Distance Matrix API error:", error)
    return NextResponse.json(
      { error: "Failed to calculate distances" },
      { status: 500 }
    )
  }
}

// GET for simple single destination queries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const origin = searchParams.get("origin")
    const destination = searchParams.get("destination")
    const mode = searchParams.get("mode") || "driving"

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "Origin and destination required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      )
    }

    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
    url.searchParams.set("origins", origin)
    url.searchParams.set("destinations", destination)
    url.searchParams.set("mode", mode)
    url.searchParams.set("departure_time", "now")
    url.searchParams.set("traffic_model", "best_guess")
    url.searchParams.set("units", "metric")
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== "OK") {
      return NextResponse.json(
        { error: data.error_message || "Distance Matrix API error" },
        { status: 500 }
      )
    }

    const element = data.rows[0]?.elements?.[0]

    if (!element || element.status !== "OK") {
      return NextResponse.json(
        { error: "Could not calculate distance" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      distance: {
        value: element.distance.value,
        text: element.distance.text,
      },
      duration: {
        value: element.duration.value,
        text: element.duration.text,
      },
      durationInTraffic: element.duration_in_traffic ? {
        value: element.duration_in_traffic.value,
        text: element.duration_in_traffic.text,
      } : null,
    })
  } catch (error) {
    console.error("Distance Matrix GET error:", error)
    return NextResponse.json(
      { error: "Failed to calculate distance" },
      { status: 500 }
    )
  }
}
