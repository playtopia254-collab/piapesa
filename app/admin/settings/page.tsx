"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Shield,
  Bell,
  Database,
  Mail,
  Key,
  Globe,
  Save,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    platformName: "Pia Pesa",
    platformEmail: "admin@piapesa.com",
    maintenanceMode: false,
    allowNewRegistrations: true,
    requireEmailVerification: true,
    minTransactionAmount: 10,
    maxTransactionAmount: 100000,
    transactionFee: 0.02,
    agentCommission: 0.05,
    smsNotifications: true,
    emailNotifications: true,
    apiKey: "••••••••••••••••",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus("idle")

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSaving(false)
    setSaveStatus("success")
    setTimeout(() => setSaveStatus("idle"), 3000)
  }

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Settings</h1>
        <p className="text-muted-foreground">Configure platform settings and preferences</p>
      </div>

      {saveStatus === "success" && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Settings saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>General Settings</span>
          </CardTitle>
          <CardDescription>Basic platform configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platformName">Platform Name</Label>
              <Input
                id="platformName"
                value={settings.platformName}
                onChange={(e) => handleInputChange("platformName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platformEmail">Platform Email</Label>
              <Input
                id="platformEmail"
                type="email"
                value={settings.platformEmail}
                onChange={(e) => handleInputChange("platformEmail", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Temporarily disable the platform for maintenance
              </p>
            </div>
            <Switch
              id="maintenanceMode"
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => handleInputChange("maintenanceMode", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allowNewRegistrations">Allow New Registrations</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable new user signups
              </p>
            </div>
            <Switch
              id="allowNewRegistrations"
              checked={settings.allowNewRegistrations}
              onCheckedChange={(checked) => handleInputChange("allowNewRegistrations", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Security Settings</span>
          </CardTitle>
          <CardDescription>Security and authentication configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requireEmailVerification">Require Email Verification</Label>
              <p className="text-sm text-muted-foreground">
                Require users to verify their email address
              </p>
            </div>
            <Switch
              id="requireEmailVerification"
              checked={settings.requireEmailVerification}
              onCheckedChange={(checked) => handleInputChange("requireEmailVerification", checked)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex items-center space-x-2">
              <Input id="apiKey" type="password" value={settings.apiKey} readOnly />
              <Button variant="outline" size="sm">
                <Key className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for secure API access. Keep this key secret.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Transaction Settings</span>
          </CardTitle>
          <CardDescription>Configure transaction limits and fees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minTransactionAmount">Minimum Transaction Amount (KES)</Label>
              <Input
                id="minTransactionAmount"
                type="number"
                value={settings.minTransactionAmount}
                onChange={(e) => handleInputChange("minTransactionAmount", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTransactionAmount">Maximum Transaction Amount (KES)</Label>
              <Input
                id="maxTransactionAmount"
                type="number"
                value={settings.maxTransactionAmount}
                onChange={(e) => handleInputChange("maxTransactionAmount", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transactionFee">Transaction Fee (%)</Label>
              <Input
                id="transactionFee"
                type="number"
                step="0.01"
                value={settings.transactionFee}
                onChange={(e) => handleInputChange("transactionFee", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentCommission">Agent Commission (%)</Label>
              <Input
                id="agentCommission"
                type="number"
                step="0.01"
                value={settings.agentCommission}
                onChange={(e) => handleInputChange("agentCommission", Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Notification Settings</span>
          </CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="smsNotifications">SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send SMS notifications for important events
              </p>
            </div>
            <Switch
              id="smsNotifications"
              checked={settings.smsNotifications}
              onCheckedChange={(checked) => handleInputChange("smsNotifications", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications for important events
              </p>
            </div>
            <Switch
              id="emailNotifications"
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleInputChange("emailNotifications", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Database Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Database Connection</span>
          </CardTitle>
          <CardDescription>MongoDB connection settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Database connection string is stored in environment variables for security. Update
              your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file to
              change connection settings.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label>Connection Status</Label>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
              <span className="text-sm text-muted-foreground">
                MongoDB Atlas cluster is active
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Database className="w-4 h-4 mr-2" />
            Test Connection
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

