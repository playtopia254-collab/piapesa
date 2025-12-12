import type React from "react"
import { Card } from "@/components/ui/card"
import { CreditCard } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">Pia Pesa</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-2">Cash Anytime, Anywhere</p>
        </div>

        {/* Auth Form */}
        <Card className="p-6">{children}</Card>

        {/* Demo Notice */}
        <div className="text-center text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">⚠️ DEMO APPLICATION</p>
          <p>This is a non-production demo. No real money movements occur.</p>
        </div>
      </div>
    </div>
  )
}
