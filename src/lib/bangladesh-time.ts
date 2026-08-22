export const BANGLADESH_TIME_ZONE = "Asia/Dhaka";
export const BANGLADESH_UTC_OFFSET_HOURS = 6;

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());

  if (!match) {
    throw new Error(`Invalid date input: ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * Returns YYYY-MM-DD for the Bangladesh calendar day containing `date`.
 * This does not depend on the Railway/server timezone.
 */
export function getBangladeshDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGLADESH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Converts a Bangladesh business date (YYYY-MM-DD) at 00:00 Asia/Dhaka
 * to the matching UTC Date object.
 *
 * Bangladesh is UTC+06 all year and has no DST.
 */
export function bangladeshDateStartUtc(value: string) {
  const { year, month, day } = parseDateInput(value);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      -BANGLADESH_UTC_OFFSET_HOURS,
      0,
      0,
      0
    )
  );
}

export function bangladeshDateEndUtc(value: string) {
  const start = bangladeshDateStartUtc(value);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function getBangladeshDayRange(value: string) {
  return {
    start: bangladeshDateStartUtc(value),
    end: bangladeshDateEndUtc(value),
  };
}

export function getBangladeshTodayRange(now = new Date()) {
  return getBangladeshDayRange(getBangladeshDateInputValue(now));
}

/**
 * Use for business-date fields such as readyToShipAt.
 * The DB still stores an instant in UTC, but this instant represents
 * 00:00 of the selected Bangladesh date.
 */
export function bangladeshBusinessDateToUtc(value: string) {
  return bangladeshDateStartUtc(value);
}

export function formatBangladeshDateTime(
  value: Date | string | null | undefined
) {
  if (!value) return "N/A";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGLADESH_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatBangladeshDate(
  value: Date | string | null | undefined
) {
  if (!value) return "N/A";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGLADESH_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
