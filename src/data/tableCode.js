/** Share codes. The alphabet omits 0/O/1/I so codes survive being read aloud. */

export const TABLE_CODE_LENGTH = 6;
export const TABLE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CODE_PATTERN = new RegExp(`^[${TABLE_CODE_ALPHABET}]{${TABLE_CODE_LENGTH}}$`);

export function generateTableCode() {
  const values = new Uint32Array(TABLE_CODE_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => TABLE_CODE_ALPHABET[value % TABLE_CODE_ALPHABET.length]).join('');
}

export function isValidTableCode(code) {
  return typeof code === 'string' && CODE_PATTERN.test(code.toUpperCase());
}

/** Accepts a bare code or a full share link, so pasting either one works. */
export function parseTableCode(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  try {
    const url = new URL(trimmed);
    candidates.push(url.searchParams.get('t') || '', url.pathname.replace(/^\/+/, '').split('/')[0]);
  } catch {
    // Not a URL; the raw string is the only candidate.
  }

  for (const candidate of candidates) {
    const code = String(candidate).toUpperCase();
    if (isValidTableCode(code)) return code;
  }
  return null;
}

/** Reads a code out of the current address, from `/CODE` or `?t=CODE`. */
export function codeFromLocation(location = window.location) {
  const fromQuery = new URLSearchParams(location.search).get('t');
  if (fromQuery && isValidTableCode(fromQuery)) return fromQuery.toUpperCase();

  const segment = location.pathname.replace(/^\/+/, '').split('/')[0];
  return isValidTableCode(segment) ? segment.toUpperCase() : null;
}

export function isViewOnlyLocation(location = window.location) {
  return new URLSearchParams(location.search).get('view') === '1';
}

export function shareLink(code, { viewOnly = false } = {}) {
  const url = new URL(`/${code}`, window.location.origin);
  if (viewOnly) url.searchParams.set('view', '1');
  return url.toString();
}
