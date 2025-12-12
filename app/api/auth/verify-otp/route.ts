import { NextRequest, NextResponse } from "next/server"
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

    // Format phone number - normalize to consistent format
    let formattedPhone = phone.trim()
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.slice(1)
    } else if (formattedPhone.startsWith("254")) {
      formattedPhone = "+" + formattedPhone
    } else if (!formattedPhone.startsWith("+254")) {
      formattedPhone = "+254" + formattedPhone
    }

    // Try verifying with the formatted phone
    let isValid = verifyOTP(formattedPhone, code)
    
    // If that fails, try alternative formats (in case OTP was stored with different format)
    if (!isValid) {
      // Try without + prefix
      const phoneWithoutPlus = formattedPhone.replace(/^\+/, "")
      isValid = verifyOTP(phoneWithoutPlus, code)
    }
    
    if (!isValid) {
      // Try with 254 prefix (no +)
      const phone254 = formattedPhone.startsWith("+254") ? formattedPhone.slice(1) : formattedPhone
      isValid = verifyOTP(phone254, code)
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid or expired OTP code" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: true, message: "OTP verified successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Verify OTP error:", error)
    return NextResponse.json(
      { error: "Failed to verify OTP. Please try again." },
      { status: 500 }
    )
  }
}

