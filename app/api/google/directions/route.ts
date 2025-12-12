import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const origin = searchParams.get("origin") // "lat,lng"
    const destination = searchParams.get("destination") // "lat,lng"
    const travelMode = searchParams.get("travelMode") || "driving" // driving, walking, bicycling, transit

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      )
    }

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "Origin and destination are required" },
        { status: 400 }
      )
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&travelMode=${travelMode}&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0]
      const leg = route.legs[0]

      return NextResponse.json({
        success: true,
        distance: {
          text: leg.distance.text,
          value: leg.distance.value, // in meters
        },
        duration: {
          text: leg.duration.text,
          value: leg.duration.value, // in seconds
        },
        polyline: route.overview_polyline.points,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance: step.distance.text,
          duration: step.duration.text,
          polyline: step.polyline.points,
        })),
        bounds: route.bounds,
      })
    }

    return NextResponse.json(
      { error: data.error_message || "Route not found" },
      { status: 404 }
    )
  } catch (error) {
    console.error("Directions error:", error)
    return NextResponse.json(
      { error: "Failed to get directions" },
      { status: 500 }
    )
  }
}

