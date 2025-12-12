import axios from "axios"
import { getDb } from "./mongodb"

// Generate a random 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store OTP with expiration (59 seconds) in MongoDB
export async function storeOTP(phone: string, code: string): Promise<void> {
  try {
    const db = await getDb()
    const otpsCollection = db.collection("otps")
    
    const expiresAt = new Date(Date.now() + 59 * 1000) // 59 seconds from now
    
    // Store OTP in database (upsert to replace any existing OTP for this phone)
    await otpsCollection.updateOne(
      { phone: phone },
      {
        $set: {
          code: code,
          expiresAt: expiresAt,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
    
    console.log(`💾 OTP stored in DB for ${phone}: ${code} (expires at ${expiresAt.toISOString()})`)
    
    // Clean up expired OTPs in background (don't wait for it)
    otpsCollection.deleteMany({ expiresAt: { $lt: new Date() } }).catch(console.error)
  } catch (error) {
    console.error("Error storing OTP:", error)
    throw error
  }
}

// Verify OTP from MongoDB
export async function verifyOTP(phone: string, code: string): Promise<boolean> {
  try {
    console.log("=".repeat(80))
    console.log("🔍 OTP VERIFICATION DEBUG")
    console.log("=".repeat(80))
    console.log("Verifying with phone:", phone)
    console.log("Verifying with code:", code)
    
    const db = await getDb()
    const otpsCollection = db.collection("otps")
    
    // Try to find OTP with the phone number
    let stored = await otpsCollection.findOne({ phone: phone })
    
    // If not found, try alternative formats
    if (!stored) {
      const phoneWithoutPlus = phone.replace(/^\+/, "")
      stored = await otpsCollection.findOne({ phone: phoneWithoutPlus })
    }
    
    if (!stored) {
      const phone254 = phone.startsWith("+254") ? phone.slice(1) : phone
      stored = await otpsCollection.findOne({ phone: phone254 })
    }
    
    console.log("Stored OTP data:", stored ? { 
      code: stored.code, 
      expiresAt: stored.expiresAt?.toISOString(), 
      isExpired: stored.expiresAt ? new Date() > new Date(stored.expiresAt) : true 
    } : "NOT FOUND")
    
    if (!stored) {
      console.log("❌ OTP not found for phone:", phone)
      console.log("=".repeat(80))
      return false
    }
    
    // Check if expired
    if (stored.expiresAt && new Date() > new Date(stored.expiresAt)) {
      console.log("❌ OTP expired")
      await otpsCollection.deleteOne({ _id: stored._id })
      console.log("=".repeat(80))
      return false
    }
    
    // Verify code
    console.log("Comparing codes - Stored:", stored.code, "Provided:", code, "Match:", stored.code === code)
    if (stored.code === code) {
      console.log("✅ OTP verified successfully!")
      // Remove after successful verification
      await otpsCollection.deleteOne({ _id: stored._id })
      console.log("=".repeat(80))
      return true
    }
    
    console.log("❌ OTP code mismatch")
    console.log("=".repeat(80))
    return false
  } catch (error) {
    console.error("Error verifying OTP:", error)
    console.log("=".repeat(80))
    return false
  }
}

// Format phone number for SMS (remove + and ensure proper format)
function formatPhoneForSMS(phone: string): string {
  // Remove + and any spaces
  let formatted = phone.replace(/\+|\s/g, "")
  
  // If starts with 254, keep it
  // If starts with 0, replace with 254
  if (formatted.startsWith("0")) {
    formatted = "254" + formatted.slice(1)
  } else if (!formatted.startsWith("254")) {
    formatted = "254" + formatted
  }
  
  return formatted
}

// Send OTP via SMS using Zettatel
export async function sendOTPSMS(phone: string, otpCode: string): Promise<boolean> {
  try {
    const username = process.env.ZETTATEL_USERNAME
    const password = process.env.ZETTATEL_PASSWORD
    const senderId = process.env.ZETTATEL_SENDER_ID

    console.log("Zettatel credentials check:", {
      hasUsername: !!username,
      hasPassword: !!password,
      hasSenderId: !!senderId,
      username: username,
      senderId: senderId,
    })

    if (!username || !password || !senderId) {
      console.error("Zettatel credentials not configured. Please check your .env.local file.")
      console.error("Required: ZETTATEL_USERNAME, ZETTATEL_PASSWORD, ZETTATEL_SENDER_ID")
      return false
    }

    // Format phone number
    const formattedPhone = formatPhoneForSMS(phone)
    console.log(`Sending SMS to phone: ${phone} -> formatted: ${formattedPhone}`)

    // Zettatel API endpoint
    const zettatelApiUrl = "https://portal.zettatel.com/SMSApi/send"

    // Prepare SMS message
    const message = `Your Pia Pesa verification code is: ${otpCode}. This code expires in 59 seconds. Do not share this code with anyone.`

    // Build URL-encoded form data (as per Zettatel API documentation)
    // Note: API requires lowercase 'userid' not 'userId'
    const formData = new URLSearchParams({
      userid: username, // lowercase 'userid' as per API requirement
      password: password, // URL encoding handled by URLSearchParams
      sendMethod: "quick", // Required parameter
      mobile: formattedPhone,
      msg: message,
      senderid: senderId, // Note: senderid not sender
      msgType: "text",
      output: "json",
      duplicatecheck: "true",
    })

    console.log("Sending SMS request to Zettatel API...")
    console.log("Request data:", {
      userid: username,
      sendMethod: "quick",
      mobile: formattedPhone,
      senderid: senderId,
      msgType: "text",
      output: "json",
      messageLength: message.length,
    })

    // POST request with application/x-www-form-urlencoded content type
    const response = await axios.post(
      zettatelApiUrl,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "cache-control": "no-cache",
        },
        timeout: 30000, // 30 second timeout
      }
    )

    // Check response based on Zettatel API format
    if (response.data) {
      const responseData = typeof response.data === "string" ? JSON.parse(response.data) : response.data
      
      if (responseData.status === "success" || responseData.statusCode === "200") {
        console.log(`SMS OTP sent successfully to ${phone}`)
        console.log(`Transaction ID: ${responseData.transactionId || "N/A"}`)
        return true
      } else {
        console.error("Zettatel API error response:", JSON.stringify(responseData, null, 2))
        console.error(`Failed to send SMS to ${phone}. Status: ${responseData.status}, StatusCode: ${responseData.statusCode}, Reason: ${responseData.reason || "Unknown"}`)
        return false
      }
    } else {
      throw new Error("Invalid response from Zettatel API")
    }
  } catch (error) {
    console.error("=".repeat(50))
    console.error("ERROR sending SMS via Zettatel:")
    console.error("=".repeat(50))
    console.error("Error:", error)
    
    // Log detailed error information
    if (axios.isAxiosError(error)) {
      console.error("Response status:", error.response?.status)
      console.error("Response data:", JSON.stringify(error.response?.data, null, 2))
      console.error("Request URL:", error.config?.url)
      console.error("Request data:", error.config?.data)
    }
    console.error("=".repeat(50))
    
    // DO NOT return true - SMS failed, so return false
    return false
  }
}
