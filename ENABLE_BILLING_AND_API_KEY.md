# Enable Billing & Get Google Maps API Key - Complete Guide

## 🎯 Quick Overview

After adding billing to your Google Cloud project, you need to:
1. ✅ Link billing account to your project
2. ✅ Enable the 4 required APIs
3. ✅ Create/get your API key
4. ✅ Add API key to your project

---

## 📋 Step-by-Step Instructions

### Step 1: Link Billing Account to Your Project

1. Go to [Google Cloud Console - Billing](https://console.cloud.google.com/billing)
2. If you see "No billing account":
   - Click **"Link a billing account"**
   - If you don't have one, click **"Create billing account"**
   - Enter your payment information (credit card required)
   - **Note**: You won't be charged if you stay under $200/month free credit
3. Select your project from the dropdown
4. Click **"Set account"** or **"Link"**

✅ **Verification**: You should see your billing account linked to your project.

---

### Step 2: Enable Required APIs

You need to enable these 4 APIs (click each link and click "ENABLE"):

1. **Maps JavaScript API** (MOST IMPORTANT!)
   - 🔗 [Enable Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-javascript-api.googleapis.com)
   - Click **"ENABLE"** button
   - Wait for confirmation

2. **Geocoding API**
   - 🔗 [Enable Geocoding API](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com)
   - Click **"ENABLE"** button

3. **Directions API**
   - 🔗 [Enable Directions API](https://console.cloud.google.com/apis/library/directions-backend.googleapis.com)
   - Click **"ENABLE"** button

4. **Distance Matrix API**
   - 🔗 [Enable Distance Matrix API](https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com)
   - Click **"ENABLE"** button

✅ **Verification**: Go to [APIs Dashboard](https://console.cloud.google.com/apis/dashboard) - all 4 APIs should show as "Enabled"

---

### Step 3: Get Your API Key

#### Option A: Create a New API Key

1. Go to [Credentials Page](https://console.cloud.google.com/apis/credentials)
2. Click **"+ CREATE CREDENTIALS"** → **"API key"**
3. Your API key will be created and displayed
4. **Copy the API key** (you'll need it in Step 4)

#### Option B: Use Existing API Key

1. Go to [Credentials Page](https://console.cloud.google.com/apis/credentials)
2. Find your existing API key in the list
3. Click on it to view details
4. **Copy the API key**

---

### Step 4: Configure API Key (Recommended for Security)

1. Click on your API key to edit it
2. Under **"Application restrictions"**:
   - Select **"HTTP referrers (web sites)"**
   - Click **"Add an item"**
   - Add these referrers:
     - `http://localhost:3000/*`
     - `https://yourdomain.com/*` (replace with your actual domain)
3. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check these 4 APIs:
     - ✅ Maps JavaScript API
     - ✅ Geocoding API
     - ✅ Directions API
     - ✅ Distance Matrix API
4. Click **"SAVE"**

---

### Step 5: Add API Key to Your Project

1. Open your project's `.env.local` file (create it if it doesn't exist)
2. Add this line:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Replace `your_api_key_here` with your actual API key from Step 3**

Example:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCUye5Of2MtmvhnWrA96k3DDk9Rv6GnGAA
```

**Important**: 
- The `NEXT_PUBLIC_` prefix is **required** for Next.js
- No spaces around the `=` sign
- Save the file

---

### Step 6: Restart Your Development Server

1. Stop your current server (press `Ctrl+C` in terminal)
2. Start it again:

```bash
npm run dev
```

---

### Step 7: Test It Works

1. Open your app: `http://localhost:3000`
2. Navigate to a page with maps (e.g., withdrawal page)
3. You should see Google Maps loading properly
4. Check browser console (F12) - no errors should appear

---

## ✅ Verification Checklist

- [ ] Billing account linked to project
- [ ] Maps JavaScript API → **ENABLED**
- [ ] Geocoding API → **ENABLED**
- [ ] Directions API → **ENABLED**
- [ ] Distance Matrix API → **ENABLED**
- [ ] API key created/copied
- [ ] API key added to `.env.local` with `NEXT_PUBLIC_` prefix
- [ ] Dev server restarted
- [ ] Maps loading in browser

---

## 🔍 How to Verify Your API Key is Working

### Method 1: Check Browser Console
1. Open your app in browser
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Look for any Google Maps errors
5. If you see "Google Maps API key missing" → API key not in `.env.local`
6. If you see "RefererNotAllowedMapError" → Add `http://localhost:3000/*` to API key restrictions

### Method 2: Test API Key Directly
Open this URL in your browser (replace `YOUR_API_KEY` with your actual key):
```
https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY
```

- ✅ If it loads without errors → API key is valid
- ❌ If you see an error page → API key has issues

---

## 💰 Billing & Free Tier

**Good News**: Google Maps Platform offers:
- **$200 free credit per month**
- This covers approximately:
  - 28,000 map loads
  - 40,000 geocoding requests
  - 2,000 directions requests
  - 40,000 distance matrix requests

**For most small to medium apps, this is completely free!**

You'll only be charged if you exceed $200/month in usage.

---

## 🚨 Common Issues & Solutions

### Issue: "BillingNotEnabledMapError"
**Solution**: Make sure billing is linked to your project (Step 1)

### Issue: "RefererNotAllowedMapError"
**Solution**: Add `http://localhost:3000/*` to API key restrictions (Step 4)

### Issue: "InvalidKeyMapError"
**Solution**: 
- Check API key is correct in `.env.local`
- Make sure it has `NEXT_PUBLIC_` prefix
- Restart dev server

### Issue: "This API project is not authorized"
**Solution**: Enable all 4 APIs (Step 2)

### Issue: Maps not showing
**Solution**:
1. Check browser console for errors
2. Verify API key in `.env.local`
3. Make sure all APIs are enabled
4. Restart dev server
5. Clear browser cache (`Ctrl+Shift+R`)

---

## 📞 Need Help?

If you're still having issues:
1. Check browser console (F12) for specific error messages
2. Verify all steps in the checklist above
3. Make sure your API key is active in [Credentials Page](https://console.cloud.google.com/apis/credentials)

---

## 🎉 Success!

Once everything is set up, you should see:
- ✅ Interactive Google Maps
- ✅ Real-time agent location markers
- ✅ Route visualization (green lines)
- ✅ Address geocoding working
- ✅ Distance calculations working

Your Google Maps integration is now fully enabled! 🚀

