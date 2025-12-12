"use client"

import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Agent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  distance: number
  distanceFormatted: string
}

interface LeafletMapWrapperProps {
  userLocation: { lat: number; lng: number } | null
  agents: Agent[]
  selectedAgent: { id: string } | null
  onSelectAgent: (agent: Agent) => void
}

export function LeafletMapWrapper({
  userLocation,
  agents,
  selectedAgent,
  onSelectAgent,
}: LeafletMapWrapperProps) {
  if (!userLocation) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Location not available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate bounds for map
  const allPoints = [userLocation, ...agents.map(a => a.location)]
  const minLat = Math.min(...allPoints.map(p => p.lat))
  const maxLat = Math.max(...allPoints.map(p => p.lat))
  const minLng = Math.min(...allPoints.map(p => p.lng))
  const maxLng = Math.max(...allPoints.map(p => p.lng))
  
  // Add padding
  const latPadding = (maxLat - minLat) * 0.2 || 0.01
  const lngPadding = (maxLng - minLng) * 0.2 || 0.01
  
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2

  // Generate OpenStreetMap static image URL
  // Using bbox format: minLng,minLat,maxLng,maxLat
  const bbox = `${minLng - lngPadding},${minLat - latPadding},${maxLng + lngPadding},${maxLat + latPadding}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${centerLat},${centerLng}`

  return (
    <div className="h-[350px] w-full relative border rounded-lg overflow-hidden bg-muted">
      {/* Static map iframe */}
      <iframe
        width="100%"
        height="100%"
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
        src={mapUrl}
        className="border-0"
        title="Map showing nearby agents"
      />
      
      {/* Legend overlay */}
      <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white p-2 rounded text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Your Location</span>
        </div>
        {agents.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>{agents.length} Agent{agents.length !== 1 ? 's' : ''} Available</span>
          </div>
        )}
      </div>
    </div>
  )
}

