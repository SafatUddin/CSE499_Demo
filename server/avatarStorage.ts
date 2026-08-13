/**
 * Avatar storage for merchant profile pictures, backed by Supabase Storage (object
 * storage) rather than local disk — local disk on Railway gets wiped on every
 * redeploy, silently breaking every merchant's avatar URL.
 *
 * Stores files at:  avatars/{merchantId}/{uuid}.{ext}  (bucket: "avatars", public)
 * Public URL:        {SUPABASE_URL}/storage/v1/object/public/avatars/{merchantId}/{uuid}.{ext}
 *
 * Security notes:
 * - Filenames are random UUIDs; never derived from user input.
 * - Objects are scoped per-merchant by path prefix.
 * - Only JPEG, PNG, WebP, and GIF are accepted; verified by magic bytes, not just MIME header.
 * - Files above MAX_AVATAR_BYTES are rejected before uploading.
 * - On avatar replace / remove, the old Supabase object is deleted (external HTTPS URLs, e.g.
 *   from Google sign-in, are never touched).
 */

import crypto from 'crypto';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const BUCKET = 'avatars';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  }
  return createClient(url, key);
}

/** Public URL prefix for objects in the avatars bucket. */
function publicUrlPrefix(): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
}

/** Regex a stored avatar URL must match (no path traversal, scoped to our own bucket). */
function avatarPathRegex(): RegExp {
  const prefix = publicUrlPrefix().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${prefix}[a-z0-9_-]+/[a-z0-9_-]+\\.[a-z]+$`, 'i');
}

export function isLocalAvatarUrl(url: string): boolean {
  if (!process.env.SUPABASE_URL) return false;
  return avatarPathRegex().test(url);
}

/** Map MIME type → file extension (server-decided; never trusts client Content-Type). */
const MAGIC_BYTES: Array<{ magic: Buffer; mime: string; ext: string }> = [
  { magic: Buffer.from([0xff, 0xd8, 0xff]), mime: 'image/jpeg', ext: 'jpg' },
  { magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), mime: 'image/png', ext: 'png' },
  { magic: Buffer.from([0x47, 0x49, 0x46, 0x38]), mime: 'image/gif', ext: 'gif' },
  { magic: Buffer.from([0x52, 0x49, 0x46, 0x46]), mime: 'image/webp', ext: 'webp' },
];

/** Detect MIME type by magic bytes. Returns null if not an allowed image type. */
export function detectImageType(buf: Buffer): { mime: string; ext: string } | null {
  for (const entry of MAGIC_BYTES) {
    if (buf.length >= entry.magic.length && buf.subarray(0, entry.magic.length).equals(entry.magic)) {
      // WebP also needs 'WEBP' at offset 8
      if (entry.ext === 'webp') {
        if (buf.length >= 12 && buf.slice(8, 12).toString('ascii') === 'WEBP') {
          return { mime: entry.mime, ext: entry.ext };
        }
        continue;
      }
      return { mime: entry.mime, ext: entry.ext };
    }
  }
  return null;
}

function assertValidMerchantId(merchantId: string) {
  if (!/^[a-z0-9_-]+$/i.test(merchantId)) {
    throw new Error('Invalid merchantId');
  }
}

/** Upload an avatar buffer to Supabase Storage. Returns the public URL. */
export async function saveAvatarFile(merchantId: string, buffer: Buffer): Promise<string> {
  const imgType = detectImageType(buffer);
  if (!imgType) throw new Error('Unsupported image format');
  assertValidMerchantId(merchantId);

  const filename = `${crypto.randomUUID()}.${imgType.ext}`;
  const objectPath = `${merchantId}/${filename}`;

  const { error } = await getSupabase().storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: imgType.mime,
    upsert: false,
  });
  if (error) throw new Error(`Avatar upload failed: ${error.message}`);

  return `${publicUrlPrefix()}${objectPath}`;
}

/**
 * Delete an avatar object if it belongs to this merchant's own storage path.
 * Silently ignores missing files or external HTTPS URLs (e.g. Google-provided avatars).
 */
export async function deleteLocalAvatarFile(merchantId: string, avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl || !isLocalAvatarUrl(avatarUrl)) return;
  try {
    const objectPath = avatarUrl.slice(publicUrlPrefix().length);
    // Guard: the object path must actually be scoped under this merchant's own folder.
    if (!objectPath.startsWith(`${merchantId}/`)) return;
    await getSupabase().storage.from(BUCKET).remove([objectPath]);
  } catch {
    // Best-effort deletion; never throw
  }
}

/**
 * Multer instance for avatar uploads.
 * memoryStorage so we can inspect magic bytes before uploading to Supabase.
 * The route handler is responsible for size enforcement (fileSize option as belt-and-suspenders).
 */
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Accept only image/* — magic-byte check happens after full buffer arrives
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are accepted'));
      return;
    }
    cb(null, true);
  },
});
