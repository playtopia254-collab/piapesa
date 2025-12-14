import { NextRequest, NextResponse } from "next/server"
import { generateOTP, storeOTP, sendOTPSMS } from "@/lib/sms"
import { getDb } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      )
    }

    // Format phone number - normalize to consistent format
    let formattedPhone = phone.trim()
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.slice(1)
    } else if (formattedPhone.startsWith("254")) {
      formattedPhone = "+" + formattedPhone
    } else if (!formattedPhone.startsWith("+254")) {
      formattedPhone = "+254" + formattedPhone
    }

    // Check if there's an existing valid OTP for this phone
    const db = await getDb()
    const otpsCollection = db.collection("otps")
    
    const existingOTP = await otpsCollection.findOne({
      $or: [
        { phone: formattedPhone },
        { phone: formattedPhone.replace(/^\+/, "") },
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

    // Check if user exists for this phone (for signup, user might not exist yet)
    const usersCollection = db.collection("users")
    const existingUser = await usersCollection.findOne({ phone: formattedPhone })
    const userId = existingUser?._id.toString()

    // Generate OTP
    const otpCode = generateOTP()
    
    // Store OTP with normalized format and userId (if user exists)
    // This ensures OTPs are tied to specific users when possible
    await storeOTP(formattedPhone, otpCode, userId)

    // Send OTP via SMS
    const smsSent = await sendOTPSMS(formattedPhone, otpCode)

    if (!smsSent) {
      console.error(`Failed to send SMS OTP to ${formattedPhone}`)
      return NextResponse.json(
        { error: "Failed to send OTP SMS. Please check your SMS configuration and try again." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "OTP sent successfully to your phone",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Send OTP error:", error)
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    )
  }
}

