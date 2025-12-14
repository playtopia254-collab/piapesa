import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, email, phone } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    if (!name && !email && !phone) {
      return NextResponse.json({ error: "At least one field is required" }, { status: 400 })
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

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate phone format if provided
    if (phone && !/^\+254\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "Invalid phone format. Use +254XXXXXXXXX" },
        { status: 400 }
      )
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await usersCollection.findOne({ email: email.toLowerCase() })
      if (existingUser && existingUser._id.toString() !== userId) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 })
      }
    }

    // Check if phone is already taken by another user
    if (phone && phone !== user.phone) {
      const existingUser = await usersCollection.findOne({ phone })
      if (existingUser && existingUser._id.toString() !== userId) {
        return NextResponse.json({ error: "Phone number already in use" }, { status: 400 })
      }
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (name) updateData.name = name
    if (email) updateData.email = email.toLowerCase()
    if (phone) updateData.phone = phone

    // Update user
    await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: updateData })

    // Fetch updated user
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) })

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser?._id.toString(),
        name: updatedUser?.name,
        email: updatedUser?.email,
        phone: updatedUser?.phone,
      },
    })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}

