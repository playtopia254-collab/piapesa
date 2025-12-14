/**
 * Smooth Marker Animation Utilities
 * Implements Uber-like smooth marker movement with GPS noise filtering
 */

// Haversine distance calculation (returns meters)
export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Calculate bearing between two points (in degrees, 0 = North)
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180

  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)

  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return (bearing + 360) % 360
}

// Linear interpolation
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

// Ease-out cubic for smooth deceleration
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// Smooth angle interpolation (handles 0/360 wraparound)
export function lerpAngle(start: number, end: number, t: number): number {
  let diff = end - start
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return (start + diff * t + 360) % 360
}

/**
 * GPS Position Smoother using Exponential Moving Average
 * Filters out GPS noise for smoother marker movement
 */
export class PositionSmoother {
  private lat: number = 0
  private lng: number = 0
  private initialized: boolean = false
  private smoothingFactor: number

  constructor(smoothingFactor: number = 0.3) {
    // Higher = more responsive, Lower = smoother
    this.smoothingFactor = Math.max(0.1, Math.min(1, smoothingFactor))
  }

  update(newLat: number, newLng: number): { lat: number; lng: number } {
    if (!this.initialized) {
      this.lat = newLat
      this.lng = newLng
      this.initialized = true
      return { lat: this.lat, lng: this.lng }
    }

    // Apply exponential smoothing
    this.lat = this.lat + this.smoothingFactor * (newLat - this.lat)
    this.lng = this.lng + this.smoothingFactor * (newLng - this.lng)

    return { lat: this.lat, lng: this.lng }
  }

  getCurrent(): { lat: number; lng: number } {
    return { lat: this.lat, lng: this.lng }
  }

  reset(): void {
    this.initialized = false
  }
}

/**
 * Smooth Marker Animator
 * Animates a Google Maps marker smoothly between positions
 */
export class SmoothMarkerAnimator {
  private marker: google.maps.Marker | null = null
  private animationId: number | null = null
  private currentLat: number = 0
  private currentLng: number = 0
  private targetLat: number = 0
  private targetLng: number = 0
  private currentHeading: number = 0
  private targetHeading: number = 0
  private animationStartTime: number = 0
  private animationDuration: number = 1000 // ms
  private startLat: number = 0
  private startLng: number = 0
  private startHeading: number = 0
  private positionSmoother: PositionSmoother
  private isAnimating: boolean = false
  private onHeadingChange?: (heading: number) => void

  constructor(options?: {
    smoothingFactor?: number
    animationDuration?: number
    onHeadingChange?: (heading: number) => void
  }) {
    this.positionSmoother = new PositionSmoother(options?.smoothingFactor || 0.4)
    this.animationDuration = options?.animationDuration || 1000
    this.onHeadingChange = options?.onHeadingChange
  }

  setMarker(marker: google.maps.Marker): void {
    this.marker = marker
    const pos = marker.getPosition()
    if (pos) {
      this.currentLat = pos.lat()
      this.currentLng = pos.lng()
      this.targetLat = this.currentLat
      this.targetLng = this.currentLng
    }
  }

  /**
   * Animate to a new position
   * @param lat Target latitude
   * @param lng Target longitude
   * @param immediate If true, jump immediately without animation
   */
  animateTo(lat: number, lng: number, immediate: boolean = false): void {
    // Apply GPS smoothing first
    const smoothed = this.positionSmoother.update(lat, lng)

    // Calculate distance to determine if we should animate
    const distance = getDistanceMeters(
      this.currentLat,
      this.currentLng,
      smoothed.lat,
      smoothed.lng
    )

    // If very small movement (< 2m), skip animation to avoid jitter
    if (distance < 2 && !immediate) {
      return
    }

    // Calculate heading based on movement direction
    if (distance > 3) {
      const newHeading = calculateBearing(
        this.currentLat,
        this.currentLng,
        smoothed.lat,
        smoothed.lng
      )
      this.targetHeading = newHeading
    }

    // Store start position for animation
    this.startLat = this.currentLat
    this.startLng = this.currentLng
    this.startHeading = this.currentHeading

    // Set target
    this.targetLat = smoothed.lat
    this.targetLng = smoothed.lng

    // Calculate animation duration based on distance (faster for short distances)
    if (distance < 10) {
      this.animationDuration = 500
    } else if (distance < 50) {
      this.animationDuration = 800
    } else if (distance < 200) {
      this.animationDuration = 1000
    } else {
      this.animationDuration = 1500
    }

    if (immediate) {
      this.currentLat = smoothed.lat
      this.currentLng = smoothed.lng
      this.currentHeading = this.targetHeading
      this.updateMarkerPosition()
      return
    }

    // Start animation
    this.animationStartTime = performance.now()

    if (!this.isAnimating) {
      this.isAnimating = true
      this.animate()
    }
  }

  private animate = (): void => {
    if (!this.isAnimating) return

    const now = performance.now()
    const elapsed = now - this.animationStartTime
    const progress = Math.min(elapsed / this.animationDuration, 1)
    const easedProgress = easeOutCubic(progress)

    // Interpolate position
    this.currentLat = lerp(this.startLat, this.targetLat, easedProgress)
    this.currentLng = lerp(this.startLng, this.targetLng, easedProgress)

    // Interpolate heading smoothly
    this.currentHeading = lerpAngle(
      this.startHeading,
      this.targetHeading,
      easedProgress
    )

    // Update marker
    this.updateMarkerPosition()

    // Notify heading change
    if (this.onHeadingChange) {
      this.onHeadingChange(this.currentHeading)
    }

    // Continue animation if not complete
    if (progress < 1) {
      this.animationId = requestAnimationFrame(this.animate)
    } else {
      this.isAnimating = false
      // Snap to final position
      this.currentLat = this.targetLat
      this.currentLng = this.targetLng
      this.currentHeading = this.targetHeading
      this.updateMarkerPosition()
    }
  }

  private updateMarkerPosition(): void {
    if (this.marker && typeof google !== "undefined") {
      this.marker.setPosition({
        lat: this.currentLat,
        lng: this.currentLng,
      })
    }
  }

  getCurrentPosition(): { lat: number; lng: number } {
    return { lat: this.currentLat, lng: this.currentLng }
  }

  getCurrentHeading(): number {
    return this.currentHeading
  }

  stop(): void {
    this.isAnimating = false
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  destroy(): void {
    this.stop()
    this.marker = null
    this.positionSmoother.reset()
  }
}

/**
 * Hook-friendly smooth position tracker
 * Returns smoothed position that can be used in React components
 */
export function createSmoothPositionTracker(smoothingFactor: number = 0.3) {
  const smoother = new PositionSmoother(smoothingFactor)
  let animatedLat = 0
  let animatedLng = 0
  let targetLat = 0
  let targetLng = 0
  let animationId: number | null = null
  let lastUpdateTime = 0
  let onUpdate: ((pos: { lat: number; lng: number }) => void) | null = null

  function update(lat: number, lng: number) {
    // Apply GPS smoothing
    const smoothed = smoother.update(lat, lng)
    targetLat = smoothed.lat
    targetLng = smoothed.lng

    // Start animation if not running
    if (animationId === null) {
      lastUpdateTime = performance.now()
      animate()
    }
  }

  function animate() {
    const now = performance.now()
    const deltaTime = Math.min((now - lastUpdateTime) / 1000, 0.1) // Cap at 100ms
    lastUpdateTime = now

    // Smooth interpolation towards target (spring-like)
    const lerpFactor = 1 - Math.pow(0.001, deltaTime) // Adjust 0.001 for speed

    const prevLat = animatedLat
    const prevLng = animatedLng

    animatedLat = lerp(animatedLat, targetLat, lerpFactor)
    animatedLng = lerp(animatedLng, targetLng, lerpFactor)

    // Check if we've essentially arrived
    const distance = getDistanceMeters(animatedLat, animatedLng, targetLat, targetLng)

    if (distance < 0.5) {
      // Within 0.5m, snap to target
      animatedLat = targetLat
      animatedLng = targetLng
      animationId = null
    } else {
      animationId = requestAnimationFrame(animate)
    }

    // Notify listener
    if (onUpdate && (prevLat !== animatedLat || prevLng !== animatedLng)) {
      onUpdate({ lat: animatedLat, lng: animatedLng })
    }
  }

  function setInitialPosition(lat: number, lng: number) {
    animatedLat = lat
    animatedLng = lng
    targetLat = lat
    targetLng = lng
    smoother.update(lat, lng) // Initialize smoother
  }

  function setOnUpdate(callback: (pos: { lat: number; lng: number }) => void) {
    onUpdate = callback
  }

  function getPosition() {
    return { lat: animatedLat, lng: animatedLng }
  }

  function destroy() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    onUpdate = null
  }

  return {
    update,
    setInitialPosition,
    setOnUpdate,
    getPosition,
    destroy,
  }
}

