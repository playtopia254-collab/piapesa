# Google Maps Integration Setup

This guide will help you set up Google Maps for the Uber-like agent withdrawal experience.

## 🎯 Required APIs

You need to enable these APIs in Google Cloud Console:

1. **Maps JavaScript API** - For displaying the map
2. **Geocoding API** - For converting GPS to addresses
3. **Directions API** - For showing routes (Uber-style)
4. **Distance Matrix API** - For calculating ETAs and distances

## 📋 Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "Pia Pesa Wallet"
4. Click "Create"

### 2. Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable each API:
   - `Maps JavaScript API`
   - `Geocoding API`
   - `Directions API`
   - `Distance Matrix API`

### 3. Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Copy your API key
4. (Recommended) Click "Restrict Key" and:
   - Under "Application restrictions", select "HTTP referrers"
   - Add your domains:
     - `http://localhost:3000/*`
     - `https://yourdomain.com/*`
   - Under "API restrictions", select "Restrict key"
   - Select only the 4 APIs listed above
   - Click "Save"

### 4. Add API Key to Environment Variables

Add this to your `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Important**: The `NEXT_PUBLIC_` prefix is required for Next.js to expose it to the browser.

### 5. Restart Your Dev Server

```bash
npm run dev
```

## 💰 Pricing & Free Tier

Google Maps Platform offers:
- **$200 free credit per month**
- This covers approximately:
  - 28,000 map loads
  - 40,000 geocoding requests
  - 2,000 directions requests
  - 40,000 distance matrix requests

For most small to medium apps, this is **completely free**.

## ✅ Verification

After setup, you should see:
1. ✅ Interactive Google Maps instead of static maps
2. ✅ Real-time agent markers
3. ✅ Route visualization (green line from agent to user)
4. ✅ Car icon that moves with agent location
5. ✅ Address geocoding (GPS → readable address)

## 🚨 Troubleshooting

### "Error loading Google Maps"
- Check that your API key is correct
- Verify the API key is in `.env.local` with `NEXT_PUBLIC_` prefix
- Check that all 4 APIs are enabled
- Verify API key restrictions allow your domain

### "This API project is not authorized"
- Make sure all 4 APIs are enabled in Google Cloud Console
- Check API key restrictions

### Map not showing
- Check browser console for errors
- Verify API key is exposed (check Network tab for API calls)
- Ensure billing is enabled (even with free tier)

## 📱 Features Enabled

With Google Maps integration, you get:

1. **Interactive Maps** - Zoom, pan, full control
2. **Real-time Tracking** - See agent moving in real-time
3. **Route Visualization** - Green line showing agent's path
4. **Car Icon** - Animated car marker that rotates with direction
5. **Address Display** - "Your Location: Moi Avenue, Nairobi"
6. **ETA Calculation** - "Agent arriving in 3 minutes"
7. **Distance Sorting** - Agents sorted by closest first

## 🔒 Security Best Practices

1. **Restrict API Key** - Only allow your domains
2. **Limit APIs** - Only enable the 4 APIs you need
3. **Monitor Usage** - Set up billing alerts in Google Cloud
4. **Rotate Keys** - Change API key if compromised

## 📚 Additional Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)
- [API Status Dashboard](https://status.cloud.google.com/)

