/**
 * Local-disk avatar storage for merchant profile pictures.
 *
 * Stores files at:  uploads/avatars/{merchantId}/{uuid}.{ext}
 * Public URL:       /uploads/avatars/{merchantId}/{uuid}.{ext}
 *
 * Security notes:
 * - Filenames are random UUIDs; never derived from user input.
 * - Directories are scoped per-merchant; path traversal is blocked at read time.
 * - Only JPEG, PNG, WebP, and GIF are accepted; verified by magic bytes, not just MIME header.
 * - Files above MAX_AVATAR_BYTES are rejected before writing.
 * - On avatar replace / remove, the old local file is deleted (external HTTPS URLs are never touched).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads', 'avatars');

/** URL path prefix where avatar files are served. */
export const AVATAR_URL_PREFIX = '/uploads/avatars/';

/** Regex that a stored local avatar URL must match (no .. allowed). */
const LOCAL_AVATAR_PATH_RE = /^\/uploads\/avatars\/[a-z0-9_-]+\/[a-z0-9_-]+\.[a-z]+$/i;

export function isLocalAvatarUrl(url: string): boolean {
  return LOCAL_AVATAR_PATH_RE.test(url);
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

/** Ensure the merchant's upload directory exists. */
function ensureMerchantDir(merchantId: string): string {
  // Reject any merchantId that looks like a traversal attempt (only allow cuid chars)
  if (!/^[a-z0-9_-]+$/i.test(merchantId)) {
    throw new Error('Invalid merchantId');
  }
  const dir = path.join(UPLOADS_ROOT, merchantId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Save avatar buffer to disk. Returns the public URL path. */
export function saveAvatarFile(merchantId: string, buffer: Buffer): string {
  const imgType = detectImageType(buffer);
  if (!imgType) throw new Error('Unsupported image format');

  const dir = ensureMerchantDir(merchantId);
  const filename = `${crypto.randomUUID()}.${imgType.ext}`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return `${AVATAR_URL_PREFIX}${merchantId}/${filename}`;
}

/**
 * Delete a local avatar file if it belongs to this merchant's upload directory.
 * Silently ignores missing files or external HTTPS URLs.
 */
export function deleteLocalAvatarFile(merchantId: string, avatarUrl: string | null | undefined): void {
  if (!avatarUrl || !isLocalAvatarUrl(avatarUrl)) return;
  try {
    // Resolve the absolute path and verify it sits inside the merchant's own folder
    const expectedDir = path.resolve(UPLOADS_ROOT, merchantId);
    const filename = path.basename(avatarUrl);
    const fullPath = path.join(expectedDir, filename);
    // Guard against traversal: resolved path must start with the expected dir
    if (!fullPath.startsWith(expectedDir + path.sep) && fullPath !== expectedDir) return;
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch {
    // Best-effort deletion; never throw
  }
}

/**
 * Multer instance for avatar uploads.
 * memoryStorage so we can inspect magic bytes before writing.
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
