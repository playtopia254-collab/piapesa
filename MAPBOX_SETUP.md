# 🗺️ Mapbox Setup Guide - Bolt/Uber Style Maps

This guide explains how to set up Mapbox GL JS for premium, ride-hailing style maps in your Pia Pesa Wallet application.

## Why Mapbox?

| Feature | Google Maps | Mapbox |
|---------|-------------|--------|
| Tile Type | Raster (images) | Vector (shapes) |
| Zoom Quality | Pixelated at high zoom | Sharp at all zoom levels |
| Custom Styling | Limited | Full control |
| Animation | Basic | Smooth 60fps |
| Performance | Good | Excellent |
| Pricing | Per request | More generous free tier |

### What Makes Bolt/Uber Maps Smooth?

1. **Vector Tiles** - Instead of loading static images, roads, buildings, and labels are vector shapes that scale perfectly at any zoom level.

2. **Minimal Color Palette** - Fewer colors = less cognitive load = smoother perceived experience.

3. **Camera Interpolation** - Smooth camera transitions with easing functions (ease-in-out) instead of snapping.

4. **Layer Prioritization** - Route lines appear above roads and buildings, so nothing competes visually.

5. **GPU Acceleration** - Mapbox uses WebGL for hardware-accelerated rendering.

## Setup Steps

### 1. Create Mapbox Account

1. Go to [mapbox.com](https://www.mapbox.com/)
2. Sign up for a free account
3. You get 50,000 free map loads/month

### 2. Get Your Access Token

1. Go to your [Mapbox Account Dashboard](https://account.mapbox.com/)
2. Navigate to **Access tokens**
3. Copy your **Default public token** (starts with `pk.`)

### 3. Configure Environment

Add to your `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJja...
```

### 4. Use the Components

#### Option A: Full Mapbox Map

```tsx
import { BoltMapboxMap } from "@/components/bolt-mapbox-map"

<BoltMapboxMap
  userLocation={userLocation}
  agents={nearbyAgents}
  selectedAgent={selectedAgent}
  onSelectAgent={handleAgentSelect}
  showRoute={true}
  etaSeconds={120}
/>
```

#### Option B: Agent Tracking Map

```tsx
import { BoltAgentTrackingMap } from "@/components/bolt-agent-tracking-map"

<BoltAgentTrackingMap
  onSelectAgent={handleAgentSelect}
  selectedAgentId={selectedAgentId}
  height="600px"
/>
```

## Component Features

### BoltMapboxMap

The full-featured Mapbox map with:
- Custom SVG markers (user, agents, car)
- Route rendering with GeoJSON
- Smooth camera animations
- ETA display
- Voice navigation support
- Map style toggle (light/satellite)
- Zoom controls

### BoltAgentTrackingMap

Specialized for agent discovery:
- Auto-fetches nearby agents
- Real-time location updates
- Agent list with ratings
- Distance calculations
- Automatic refresh every 4 seconds

## Technical Implementation

### Camera Animation

```typescript
map.current.flyTo({
  center: [agent.location.lng, agent.location.lat],
  zoom: 15,
  duration: 1500, // ms - longer = smoother
  easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out-cubic
})
```

### Custom Markers

SVG-based markers with:
- Animated pulse effects
- Drop shadows for depth
- Color gradients
- No pixelation at any zoom

### Route Rendering

```typescript
// Add route as GeoJSON layer
map.current.addLayer({
  id: "route-line",
  type: "line",
  source: "route",
  paint: {
    "line-color": "#3b82f6", // Soft blue
    "line-width": 6,
    "line-blur": 1, // Subtle glow
  },
})
```

### Style Customization

The map uses Mapbox's `light-v11` style with modifications:
- POI labels hidden (shops, restaurants)
- Water color muted
- Minimal visual clutter
- Focus on roads and navigation

## Performance Tips

1. **Minimize Re-renders**
   - Use `useRef` for map instance
   - Batch marker updates

2. **Use requestAnimationFrame**
   - Smooth marker animations
   - 60fps position updates

3. **Limit API Calls**
   - Fetch agents every 4 seconds, not continuously
   - Cache route calculations

4. **GPU Acceleration**
   - Mapbox uses WebGL by default
   - Markers use CSS transforms

## Comparison: Google Maps vs Mapbox

### Google Maps Component (existing)

```tsx
// Uses @react-google-maps/api
<GoogleMap styles={boltMapStyle} ... />
```

### Mapbox Component (new)

```tsx
// Uses mapbox-gl directly
const map = new mapboxgl.Map({
  style: "mapbox://styles/mapbox/light-v11",
  ...
})
```

## Migrating from Google Maps

Both map providers are available in this project. You can:

1. **Use both** - Google Maps for complex Places autocomplete, Mapbox for the main map
2. **Use Mapbox only** - Replace all map components
3. **Use Google Maps only** - Continue using existing components

To switch to Mapbox in the `agent-withdrawal-flow.tsx`:

```tsx
// Replace this:
import { GoogleMapsWrapper } from "@/components/google-maps-wrapper"

// With this:
import { BoltMapboxMap } from "@/components/bolt-mapbox-map"
```

## Troubleshooting

### Map Not Loading

1. Check console for errors
2. Verify `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is set
3. Ensure token starts with `pk.`

### Token Not Working

1. Go to Mapbox dashboard
2. Create a new token with proper scopes
3. URL restrictions should include your domain

### Slow Performance

1. Reduce marker count
2. Use marker clustering for many markers
3. Disable unused features

## Resources

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/guides/)
- [Mapbox Studio](https://studio.mapbox.com/) - Custom style editor
- [Mapbox Examples](https://docs.mapbox.com/mapbox-gl-js/examples/)

---

🚀 **Tip**: For the smoothest experience, use Mapbox on mobile devices with touch gestures. The vector-based rendering shines on high-DPI screens!

