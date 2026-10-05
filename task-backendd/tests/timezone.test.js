const {
  getLocalDateString,
  isSameDayInTimezone,
  areConsecutiveDaysInTimezone,
  isDateInCurrentWeek
} = require('../services/timezoneService');

describe('Timezone Service & Streak Boundary Tests (M4.5-B)', () => {
  it('should format date string in IANA timezone accurately', () => {
    const utcDate = new Date('2026-10-05T23:30:00Z');
    const nyDateStr = getLocalDateString(utcDate, 'America/New_York');
    const tokyoDateStr = getLocalDateString(utcDate, 'Asia/Tokyo');

    expect(nyDateStr).toBe('2026-10-05');
    expect(tokyoDateStr).toBe('2026-10-06');
  });

  it('should fall back safely to UTC if timezone is invalid or missing', () => {
    const date = new Date('2026-10-05T12:00:00Z');
    const invalidTz = getLocalDateString(date, 'Invalid/Timezone');
    const missingTz = getLocalDateString(date, null);

    expect(invalidTz).toBe('2026-10-05');
    expect(missingTz).toBe('2026-10-05');
  });

  it('should accurately detect same local day across UTC midnight boundary', () => {
    const d1 = new Date('2026-10-05T23:30:00Z');
    const d2 = new Date('2026-10-06T01:30:00Z');

    // In America/New_York, d1 is Oct 5 19:30 and d2 is Oct 5 21:30 -> Same local day!
    expect(isSameDayInTimezone(d1, d2, 'America/New_York')).toBe(true);

    // In UTC, d1 is Oct 5 and d2 is Oct 6 -> Different days!
    expect(isSameDayInTimezone(d1, d2, 'UTC')).toBe(false);
  });

  it('should accurately detect consecutive local days in user timezone', () => {
    const day1 = new Date('2026-10-05T14:00:00Z');
    const day2 = new Date('2026-10-04T14:00:00Z');

    expect(areConsecutiveDaysInTimezone(day1, day2, 'America/New_York')).toBe(true);
  });

  it('should identify dates in current week for user timezone', () => {
    const now = new Date('2026-10-05T12:00:00Z'); // Monday Oct 5
    const sameWeekDate = new Date('2026-10-06T10:00:00Z'); // Tuesday Oct 6
    const diffWeekDate = new Date('2026-09-20T10:00:00Z');

    expect(isDateInCurrentWeek(sameWeekDate, now, 'UTC')).toBe(true);
    expect(isDateInCurrentWeek(diffWeekDate, now, 'UTC')).toBe(false);
  });
});
