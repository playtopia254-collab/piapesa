# Pia Pesa - Peer-to-Peer Digital Wallet Demo

**⚠️ IMPORTANT: This is a NON-PRODUCTION DEMO application for UI/UX presentation and copyright submission purposes only. NO REAL MONEY MOVEMENTS occur - all transactions are simulated client-side.**

## Overview

Pia Pesa (meaning "Give Money" in Swahili) is a demo mobile wallet application that simulates multi-network money movement across Kenya's popular payment systems including M-Pesa, Airtel Money, and Bank transfers. The app demonstrates peer-to-peer payments, agent-based cash withdrawals, and cross-network transactions using mock Kenyan data.

## Features

### Core Functionality
- **Multi-Network Support**: M-Pesa, Airtel Money, Bank transfers
- **Peer-to-Peer Payments**: Send money to any phone number
- **Agent Network**: Find and match with nearby cash agents
- **Withdrawal System**: Request cash withdrawals via agents or bank deposits
- **Transaction History**: Complete transaction tracking and receipts
- **Agent Dashboard**: Separate interface for agents to manage requests

### User Flows
- Landing page with brand messaging and CTAs
- Phone number + PIN authentication with SMS simulation
- User dashboard with balance and quick actions
- Send money with network selection and purpose
- Withdrawal requests with agent matching
- Agent signup and management system
- Transaction history with filtering
- Support system with FAQ and dispute handling
- Account settings with profile management

## Technology Stack

- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom Kenyan fintech theme
- **UI Components**: shadcn/ui component library
- **Data**: Client-side mock data (JSON)
- **Deployment**: Vercel-ready static build

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Chambu Digital API key (for payment processing)

### Installation

1. Clone or download the project
\`\`\`bash
git clone <repository-url>
cd pia-pesa
\`\`\`

2. Install dependencies
\`\`\`bash
npm install
# or
yarn install
\`\`\`

3. Set up environment variables
   
   Create a `.env.local` file in the root directory:
   \`\`\`env
   # Chambu Digital API Configuration
   CHAMBU_API_KEY=sk_1765522848334_e6355626ebd64c469d2d61d049a907f7
   CHAMBU_CLIENT_ID=CLIENT_1765522848334_86dd89a7
   CHAMBU_MERCHANT_ID=MERCHANT_1765522848334_d38132
   
   # MongoDB Connection (Required for real transactions)
   MONGODB_URI=your_mongodb_connection_string_here
   \`\`\`
   
   **Your Chambu Digital Credentials (Already Configured):**
   - **API Key**: `sk_1765522848334_e6355626ebd64c469d2d61d049a907f7` ✅
   - **Client ID**: `CLIENT_1765522848334_86dd89a7`
   - **Merchant ID**: `MERCHANT_1765522848334_d38132`
   
   **Note**: The API key is automatically used by the application. Client ID and Merchant ID are for reference.

4. Run the development server
\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Payment Integration

This application is integrated with **Chambu Digital** payment gateway for real mobile money transactions:

- **Send Money (B2C)**: Send money to any mobile wallet (M-Pesa, Airtel Money, T-Kash)
- **Collect Payments (C2B)**: Initiate STK Push requests for payment collection
- **Transaction Status**: Real-time status tracking with SasaPay transaction codes

See `CHAMBU_INTEGRATION.md` for detailed integration documentation.

### Demo Credentials

Use these test accounts to explore the app:

**Regular User:**
- Phone: +254712345678 (or 0712345678)
- PIN: 1234
- Balance: KES 15,750.50

**Agent User:**
- Phone: +254723456789 (or 0723456789) 
- PIN: 5678
- Balance: KES 8,920.00
- Location: Nairobi CBD

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Deploy with one click - no additional configuration needed

### Manual Deployment

\`\`\`bash
npm run build
npm run start
\`\`\`

## Mock Data Structure

The app uses `data/mock-data.json` containing:
- Sample users with Kenyan phone numbers
- Mock agents in major Kenyan cities
- Transaction history with various statuses
- Network configurations (M-Pesa, Airtel Money, Bank)

## Replacing with Real Backend

To convert this demo to a production app:

1. **Replace Mock API** (`lib/mock-api.ts`):
   - Replace with real REST API or GraphQL endpoints
   - Add proper authentication (JWT, OAuth)
   - Implement real payment gateway integrations

2. **Add Real Database**:
   - Replace JSON mock data with PostgreSQL/MongoDB
   - Implement proper user management
   - Add transaction logging and audit trails

3. **Security Enhancements**:
   - Add proper PIN/password hashing
   - Implement 2FA with real SMS/OTP
   - Add rate limiting and fraud detection
   - Secure API endpoints with proper validation

4. **Payment Integration**:
   - ✅ **Chambu Digital API** - Already integrated for M-Pesa, Airtel Money, and T-Kash
   - See `CHAMBU_INTEGRATION.md` for details
   - Connect to banking APIs for transfers (if needed)
   - Implement proper webhook handling for real-time updates

5. **Production Features**:
   - Add real-time notifications
   - Implement proper error handling
   - Add monitoring and analytics
   - Set up proper logging

## File Structure

\`\`\`
pia-pesa/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication pages
│   ├── dashboard/         # User dashboard pages
│   ├── globals.css        # Global styles with Kenyan theme
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
├── data/                  # Mock data files
├── lib/                   # Utilities and mock API
└── README.md             # This file
\`\`\`

## Demo Limitations

- All transactions are simulated client-side
- No real money movements or account debits
- SMS verification accepts any 4-6 digit code
- Agent locations are static mock data
- No real-time updates or push notifications
- Balance updates are temporary (reset on refresh)

## License & Copyright

See `LICENSE` and `COPYRIGHT.md` files for demo ownership and usage rights.

## Support

This is a demo application. For questions about implementation or customization, please refer to the code comments and documentation.

---

**Disclaimer**: This application is for demonstration purposes only. Do not use for actual financial transactions. Always comply with local financial regulations when building production fintech applications.
