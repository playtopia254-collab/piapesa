import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function GET() {
  try {
    // Test MongoDB connection
    const db = await getDb()
    
    // Try a simple operation instead of listing collections
    // This avoids potential SSL issues with admin commands
    const testCollection = db.collection('_test_connection')
    await testCollection.findOne({ _id: 'connection_test' })
    
    return NextResponse.json({
      success: true,
      message: "Database connection successful!",
      database: db.databaseName,
      connectionString: process.env.MONGODB_URI ? "Configured" : "Not configured",
    })
  } catch (error) {
    console.error("Database test error:", error)
    
    let errorMessage = "Unknown error"
    let errorDetails = ""
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack || ""
      
      // Provide helpful suggestions based on error type
      if (errorMessage.includes('SSL') || errorMessage.includes('TLS') || errorMessage.includes('tlsv1')) {
        errorDetails += "\n\nSSL/TLS Error Suggestions:\n"
        errorDetails += "1. Check your MongoDB Atlas IP whitelist\n"
        errorDetails += "2. Verify your connection string format\n"
        errorDetails += "3. Try updating Node.js to latest LTS version\n"
        errorDetails += "4. Check if firewall is blocking the connection"
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
        mongodbUri: process.env.MONGODB_URI ? "Set (hidden)" : "Not set",
        nodeVersion: process.version,
      },
      { status: 500 }
    )
  }
}

