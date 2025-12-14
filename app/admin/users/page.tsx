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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Search, Filter, MoreVertical, UserCheck, UserX, Eye, Edit } from "lucide-react"
import { mockApi, type User } from "@/lib/mock-api"
import { CurrencyFormatter } from "@/components/currency-formatter"
import { PhoneFormatter } from "@/components/phone-formatter"
import mockData from "@/data/mock-data.json"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    const loadUsers = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setUsers(mockData.users as User[])
      setFilteredUsers(mockData.users as User[])
      setIsLoading(false)
    }
    loadUsers()
  }, [])

  useEffect(() => {
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.phone.includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filterType === "agents") {
      filtered = filtered.filter((user) => user.isAgent)
    } else if (filterType === "regular") {
      filtered = filtered.filter((user) => !user.isAgent)
    }

    setFilteredUsers(filtered)
  }, [users, searchTerm, filterType])

  const handleToggleAgent = (userId: string) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, isAgent: !user.isAgent } : user)),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage all users and their accounts</p>
        </div>
        <Button>
          <UserCheck className="w-4 h-4 mr-2" />
          Add New User
        </Button>
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
                  placeholder="Search by name, phone, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">User Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="regular">Regular Users</SelectItem>
                  <SelectItem value="agents">Agents</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>All registered users in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {user.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PhoneFormatter phone={user.phone} />
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <CurrencyFormatter amount={user.balance} />
                      </TableCell>
                      <TableCell>
                        {user.isAgent ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <UserCheck className="w-3 h-3 mr-1" />
                            Agent
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleAgent(user.id)}>
                              {user.isAgent ? (
                                <>
                                  <UserX className="w-4 h-4 mr-2" />
                                  Remove Agent Status
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Make Agent
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

      {/* User Details Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>Complete information about {selectedUser.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p className="text-sm font-medium">{selectedUser.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <p className="text-sm font-medium">
                    <PhoneFormatter phone={selectedUser.phone} />
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Balance</label>
                  <p className="text-sm font-medium">
                    <CurrencyFormatter amount={selectedUser.balance} />
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Type</label>
                  <p className="text-sm font-medium">
                    {selectedUser.isAgent ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Agent
                      </Badge>
                    ) : (
                      <Badge variant="outline">Regular User</Badge>
                    )}
                  </p>
                </div>
                {selectedUser.isAgent && selectedUser.location && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <p className="text-sm font-medium">{selectedUser.location}</p>
                  </div>
                )}
                {selectedUser.isAgent && selectedUser.rating && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Rating</label>
                    <p className="text-sm font-medium">⭐ {selectedUser.rating.toFixed(1)}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                  <p className="text-sm font-medium">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

