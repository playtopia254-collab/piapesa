"use client"

import { MapPin, Navigation, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CustomerLocationMapProps {
  customerLocation: { lat: number; lng: number }
  agentLocation?: { lat: number; lng: number } | null
  height?: string
}

export default function CustomerLocationMap({
  customerLocation,
  agentLocation,
  height = "200px",
}: CustomerLocationMapProps) {
  // Calculate distance between agent and customer
  const calculateDistance = () => {
    if (!agentLocation) return null
    
    const R = 6371 // Earth's radius in km
    const dLat = (customerLocation.lat - agentLocation.lat) * (Math.PI / 180)
    const dLng = (customerLocation.lng - agentLocation.lng) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(agentLocation.lat * (Math.PI / 180)) *
        Math.cos(customerLocation.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`
    }
    return `${distance.toFixed(1)}km`
  }

  // Open Google Maps for navigation
  const openGoogleMaps = () => {
    let url: string
    
    if (agentLocation) {
      // Directions from agent to customer
      url = `https://www.google.com/maps/dir/?api=1&origin=${agentLocation.lat},${agentLocation.lng}&destination=${customerLocation.lat},${customerLocation.lng}&travelmode=driving`
    } else {
      // Just show customer location
      url = `https://www.google.com/maps/search/?api=1&query=${customerLocation.lat},${customerLocation.lng}`
    }
    
    window.open(url, "_blank")
  }

  // Open static map preview
  const getStaticMapUrl = () => {
    const markers = [`color:red|${customerLocation.lat},${customerLocation.lng}`]
    if (agentLocation) {
      markers.push(`color:blue|${agentLocation.lat},${agentLocation.lng}`)
    }
    
    // Using OpenStreetMap static tile as fallback (no API key needed)
    const zoom = agentLocation ? 13 : 15
    const lat = agentLocation 
      ? (customerLocation.lat + agentLocation.lat) / 2 
      : customerLocation.lat
    const lng = agentLocation 
      ? (customerLocation.lng + agentLocation.lng) / 2 
      : customerLocation.lng
    
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=400x200&markers=${customerLocation.lat},${customerLocation.lng},ol-marker-red`
  }

  const distance = calculateDistance()

  return (
    <div style={{ height }} className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg overflow-hidden relative">
      {/* Map Preview Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage: `url(${getStaticMapUrl()})`,
        }}
      />
      
      {/* Overlay Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
        {/* Location Icons */}
        <div className="flex items-center gap-8 mb-3">
          {agentLocation && (
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg">
                🚗
              </div>
              <span className="text-xs mt-1 font-medium text-blue-700">You</span>
            </div>
          )}
          
          {agentLocation && distance && (
            <div className="flex flex-col items-center">
              <div className="text-lg font-bold text-purple-600">{distance}</div>
              <div className="w-16 h-0.5 bg-purple-400 rounded"></div>
            </div>
          )}
          
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg">
              📍
            </div>
            <span className="text-xs mt-1 font-medium text-red-700">Customer</span>
          </div>
        </div>

        {/* Coordinates */}
        <p className="text-xs text-gray-500 mb-3">
          {customerLocation.lat.toFixed(4)}, {customerLocation.lng.toFixed(4)}
        </p>

        {/* Navigate Button */}
        <Button
          onClick={openGoogleMaps}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          size="sm"
        >
          <Navigation className="h-4 w-4 mr-2" />
          {agentLocation ? "Get Directions" : "View on Map"}
          <ExternalLink className="h-3 w-3 ml-2" />
        </Button>
      </div>
    </div>
  )
}
