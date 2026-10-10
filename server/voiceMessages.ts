import { ai } from './gemini';

export const MAX_INBOUND_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_TRANSCRIPT_LENGTH = 4000;

const AUDIO_SIGNATURES = [
  { mime: 'audio/mpeg', test: (buffer: Buffer) => buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) },
  { mime: 'audio/ogg', test: (buffer: Buffer) => buffer.subarray(0, 4).toString('ascii') === 'OggS' },
  { mime: 'audio/wav', test: (buffer: Buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE' },
  { mime: 'audio/mp4', test: (buffer: Buffer) => buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp' },
  { mime: 'audio/amr', test: (buffer: Buffer) => buffer.subarray(0, 6).toString('ascii') === '#!AMR\n' },
];

export function detectAudioType(buffer: Buffer): { mime: string } | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_INBOUND_AUDIO_BYTES) return null;
  return AUDIO_SIGNATURES.find((signature) => signature.test(buffer)) || null;
}

export async function downloadInboundAudio(url: string, accessToken?: string): Promise<Buffer | null> {
  try {
    if (!/^https:\/\//i.test(url)) return null;
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(url, { headers, redirect: 'error' });
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_INBOUND_AUDIO_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return detectAudioType(buffer) ? buffer : null;
  } catch {
    return null;
  }
}

export async function transcribeVoiceMessage(buffer: Buffer): Promise<string | null> {
  const type = detectAudioType(buffer);
  if (!type || !ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcribe this customer voice message accurately. Preserve names, phone numbers, addresses, quantities, and Bangla/Banglish meaning. Return only the transcript, with no commentary.' },
          { inlineData: { mimeType: type.mime, data: buffer.toString('base64') } },
        ],
      }],
      config: { temperature: 0 },
    });
    const transcript = response.text?.trim();
    return transcript ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) : null;
  } catch {
    return null;
  }
}