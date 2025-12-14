import nodemailer from "nodemailer"

// Generate a random 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map<string, { code: string; expiresAt: number }>()

// Store OTP with expiration (5 minutes)
export function storeOTP(email: string, code: string): void {
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  otpStore.set(email.toLowerCase(), { code, expiresAt })
  
  // Clean up expired OTPs
  setTimeout(() => {
    otpStore.delete(email.toLowerCase())
  }, 5 * 60 * 1000)
}

// Verify OTP
export function verifyOTP(email: string, code: string): boolean {
  const stored = otpStore.get(email.toLowerCase())
  if (!stored) return false
  
  // Check if expired
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase())
    return false
  }
  
  // Verify code
  if (stored.code === code) {
    otpStore.delete(email.toLowerCase()) // Remove after successful verification
    return true
  }
  
  return false
}

// Create email transporter
function createTransporter() {
  // For development, you can use Gmail or any SMTP service
  // In production, use a service like SendGrid, Resend, or AWS SES
  
  // Option 1: Gmail (for development/testing)
  if (process.env.EMAIL_SERVICE === "gmail" && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail (NOT regular password)
        },
      })
    } catch (error) {
      console.error("Failed to create Gmail transporter:", error)
      // Fall through to console transport
    }
  }
  
  // Option 2: Custom SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }
  
  // Option 3: Development - Console only (for testing without real email)
  // This will log emails to console instead of sending
  console.warn("Email not configured. Using console transport for development.")
  console.warn("To enable real email sending, configure EMAIL_SERVICE and EMAIL_USER in .env.local")
  return nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  })
}

// Send OTP email
export async function sendOTPEmail(email: string, otpCode: string): Promise<boolean> {
  try {
    const transporter = createTransporter()
    
    // Check if we're using console transport (development mode)
    const isConsoleTransport = !process.env.EMAIL_USER && !process.env.SMTP_USER
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || "Pia Pesa <noreply@piapesa.com>",
      to: email,
      subject: "Your Pia Pesa Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Pia Pesa</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Cash Anytime, Anywhere</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            <p>Thank you for signing up for Pia Pesa! Please use the verification code below to complete your registration:</p>
            
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 0;">${otpCode}</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Pia Pesa. All rights reserved.<br>
              This is an automated message, please do not reply.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Pia Pesa - Email Verification
        
        Thank you for signing up! Your verification code is:
        
        ${otpCode}
        
        This code will expire in 5 minutes.
        
        If you didn't request this code, please ignore this email.
      `,
    }
    
    const info = await transporter.sendMail(mailOptions)
    
    // In development with console transport, log the email
    if (isConsoleTransport || (process.env.NODE_ENV === "development" && !process.env.EMAIL_USER)) {
      console.log("=".repeat(50))
      console.log("OTP Email (Development Mode):")
      console.log(`To: ${email}`)
      console.log(`OTP Code: ${otpCode}`)
      console.log("=".repeat(50))
    }
    
    return true
  } catch (error) {
    console.error("Error sending OTP email:", error)
    
    // Provide more specific error information
    if (error instanceof Error) {
      if (error.message.includes("Invalid login") || error.message.includes("authentication failed")) {
        console.error("Gmail authentication failed. Please use an App Password, not your regular password.")
        console.error("See: https://support.google.com/accounts/answer/185833")
      } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
        console.error("Cannot reach email server. Check your network connection.")
      } else {
        console.error("Email error details:", error.message)
      }
    }
    
    // In development, still return true if console transport is used
    // This allows the app to continue even if email fails
    if (process.env.NODE_ENV === "development") {
      console.warn("Email sending failed, but continuing in development mode")
      console.log(`OTP Code for ${email}: ${otpCode}`)
      return true // Return true in dev mode so app can continue
    }
    
    return false
  }
}

