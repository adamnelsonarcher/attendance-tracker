import { defaultTermWindow, weekdayOf, weeklyDates } from '../recurrence';

describe('weeklyDates', () => {
  it('builds a semester of one weekday', () => {
    // Fall 2026: Mondays from the 24th of August.
    const dates = weeklyDates('2026-08-24', '2026-12-04', 1);

    expect(dates[0]).toBe('2026-08-24');
    expect(dates).toHaveLength(15);
    expect(dates[dates.length - 1]).toBe('2026-11-30');
  });

  it('starts at the first matching weekday, not the range start', () => {
    // The range opens on a Monday; the sessions are on Thursdays.
    expect(weeklyDates('2026-08-24', '2026-09-30', 4)[0]).toBe('2026-08-27');
  });

  it('keeps every date exactly seven days apart', () => {
    const dates = weeklyDates('2026-08-24', '2026-12-04', 2);
    for (let i = 1; i < dates.length; i += 1) {
      const gap = (new Date(`${dates[i]}T12:00:00Z`) - new Date(`${dates[i - 1]}T12:00:00Z`)) / 86400000;
      expect(gap).toBe(7);
    }
  });

  it('does not drift across a daylight-saving boundary', () => {
    // US clocks change on 2026-11-01, mid-semester. Every one of these must
    // still be a Tuesday — the kind of slip that puts a session on the wrong
    // day halfway down a hand-typed column.
    const dates = weeklyDates('2026-10-06', '2026-11-24', 2);
    for (const date of dates) expect(weekdayOf(date)).toBe(2);
  });

  it('leaves out dates it is told to skip', () => {
    const dates = weeklyDates('2026-08-24', '2026-12-04', 1, ['2026-11-23']);
    expect(dates).not.toContain('2026-11-23');
    expect(dates).toHaveLength(14);
  });

  it('returns nothing for a range with no such weekday', () => {
    expect(weeklyDates('2026-08-24', '2026-08-26', 6)).toEqual([]);
  });

  it('refuses a backwards or malformed range', () => {
    expect(weeklyDates('2026-12-04', '2026-08-24', 1)).toEqual([]);
    expect(weeklyDates('', '2026-12-04', 1)).toEqual([]);
    expect(weeklyDates('not-a-date', 'nor-this', 1)).toEqual([]);
  });

  it('is bounded, so a typo in the end year cannot hang the app', () => {
    expect(weeklyDates('2026-08-24', '2226-08-24', 1).length).toBeLessThanOrEqual(200);
  });
});

describe('defaultTermWindow', () => {
  it('offers about a semester', () => {
    const { startDate, endDate } = defaultTermWindow(new Date('2026-08-24T12:00:00Z'));
    expect(startDate < endDate).toBe(true);
    const weeks = (new Date(endDate) - new Date(startDate)) / (86400000 * 7);
    expect(Math.round(weeks)).toBe(15);
  });
});
