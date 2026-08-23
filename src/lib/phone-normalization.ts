const BANGLA_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

/** Convert Bangla numerals to ASCII/English numerals without changing other text. */
export function convertBanglaDigitsToEnglish(value: string) {
  return String(value || "").replace(/[০-৯]/g, (digit) => BANGLA_DIGITS[digit] ?? digit);
}

/**
 * Normalize a Bangladesh phone value for storage/input.
 * - Bangla digits -> English digits
 * - removes spaces, dashes, brackets and other non-digits
 * - +8801XXXXXXXXX / 8801XXXXXXXXX -> 01XXXXXXXXX
 * - 1XXXXXXXXX -> 01XXXXXXXXX
 */
export function normalizeBangladeshPhone(value: string) {
  const ascii = convertBanglaDigitsToEnglish(value);
  const digits = ascii.replace(/\D/g, "");

  if (digits.startsWith("8801") && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }

  if (digits.startsWith("1") && digits.length === 10) {
    return `0${digits}`;
  }

  return digits;
}

export function isValidBangladeshMobile(value: string) {
  return /^01\d{9}$/.test(normalizeBangladeshPhone(value));
}
