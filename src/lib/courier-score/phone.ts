export function normalizeBangladeshPhone(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  let phone = value.replace(/[^\d]/g, "");

  if (phone.startsWith("880")) {
    phone = `0${phone.slice(3)}`;
  } else if (phone.startsWith("88") && phone.length === 13) {
    phone = phone.slice(2);
  }

  return phone;
}

export function isBangladeshPhone(value: unknown): boolean {
  return /^01[3-9]\d{8}$/.test(normalizeBangladeshPhone(value));
}

export function assertBangladeshPhone(value: unknown): string {
  const phone = normalizeBangladeshPhone(value);

  if (!isBangladeshPhone(phone)) {
    throw new Error("সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন।");
  }

  return phone;
}

export function withBangladeshCountryCode(value: unknown): string {
  return `88${assertBangladeshPhone(value)}`;
}
