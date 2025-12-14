# Quick Fix for Google Maps Error

## ✅ Your API Key Configuration Looks Good!

I can see your API key has:
- ✅ Application restrictions: None (allows localhost)
- ✅ API restrictions: 32 APIs selected (including the 4 we need)

## 🔴 But You Still Need to ENABLE the APIs!

**Having APIs in the restriction list ≠ APIs are enabled!**

### Step 1: Enable Each API Individually

Go to each of these links and click "ENABLE":

1. **Maps JavaScript API** (MOST IMPORTANT!)
   - https://console.cloud.google.com/apis/library/maps-javascript-api.googleapis.com
   - Click "ENABLE" button
   - Wait for confirmation

2. **Geocoding API**
   - https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
   - Click "ENABLE" button

3. **Directions API**
   - https://console.cloud.google.com/apis/library/directions-backend.googleapis.com
   - Click "ENABLE" button

4. **Distance Matrix API**
   - https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com
   - Click "ENABLE" button

### Step 2: Enable Billing (REQUIRED!)

Even with free tier, billing MUST be enabled:

1. Go to: https://console.cloud.google.com/billing
2. If you see "No billing account", click "Link a billing account"
3. Create a billing account (credit card required, but you won't be charged if you stay under $200/month)
4. Link it to your project

### Step 3: Verify APIs Are Enabled

1. Go to: https://console.cloud.google.com/apis/dashboard
2. You should see all 4 APIs listed as "Enabled"
3. If any show "Enable API", click it

### Step 4: Restart Your Dev Server

After enabling APIs and billing:

```bash
# Stop server (Ctrl+C)
npm run dev
```

### Step 5: Refresh Browser

Clear cache and refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

## 🎯 Quick Checklist

- [ ] Maps JavaScript API → ENABLED (not just selected)
- [ ] Geocoding API → ENABLED
- [ ] Directions API → ENABLED
- [ ] Distance Matrix API → ENABLED
- [ ] Billing account → LINKED to project
- [ ] Dev server → RESTARTED
- [ ] Browser → REFRESHED

## ⚠️ Common Mistake

**Selecting APIs in key restrictions ≠ Enabling APIs in the project**

You need to do BOTH:
1. ✅ Enable APIs in the project (APIs & Services → Library)
2. ✅ Select APIs in key restrictions (APIs & Services → Credentials)

## Still Not Working?

Check browser console (F12) for the exact error message and share it with me.

