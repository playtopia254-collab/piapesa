import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, currentPin, newPin } = body

    if (!userId || !currentPin || !newPin) {
      return NextResponse.json(
        { error: "User ID, current PIN, and new PIN are required" },
        { status: 400 }
      )
    }

    if (newPin.length !== 4) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits" },
        { status: 400 }
      )
    }

    if (!/^\d+$/.test(newPin)) {
      return NextResponse.json({ error: "PIN must contain only numbers" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")

    // Verify user exists
    let user
    try {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    } catch (e) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify current PIN
    const isCurrentPinValid = await bcrypt.compare(currentPin, user.pin)
    if (!isCurrentPinValid) {
      return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 400 })
    }

    // Check if new PIN is same as current
    const isSamePin = await bcrypt.compare(newPin, user.pin)
    if (isSamePin) {
      return NextResponse.json(
        { error: "New PIN must be different from current PIN" },
        { status: 400 }
      )
    }

    // Hash new PIN
    const hashedNewPin = await bcrypt.hash(newPin, 10)

    // Update PIN
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          pin: hashedNewPin,
          updatedAt: new Date(),
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: "PIN changed successfully",
    })
  } catch (error) {
    console.error("Change PIN error:", error)
    return NextResponse.json({ error: "Failed to change PIN" }, { status: 500 })
  }
}

