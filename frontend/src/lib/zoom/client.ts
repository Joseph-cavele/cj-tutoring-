/**
 * Zoom Server-to-Server OAuth client.
 *
 * Server-only. ZOOM_CLIENT_SECRET must never reach the browser
 * (CLAUDE.md section 33), so nothing in this folder may be imported from a
 * client component.
 *
 * Zoom has no first-party Node SDK for S2S, so this wraps the REST API
 * directly rather than adding a dependency.
 */

const ZOOM_OAUTH = 'https://zoom.us/oauth/token';
const ZOOM_API = 'https://api.zoom.us/v2';

export class ZoomNotConfiguredError extends Error {
  constructor() {
    super('Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.');
    this.name = 'ZoomNotConfiguredError';
  }
}

type ZoomCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

function credentials(): ZoomCredentials | null {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  // Placeholder values from .env.example count as unconfigured.
  const usable = (value?: string) => Boolean(value && !value.startsWith('your_'));

  if (!usable(accountId) || !usable(clientId) || !usable(clientSecret)) return null;

  return {
    accountId: accountId as string,
    clientId: clientId as string,
    clientSecret: clientSecret as string,
  };
}

/** True when the platform can actually create meetings. */
export function isZoomConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Cached access token.
 *
 * Zoom's S2S tokens last an hour, and minting one per lesson would burn rate
 * limit for no reason. Cached on globalThis so Next's hot reload does not
 * reset it on every edit.
 */
type TokenCache = { token: string; expiresAt: number };

declare global {
  var _zoomTokenCache: TokenCache | undefined;
}

async function accessToken(): Promise<string> {
  const config = credentials();

  if (!config) throw new ZoomNotConfiguredError();

  const cached = globalThis._zoomTokenCache;

  // 60s of headroom, so a token cannot expire mid-request.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(
    `${ZOOM_OAUTH}?grant_type=account_credentials&account_id=${encodeURIComponent(config.accountId)}`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.reason ?? payload.message ?? 'Zoom would not issue a token');
  }

  globalThis._zoomTokenCache = {
    token: payload.access_token as string,
    expiresAt: Date.now() + (payload.expires_in as number) * 1000,
  };

  return payload.access_token as string;
}

export type CreatedMeeting = {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
  password?: string;
};

/**
 * Schedules a meeting.
 *
 * `startsAt` must be a real instant; it is sent as UTC and Zoom converts for
 * display, so the lesson's South African time has to be resolved to an
 * absolute time before it gets here.
 */
export async function createMeeting(params: {
  topic: string;
  startsAt: Date;
  durationMinutes: number;
  agenda?: string;
}): Promise<CreatedMeeting> {
  const token = await accessToken();

  const response = await fetch(`${ZOOM_API}/users/me/meetings`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      topic: params.topic,
      // 2 = a scheduled meeting.
      type: 2,
      start_time: params.startsAt.toISOString(),
      duration: params.durationMinutes,
      timezone: 'Africa/Johannesburg',
      agenda: params.agenda,
      settings: {
        join_before_host: false,
        // The tutor should let the student in, so nobody sits in an empty room
        // with a stranger before the lesson starts.
        waiting_room: true,
        mute_upon_entry: true,
        auto_recording: 'none',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.id) {
    throw new Error(payload.message ?? 'Zoom could not create the meeting');
  }

  return {
    meetingId: String(payload.id),
    joinUrl: payload.join_url as string,
    startUrl: payload.start_url as string,
    password: payload.password as string | undefined,
  };
}

/** Cancels a meeting. Failure is not fatal - the lesson is cancelled either way. */
export async function deleteMeeting(meetingId: string): Promise<void> {
  const token = await accessToken();

  await fetch(`${ZOOM_API}/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
}
