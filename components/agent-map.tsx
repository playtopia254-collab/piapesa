"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Navigation,
  Star,
  Phone,
  Loader2,
  RefreshCw,
  User,
  AlertCircle,
} from "lucide-react"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { getCurrentLocation } from "@/lib/location-utils"

// Import the Google Maps wrapper component
import { GoogleMapsWrapper } from "./google-maps-wrapper"

interface Agent {
  id: string
  name: string
  phone: string
  location: {
    lat: number
    lng: number
    updatedAt?: string
  }
  rating: number
  totalTransactions: number
  distance: number
  distanceFormatted: string
}

interface AgentMapProps {
  userLocation: { lat: number; lng: number } | null
  onSelectAgent: (agent: Agent) => void
  selectedAgent: Agent | null
  requestId?: string
  agents?: Agent[] // Optional: pass agents directly instead of fetching
}

export function AgentMap({
  userLocation,
  onSelectAgent,
  selectedAgent,
  requestId,
  agents: providedAgents,
}: AgentMapProps) {
  const [agents, setAgents] = useState<Agent[]>(providedAgents || [])
  const [isLoading, setIsLoading] = useState(!providedAgents)
  const [error, setError] = useState("")

  // Fetch nearby agents (only if not provided)
  const fetchAgents = async () => {
    if (!userLocation || providedAgents) return

    setIsLoading(true)
    setError("")

    try {
      const url = requestId
        ? `/api/agents/nearby?requestId=${requestId}&lat=${userLocation.lat}&lng=${userLocation.lng}&maxDistance=20`
        : `/api/agents/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&maxDistance=20`
      
      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setAgents(data.agents || [])
      } else {
        setError(data.error || "Failed to find agents")
      }
    } catch (error) {
      setError("Failed to fetch nearby agents")
      console.error("Failed to fetch agents:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Update agents when providedAgents changes
  useEffect(() => {
    if (providedAgents) {
      setAgents(providedAgents)
      setIsLoading(false)
    }
  }, [providedAgents])

  useEffect(() => {
    if (userLocation && !providedAgents) {
      fetchAgents()
    }
  }, [userLocation, requestId, providedAgents])

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Find Nearby Agents
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAgents}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {userLocation ? (
            <GoogleMapsWrapper
              userLocation={userLocation}
              agents={agents}
              selectedAgent={selectedAgent}
              onSelectAgent={onSelectAgent}
              showRoute={false}
            />
          ) : (
            <div className="h-[350px] flex items-center justify-center bg-muted">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Location not available</p>
                <p className="text-sm text-muted-foreground">
                  Enable location access to see nearby agents
                </p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="p-3 border-t bg-muted/50 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>You</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Available Agents</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Selected</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent List */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Available Agents ({agents.length})</span>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center py-4 text-red-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          )}

          {!error && agents.length === 0 && !isLoading && (
            <div className="text-center py-6 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No agents found nearby</p>
              <p className="text-sm">Try expanding your search area</p>
            </div>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedAgent?.id === agent.id
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "hover:border-primary hover:bg-muted/50"
                }`}
                onClick={() => onSelectAgent(agent)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      selectedAgent?.id === agent.id
                        ? "bg-green-100"
                        : "bg-orange-100"
                    }`}
                  >
                    <User
                      className={`h-6 w-6 ${
                        selectedAgent?.id === agent.id
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold">{agent.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{agent.rating}</span>
                      </div>
                      <span>•</span>
                      <span>{agent.totalTransactions} trips</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary font-semibold"
                  >
                    {agent.distanceFormatted}
                  </Badge>
                  {selectedAgent?.id === agent.id && (
                    <p className="text-xs text-green-600 mt-1">Selected</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

