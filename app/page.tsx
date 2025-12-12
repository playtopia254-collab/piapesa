import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Shield, Users, Zap, MapPin, CreditCard, Smartphone } from "lucide-react"
import Link from "next/link"
import { CurrencyFormatter } from "@/components/currency-formatter"

export default function LandingPage() {
  // Mock demo data for hero section
  const demoBalance = 15750.5
  const recentTransactions = [
    { id: 1, type: "Sent", amount: -2500, to: "Mary W.", network: "M-Pesa", time: "2 hours ago" },
    { id: 2, type: "Received", amount: 1200, from: "Peter M.", network: "Airtel Money", time: "1 day ago" },
    { id: 3, type: "Withdrawal", amount: -5000, agent: "Grace N.", network: "M-Pesa", time: "2 days ago" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Pia Pesa</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#agents" className="text-muted-foreground hover:text-foreground transition-colors">
              Become Agent
            </Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/login">
              <Button variant="outline" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Sign Up
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="w-fit">
                  🇰🇪 Made for Kenya
                </Badge>
                <h1 className="text-4xl md:text-6xl font-bold text-balance leading-tight">
                  Pia Pesa – <span className="text-primary">Cash Anytime, Anywhere</span>
                </h1>
                <p className="text-xl text-muted-foreground text-pretty max-w-lg">
                  Send money across networks, withdraw via trusted agents, and manage your finances with Kenya's most
                  flexible digital wallet.
                </p>
              </div>

              {/* Feature bullets */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Deposit to any network</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Withdraw via agents</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">P2P matching</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Cross-network send/receive</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/signup?agent=true">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
                    Become an Agent
                  </Button>
                </Link>
              </div>
            </div>

            {/* Demo Hero */}
            <div className="relative">
              <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Demo Wallet</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      DEMO
                    </Badge>
                  </div>
                  <CardDescription>Sample KES balance and transactions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-2">Available Balance</p>
                    <p className="text-3xl font-bold text-primary">
                      <CurrencyFormatter amount={demoBalance} />
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Recent Transactions</h4>
                    {recentTransactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between py-2 px-3 bg-background/50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${txn.amount > 0 ? "bg-green-500" : "bg-red-500"}`} />
                          <div>
                            <p className="text-sm font-medium">
                              {txn.type} {txn.to && `to ${txn.to}`} {txn.from && `from ${txn.from}`}{" "}
                              {txn.agent && `via ${txn.agent}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {txn.network} • {txn.time}
                            </p>
                          </div>
                        </div>
                        <p className={`text-sm font-medium ${txn.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                          <CurrencyFormatter amount={Math.abs(txn.amount)} />
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Pia Pesa?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built for Kenyans, by Kenyans. Experience seamless money movement across all major networks.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Secure & Trusted</CardTitle>
                <CardDescription>Bank-level security with PIN protection and transaction verification</CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>Send money instantly across M-Pesa, Airtel Money, and bank networks</CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Agent Network</CardTitle>
                <CardDescription>Access cash through our verified agent network across Kenya</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Experience the Future of Money?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of Kenyans who trust Pia Pesa for their daily money transfers and cash needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Start Using Pia Pesa
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/signup?agent=true">
              <Button variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
                Become an Agent
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">Pia Pesa</span>
              </div>
              <p className="text-sm text-muted-foreground">Cash anytime, anywhere. Kenya's flexible digital wallet.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Send Money
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Withdraw Cash
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Agent Network
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground">
                    Demo Notice
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 Pia Pesa Demo. This is a non-production demonstration app. No real money movements occur.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
