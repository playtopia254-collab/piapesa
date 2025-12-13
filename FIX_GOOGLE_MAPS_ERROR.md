# Fix "This page can't load Google Maps correctly" Error

## 🔍 Quick Diagnosis

Even with billing active, this error usually means one of these issues:

1. ❌ API key not in `.env.local` file
2. ❌ APIs not actually enabled (just having billing ≠ APIs enabled)
3. ❌ API key restrictions blocking localhost
4. ❌ Dev server not restarted after adding API key

---

## ✅ Step-by-Step Fix

### Step 1: Check if API Key is in `.env.local`

1. Open your project root folder
2. Look for `.env.local` file
3. If it doesn't exist, **create it**
4. Add this line (replace with YOUR actual API key):

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

**Important:**
- Must start with `NEXT_PUBLIC_`
- No spaces around `=`
- Save the file

---

### Step 2: Get Your API Key from Google Cloud

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your API key in the list
3. Click on it
4. **Copy the API key** (starts with `AIza...`)
5. Paste it into `.env.local` file

**If you don't have an API key:**
1. Click **"+ CREATE CREDENTIALS"** → **"API key"**
2. Copy the key that appears
3. Add it to `.env.local`

---

### Step 3: Verify APIs Are Actually Enabled

**This is the #1 most common issue!** Having billing ≠ APIs enabled.

Go to each link and click **"ENABLE"**:

1. **Maps JavaScript API** (MOST IMPORTANT!)
   - 🔗 https://console.cloud.google.com/apis/library/maps-javascript-api.googleapis.com
   - Click **"ENABLE"** button
   - Wait for confirmation

2. **Geocoding API**
   - 🔗 https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
   - Click **"ENABLE"**

3. **Directions API**
   - 🔗 https://console.cloud.google.com/apis/library/directions-backend.googleapis.com
   - Click **"ENABLE"**

4. **Distance Matrix API**
   - 🔗 https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com
   - Click **"ENABLE"**

**Verify they're enabled:**
- Go to: https://console.cloud.google.com/apis/dashboard
- All 4 should show as **"Enabled"** (not just listed)

---

### Step 4: Fix API Key Restrictions

If your API key has restrictions that block localhost:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your API key
3. Under **"Application restrictions"**:
   - If set to "HTTP referrers", make sure `http://localhost:3000/*` is added
   - **OR** temporarily set to **"None"** for testing
4. Under **"API restrictions"**:
   - Make sure all 4 APIs are checked, OR
   - Set to **"Don't restrict key"** for testing
5. Click **"SAVE"**

---

### Step 5: Restart Your Dev Server

**This is critical!** Next.js only loads `.env.local` on startup.

1. Stop your server: Press `Ctrl+C` in terminal
2. Start it again:

```bash
npm run dev
```

---

### Step 6: Clear Browser Cache

1. Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or open in Incognito/Private window

---

## 🔍 Debug: Check What's Wrong

### Method 1: Check Browser Console

1. Open your app: `http://localhost:3000`
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Look for error messages:

**Common errors:**
- `"Google Maps API key missing"` → API key not in `.env.local` or server not restarted
- `"RefererNotAllowedMapError"` → Add `http://localhost:3000/*` to API key restrictions
- `"InvalidKeyMapError"` → Wrong API key or key not active
- `"BillingNotEnabledMapError"` → Billing not linked to project

### Method 2: Check if API Key is Loaded

1. Open browser console (F12)
2. Type this in console:
```javascript
console.log(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
```

- If it shows `undefined` → API key not loaded (check `.env.local` and restart server)
- If it shows your key → API key is loaded, check API restrictions

### Method 3: Test API Key Directly

Open this URL in browser (replace `YOUR_API_KEY`):
```
https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY
```

- ✅ Loads without errors → API key is valid
- ❌ Shows error page → API key has issues

---

## ✅ Quick Checklist

Run through this checklist:

- [ ] `.env.local` file exists in project root
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...` is in `.env.local`
- [ ] API key copied from Google Cloud Console
- [ ] Maps JavaScript API → **ENABLED** (not just selected)
- [ ] Geocoding API → **ENABLED**
- [ ] Directions API → **ENABLED**
- [ ] Distance Matrix API → **ENABLED**
- [ ] API key restrictions allow `http://localhost:3000/*` OR set to "None"
- [ ] Dev server restarted after adding API key
- [ ] Browser cache cleared (`Ctrl+Shift+R`)

---

## 🚨 Most Common Issues

### Issue 1: "I have billing but APIs aren't enabled"
**Solution:** Go to each API link above and click "ENABLE". Having billing ≠ APIs enabled.

### Issue 2: "API key is in .env.local but not working"
**Solution:** 
- Check it starts with `NEXT_PUBLIC_`
- Restart dev server
- Check browser console for exact error

### Issue 3: "RefererNotAllowedMapError"
**Solution:** Add `http://localhost:3000/*` to API key restrictions OR set restrictions to "None"

### Issue 4: "InvalidKeyMapError"
**Solution:**
- Verify API key is correct
- Check API key is active in Google Cloud Console
- Make sure you're using the right project's API key

---

## 🎯 Still Not Working?

1. **Check browser console (F12)** for the exact error message
2. **Verify all 4 APIs are enabled** (not just in restrictions)
3. **Make sure billing is linked to the SAME project** as your API key
4. **Try creating a new API key** (sometimes keys get corrupted)

---

## 📞 Need More Help?

Share these details:
1. Error message from browser console (F12)
2. Whether `.env.local` exists and has the API key
3. Whether all 4 APIs show as "Enabled" in dashboard
4. Whether you restarted the dev server

---

## ✅ Success Indicators

When it's working, you should see:
- ✅ Interactive Google Maps (not error dialog)
- ✅ Agent markers on the map
- ✅ Your location marker
- ✅ No errors in browser console

Good luck! 🚀

