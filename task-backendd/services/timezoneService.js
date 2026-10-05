/**
 * Timezone Utility Service
 * Provides robust IANA timezone conversion and date boundary functions with UTC fallback.
 */

/**
 * Returns YYYY-MM-DD string formatted in the given IANA timezone
 */
function getLocalDateString(date = new Date(), timezone = 'UTC') {
  if (!date) return null;
  const validDate = new Date(date);
  if (isNaN(validDate.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(validDate); // Returns YYYY-MM-DD
  } catch (err) {
    // Safe fallback to UTC for invalid timezones
    const fallbackFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fallbackFormatter.format(validDate);
  }
}

/**
 * Check if two dates fall on the same calendar day in the given timezone
 */
function isSameDayInTimezone(date1, date2, timezone = 'UTC') {
  const str1 = getLocalDateString(date1, timezone);
  const str2 = getLocalDateString(date2, timezone);
  if (!str1 || !str2) return false;
  return str1 === str2;
}

/**
 * Check if date1 is exactly one calendar day after date2 in the given timezone
 */
function areConsecutiveDaysInTimezone(date1, date2, timezone = 'UTC') {
  const str1 = getLocalDateString(date1, timezone);
  const str2 = getLocalDateString(date2, timezone);
  if (!str1 || !str2) return false;

  const d1 = new Date(`${str1}T00:00:00Z`);
  const d2 = new Date(`${str2}T00:00:00Z`);
  const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));
  return diffDays === 1;
}

/**
 * Returns YYYY-MM-DD of the start of the week (Sunday) for a given date in a timezone
 */
function getStartOfWeekDateString(date = new Date(), timezone = 'UTC') {
  const dateStr = getLocalDateString(date, timezone);
  if (!dateStr) return null;

  const utcDate = new Date(`${dateStr}T00:00:00Z`);
  const dayOfWeek = utcDate.getUTCDay(); // 0 = Sunday
  utcDate.setUTCDate(utcDate.getUTCDate() - dayOfWeek);

  return utcDate.toISOString().split('T')[0];
}

/**
 * Check if a date falls in the current week in the given timezone
 */
function isDateInCurrentWeek(date, referenceDate = new Date(), timezone = 'UTC') {
  const dateStr = getLocalDateString(date, timezone);
  if (!dateStr) return false;

  const startOfWeekStr = getStartOfWeekDateString(referenceDate, timezone);
  const endOfWeekDate = new Date(`${startOfWeekStr}T00:00:00Z`);
  endOfWeekDate.setUTCDate(endOfWeekDate.getUTCDate() + 7);
  const endOfWeekStr = endOfWeekDate.toISOString().split('T')[0];

  return dateStr >= startOfWeekStr && dateStr < endOfWeekStr;
}

module.exports = {
  getLocalDateString,
  isSameDayInTimezone,
  areConsecutiveDaysInTimezone,
  getStartOfWeekDateString,
  isDateInCurrentWeek,
};
