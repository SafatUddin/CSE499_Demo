// Separates a customer's phone number from their delivery address. LLM tool output and
// older order rows sometimes mix both into one string (e.g. "Phone: X | Address: Y" or
// "address Mohammadpur ... and amar phone number 017XXXXXXXX"), so every phone/address
// pair is normalized through here before being stored or shown.

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

// Bangladeshi mobile numbers first (optionally +88 / 88 prefixed, spaces/dashes allowed),
// then any other 8–15 digit phone-like sequence.
const PHONE_PATTERN = /(?:\+?\s*88[\s-]*)?0\s*1[3-9](?:[\s-]*\d){8}(?!\d)|\+?\d(?:[\s-]*\d){7,14}(?!\d)/u;

const NOT_WORD_BEFORE = '(?<![\\p{L}\\p{N}])';
const PHONE_LABEL = new RegExp(
  `${NOT_WORD_BEFORE}(?:(?:and|ar|&|এবং|আর)\\s+)?(?:with\\s+)?(?:(?:my|the|amar|আমার)\\s+)?(?:phone|mobile|cell|contact|ফোন|মোবাইল)(?:\\s*(?:number|num|no\\.?|নম্বর|নাম্বার))?(?:\\s*(?:is|holo|hocche|হলো|হচ্ছে))?\\s*[:\\-]?`,
  'giu',
);
const ADDRESS_LABEL = new RegExp(
  `^\\s*(?:(?:my|amar|আমার)\\s+)?(?:(?:delivery|shipping)\\s+)?(?:address|thikana|ঠিকানা)(?:\\s*(?:is|holo|hocche|হলো|হচ্ছে))?\\s*[:\\-]?`,
  'iu',
);
const LEGACY_COMBINED = /^\s*phone\s*:\s*([^|]*?)\s*(?:\|\s*address\s*:\s*([\s\S]*))?$/i;

export function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = normalizeDigits(raw).trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return cleaned.startsWith('+') ? `+${digits}` : digits;
}

export function extractPhone(text: string | null | undefined): string {
  if (!text) return '';
  const match = normalizeDigits(text).match(PHONE_PATTERN);
  return match ? normalizePhone(match[0]) : '';
}

export function splitContactDetails(input: { phone?: string | null; address?: string | null }): { phone: string; address: string } {
  let phone = normalizePhone(input.phone);
  let address = normalizeDigits(input.address || '').trim();

  const legacy = address.match(LEGACY_COMBINED);
  if (legacy) {
    phone = phone || normalizePhone(legacy[1]);
    address = (legacy[2] || '').trim();
  }
  address = address.replace(/\s*\|?\s*address\s*:\s*/i, ' ');

  const embeddedPhone = address.match(PHONE_PATTERN);
  if (embeddedPhone) {
    phone = phone || normalizePhone(embeddedPhone[0]);
    address = address.replace(embeddedPhone[0], ' ');
  }

  address = address
    .replace(PHONE_LABEL, ' ')
    .replace(ADDRESS_LABEL, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;|:\-]+|[\s,;|:\-]+$/g, '')
    .replace(/(?:\s+(?:and|ar|এবং|আর))+$/iu, '')
    .trim();

  return { phone, address };
}
