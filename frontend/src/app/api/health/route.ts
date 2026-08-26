import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';

// Reads the session cookie and dials the database, so it must never be
// prerendered or cached - every call reports live state.
export const dynamic = 'force-dynamic';

type HealthResponse = {
  status: 'ok' | 'error';
  database: 'connected' | 'unavailable';
  // Only populated for admins; a signed-out probe gets status alone.
  detail?: {
    host: string;
    name: string;
    readyState: number;
    error?: string;
  };
};

/**
 * GET /api/health
 *
 * Confirms the MongoDB Atlas connection is live.
 *
 * Deliberately two-tier: anyone may learn whether the service is up, because
 * that is what an uptime probe needs, but hostnames, database names and driver
 * error strings are useful to an attacker mapping the deployment, so those are
 * shown only to an authenticated admin.
 */
export async function GET() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';

  try {
    const instance = await connectDB();
    const { host, name, readyState } = instance.connection;

    // connect() resolves once the driver picks a server; readyState confirms the
    // socket is actually usable rather than mid-handshake or already dropped.
    const healthy = readyState === mongoose.ConnectionStates.connected;

    const body: HealthResponse = {
      status: healthy ? 'ok' : 'error',
      database: healthy ? 'connected' : 'unavailable',
    };

    if (isAdmin) {
      body.detail = { host, name, readyState };
    }

    return NextResponse.json(body, { status: healthy ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Always log server-side; the connection string itself is never in the message.
    console.error('Health check failed:', message);

    const body: HealthResponse = { status: 'error', database: 'unavailable' };

    if (isAdmin) {
      body.detail = {
        host: '',
        name: '',
        readyState: mongoose.connection.readyState,
        error: message,
      };
    }

    return NextResponse.json(body, { status: 503 });
  }
}
