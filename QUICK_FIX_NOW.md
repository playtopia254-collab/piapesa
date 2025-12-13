# 🚨 QUICK FIX - Google Maps Error (Billing Active But Still Error)

## The Problem

Even with billing active, you're seeing "This page can't load Google Maps correctly" because:

**Most likely:** The APIs are NOT actually enabled (just having billing ≠ APIs enabled)

---

## ⚡ 5-Minute Fix

### Step 1: Enable the APIs (DO THIS FIRST!)

Go to each link and click **"ENABLE"**:

1. **Maps JavaScript API** ⭐ MOST IMPORTANT
   - https://console.cloud.google.com/apis/library/maps-javascript-api.googleapis.com
   - Click **"ENABLE"**

2. **Geocoding API**
   - https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
   - Click **"ENABLE"**

3. **Directions API**
   - https://console.cloud.google.com/apis/library/directions-backend.googleapis.com
   - Click **"ENABLE"**

4. **Distance Matrix API**
   - https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com
   - Click **"ENABLE"**

**Verify:** Go to https://console.cloud.google.com/apis/dashboard
- All 4 should show as **"Enabled"** ✅

---

### Step 2: Get Your API Key

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your API key (or create one: "+ CREATE CREDENTIALS" → "API key")
3. **Copy the API key** (starts with `AIza...`)

---

### Step 3: Add API Key to Project

1. In your project root, create/edit `.env.local` file
2. Add this line (replace with YOUR key):

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

**Example:**
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCUye5Of2MtmvhnWrA96k3DDk9Rv6GnGAA
```

**Important:**
- Must start with `NEXT_PUBLIC_`
- No spaces around `=`
- Save the file

---

### Step 4: Fix API Key Restrictions

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your API key
3. Under **"Application restrictions"**:
   - Set to **"None"** (for testing) OR
   - Add `http://localhost:3000/*` if using HTTP referrers
4. Click **"SAVE"**

---

### Step 5: Restart Dev Server

**CRITICAL!** Next.js only loads `.env.local` on startup.

1. Stop server: `Ctrl+C`
2. Start again:
```bash
npm run dev
```

---

### Step 6: Clear Browser Cache

Press `Ctrl+Shift+R` (or open Incognito window)

---

## ✅ Check if It Works

1. Open: http://localhost:3000
2. Go to withdrawal page
3. Maps should load! ✅

If still error:
- Press `F12` → Console tab
- Share the error message

---

## 🎯 Most Common Issue

**"I have billing but APIs aren't enabled"**

**Solution:** Having billing ≠ APIs enabled. You MUST click "ENABLE" on each API individually (Step 1 above).

---

## 📋 Quick Checklist

- [ ] All 4 APIs show as "Enabled" in dashboard
- [ ] API key copied from Google Cloud
- [ ] API key added to `.env.local` with `NEXT_PUBLIC_` prefix
- [ ] API key restrictions allow localhost OR set to "None"
- [ ] Dev server restarted
- [ ] Browser cache cleared

---

That's it! Should work now! 🚀

