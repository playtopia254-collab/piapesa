import { NextRequest, NextResponse } from "next/server"

// POST - Get location using Google Geolocation API (server-side, more accurate)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      )
    }

    // Google Geolocation API endpoint
    const url = `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        considerIp: body.considerIp !== false, // Use IP as fallback
        wifiAccessPoints: body.wifiAccessPoints || [],
        cellTowers: body.cellTowers || [],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // If API is blocked due to referrer restrictions (403), this is expected
      // The client will fall back to browser geolocation
      if (response.status === 403) {
        // Silently return error - client will use browser geolocation fallback
        return NextResponse.json(
          { 
            error: "Geolocation API blocked (expected if API key has referrer restrictions)",
            fallback: "Browser geolocation will be used instead"
          },
          { status: 403 }
        )
      }

      // For other errors, log but don't spam console
      if (response.status !== 403) {
        console.warn("Google Geolocation API error:", errorData)
      }

      return NextResponse.json(
        { error: "Failed to get location from Google Geolocation API" },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (data.location) {
      return NextResponse.json({
        success: true,
        location: {
          lat: data.location.lat,
          lng: data.location.lng,
        },
        accuracy: data.accuracy || 20, // Accuracy in meters
      })
    }

    return NextResponse.json(
      { error: "No location data received" },
      { status: 500 }
    )
  } catch (error) {
    console.error("Geolocation API error:", error)
    return NextResponse.json(
      { error: "Failed to process geolocation request" },
      { status: 500 }
    )
  }
}

