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

    // Generate and send OTP to user's phone via SMS
    const otpCode = generateOTP()
    
    // Normalize phone number format for OTP storage (ensure consistent format)
    // Store OTP with normalized phone number to match verification
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
    
    console.log("=".repeat(80))
    console.log("📱 OTP STORAGE DEBUG")
    console.log("=".repeat(80))
    console.log("User phone from DB:", user.phone)
    console.log("Normalized phone for OTP:", phoneForOTP)
    console.log("OTP Code:", otpCode)
    console.log("=".repeat(80))
    
    // Store OTP with normalized format in database
    await storeOTP(phoneForOTP, otpCode)
    
    // Also store with alternative formats to handle verification mismatches
    const phoneWithoutPlus = phoneForOTP.replace(/^\+/, "")
    await storeOTP(phoneWithoutPlus, otpCode)
    
    console.log("✅ OTP stored in DB with formats:", [phoneForOTP, phoneWithoutPlus])

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

