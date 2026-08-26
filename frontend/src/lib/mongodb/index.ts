import mongoose, { type Mongoose } from 'mongoose';

// Next.js hot reload and serverless invocations re-run modules, so the connection
// is cached on globalThis to avoid opening a new pool on every request.
type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis._mongooseCache ?? { conn: null, promise: null };
globalThis._mongooseCache = cached;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function createConnection(uri: string): Promise<Mongoose> {
  try {
    const instance = await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });

    const { host, name } = instance.connection;
    console.log(`${GREEN}✔ MongoDB Atlas connected${RESET} → ${host}/${name}`);

    return instance;
  } catch (error) {
    // Drop the cached promise so the next call retries instead of awaiting
    // this same rejected promise forever.
    cached.promise = null;

    const message = error instanceof Error ? error.message : String(error);
    console.error(`${RED}✖ MongoDB connection failed:${RESET} ${message}`);

    throw error;
  }
}

export async function connectDB(): Promise<Mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const message = 'MONGODB_URI is not set. Add it to .env.local';
    console.error(`${RED}✖ MongoDB config error:${RESET} ${message}`);
    throw new Error(message);
  }

  // Concurrent callers on a cold start share one in-flight attempt.
  if (!cached.promise) {
    cached.promise = createConnection(uri);
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    // createConnection already logged and reset the cache; just propagate
    // so the caller can decide how to respond.
    cached.conn = null;
    throw error;
  }
}

export default connectDB;
