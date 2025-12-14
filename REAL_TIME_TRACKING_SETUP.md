# Real-Time Agent Tracking Setup (Bolt/Uber Style)

## ✅ What's Been Implemented

### 1. **Real-Time Location Updates**
- Agent location updates every **2.5 seconds** (smooth, like Bolt/Uber)
- Coordinates update in real-time as the agent moves
- Smooth marker movement without jumping

### 2. **Live ETA Calculation**
- Uses **Google Directions API** to calculate accurate ETA
- Shows estimated arrival time that updates as agent moves closer
- Displays in format: "5 min", "2h 15min", etc.

### 3. **Live Distance Updates**
- Real-time distance calculation between agent and customer
- Updates automatically as agent moves
- Shows in meters (m) or kilometers (km)

### 4. **Smooth Camera Following**
- Map smoothly pans to follow the agent as they move
- No jarring jumps or sudden movements
- Camera follows agent position smoothly

### 5. **Smooth Route Updates**
- Route recalculates smoothly when agent location changes
- Debounced updates to avoid too many API calls
- Green route line updates in real-time

### 6. **Enhanced Marker Animation**
- Car icon rotates based on agent's heading/direction
- Smooth position updates (no animation on real-time updates)
- Optimized for performance

---

## 🔧 Required Google Maps APIs

Make sure these APIs are **enabled** in your Google Cloud Console:

1. ✅ **Maps JavaScript API** (Required - for displaying the map)
2. ✅ **Directions API** (Required - for ETA and route calculation)
3. ✅ **Geocoding API** (Required - for address conversion)
4. ✅ **Distance Matrix API** (Optional - for distance calculations)

### How to Enable:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Library**
3. Search for each API name above
4. Click on it and click **"Enable"**
5. Wait a few seconds for activation

---

## 📱 How It Works

### For Customers (Tracking Agent):

1. **Agent Matched**: When an agent accepts the request
   - Map shows agent's location
   - ETA and distance start calculating
   - Updates every 2.5 seconds

2. **Agent Moving**: As the agent moves
   - Car icon moves smoothly on the map
   - ETA decreases in real-time
   - Distance updates automatically
   - Route recalculates smoothly
   - Camera follows the agent

3. **Agent Arriving**: When agent gets close
   - ETA shows "X min" or "X sec"
   - Distance shows in meters
   - Map zooms to show both locations

### For Agents (Updating Location):

Agents need to update their location regularly. This happens automatically if they have the agent dashboard open, or they can manually update via the `/api/agents/update-location` endpoint.

---

## 🎯 Key Features

### Smooth Movement
- **No jumping**: Markers move smoothly between positions
- **No flickering**: Optimized rendering
- **Real-time**: Updates every 2.5 seconds

### Live Information
- **ETA**: Shows estimated arrival time
- **Distance**: Shows distance to customer
- **Route**: Shows driving route with traffic

### Visual Feedback
- **Car Icon**: Rotates based on direction
- **Route Line**: Green line showing the path
- **User Marker**: Blue circle for customer location
- **Agent Marker**: Car icon for agent location

---

## 🔍 Technical Details

### Polling Frequency
- **Location Updates**: Every 2.5 seconds
- **Status Polling**: Every 3 seconds
- **Route Updates**: Debounced (500ms delay)

### API Endpoints Used
- `/api/agent-withdrawals/[requestId]/track-agent` - Gets agent location, distance, and ETA
- `/api/agents/update-location` - Updates agent's current location
- Google Directions API - Calculates route and ETA

### Performance Optimizations
- Debounced route updates
- Optimized marker rendering
- Smooth camera panning
- Efficient state updates

---

## 🚀 Testing

### To Test Real-Time Tracking:

1. **As Customer**:
   - Create a withdrawal request
   - Wait for agent to accept
   - Watch the map - agent should move smoothly
   - Check ETA and distance updates

2. **As Agent**:
   - Open agent dashboard
   - Accept a request
   - Move around (or simulate movement)
   - Customer should see your movement in real-time

### Expected Behavior:
- ✅ Agent marker moves smoothly (no jumping)
- ✅ ETA updates every 2.5 seconds
- ✅ Distance decreases as agent gets closer
- ✅ Route updates smoothly
- ✅ Camera follows agent movement
- ✅ Car icon rotates based on direction

---

## ⚠️ Important Notes

1. **API Quotas**: 
   - Directions API has usage limits
   - Free tier: $200/month credit
   - Monitor usage in Google Cloud Console

2. **Location Accuracy**:
   - Requires GPS permission on mobile devices
   - Better accuracy = smoother tracking
   - High accuracy mode recommended

3. **Network**:
   - Requires stable internet connection
   - Works on both WiFi and mobile data
   - Updates may be slower on slow connections

4. **Battery**:
   - Real-time tracking uses battery
   - Updates every 2.5 seconds
   - Consider reducing frequency if needed

---

## 🐛 Troubleshooting

### Agent Not Moving on Map:
- Check if agent is updating location via `/api/agents/update-location`
- Verify agent has GPS enabled
- Check browser console for errors

### ETA Not Updating:
- Verify Directions API is enabled
- Check API key has proper permissions
- Check network connection

### Map Not Following Agent:
- Ensure `showRoute` is enabled
- Check if `agentLocation` is updating
- Verify map is in tracking mode

### Jumpy Movement:
- Reduce polling frequency if needed
- Check network latency
- Verify location updates are smooth

---

## 📊 Performance Metrics

- **Update Frequency**: 2.5 seconds
- **Route Update Delay**: 500ms debounce
- **API Calls**: ~1 per 2.5 seconds (tracking) + route updates
- **Smoothness**: 60fps marker movement
- **Accuracy**: GPS-level precision

---

**Last Updated**: 2025-01-13

