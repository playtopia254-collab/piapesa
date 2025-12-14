"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"

// Dynamic import to avoid SSR issues with Mapbox
const BoltAgentTrackingMap = dynamic(
  () => import("@/components/bolt-agent-tracking-map").then((mod) => ({ default: mod.BoltAgentTrackingMap })),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
            <p className="text-muted-foreground">Loading Bolt-style map...</p>
          </div>
        </CardContent>
      </Card>
    ),
  }
)

interface Agent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  distance?: number
  distanceFormatted?: string
  totalReviews?: number
}

export default function AgentTrackingPage() {
  const router = useRouter()
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    console.log("Selected agent:", agent)
  }

  return (
    <div className="container mx-auto py-6 pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Live Agent Tracking
          </h1>
          <p className="text-muted-foreground">
            Track available agents in real-time with Bolt-style premium maps
          </p>
        </div>
      </div>

      {/* Selected Agent Info */}
      {selectedAgent && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Selected Agent: {selectedAgent.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Distance</p>
                <p className="text-lg font-semibold">{selectedAgent.distanceFormatted || "Unknown"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rating</p>
                <p className="text-lg font-semibold">{selectedAgent.rating.toFixed(1)} ⭐</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Trips</p>
                <p className="text-lg font-semibold">{selectedAgent.totalTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bolt-style Mapbox Tracking Map */}
      <BoltAgentTrackingMap
        onSelectAgent={handleSelectAgent}
        selectedAgentId={selectedAgent?.id || null}
        height="600px"
      />

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold">Real-time Tracking</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Live GPS location updates every 4 seconds</li>
                <li>High-accuracy positioning (±10-20 meters)</li>
                <li>Smooth marker animations</li>
                <li>Pulse effects for active agents</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Premium Mapbox Features</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Vector tiles - sharp at all zoom levels</li>
                <li>60fps smooth animations</li>
                <li>Custom SVG markers with no pixelation</li>
                <li>GPU-accelerated rendering</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

