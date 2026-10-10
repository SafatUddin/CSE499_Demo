import { Type } from '@google/genai';
import { ai } from './gemini';
import { detectImageType } from './mediaStorage';

export const MAX_INBOUND_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_CATALOG_IMAGES_TO_COMPARE = 8;

export interface ImageRecognitionCatalogItem {
  name: string;
  sku: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
}

export interface ImageMatchCandidate {
  sku: string;
  confidence: number;
  reason: string;
}

export interface ImageRecognitionResult {
  match: 'exact' | 'ambiguous' | 'none' | 'unavailable';
  sku: string | null;
  confidence: number;
  candidates: ImageMatchCandidate[];
}

export function validateInboundImage(buffer: Buffer): { mime: string; size: number } | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_INBOUND_IMAGE_BYTES) return null;
  const type = detectImageType(buffer);
  return type ? { mime: type.mime, size: buffer.length } : null;
}

export function normalizeImageRecognitionResult(
  raw: unknown,
  catalog: ImageRecognitionCatalogItem[],
): ImageRecognitionResult {
  const validSkus = new Set(catalog.map((item) => item.sku));
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];
  const candidates: ImageMatchCandidate[] = [];

  for (const candidate of rawCandidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Record<string, unknown>;
    const sku = typeof item.sku === 'string' ? item.sku.trim() : '';
    const confidence = Number(item.confidence);
    if (!validSkus.has(sku) || !Number.isFinite(confidence)) continue;
    if (candidates.some((entry) => entry.sku === sku)) continue;
    candidates.push({
      sku,
      confidence: Math.max(0, Math.min(1, confidence)),
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 300) : '',
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const top = candidates[0];
  const rawMatch = value.match;
  const match = candidates.length === 0
    ? 'none'
    : rawMatch === 'ambiguous'
      ? 'ambiguous'
      : rawMatch === 'none'
        ? 'none'
        : top && top.confidence >= 0.85
          ? 'exact'
          : 'ambiguous';

  return {
    match,
    sku: match === 'exact' && top ? top.sku : null,
    confidence: top?.confidence ?? 0,
    candidates: candidates.slice(0, 3),
  };
}

export async function downloadInboundImage(url: string, accessToken?: string): Promise<Buffer | null> {
  try {
    if (!/^https:\/\//i.test(url)) return null;
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(url, { headers, redirect: 'error' });
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_INBOUND_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return validateInboundImage(buffer) ? buffer : null;
  } catch {
    return null;
  }
}

async function fetchImagePart(url: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  const buffer = await downloadInboundImage(url);
  const type = buffer ? validateInboundImage(buffer) : null;
  return buffer && type
    ? { inlineData: { mimeType: type.mime, data: buffer.toString('base64') } }
    : null;
}

export async function recognizeCatalogImage(
  image: Buffer,
  catalog: ImageRecognitionCatalogItem[],
): Promise<ImageRecognitionResult> {
  const imageType = validateInboundImage(image);
  if (!imageType || !ai || catalog.length === 0) {
    return { match: !ai ? 'unavailable' : 'none', sku: null, confidence: 0, candidates: [] };
  }

  const catalogWithImages = catalog
    .filter((item) => item.imageUrl)
    .slice(0, MAX_CATALOG_IMAGES_TO_COMPARE);
  const catalogParts: Array<Record<string, unknown>> = [];
  for (const item of catalogWithImages) {
    const part = await fetchImagePart(item.imageUrl!);
    catalogParts.push({
      text: `Catalog candidate: SKU=${item.sku}; name=${item.name}; price=${item.price}; description=${item.description || 'none'}`,
    });
    if (part) catalogParts.push(part);
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { text: 'Identify whether the customer image matches a catalog item. Only return candidates from the supplied catalog. Use exact only when visual identity is strong (confidence >= 0.85); use ambiguous for plausible alternatives; use none when no candidate is credible.' },
          { inlineData: { mimeType: imageType.mime, data: image.toString('base64') } },
          ...catalogParts,
        ],
      }],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: { type: Type.STRING, enum: ['exact', 'ambiguous', 'none'] },
            candidates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sku: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  reason: { type: Type.STRING },
                },
                required: ['sku', 'confidence', 'reason'],
              },
            },
          },
          required: ['match', 'candidates'],
        },
      },
    });
    return normalizeImageRecognitionResult(JSON.parse(response.text || '{}'), catalog);
  } catch {
    return { match: 'unavailable', sku: null, confidence: 0, candidates: [] };
  }
}
