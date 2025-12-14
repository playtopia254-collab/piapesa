"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Filter,
  UserCheck,
  MapPin,
  Star,
  Phone,
  CheckCircle,
  XCircle,
  MoreVertical,
  Eye,
  Edit,
  UserX,
} from "lucide-react"
import { mockApi, type Agent } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"
import mockData from "@/data/mock-data.json"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  useEffect(() => {
    const loadAgents = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setAgents(mockData.agents as Agent[])
      setFilteredAgents(mockData.agents as Agent[])
      setIsLoading(false)
    }
    loadAgents()
  }, [])

  useEffect(() => {
    let filtered = agents

    if (searchTerm) {
      filtered = filtered.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agent.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agent.phone.includes(searchTerm),
      )
    }

    if (statusFilter === "active") {
      filtered = filtered.filter((agent) => agent.isActive)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((agent) => !agent.isActive)
    }

    setFilteredAgents(filtered)
  }, [agents, searchTerm, statusFilter])

  const handleToggleStatus = (agentId: string) => {
    setAgents((prev) =>
      prev.map((agent) => (agent.id === agentId ? { ...agent, isActive: !agent.isActive } : agent)),
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  const activeAgents = agents.filter((a) => a.isActive).length
  const totalTransactions = agents.reduce((sum, a) => sum + a.totalTransactions, 0)
  const avgRating =
    agents.length > 0
      ? agents.reduce((sum, a) => sum + a.rating, 0) / agents.length
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground">Manage all agents and their activities</p>
        </div>
        <Button>
          <UserCheck className="w-4 h-4 mr-2" />
          Add New Agent
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <UserCheck className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">{activeAgents} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Platform average</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, location, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agents ({filteredAgents.length})</CardTitle>
          <CardDescription>All registered agents in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAgents.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No agents found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead>Max Amount</TableHead>
                    <TableHead>Networks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {agent.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span>{agent.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PhoneFormatter phone={agent.phone} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{agent.rating.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{agent.totalTransactions}</span>
                      </TableCell>
                      <TableCell>
                        <CurrencyFormatter amount={agent.maxAmount} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.availableNetworks.map((network) => (
                            <Badge key={network} variant="outline" className="text-xs">
                              {network}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {agent.isActive ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedAgent(agent)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Agent
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(agent.id)}>
                              {agent.isActive ? (
                                <>
                                  <UserX className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Details Dialog */}
      {selectedAgent && (
        <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agent Details</DialogTitle>
              <DialogDescription>Complete information about {selectedAgent.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm font-medium">{selectedAgent.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <p className="text-sm font-medium">
                    <PhoneFormatter phone={selectedAgent.phone} />
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="text-sm font-medium">{selectedAgent.location}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Rating</label>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <p className="text-sm font-medium">{selectedAgent.rating.toFixed(1)}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Transactions</label>
                  <p className="text-sm font-medium">{selectedAgent.totalTransactions}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Max Amount</label>
                  <p className="text-sm font-medium">
                    <CurrencyFormatter amount={selectedAgent.maxAmount} />
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <p className="text-sm font-medium">
                    {selectedAgent.isActive ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-100 text-red-700">
                        Inactive
                      </Badge>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Available Networks</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedAgent.availableNetworks.map((network) => (
                      <Badge key={network} variant="outline" className="text-xs">
                        {network}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              {selectedAgent.coordinates && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Coordinates</label>
                  <p className="text-sm font-mono">
                    {selectedAgent.coordinates[0]}, {selectedAgent.coordinates[1]}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

