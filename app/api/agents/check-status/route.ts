import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// GET - Check agent status and location (for debugging)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get("agentId")

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 })
    }

    const db = await getDb()
    const usersCollection = db.collection("users")

    let agent
    try {
      agent = await usersCollection.findOne({
        _id: new ObjectId(agentId),
        isAgent: true,
      })
    } catch (e) {
      return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 })
    }

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent._id.toString(),
        name: agent.name,
        phone: agent.phone,
        isAgent: agent.isAgent || false,
        isAvailable: agent.isAvailable || false,
        location: agent.location,
        lastKnownLocation: agent.lastKnownLocation,
        lastActiveAt: agent.lastActiveAt?.toISOString(),
        hasLocation: !!(agent.location || agent.lastKnownLocation),
        locationAge: agent.location?.updatedAt 
          ? Math.round((Date.now() - new Date(agent.location.updatedAt).getTime()) / 1000)
          : null,
      },
    })
  } catch (error) {
    console.error("Check agent status error:", error)
    return NextResponse.json(
      { error: "Failed to check agent status" },
      { status: 500 }
    )
  }
}

