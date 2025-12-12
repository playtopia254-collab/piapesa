import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const origins = searchParams.get("origins") // "lat1,lng1|lat2,lng2"
    const destinations = searchParams.get("destinations") // "lat1,lng1|lat2,lng2"
    const travelMode = searchParams.get("travelMode") || "driving"

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      )
    }

    if (!origins || !destinations) {
      return NextResponse.json(
        { error: "Origins and destinations are required" },
        { status: 400 }
      )
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=${travelMode}&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === "OK") {
      const results = data.rows.map((row: any, originIndex: number) =>
        row.elements.map((element: any, destIndex: number) => ({
          origin: originIndex,
          destination: destIndex,
          distance: element.distance
            ? {
                text: element.distance.text,
                value: element.distance.value, // in meters
              }
            : null,
          duration: element.duration
            ? {
                text: element.duration.text,
                value: element.duration.value, // in seconds
              }
            : null,
          status: element.status,
        }))
      )

      return NextResponse.json({
        success: true,
        results: results.flat(),
        originAddresses: data.origin_addresses,
        destinationAddresses: data.destination_addresses,
      })
    }

    return NextResponse.json(
      { error: data.error_message || "Distance calculation failed" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Distance matrix error:", error)
    return NextResponse.json(
      { error: "Failed to calculate distance" },
      { status: 500 }
    )
  }
}

