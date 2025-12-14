import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const db = await getDb()
    const notificationsCollection = db.collection("notifications")

    // Verify user exists
    const usersCollection = db.collection("users")
    let user
    try {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    } catch (e) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Fetch notifications for user
    const notifications = await notificationsCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    // Count unread notifications
    const unreadCount = await notificationsCollection.countDocuments({
      userId: new ObjectId(userId),
      read: false,
    })

    // Format notifications
    const formattedNotifications = notifications.map((notif) => ({
      id: notif._id.toString(),
      type: notif.type || "info",
      title: notif.title,
      message: notif.message,
      read: notif.read || false,
      createdAt: notif.createdAt?.toISOString() || new Date().toISOString(),
      link: notif.link,
      metadata: notif.metadata,
    }))

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      unreadCount,
    })
  } catch (error) {
    console.error("Get notifications error:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, title, message, link, metadata } = body

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: "User ID, type, title, and message are required" },
        { status: 400 }
      )
    }

    const db = await getDb()
    const notificationsCollection = db.collection("notifications")

    // Verify user exists
    const usersCollection = db.collection("users")
    let user
    try {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) })
    } catch (e) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Create notification
    const notification = {
      userId: new ObjectId(userId),
      type,
      title,
      message,
      read: false,
      link,
      metadata,
      createdAt: new Date(),
    }

    const result = await notificationsCollection.insertOne(notification)

    return NextResponse.json({
      success: true,
      notification: {
        id: result.insertedId.toString(),
        ...notification,
        userId: userId,
      },
    })
  } catch (error) {
    console.error("Create notification error:", error)
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
  }
}

