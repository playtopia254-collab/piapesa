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

    // Get user if exists to verify phone number matches
    const db = await getDb()
    const usersCollection = db.collection("users")
    const user = await usersCollection.findOne({ phone: formattedPhone })
    const userId = user?._id.toString()

    // Verify OTP - ensures phone number matches exactly and optionally userId
    const isValid = await verifyOTP(formattedPhone, code, userId)

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

