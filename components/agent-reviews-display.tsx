"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Review {
  id: string
  rating: number
  comment: string
  userName: string
  createdAt: string
}

interface AgentReviewsDisplayProps {
  agentId: string
  limit?: number
}

export function AgentReviewsDisplay({ agentId, limit = 5 }: AgentReviewsDisplayProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [averageRating, setAverageRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)

  useEffect(() => {
    loadReviews()
  }, [agentId])

  const loadReviews = async () => {
    try {
      const response = await fetch(`/api/agents/reviews?agentId=${agentId}&limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setReviews(data.reviews || [])
          setTotalReviews(data.total || 0)
          
          // Calculate average rating
          if (data.reviews && data.reviews.length > 0) {
            const avg = data.reviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / data.reviews.length
            setAverageRating(Number.parseFloat(avg.toFixed(1)))
          }
        }
      }
    } catch (error) {
      console.error("Failed to load reviews:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No reviews yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <Card key={review.id} className="border-border">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3 h-3 ${
                        star <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {review.userName}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
              </span>
            </div>
            {review.comment && (
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            )}
          </CardContent>
        </Card>
      ))}
      {totalReviews > limit && (
        <p className="text-xs text-center text-muted-foreground">
          Showing {limit} of {totalReviews} reviews
        </p>
      )}
    </div>
  )
}

