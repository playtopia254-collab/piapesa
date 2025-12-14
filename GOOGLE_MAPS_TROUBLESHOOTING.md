# Google Maps Error Troubleshooting

## Error: "This page can't load Google Maps correctly"

This error appears when Google Maps cannot authenticate or load. Follow these steps:

### ✅ Step 1: Verify API Key in `.env.local`

Make sure your `.env.local` file contains:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCUye5Of2MtmvhnWrA96k3DDk9Rv6GnGAA
```

**Important:**
- The key must start with `NEXT_PUBLIC_` (required for Next.js)
- No spaces around the `=` sign
- Restart your dev server after adding/updating the key

### ✅ Step 2: Enable Required APIs

Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Library**

Enable these 4 APIs:
1. ✅ **Maps JavaScript API** (MOST IMPORTANT - this is what shows the map)
2. ✅ **Geocoding API**
3. ✅ **Directions API**
4. ✅ **Distance Matrix API**

**How to enable:**
- Search for each API name
- Click on it
- Click "Enable" button
- Wait a few seconds for it to activate

### ✅ Step 3: Enable Billing (REQUIRED)

**Even for the free tier, billing must be enabled!**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Billing**
3. Link a billing account (you won't be charged if you stay within $200/month free credit)
4. If you don't have a billing account, create one (credit card required, but free tier applies)

### ✅ Step 4: Check API Key Restrictions

If your API key has restrictions:

1. Go to **APIs & Services** → **Credentials**
2. Click on your API key
3. Under **Application restrictions**:
   - If set to "HTTP referrers", make sure `http://localhost:3000/*` is added
   - Or temporarily set to "None" for testing
4. Under **API restrictions**:
   - Make sure all 4 APIs are allowed, OR
   - Set to "Don't restrict key" for testing

### ✅ Step 5: Verify API Key is Active

1. Go to **APIs & Services** → **Credentials**
2. Check that your API key shows as "Active"
3. If it shows any warnings, click to see details

### ✅ Step 6: Check Browser Console

Open browser DevTools (F12) → Console tab

Look for errors like:
- `Google Maps JavaScript API error: RefererNotAllowedMapError` → API key restriction issue
- `Google Maps JavaScript API error: ApiNotActivatedMapError` → API not enabled
- `Google Maps JavaScript API error: InvalidKeyMapError` → Wrong API key

### ✅ Step 7: Test API Key Directly

Test your API key in browser:
```
https://maps.googleapis.com/maps/api/js?key=AIzaSyCUye5Of2MtmvhnWrA96k3DDk9Rv6GnGAA
```

If you see an error page, the API key has issues.

## Quick Checklist

- [ ] API key added to `.env.local` with `NEXT_PUBLIC_` prefix
- [ ] Dev server restarted after adding key
- [ ] Maps JavaScript API enabled
- [ ] Geocoding API enabled
- [ ] Directions API enabled
- [ ] Distance Matrix API enabled
- [ ] Billing enabled in Google Cloud
- [ ] API key restrictions allow `http://localhost:3000/*` (if restricted)
- [ ] No errors in browser console

## Still Not Working?

1. **Check the exact error message** in browser console
2. **Verify API key** in Google Cloud Console → Credentials
3. **Try creating a new API key** (sometimes keys get corrupted)
4. **Check Google Cloud status**: https://status.cloud.google.com/

## Common Error Messages

| Error | Solution |
|-------|----------|
| `RefererNotAllowedMapError` | Add `http://localhost:3000/*` to API key restrictions |
| `ApiNotActivatedMapError` | Enable Maps JavaScript API |
| `InvalidKeyMapError` | Check API key is correct in `.env.local` |
| `BillingNotEnabledMapError` | Enable billing in Google Cloud Console |

## Need Help?

1. Check browser console for specific error
2. Verify all 4 APIs are enabled
3. Make sure billing is enabled
4. Try creating a new API key if issues persist

