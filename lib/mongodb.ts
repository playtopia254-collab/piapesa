import { MongoClient, Db } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local')
}

// Get connection string and ensure proper format
let uri: string = process.env.MONGODB_URI.trim()

// For Node.js v22 SSL compatibility, ensure database name is in the connection string
// and remove appName if it's causing issues
if (!uri.includes('/piapesa') && !uri.includes('/?') && !uri.includes('&')) {
  // Add database name before query parameters
  if (uri.includes('?')) {
    uri = uri.replace('?', '/piapesa?')
  } else {
    uri = uri + '/piapesa'
  }
}

// Remove appName parameter as it can cause SSL issues with Node.js v22
uri = uri.replace(/[?&]appName=[^&]*/g, '')

// Add essential parameters
const separator = uri.includes('?') ? '&' : '?'
uri = `${uri}${separator}retryWrites=true&w=majority`

console.log('MongoDB URI configured (database name included)')

// Minimal connection options - let MongoDB driver handle TLS from connection string
const options: any = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    try {
      client = new MongoClient(uri, options)
      globalWithMongo._mongoClientPromise = client.connect().catch((err) => {
        // Clear the promise on error so we can retry
        globalWithMongo._mongoClientPromise = undefined
        console.error("MongoDB connection failed, clearing cache:", err)
        throw err
      })
    } catch (err) {
      console.error("Failed to create MongoClient:", err)
      throw err
    }
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromise
    // Get database - connection string already includes database name
    // If database name wasn't in URI, use 'piapesa' as fallback
    const dbName = uri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || 'piapesa'
    return client.db(dbName)
  } catch (error) {
    console.error("MongoDB getDb error:", error)
    throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
