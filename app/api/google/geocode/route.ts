import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const lat = searchParams.get("lat")
    const lng = searchParams.get("lng")
    const address = searchParams.get("address")

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      )
    }

    // Reverse geocoding (lat/lng to address)
    if (lat && lng) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === "OK" && data.results.length > 0) {
        return NextResponse.json({
          success: true,
          address: data.results[0].formatted_address,
          location: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
          },
          components: data.results[0].address_components,
        })
      }

      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      )
    }

    // Forward geocoding (address to lat/lng)
    if (address) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === "OK" && data.results.length > 0) {
        const location = data.results[0].geometry.location
        return NextResponse.json({
          success: true,
          address: data.results[0].formatted_address,
          location: {
            lat: location.lat,
            lng: location.lng,
          },
          components: data.results[0].address_components,
        })
      }

      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: "Either lat/lng or address must be provided" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Geocoding error:", error)
    return NextResponse.json(
      { error: "Failed to geocode location" },
      { status: 500 }
    )
  }
}

