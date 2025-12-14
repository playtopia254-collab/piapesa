import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// POST - Create a review for an agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, userId, transactionId, rating, comment } = body

    if (!agentId || !userId || !rating) {
      return NextResponse.json(
        { error: "Agent ID, User ID, and rating are required" },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      )
    }

    const db = await getDb()
    const reviewsCollection = db.collection("agent_reviews")
    const usersCollection = db.collection("users")

    // Verify agent exists
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

    // Check if user already reviewed this agent for this transaction
    if (transactionId) {
      const existingReview = await reviewsCollection.findOne({
        agentId: new ObjectId(agentId),
        userId: new ObjectId(userId),
        transactionId: transactionId,
      })

      if (existingReview) {
        return NextResponse.json(
          { error: "You have already reviewed this transaction" },
          { status: 400 }
        )
      }
    }

    // Create review
    const review = {
      agentId: new ObjectId(agentId),
      userId: new ObjectId(userId),
      transactionId: transactionId || null,
      rating: Number.parseInt(rating),
      comment: comment || "",
      userName: user.name,
      userPhone: user.phone,
      createdAt: new Date(),
    }

    const result = await reviewsCollection.insertOne(review)

    // Calculate new average rating for agent
    const allReviews = await reviewsCollection
      .find({ agentId: new ObjectId(agentId) })
      .toArray()

    const totalRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0)
    const averageRating = allReviews.length > 0 ? totalRating / allReviews.length : 5.0

    // Update agent's rating
    await usersCollection.updateOne(
      { _id: new ObjectId(agentId) },
      {
        $set: {
          rating: Number.parseFloat(averageRating.toFixed(1)),
          totalReviews: allReviews.length,
          updatedAt: new Date(),
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: "Review submitted successfully",
      review: {
        id: result.insertedId.toString(),
        ...review,
        agentId: agentId,
        userId: userId,
      },
      newRating: Number.parseFloat(averageRating.toFixed(1)),
    })
  } catch (error) {
    console.error("Create review error:", error)
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 })
  }
}

// GET - Get reviews for an agent
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentId = searchParams.get("agentId")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 })
    }

    const db = await getDb()
    const reviewsCollection = db.collection("agent_reviews")

    // Get reviews for agent
    const reviews = await reviewsCollection
      .find({ agentId: new ObjectId(agentId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    // Format reviews
    const formattedReviews = reviews.map((review) => ({
      id: review._id.toString(),
      agentId: review.agentId.toString(),
      userId: review.userId.toString(),
      transactionId: review.transactionId?.toString() || null,
      rating: review.rating,
      comment: review.comment,
      userName: review.userName,
      createdAt: review.createdAt?.toISOString() || new Date().toISOString(),
    }))

    return NextResponse.json({
      success: true,
      reviews: formattedReviews,
      total: formattedReviews.length,
    })
  } catch (error) {
    console.error("Get reviews error:", error)
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 })
  }
}

