import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id

    if (!notificationId) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
    }

    const db = await getDb()
    const notificationsCollection = db.collection("notifications")

    // Verify notification exists
    let notification
    try {
      notification = await notificationsCollection.findOne({
        _id: new ObjectId(notificationId),
      })
    } catch (e) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 })
    }

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    // Mark as read
    await notificationsCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: "Notification marked as read",
    })
  } catch (error) {
    console.error("Mark notification as read error:", error)
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    )
  }
}

