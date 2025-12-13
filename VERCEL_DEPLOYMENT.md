# 🚀 Vercel Deployment Checklist (Premium Edition)

## 🎯 Google APIs to Enable (Premium Features)

Enable these APIs in [Google Cloud Console](https://console.cloud.google.com/apis/library):

### Core APIs (Required)
1. ✅ **Maps JavaScript API** - Interactive maps
2. ✅ **Geocoding API** - Address ↔ coordinates
3. ✅ **Directions API** - Route calculation
4. ✅ **Distance Matrix API** - Multi-destination ETA
5. ✅ **Geolocation API** - Enhanced location accuracy

### Premium APIs (Recommended)
6. ✅ **Places API (New)** - Address autocomplete
7. ✅ **Roads API** - Snap-to-roads for smooth tracking
8. ✅ **Street View Static API** - Location verification

### AI/ML APIs (Optional - Future)
9. ⬜ **Cloud Vision API** - ID verification
10. ⬜ **Cloud Text-to-Speech API** - Voice navigation

---

## ✅ Environment Variables (CRITICAL)

**Set these in Vercel Dashboard → Settings → Environment Variables:**

### Required Variables:

1. **MongoDB Connection String**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   ```
   - Environment: Production, Preview, Development (select all)

2. **Google Maps API Key**
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...your_key_here
   ```
   - Environment: Production, Preview, Development (select all)
   - ⚠️ **MUST start with `NEXT_PUBLIC_`** for client-side access

3. **SMS Service (if using)**
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```
   - Environment: Production, Preview, Development (select all)

### How to Add in Vercel:

1. Go to your project in Vercel Dashboard
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Enter **Name** and **Value**
5. Select environments (Production, Preview, Development)
6. Click **Save**
7. **Redeploy** your application

---

## 🔐 Google Maps API Key Setup for Vercel

### Step 1: Add Your Vercel Domain to API Key Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your API key
4. Under **"Application restrictions"**:
   - Select **"HTTP referrers (web sites)"**
   - Add your Vercel domain(s):
     ```
     https://your-app.vercel.app/*
     https://*.vercel.app/*
     ```
   - If you have a custom domain:
     ```
     https://yourdomain.com/*
     https://*.yourdomain.com/*
     ```
5. Click **SAVE**

### Step 2: Enable Required APIs

Make sure these are enabled:
- ✅ Maps JavaScript API
- ✅ Geocoding API
- ✅ Directions API
- ✅ Distance Matrix API

---

## 📱 GPS Accuracy Feature (Client-Side Only)

**✅ Good News:** The GPS accuracy check is **100% client-side** using `navigator.geolocation`, so it works perfectly on Vercel!

- No server-side geolocation calls
- Works in browser on any device
- No special Vercel configuration needed

---

## 🔄 After Adding Environment Variables

**IMPORTANT:** You must redeploy after adding/changing environment variables:

1. Go to **Deployments** tab in Vercel
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

**OR** push a new commit to trigger automatic deployment.

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Environment variables are set in Vercel Dashboard
- [ ] Google Maps API key is added with `NEXT_PUBLIC_` prefix
- [ ] Vercel domain is added to Google Cloud API key restrictions
- [ ] All 4 Google Maps APIs are enabled
- [ ] Application has been redeployed after adding env vars
- [ ] GPS accuracy check works (client-side, no server config needed)

---

## 🐛 Common Issues

### Issue: "Google Maps API Key Missing"
**Solution:** 
- Check environment variable is named `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Verify it's set for Production environment
- Redeploy after adding

### Issue: "RefererNotAllowedMapError"
**Solution:**
- Add your Vercel domain to Google Cloud API key restrictions
- Format: `https://your-app.vercel.app/*`

### Issue: GPS accuracy not working
**Solution:**
- This is client-side only - no server config needed
- Ensure browser has location permissions
- Check HTTPS is enabled (Vercel provides this automatically)

---

## 📝 Quick Reference

**Vercel Dashboard:**
- Settings → Environment Variables: Add env vars
- Deployments: Redeploy after changes

**Google Cloud Console:**
- APIs & Services → Credentials: Manage API keys
- APIs & Services → Library: Enable APIs

---

**Last Updated:** 2025-01-13

