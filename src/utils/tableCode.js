export const TABLE_CODE_LENGTH = 6;
export const TABLE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTableCode() {
  return Array.from({ length: TABLE_CODE_LENGTH }, () =>
    TABLE_CODE_ALPHABET.charAt(Math.floor(Math.random() * TABLE_CODE_ALPHABET.length))
  ).join('');
}

export function isValidTableCode(code) {
  if (!code || typeof code !== 'string') return false;
  const re = new RegExp(`^[${TABLE_CODE_ALPHABET}]{${TABLE_CODE_LENGTH}}$`);
  return re.test(code.toUpperCase());
}


