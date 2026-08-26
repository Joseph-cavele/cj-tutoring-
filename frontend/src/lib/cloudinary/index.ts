import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary, server-only.
 *
 * CLOUDINARY_API_SECRET must never reach the browser (CLAUDE.md section 33),
 * so nothing in this folder may be imported from a client component. The
 * browser uploads directly to Cloudinary using a signature minted here, which
 * means large files never pass through our server - but it also means the
 * browser chooses what to tell us afterwards, so `getResource` exists to check
 * that claim.
 */

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
    this.name = 'CloudinaryNotConfiguredError';
  }
}

/** Where every study material lives, so uploads cannot be scattered. */
export const MATERIALS_FOLDER = 'cj-tutoring/materials';

/** 20 MB. Enough for a scanned past paper, small enough to stay usable on data. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function readConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const usable = (value?: string) => Boolean(value && !value.startsWith('your_'));

  if (!usable(cloudName) || !usable(apiKey) || !usable(apiSecret)) return null;

  return {
    cloudName: cloudName as string,
    apiKey: apiKey as string,
    apiSecret: apiSecret as string,
  };
}

export function isCloudinaryConfigured(): boolean {
  return readConfig() !== null;
}

function configured(): CloudinaryConfig {
  const config = readConfig();

  if (!config) throw new CloudinaryNotConfiguredError();

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  return config;
}

export type UploadSignature = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
  maxBytes: number;
};

/**
 * Mints a short-lived signature for one direct upload.
 *
 * Only `folder` and `timestamp` are signed, and both are chosen here rather
 * than by the caller - so a signature cannot be reused to write somewhere
 * else in the account. Cloudinary rejects a signature older than an hour.
 */
export function signUpload(): UploadSignature {
  const config = configured();
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { folder: MATERIALS_FOLDER, timestamp },
    config.apiSecret
  );

  return {
    timestamp,
    signature,
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    folder: MATERIALS_FOLDER,
    // `auto` lets Cloudinary classify PDFs, images and video itself.
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
    maxBytes: MAX_UPLOAD_BYTES,
  };
}

export type CloudinaryResource = {
  publicId: string;
  url: string;
  bytes: number;
  format: string;
  resourceType: string;
};

/**
 * Confirms a file really exists, and really is ours.
 *
 * The browser reports what it uploaded, and the browser can be told to report
 * anything - a URL on someone else's account, or a file that was never
 * uploaded at all. This asks Cloudinary directly and rejects anything outside
 * our own materials folder, so what gets stored is a fact rather than a claim.
 */
export async function getResource(
  publicId: string,
  resourceType: string
): Promise<CloudinaryResource | null> {
  configured();

  // The folder check is what stops a caller pointing us at an unrelated asset.
  if (!publicId.startsWith(`${MATERIALS_FOLDER}/`)) return null;

  const type = ['image', 'video', 'raw'].includes(resourceType) ? resourceType : 'image';

  try {
    const resource = await cloudinary.api.resource(publicId, { resource_type: type });

    return {
      publicId: resource.public_id as string,
      url: resource.secure_url as string,
      bytes: (resource.bytes as number) ?? 0,
      format: (resource.format as string) ?? '',
      resourceType: (resource.resource_type as string) ?? type,
    };
  } catch {
    // Not found, or not readable with our credentials. Either way, not ours.
    return null;
  }
}

/** Removes the stored file. Best effort - a failure must not block the record. */
export async function destroyResource(publicId: string, resourceType: string) {
  configured();

  const type = ['image', 'video', 'raw'].includes(resourceType) ? resourceType : 'image';

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: type });
  } catch (error) {
    console.error('[cloudinary] could not delete', publicId, error);
  }
}
