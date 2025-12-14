import { NextRequest, NextResponse } from "next/server"

// Premium Roads API - Snap to Roads
// Snaps GPS coordinates to the nearest road for smoother tracking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, interpolate = true } = body

    if (!path || !Array.isArray(path) || path.length === 0) {
      return NextResponse.json(
        { error: "Path array required (array of {lat, lng} objects)" },
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

    // Format path for API (max 100 points)
    const pathStr = path
      .slice(0, 100)
      .map((point: any) => `${point.lat},${point.lng}`)
      .join("|")

    // Build Roads API URL
    const url = new URL("https://roads.googleapis.com/v1/snapToRoads")
    url.searchParams.set("path", pathStr)
    url.searchParams.set("interpolate", interpolate.toString())
    url.searchParams.set("key", apiKey)

    console.log(`🛣️ Roads API request: ${path.length} points`)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.error) {
      console.error("Roads API error:", data.error)
      return NextResponse.json(
        { error: data.error.message || "Roads API error" },
        { status: 500 }
      )
    }

    // Parse snapped points
    const snappedPoints = data.snappedPoints?.map((point: any) => ({
      lat: point.location.latitude,
      lng: point.location.longitude,
      placeId: point.placeId,
      originalIndex: point.originalIndex,
    })) || []

    return NextResponse.json({
      success: true,
      originalCount: path.length,
      snappedCount: snappedPoints.length,
      snappedPath: snappedPoints,
      // Also return just coordinates for easy use
      coordinates: snappedPoints.map((p: any) => ({ lat: p.lat, lng: p.lng })),
    })
  } catch (error) {
    console.error("Roads API error:", error)
    return NextResponse.json(
      { error: "Failed to snap to roads" },
      { status: 500 }
    )
  }
}

// GET for snapping a single point to nearest road
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get("lat")
    const lng = searchParams.get("lng")

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "lat and lng required" },
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

    // Use nearestRoads endpoint for single point
    const url = new URL("https://roads.googleapis.com/v1/nearestRoads")
    url.searchParams.set("points", `${lat},${lng}`)
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || "Roads API error" },
        { status: 500 }
      )
    }

    const snappedPoint = data.snappedPoints?.[0]

    if (!snappedPoint) {
      // Return original if no road found nearby
      return NextResponse.json({
        success: true,
        snapped: false,
        location: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        },
      })
    }

    return NextResponse.json({
      success: true,
      snapped: true,
      location: {
        lat: snappedPoint.location.latitude,
        lng: snappedPoint.location.longitude,
      },
      placeId: snappedPoint.placeId,
    })
  } catch (error) {
    console.error("Nearest roads error:", error)
    return NextResponse.json(
      { error: "Failed to find nearest road" },
      { status: 500 }
    )
  }
}

