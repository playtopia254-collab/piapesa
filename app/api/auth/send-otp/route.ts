import { NextRequest, NextResponse } from "next/server"
import { generateOTP, storeOTP, sendOTPSMS } from "@/lib/sms"

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

    // Generate OTP
    const otpCode = generateOTP()
    
    // Store OTP with normalized format
    storeOTP(formattedPhone, otpCode)
    
    // Also store with alternative format to handle verification mismatches
    const phoneWithoutPlus = formattedPhone.replace(/^\+/, "")
    storeOTP(phoneWithoutPlus, otpCode)

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

