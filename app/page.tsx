import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Shield,
  Users,
  Zap,
  MapPin,
  CreditCard,
  Smartphone,
  CheckCircle,
  Send,
  Download,
  ArrowUpCircle,
  UserPlus,
} from "lucide-react"
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

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Simple, fast, and secure. Get started in minutes and start managing your money like never before.
            </p>
          </div>

          {/* For Users */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-center mb-8">For Users</h3>
            <div className="grid md:grid-cols-4 gap-6">
              {/* Step 1 */}
              <Card className="text-center relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                    1
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Sign Up</CardTitle>
                  <CardDescription>
                    Create your account in seconds with your phone number and email. Verify with OTP and set your PIN.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Step 2 */}
              <Card className="text-center relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                    2
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ArrowUpCircle className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Deposit Money</CardTitle>
                  <CardDescription>
                    Add funds to your wallet via M-Pesa, Airtel Money, or T-Kash. Your balance is instantly available.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Step 3 */}
              <Card className="text-center relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                    3
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Send or Withdraw</CardTitle>
                  <CardDescription>
                    Send money to anyone across networks or request cash withdrawal from nearby agents.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Step 4 */}
              <Card className="text-center relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                    4
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Done!</CardTitle>
                  <CardDescription>
                    Track all your transactions in real-time. Get instant notifications and manage your money effortlessly.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* For Agents */}
          <div className="bg-muted/30 rounded-lg p-8 md:p-12">
            <h3 className="text-2xl font-bold text-center mb-8">For Agents</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Agent Step 1 */}
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <UserPlus className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Register as Agent</CardTitle>
                  <CardDescription>
                    Sign up and provide your ID number, location, and preferred payment networks. Get verified in minutes.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Agent Step 2 */}
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Set Your Location</CardTitle>
                  <CardDescription>
                    Update your location and availability status. Customers nearby will see you on the map.
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Agent Step 3 */}
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Download className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Accept Requests</CardTitle>
                  <CardDescription>
                    Receive withdrawal requests from customers. Accept, meet up, and complete transactions. Earn commission on each transaction.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* Key Features */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center mb-8">Key Features</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Instant Transfers</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Send money across M-Pesa, Airtel Money, and T-Kash instantly. No waiting, no delays.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Agent Network</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Find verified agents near you. Withdraw cash anytime, anywhere across Kenya.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Secure & Safe</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Bank-level encryption, PIN protection, and transaction verification keep your money safe.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Mobile First</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Works seamlessly on any device. Access your wallet from your phone, tablet, or computer.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Peer-to-Peer</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Direct matching between users and agents. No intermediaries, lower fees, faster service.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">All Networks</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Support for M-Pesa, Airtel Money, T-Kash, and bank transfers. One wallet, all networks.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* CTA in How It Works */}
          <div className="mt-16 text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
            <p className="text-muted-foreground mb-6">
              Join thousands of Kenyans using Pia Pesa for their daily money needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Create Free Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/signup?agent=true">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Become an Agent
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Become an Agent Section */}
      <section id="agents" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Become a Pia Pesa Agent</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join our network of trusted agents and earn money by helping customers withdraw cash. Set your own schedule and location.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
            {/* Left side - Benefits */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Why Become an Agent?</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Earn Commission</h4>
                    <p className="text-sm text-muted-foreground">
                      Earn 2% commission on every withdrawal transaction you complete. Example: Complete a KES 1,000 withdrawal and earn KES 20 commission. The more you serve, the more you earn.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Flexible Location</h4>
                    <p className="text-sm text-muted-foreground">
                      Set your location and availability. Work from anywhere - your shop, office, or home.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Build Your Network</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect with customers in your area. Build trust and grow your customer base over time.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Instant Payments</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive payments directly to your wallet. No waiting, no delays - get paid instantly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Requirements */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-2xl">Agent Requirements</CardTitle>
                <CardDescription>What you need to get started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Valid National ID</p>
                    <p className="text-sm text-muted-foreground">Kenyan National ID for verification</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">Your operating location or area</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Payment Networks</p>
                    <p className="text-sm text-muted-foreground">M-Pesa, Airtel Money, or Bank account</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Minimum Cash Reserve</p>
                    <p className="text-sm text-muted-foreground">Set your maximum withdrawal amount</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* How Agent System Works */}
          <div className="bg-card rounded-lg p-8 md:p-12 mb-12">
            <h3 className="text-2xl font-bold text-center mb-8">How the Agent System Works</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h4 className="font-semibold mb-2">Customer Requests Cash</h4>
                <p className="text-sm text-muted-foreground">
                  A customer near your location requests a cash withdrawal through the app.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h4 className="font-semibold mb-2">You Accept the Request</h4>
                <p className="text-sm text-muted-foreground">
                  You receive a notification and can accept or decline based on your availability.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h4 className="font-semibold mb-2">Complete Transaction</h4>
                <p className="text-sm text-muted-foreground">
                  Meet the customer, verify the transaction, and hand over the cash. Get paid instantly.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to Start Earning?</h3>
            <p className="text-muted-foreground mb-6">
              Join hundreds of agents already earning with Pia Pesa. Registration takes less than 5 minutes.
            </p>
            <Link href="/signup?agent=true">
              <Button size="lg" className="w-full sm:w-auto">
                Register as Agent
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
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
              © {new Date().getFullYear()} Pia Pesa. All rights reserved. | Secure • Fast • Reliable
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
