import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      email,
      sms,
      push,
      transactionAlerts,
      agentRequests,
    } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
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

    // Build notification preferences object
    const notificationPreferences: any = {}

    if (email !== undefined) notificationPreferences.email = email
    if (sms !== undefined) notificationPreferences.sms = sms
    if (push !== undefined) notificationPreferences.push = push
    if (transactionAlerts !== undefined)
      notificationPreferences.transactionAlerts = transactionAlerts
    if (agentRequests !== undefined) notificationPreferences.agentRequests = agentRequests

    // Update user notification preferences
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          notificationPreferences: {
            ...(user.notificationPreferences || {}),
            ...notificationPreferences,
          },
          updatedAt: new Date(),
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated successfully",
    })
  } catch (error) {
    console.error("Update notifications error:", error)
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    )
  }
}

