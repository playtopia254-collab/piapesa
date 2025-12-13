import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import bcrypt from "bcryptjs"
import { generateOTP, storeOTP, sendOTPSMS } from "@/lib/sms"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, pin } = body

    // Validation
    if (!phone || !pin) {
      return NextResponse.json(
        { error: "Phone number and PIN are required" },
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
    const otpsCollection = db.collection("otps")

    // Format phone number
    let formattedPhone = phone.trim()
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.slice(1)
    } else if (!formattedPhone.startsWith("+254")) {
      formattedPhone = "+254" + formattedPhone
    }
    
    // Find user by phone
    const user = await usersCollection.findOne({ phone: formattedPhone })

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Verify PIN first
    const isValidPin = await bcrypt.compare(pin, user.pin)

    if (!isValidPin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Check if there's an existing valid OTP for this phone
    
    // Normalize phone number format for OTP check
    let phoneForOTP = user.phone
    if (!phoneForOTP.startsWith("+254")) {
      if (phoneForOTP.startsWith("254")) {
        phoneForOTP = "+" + phoneForOTP
      } else if (phoneForOTP.startsWith("0")) {
        phoneForOTP = "+254" + phoneForOTP.slice(1)
      } else {
        phoneForOTP = "+254" + phoneForOTP
      }
    }
    
    // Check for existing valid OTP
    const existingOTP = await otpsCollection.findOne({
      $or: [
        { phone: phoneForOTP },
        { phone: phoneForOTP.replace(/^\+/, "") },
      ],
      expiresAt: { $gt: new Date() },
    })
    
    if (existingOTP) {
      const expiresIn = Math.floor((existingOTP.expiresAt.getTime() - Date.now()) / 1000)
      const minutes = Math.floor(expiresIn / 60)
      const seconds = expiresIn % 60
      return NextResponse.json(
        { 
          error: `Please wait. You can request a new OTP in ${minutes}:${seconds.toString().padStart(2, "0")}`,
          expiresIn: expiresIn,
        },
        { status: 429 }
      )
    }
    
    // Generate and send OTP to user's phone via SMS
    const otpCode = generateOTP()
    
    console.log("=".repeat(80))
    console.log("📱 OTP STORAGE DEBUG")
    console.log("=".repeat(80))
    console.log("User phone from DB:", user.phone)
    console.log("Normalized phone for OTP:", phoneForOTP)
    console.log("OTP Code:", otpCode)
    console.log("=".repeat(80))
    
    // Store OTP with normalized format and userId for security
    // This ensures OTP can only be used by the specific user
    await storeOTP(phoneForOTP, otpCode, user._id.toString())
    
    console.log("✅ OTP stored in DB for phone:", phoneForOTP, "with userId:", user._id.toString())

    // Send OTP via SMS
    const smsSent = await sendOTPSMS(user.phone, otpCode)

    if (!smsSent) {
      console.error(`Failed to send SMS OTP to ${user.phone}`)
      return NextResponse.json(
        { 
          error: "Failed to send OTP SMS. Please check your SMS configuration and try again.",
          hint: "Check server console for detailed error information"
        },
        { status: 500 }
      )
    }

    // Format phone for display (show full international format)
    const displayPhone = user.phone.startsWith("+254") 
      ? user.phone 
      : user.phone.startsWith("254")
      ? "+" + user.phone
      : user.phone.startsWith("0")
      ? "+254" + user.phone.slice(1)
      : user.phone

    // Return success (don't return user data yet - wait for OTP verification)
    return NextResponse.json(
      { 
        success: true, 
        message: "OTP sent to your phone",
        phone: displayPhone, // Return full international format
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Login send OTP error:", error)
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    )
  }
}

