"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star, Loader2, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentReviewModalProps {
  open: boolean
  onClose: () => void
  agentId: string
  agentName: string
  userId: string
  transactionId?: string
  onReviewSubmitted?: () => void
}

export function AgentReviewModal({
  open,
  onClose,
  agentId,
  agentName,
  userId,
  transactionId,
  onReviewSubmitted,
}: AgentReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/agents/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          userId,
          transactionId,
          rating,
          comment: comment.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setIsSubmitted(true)
        if (onReviewSubmitted) {
          onReviewSubmitted()
        }
        // Close modal after 2 seconds
        setTimeout(() => {
          onClose()
          setIsSubmitted(false)
          setRating(0)
          setComment("")
        }, 2000)
      } else {
        alert(data.error || "Failed to submit review")
      }
    } catch (error) {
      console.error("Failed to submit review:", error)
      alert("Failed to submit review. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    onClose()
    setRating(0)
    setComment("")
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {isSubmitted ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <DialogTitle>Thank You!</DialogTitle>
            <DialogDescription className="mt-2">
              Your review has been submitted successfully.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rate Your Experience</DialogTitle>
              <DialogDescription>
                How was your experience with {agentName}?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Star Rating */}
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={cn(
                          "w-8 h-8 transition-colors",
                          star <= (hoveredRating || rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        )}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {rating} {rating === 1 ? "star" : "stars"}
                    </span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">Comment (Optional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Share your experience..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {comment.length}/500 characters
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Skip
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1"
                  disabled={rating === 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Review"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

