# Pia Pesa Wallet - Setup Guide

## Quick Start

### 1. Environment Variables

Create a `.env.local` file in the root directory with the following:

```env
# Chambu Digital API Configuration
CHAMBU_API_KEY=sk_1765522848334_e6355626ebd64c469d2d61d049a907f7
CHAMBU_CLIENT_ID=CLIENT_1765522848334_86dd89a7
CHAMBU_MERCHANT_ID=MERCHANT_1765522848334_d38132

# MongoDB Connection (Required for real transactions)
MONGODB_URI=your_mongodb_connection_string_here

# Google Maps API (Required for Uber-like agent tracking)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCUye5Of2MtmvhnWrA96k3DDk9Rv6GnGAA
```

### 2. Chambu Digital API Credentials

Your API credentials are already configured:
- **API Key**: `sk_1765522848334_e6355626ebd64c469d2d61d049a907f7`
- **Client ID**: `CLIENT_1765522848334_86dd89a7`
- **Merchant ID**: `MERCHANT_1765522848334_d38132`

**Important**: 
- The API key is used for all payment API calls
- Client ID and Merchant ID are for reference and dashboard access at https://www.chambudigital.co.ke/dashboard

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Access the Application

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features Enabled

✅ **Real Money Transfers**: Send money between Pia Pesa users using Chambu Digital API
✅ **Balance Updates**: Real-time balance updates in MongoDB
✅ **Transaction Tracking**: All transactions recorded in database
✅ **Multi-Network Support**: M-Pesa, Airtel Money, T-Kash
✅ **Uber-Like Agent Tracking**: Google Maps with real-time agent location, routes, and car icons

### Google Maps API Key

Your Google Maps API key is configured:
- **API Key**: `AIzaSyCUye5Of2MtmvhnWrA96k3DDk9Rv6GnGAA`

**Important**: 
- Make sure you've enabled these 4 APIs in Google Cloud Console:
  - Maps JavaScript API
  - Geocoding API
  - Directions API
  - Distance Matrix API
- See `GOOGLE_MAPS_SETUP.md` for detailed setup instructions

## Testing

1. **Create Test Users**:
   - Sign up two users with different phone numbers
   - Note: Users must have real phone numbers for Chambu Digital to work

2. **Send Money**:
   - Login as User A
   - Go to `/dashboard/send`
   - Enter User B's phone number
   - Send money (minimum KES 10)
   - Check that balances update in real-time

3. **Check Transactions**:
   - View transaction history in `/dashboard/transactions`
   - See SasaPay transaction codes for completed transactions

## Support

For Chambu Digital API support:
- Dashboard: https://www.chambudigital.co.ke/dashboard
- Documentation: See `CHAMBU_INTEGRATION.md`

