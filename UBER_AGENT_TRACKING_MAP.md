# 🚗 Uber-Like Live Agent Tracking Map

A production-ready, Uber-style live agent tracking map component built with Google Maps JavaScript API.

## ✨ Features

### 🗺️ Map Features
- **Google Maps JavaScript API** integration
- **Geometry Library** for accurate distance calculations
- **Places API** support (optional)
- Centers on user's live GPS location with high accuracy
- Blue circular marker for user location
- Shows ALL available agents on the map simultaneously

### 📍 Agent Markers
- **Circular avatar/pin icons** with custom orange/green styling
- **Subtle shadows** for depth
- **Pulse animation** effect (via gradient glow)
- **Smooth marker movement** with interpolation when positions update
- **Click to select** - highlights agent on map and in list

### 📏 Distance Calculation
- Uses `google.maps.geometry.spherical.computeDistanceBetween` for meter-level accuracy
- Displays in **meters** if < 1000m (e.g., "10 m away")
- Displays in **kilometers** if >= 1000m (e.g., "1.2 km away")
- **Real-time updates** as user or agents move

### 📋 Agent List Panel
- **Uber-style card UI** below the map
- Each agent card shows:
  - Avatar with initial
  - Agent name
  - Star rating
  - Total trips count
  - Review count (if available)
  - **Live distance** (e.g., "10m away")
- **Selecting an agent**:
  - Zooms map to agent location
  - Changes marker color to green
  - Highlights card with green border
  - Shows selected badge

### 🔄 Real-Time Updates
- **Simulated live updates** with `setInterval` (every 4 seconds)
- **Smooth marker interpolation** (no jumping)
- Ready to plug into:
  - **MongoDB Realtime**
  - **WebSockets**
  - **Server-Sent Events (SSE)**

### 🎨 UI/UX
- Clean, modern Uber-style design
- Responsive layout
- Smooth animations
- High-quality marker icons
- Professional color scheme

## 📁 Files Created

1. **`components/uber-agent-tracking-map.tsx`**
   - Main component with all tracking features
   - Handles location, agents, and map interactions

2. **`app/dashboard/agent-tracking/page.tsx`**
   - Demo page showcasing the component
   - Accessible at `/dashboard/agent-tracking`

## 🚀 Usage

### Basic Usage

```tsx
import { UberAgentTrackingMap } from "@/components/uber-agent-tracking-map"

function MyPage() {
  const [selectedAgent, setSelectedAgent] = useState(null)

  return (
    <UberAgentTrackingMap
      onSelectAgent={(agent) => setSelectedAgent(agent)}
      selectedAgentId={selectedAgent?.id || null}
      height="600px"
    />
  )
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSelectAgent` | `(agent: Agent) => void` | `undefined` | Callback when agent is selected |
| `selectedAgentId` | `string \| null` | `null` | ID of currently selected agent |
| `height` | `string` | `"600px"` | Height of the map container |

### Agent Interface

```typescript
interface Agent {
  id: string
  name: string
  phone: string
  location: { lat: number; lng: number }
  rating: number
  totalTransactions: number
  distance?: number // in meters
  distanceFormatted?: string
  totalReviews?: number
}
```

## 🔧 Setup Requirements

### 1. Google Maps API Key

Ensure you have `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in your `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 2. Required APIs

Enable these APIs in Google Cloud Console:

- ✅ **Maps JavaScript API** (required)
- ✅ **Geometry Library** (required for distance calculation)
- ✅ **Geolocation API** (optional, for better accuracy)
- ✅ **Places API** (optional)

See `GOOGLE_MAPS_SETUP.md` for detailed setup instructions.

### 3. Location Permissions

The component requires location permissions. It will:
1. Request high-accuracy GPS location
2. Watch for location updates continuously
3. Fall back gracefully if permissions are denied

## 🎯 Key Implementation Details

### Distance Calculation

Uses Google Maps Geometry Library for maximum accuracy:

```typescript
const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(
  userLatLng,
  agentLatLng
)
```

This provides **meter-level accuracy** (e.g., 10m, 250m, 1.2km).

### Smooth Marker Animation

Markers smoothly interpolate between positions using `requestAnimationFrame`:

```typescript
const animateMarker = (marker, from, to) => {
  // Easing function (ease-out)
  const easeOut = 1 - Math.pow(1 - progress, 3)
  // Smooth position update
  marker.setPosition(new google.maps.LatLng(lat, lng))
}
```

### Real-Time Updates

- Fetches agents every **4 seconds**
- Updates distances in real-time
- Smoothly animates marker movements
- No jarring jumps or flickers

## 🔌 Integration with Real-Time Systems

### MongoDB Realtime

```typescript
// Example: Listen to MongoDB change streams
useEffect(() => {
  const stream = watchAgents((change) => {
    if (change.operationType === 'update') {
      // Update agent position
      setAgents(prev => prev.map(agent => 
        agent.id === change.documentKey._id 
          ? { ...agent, location: change.updateDescription.updatedFields.location }
          : agent
      ))
    }
  })
  
  return () => stream.close()
}, [])
```

### WebSockets

```typescript
// Example: WebSocket integration
useEffect(() => {
  const ws = new WebSocket('ws://your-server/agents')
  
  ws.onmessage = (event) => {
    const agentUpdate = JSON.parse(event.data)
    // Update agent position
    updateAgentPosition(agentUpdate)
  }
  
  return () => ws.close()
}, [])
```

## 🎨 Customization

### Marker Colors

Edit the `createAgentMarkerIcon` function:

```typescript
const color = isSelected ? "#22c55e" : "#f97316" // Green when selected, orange otherwise
```

### Update Interval

Change the update frequency:

```typescript
// In fetchAgents useEffect
const interval = setInterval(() => {
  fetchAgents()
}, 3000) // 3 seconds instead of 4
```

### Map Styling

Modify the `options` prop in the `GoogleMap` component:

```typescript
options={{
  styles: [
    // Your custom map styles
  ],
  // Other options
}}
```

## 📱 Mobile Support

- Fully responsive design
- Touch-friendly interactions
- Optimized for mobile browsers
- High-accuracy GPS on mobile devices

## 🐛 Troubleshooting

### Map Not Loading
- Check API key is set in `.env.local`
- Restart dev server after adding API key
- Verify APIs are enabled in Google Cloud Console

### Location Not Working
- Check browser location permissions
- Ensure HTTPS (required for geolocation)
- Check `ENABLE_MAXIMUM_LOCATION_ACCURACY.md` for accuracy tips

### Agents Not Showing
- Verify agents have valid `location` coordinates
- Check `/api/agents/nearby` endpoint is working
- Ensure agents have `isAvailable: true`

## 🚀 Next Steps

1. **Add to Navigation**: Link to `/dashboard/agent-tracking` in your dashboard menu
2. **Integrate with Withdrawal Flow**: Use this component in the agent selection step
3. **Add Real-Time Backend**: Connect to MongoDB Realtime or WebSockets
4. **Customize Styling**: Adjust colors, sizes, and animations to match your brand

## 📄 License

Same as the main project.

---

**Built with ❤️ for Pia Pesa Wallet**

