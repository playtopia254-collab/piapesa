"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Shield,
  CreditCard,
  Send,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const faqCategories = [
  {
    id: "general",
    title: "General",
    icon: HelpCircle,
    questions: [
      {
        q: "What is Pia Pesa?",
        a: "Pia Pesa is a peer-to-peer digital wallet that allows you to send money, receive funds, and withdraw cash through our network of agents across Kenya. You can transfer money between different mobile money networks including M-Pesa, Airtel Money, and T-Kash.",
      },
      {
        q: "How do I create an account?",
        a: "To create an account, click on 'Sign Up' and provide your phone number, name, and email address. You'll receive an OTP code via SMS to verify your phone number. Once verified, you can start using Pia Pesa immediately.",
      },
      {
        q: "Is my money safe?",
        a: "Yes, your money is secure. We use industry-standard encryption and security measures to protect your funds and personal information. All transactions are monitored and verified for your safety.",
      },
      {
        q: "What networks are supported?",
        a: "Pia Pesa supports M-Pesa, Airtel Money, and T-Kash. You can send and receive money across all these networks seamlessly.",
      },
    ],
  },
  {
    id: "transactions",
    title: "Transactions",
    icon: CreditCard,
    questions: [
      {
        q: "How do I send money?",
        a: "Go to 'Send Money' in your dashboard, enter the recipient's phone number, select the amount and network, then confirm the transaction. The money will be transferred instantly.",
      },
      {
        q: "How long do transactions take?",
        a: "Most transactions are processed instantly. Cross-network transfers may take a few minutes. Withdrawal requests are processed once an agent accepts your request.",
      },
      {
        q: "What are the transaction fees?",
        a: "Transaction fees vary by network and amount. Fees are clearly displayed before you confirm any transaction. Cross-network transfers may have slightly higher fees.",
      },
      {
        q: "Can I cancel a transaction?",
        a: "Transactions can only be cancelled if they are still pending. Once a transaction is completed, it cannot be reversed. Please contact support immediately if you need to cancel a pending transaction.",
      },
    ],
  },
  {
    id: "withdrawals",
    title: "Withdrawals",
    icon: Download,
    questions: [
      {
        q: "How do I withdraw cash?",
        a: "Go to 'Withdraw' in your dashboard, enter the amount you want to withdraw, and select a nearby agent. Once an agent accepts your request, you'll receive their location and can collect your cash.",
      },
      {
        q: "How do I find an agent?",
        a: "When you request a withdrawal, we'll show you nearby agents on a map. You can select the most convenient agent for you. Agents are verified and rated by other users.",
      },
      {
        q: "What are the withdrawal fees?",
        a: "Withdrawal fees are charged by the agent and vary by location and amount. The exact fee will be shown before you confirm the withdrawal request.",
      },
      {
        q: "What if an agent doesn't show up?",
        a: "If an agent doesn't respond or show up, you can cancel the request and select another agent. If you've already paid, contact support immediately for assistance.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    icon: Shield,
    questions: [
      {
        q: "How do I reset my PIN?",
        a: "If you've forgotten your PIN, go to 'Forgot PIN' on the login page. You'll receive an OTP code to verify your identity, then you can set a new PIN.",
      },
      {
        q: "What should I do if I suspect fraud?",
        a: "Contact support immediately if you notice any suspicious activity on your account. We'll investigate and help secure your account. You can also freeze your account temporarily from settings.",
      },
      {
        q: "How do I enable two-factor authentication?",
        a: "Two-factor authentication is automatically enabled for all transactions. You'll receive an OTP code via SMS for verification on sensitive operations.",
      },
      {
        q: "Can I change my phone number?",
        a: "Yes, you can update your phone number from Settings. You'll need to verify the new number with an OTP code. This helps keep your account secure.",
      },
    ],
  },
]

const supportTopics = [
  {
    title: "Account Issues",
    description: "Problems with login, PIN, or account access",
    icon: Shield,
    color: "text-blue-500",
  },
  {
    title: "Transaction Help",
    description: "Questions about sending, receiving, or deposits",
    icon: Send,
    color: "text-green-500",
  },
  {
    title: "Withdrawal Support",
    description: "Help with cash withdrawals and agent requests",
    icon: Download,
    color: "text-orange-500",
  },
  {
    title: "Payment Issues",
    description: "Failed payments, refunds, or transaction errors",
    icon: CreditCard,
    color: "text-purple-500",
  },
]

export default function SupportPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    topic: "",
    subject: "",
    email: "",
    phone: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitStatus("success")
      setFormData({
        topic: "",
        subject: "",
        email: "",
        phone: "",
        message: "",
      })
      
      // Clear success message after 5 seconds
      setTimeout(() => setSubmitStatus(null), 5000)
    }, 1500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Help & Support</h1>
        <p className="text-muted-foreground">Get help with your account, transactions, and more</p>
      </div>

      {/* Quick Support Topics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {supportTopics.map((topic) => {
          const Icon = topic.icon
          return (
            <Card key={topic.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <Icon className={cn("w-5 h-5", topic.color)} />
                  <CardTitle className="text-sm">{topic.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{topic.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Contact Methods */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Phone className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Call Us</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">24/7 Customer Support</p>
            <p className="text-lg font-semibold">0700 000 000</p>
            <p className="text-xs text-muted-foreground mt-1">Available anytime</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Email Us</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Send us an email</p>
            <p className="text-lg font-semibold">support@piapesa.com</p>
            <p className="text-xs text-muted-foreground mt-1">Response within 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Live Chat</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Chat with support</p>
            <Button className="w-full" variant="outline">
              Start Chat
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Average wait: 2 minutes</p>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqCategories.map((category) => {
            const Icon = category.icon
            return (
              <Card key={category.id}>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category.questions.map((faq, index) => {
                    const isOpen = openFaq === `${category.id}-${index}`
                    return (
                      <div key={index} className="border-b border-border last:border-0 pb-3 last:pb-0">
                        <button
                          onClick={() =>
                            setOpenFaq(isOpen ? null : `${category.id}-${index}`)
                          }
                          className="w-full flex items-center justify-between text-left"
                        >
                          <span className="font-medium text-sm">{faq.q}</span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        {isOpen && (
                          <p className="text-sm text-muted-foreground mt-2 pl-4">{faq.a}</p>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send us a Message</CardTitle>
          <CardDescription>
            Fill out the form below and we'll get back to you as soon as possible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Select
                  value={formData.topic}
                  onValueChange={(value) => setFormData({ ...formData, topic: value })}
                >
                  <SelectTrigger id="topic">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Account Issues</SelectItem>
                    <SelectItem value="transaction">Transaction Help</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal Support</SelectItem>
                    <SelectItem value="payment">Payment Issues</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0712 345 678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue or question in detail..."
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
              />
            </div>

            {submitStatus === "success" && (
              <Alert>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  Your message has been sent successfully! We'll get back to you soon.
                </AlertDescription>
              </Alert>
            )}

            {submitStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Something went wrong. Please try again or contact us directly.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>Helpful documents and guides</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <FileText className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">User Guide</p>
                <p className="text-xs text-muted-foreground">Complete guide to using Pia Pesa</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Security Tips</p>
                <p className="text-xs text-muted-foreground">How to keep your account safe</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <CreditCard className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Transaction Fees</p>
                <p className="text-xs text-muted-foreground">Understanding our fee structure</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Agent Network</p>
                <p className="text-xs text-muted-foreground">Learn about our agent network</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

