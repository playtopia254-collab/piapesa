# Chambu Digital Payment Integration

This application is integrated with Chambu Digital payment gateway for processing mobile money transactions.

## Setup

### 1. Environment Variables

Create a `.env.local` file in the root directory with your Chambu Digital API credentials:

```env
# Chambu Digital API Configuration
CHAMBU_API_KEY=sk_1765522848334_e6355626ebd64c469d2d61d049a907f7
CHAMBU_CLIENT_ID=CLIENT_1765522848334_86dd89a7
CHAMBU_MERCHANT_ID=MERCHANT_1765522848334_d38132
```

### 2. API Credentials

Your Chambu Digital credentials (already configured):
- **Client ID**: `CLIENT_1765522848334_86dd89a7`
- **Merchant ID**: `MERCHANT_1765522848334_d38132`
- **API Key**: `sk_1765522848334_e6355626ebd64c469d2d61d049a907f7`

**Note**: The API key is the only credential required for API calls. Client ID and Merchant ID are for reference and dashboard access.

## Features

### 1. Send Money (B2C)
- Send money from your account to customer mobile wallets
- Supports M-Pesa, Airtel Money, and T-Kash
- Real-time transaction status polling
- SasaPay transaction code tracking

**Endpoint**: `/api/payments/withdraw`

**Usage**: The send money page (`/dashboard/send`) automatically uses this API when sending money.

### 2. Collect Payments (C2B)
- Send STK Push requests to customers for payment collection
- Supports all major mobile money networks
- Automatic status polling

**Endpoint**: `/api/payments/initiate`

### 3. Transaction Status
- Check transaction status in real-time
- Poll for completion automatically
- Get SasaPay transaction codes

**Endpoints**:
- `/api/payments/status/[transactionId]` - Check status once
- `/api/payments/poll-status` - Poll until completion

## Network Codes

- **M-Pesa**: 63902
- **Airtel Money**: 63903
- **T-Kash**: 63907

## Transaction Fees

All transactions include a service fee:
- **Fee Structure**: 0.25% + KES 1.00
- Applied to all transactions

### Examples:
- KES 100 → Fee: KES 1.25 → Total: KES 101.25
- KES 1,000 → Fee: KES 3.50 → Total: KES 1,003.50
- KES 10,000 → Fee: KES 26.00 → Total: KES 10,026.00

## Transaction Limits

### Payment Collections (C2B)
- Minimum: KES 1
- Maximum: KES 250,000

### Money Transfers (B2C)
- Minimum: KES 10
- Maximum: KES 250,000

## API Client Library

The Chambu Digital API client is available in `lib/chambu-api.ts`:

```typescript
import { createChambuClient, getNetworkCode } from "@/lib/chambu-api"

// Create client
const chambu = createChambuClient()

// Send money
const response = await chambu.withdraw({
  phoneNumber: "254712345678",
  amount: 100,
  networkCode: getNetworkCode("M-Pesa"),
  reference: "ORDER_123",
  reason: "Payment"
})

// Check status
const status = await chambu.checkStatus(response.data.transactionId)

// Poll until completion
const finalStatus = await chambu.pollStatus(response.data.transactionId, {
  maxAttempts: 30,
  pollInterval: 10000
})
```

## Integration Points

### Send Money Page
- **Location**: `app/dashboard/send/page.tsx`
- **Functionality**: Uses Chambu Digital B2C API to send money
- **Features**: Real-time status polling, SasaPay code display

### Withdraw Page
- **Location**: `app/dashboard/withdraw/page.tsx`
- **Functionality**: Uses Chambu Digital B2C API for mobile money withdrawals
- **Features**: Status tracking, transaction details

## Error Handling

All API routes include comprehensive error handling:
- Validation of input parameters
- Network error handling
- Status code checking
- User-friendly error messages

## Security

- API keys are stored in environment variables
- Never expose API keys in client-side code
- All API requests use HTTPS
- API key is sent via `X-API-Key` header

## Testing

1. Ensure `.env.local` file exists with your API key
2. Test with small amounts first (minimum: KES 1 for collections, KES 10 for transfers)
3. Monitor transaction status in the dashboard
4. Check SasaPay transaction codes for completed transactions

## Support

For API documentation and support, visit:
- **Website**: https://www.chambudigital.co.ke
- **Dashboard**: https://www.chambudigital.co.ke/dashboard

## Notes

- STK Push requests expire after 60 seconds if not completed
- Poll the status endpoint every 10-30 seconds to check payment completion
- Official SasaPay transaction codes are available after successful completion
- Store transaction IDs and SasaPay codes for customer receipts and dispute resolution

