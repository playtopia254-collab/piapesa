import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, pin, isAgent, location, idNumber, preferredNetworks } = body

    // Validation
    if (!name || !phone || !email || !pin) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (pin.length !== 4) {
      return NextResponse.json(
        { error: "PIN must be 4 digits" },
        { status: 400 }
      )
    }

    // Format phone number
    let formattedPhone = phone.trim()
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.slice(1)
    } else if (!formattedPhone.startsWith("+254")) {
      formattedPhone = "+254" + formattedPhone
    }

    // Connect to database
    let db
    try {
      db = await getDb()
    } catch (dbError) {
      console.error("Database connection error:", dbError)
      
      let errorMessage = "Database connection failed. Please check your MongoDB connection string."
      
      if (dbError instanceof Error) {
        // Provide more specific error messages
        if (dbError.message.includes("authentication failed")) {
          errorMessage = "MongoDB authentication failed. Please check your username and password."
        } else if (dbError.message.includes("ENOTFOUND") || dbError.message.includes("getaddrinfo")) {
          errorMessage = "Cannot reach MongoDB server. Please check your network connection and MongoDB Atlas IP whitelist."
        } else if (dbError.message.includes("timeout")) {
          errorMessage = "Connection timeout. Please check your MongoDB Atlas IP whitelist settings."
        } else {
          errorMessage = `Database error: ${dbError.message}`
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 503 }
      )
    }
    
    const usersCollection = db.collection("users")

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [
        { phone: formattedPhone },
        { email: email.toLowerCase() }
      ]
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this phone or email already exists" },
        { status: 409 }
      )
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10)

    // Create user object
    const newUser = {
      name,
      phone: formattedPhone,
      email: email.toLowerCase(),
      pin: hashedPin,
      balance: 0,
      isAgent: isAgent || false,
      location: isAgent ? location : undefined,
      idNumber: isAgent ? idNumber : undefined,
      preferredNetworks: isAgent ? preferredNetworks || [] : [],
      rating: isAgent ? 5.0 : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Insert user into database
    const result = await usersCollection.insertOne(newUser)

    // Return user data (without PIN)
    const userResponse = {
      id: result.insertedId.toString(),
      name: newUser.name,
      phone: newUser.phone,
      email: newUser.email,
      balance: newUser.balance,
      isAgent: newUser.isAgent,
      location: newUser.location,
      rating: newUser.rating,
      createdAt: newUser.createdAt,
    }

    return NextResponse.json(
      { user: userResponse, success: true },
      { status: 201 }
    )
  } catch (error) {
    console.error("Signup error:", error)
    
    // Provide more specific error messages
    let errorMessage = "Failed to create account. Please try again."
    
    if (error instanceof Error) {
      // Check for MongoDB connection errors
      if (error.message.includes("MongoServerError") || error.message.includes("MongoNetworkError")) {
        errorMessage = "Database connection failed. Please check your MongoDB connection."
      } else if (error.message.includes("MONGODB_URI")) {
        errorMessage = "Database configuration error. Please check your environment variables."
      } else {
        errorMessage = error.message || errorMessage
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

