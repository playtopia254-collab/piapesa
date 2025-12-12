import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, email, pin } = body

    // Validation
    if ((!phone && !email) || !pin) {
      return NextResponse.json(
        { error: "Phone number or email and PIN are required" },
        { status: 400 }
      )
    }

    if (pin.length !== 4) {
      return NextResponse.json(
        { error: "PIN must be 4 digits" },
        { status: 400 }
      )
    }

    // Connect to database
    const db = await getDb()
    const usersCollection = db.collection("users")

    // Find user by phone or email
    let user = null
    let searchIdentifier = ""
    
    if (phone) {
      // Format phone number
      let formattedPhone = phone.trim()
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+254" + formattedPhone.slice(1)
      } else if (!formattedPhone.startsWith("+254")) {
        formattedPhone = "+254" + formattedPhone
      }
      searchIdentifier = formattedPhone
      user = await usersCollection.findOne({ phone: formattedPhone })
    } else if (email) {
      const formattedEmail = email.toLowerCase().trim()
      searchIdentifier = formattedEmail
      user = await usersCollection.findOne({ email: formattedEmail })
    }

    if (!user) {
      console.error(`User not found: ${searchIdentifier}`)
      return NextResponse.json(
        { error: "Invalid credentials. Please check your email/phone and PIN." },
        { status: 401 }
      )
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, user.pin)

    if (!isValidPin) {
      console.error(`Invalid PIN for user: ${user.email || user.phone}`)
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Return user data (without PIN)
    const userResponse = {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email,
      balance: user.balance || 0,
      isAgent: user.isAgent || false,
      location: user.location,
      rating: user.rating,
      createdAt: user.createdAt,
    }

    return NextResponse.json(
      { user: userResponse, success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Failed to login. Please try again." },
      { status: 500 }
    )
  }
}

