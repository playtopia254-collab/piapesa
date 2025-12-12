import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { verifyOTP } from "@/lib/sms"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, code } = body

    if (!phone || !code) {
      return NextResponse.json(
        { error: "Phone number and OTP code are required" },
        { status: 400 }
      )
    }

    console.log("=".repeat(80))
    console.log("🔐 LOGIN OTP VERIFICATION REQUEST")
    console.log("=".repeat(80))
    console.log("Received phone:", phone)
    console.log("Received code:", code)
    
    // Format phone number - normalize to consistent format
    let formattedPhone = phone.trim()
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.slice(1)
    } else if (formattedPhone.startsWith("254")) {
      formattedPhone = "+" + formattedPhone
    } else if (!formattedPhone.startsWith("+254")) {
      formattedPhone = "+254" + formattedPhone
    }
    
    console.log("Formatted phone:", formattedPhone)

    // Try verifying with the formatted phone
    let isValid = verifyOTP(formattedPhone, code)
    
    // If that fails, try alternative formats (in case OTP was stored with different format)
    if (!isValid) {
      console.log("First attempt failed, trying without + prefix...")
      // Try without + prefix
      const phoneWithoutPlus = formattedPhone.replace(/^\+/, "")
      isValid = verifyOTP(phoneWithoutPlus, code)
    }
    
    if (!isValid) {
      console.log("Second attempt failed, trying with 254 prefix (no +)...")
      // Try with 254 prefix (no +)
      const phone254 = formattedPhone.startsWith("+254") ? formattedPhone.slice(1) : formattedPhone
      isValid = verifyOTP(phone254, code)
    }

    if (!isValid) {
      console.log("❌ All OTP verification attempts failed")
      console.log("=".repeat(80))
      return NextResponse.json(
        { error: "Invalid or expired OTP code" },
        { status: 400 }
      )
    }
    
    console.log("✅ OTP verified successfully!")
    console.log("=".repeat(80))

    // OTP verified - now get user data
    const db = await getDb()
    const usersCollection = db.collection("users")

    // Find user by phone
    const user = await usersCollection.findOne({ phone: formattedPhone })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
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
    console.error("Login verify OTP error:", error)
    return NextResponse.json(
      { error: "Failed to verify OTP. Please try again." },
      { status: 500 }
    )
  }
}

