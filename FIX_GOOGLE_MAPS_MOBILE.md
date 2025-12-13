# Fix Google Maps on Mobile/Production

## Problem
Google Maps not displaying on mobile devices after hosting the application.

## Common Causes

1. **API Key Restrictions** - Most common issue
2. **Missing Environment Variables** in production
3. **HTTPS Requirement** - Google Maps requires HTTPS in production
4. **API Not Enabled** or billing not configured

---

## ✅ Solution Steps

### Step 1: Configure API Key for Production Domain

**This is the most important step!**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your API key
4. Under **"Application restrictions"**:
   - Select **"HTTP referrers (web sites)"**
   - Click **"Add an item"**
   - Add your production domain(s):
     ```
     https://yourdomain.com/*
     https://*.yourdomain.com/*
     ```
   - If using a subdomain:
     ```
     https://app.yourdomain.com/*
     https://*.app.yourdomain.com/*
     ```
   - **For mobile browsers**, also add:
     ```
     https://yourdomain.com/*
     http://localhost:3000/*  (for testing)
     ```
5. Click **"SAVE"**

**Important Notes:**
- Use `https://` (not `http://`) for production
- The `/*` at the end is required
- You can add multiple domains
- Changes take effect immediately (no need to wait)

---

### Step 2: Set Environment Variable in Production

**For Vercel:**
1. Go to your project dashboard
2. Click **Settings** → **Environment Variables**
3. Add:
   - **Name:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **Value:** Your Google Maps API key
   - **Environment:** Production, Preview, Development (select all)
4. Click **Save**
5. **Redeploy** your application

**For Netlify:**
1. Go to Site settings → **Environment variables**
2. Click **Add variable**
3. Add:
   - **Key:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **Value:** Your Google Maps API key
4. Click **Save**
5. **Redeploy** your site

**For Other Platforms:**
- Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to your hosting platform's environment variables
- Make sure it's available in production environment
- Redeploy after adding

---

### Step 3: Verify HTTPS is Enabled

Google Maps **requires HTTPS** in production. Make sure:

1. Your production site uses `https://` (not `http://`)
2. SSL certificate is valid and active
3. All requests are redirected from HTTP to HTTPS

**Check:**
- Visit your site: `https://yourdomain.com`
- Browser should show a lock icon (🔒)
- No "Not Secure" warnings

---

### Step 4: Enable Required APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Library**
3. Enable these 4 APIs (search for each and click "Enable"):
   - ✅ **Maps JavaScript API** (MOST IMPORTANT)
   - ✅ **Geocoding API**
   - ✅ **Directions API**
   - ✅ **Distance Matrix API**

---

### Step 5: Enable Billing

**Even for free tier, billing must be enabled!**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Billing**
3. Link a billing account
4. You won't be charged if you stay within $200/month free credit

---

### Step 6: Check API Key Restrictions

1. Go to **APIs & Services** → **Credentials**
2. Click your API key
3. Under **"API restrictions"**:
   - Either select **"Don't restrict key"** (for testing)
   - OR select **"Restrict key"** and check all 4 APIs:
     - Maps JavaScript API
     - Geocoding API
     - Directions API
     - Distance Matrix API
4. Click **"SAVE"**

---

## 🔍 Debugging on Mobile

### Check Browser Console

1. On your mobile device, open the app
2. Connect your phone to your computer via USB
3. Enable USB debugging (Android) or Safari Web Inspector (iOS)
4. Open Chrome DevTools (Android) or Safari Web Inspector (iOS)
5. Check the **Console** tab for errors

**Common Errors:**
- `RefererNotAllowedMapError` → Add your domain to API key restrictions
- `InvalidKeyMapError` → Check API key is correct
- `BillingNotEnabledMapError` → Enable billing
- `ApiNotActivatedMapError` → Enable Maps JavaScript API

### Test API Key Directly

Open this URL in your mobile browser (replace `YOUR_API_KEY`):
```
https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap
```

- If it loads → API key is valid
- If it shows an error → Check the error message

---

## 📱 Mobile-Specific Tips

1. **Clear Browser Cache:**
   - On mobile, clear browser cache and cookies
   - Or use incognito/private mode

2. **Test on Different Browsers:**
   - Chrome
   - Safari (iOS)
   - Firefox
   - Samsung Internet

3. **Check Network:**
   - Ensure mobile device has internet connection
   - Try on WiFi and mobile data

4. **Location Permissions:**
   - Make sure location permissions are granted
   - Maps need location to center properly

---

## ✅ Quick Checklist

- [ ] API key has production domain in HTTP referrer restrictions
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in hosting platform
- [ ] Application has been redeployed after adding env var
- [ ] Site uses HTTPS (not HTTP)
- [ ] All 4 APIs are enabled in Google Cloud Console
- [ ] Billing is enabled in Google Cloud Console
- [ ] API key restrictions allow the required APIs

---

## 🆘 Still Not Working?

1. **Check the error message** in browser console (see Debugging section)
2. **Verify API key is loading:**
   - The error message will show if API key is missing
   - Check hosting platform logs for environment variable issues
3. **Test API key restrictions:**
   - Temporarily set to "None" for testing
   - If it works, the issue is with restrictions
4. **Contact Support:**
   - Google Cloud Support: https://cloud.google.com/support
   - Your hosting platform support

---

## Example: Vercel Configuration

```bash
# In Vercel Dashboard → Settings → Environment Variables

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...your_key_here
```

**After adding:**
1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**

---

## Example: Google Cloud API Key Restrictions

**Application restrictions:**
```
HTTP referrers (web sites)

https://yourdomain.com/*
https://*.yourdomain.com/*
http://localhost:3000/*
```

**API restrictions:**
```
Restrict key

☑ Maps JavaScript API
☑ Geocoding API
☑ Directions API
☑ Distance Matrix API
```

---

**Last Updated:** 2025-01-13

