/**
 * Weekly meeting dates.
 *
 * Every check-in block in the spreadsheets this replaces is one weekday
 * repeated across a semester, and every date in every one of them was typed by
 * hand — which is why one Fall block carries a date from the previous Spring in
 * the middle of it.
 */

import { toDateString } from './model';

export const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

const MAX_OCCURRENCES = 200;

/**
 * Every `weekday` between `startDate` and `endDate` inclusive, as `YYYY-MM-DD`.
 *
 * Dates are stepped at noon UTC, the same convention the rest of the app parses
 * them with, so a daylight-saving boundary cannot shift a meeting onto the
 * wrong day mid-semester.
 */
export function weeklyDates(startDate, endDate, weekday, skip = []) {
  if (!isDate(startDate) || !isDate(endDate)) return [];

  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const target = Number(weekday);
  const cursor = new Date(start);
  if (Number.isInteger(target) && target >= 0 && target <= 6) {
    // Step forward to the first matching weekday.
    const shift = (target - cursor.getUTCDay() + 7) % 7;
    cursor.setUTCDate(cursor.getUTCDate() + shift);
  }

  const skipped = new Set(skip);
  const dates = [];
  while (cursor <= end && dates.length < MAX_OCCURRENCES) {
    const value = cursor.toISOString().slice(0, 10);
    if (!skipped.has(value)) dates.push(value);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

/**
 * The nth given weekday of each month between two dates — "the last Friday of
 * the month", which is when the townhouse meets.
 *
 * `nth` is 1–4 for the first through fourth, or -1 for the last, which is not
 * the same as the fourth in a month with five.
 */
export function monthlyDates(startDate, endDate, weekday, nth = -1, skip = []) {
  if (!isDate(startDate) || !isDate(endDate)) return [];

  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const target = Number(weekday);
  if (!Number.isInteger(target) || target < 0 || target > 6) return [];

  const skipped = new Set(skip);
  const dates = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12));

  while (cursor <= end && dates.length < MAX_OCCURRENCES) {
    const found = nthWeekdayOfMonth(cursor.getUTCFullYear(), cursor.getUTCMonth(), target, nth);
    if (found && found >= start && found <= end) {
      const value = found.toISOString().slice(0, 10);
      if (!skipped.has(value)) dates.push(value);
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return dates;
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  if (nth === -1) {
    const last = new Date(Date.UTC(year, month + 1, 0, 12));
    last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7));
    return last;
  }
  const first = new Date(Date.UTC(year, month, 1, 12));
  first.setUTCDate(1 + ((weekday - first.getUTCDay() + 7) % 7) + (nth - 1) * 7);
  return first.getUTCMonth() === month ? first : null;
}

export const REPEATS = [
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly-last', label: 'Last of each month' },
  { value: 'monthly-first', label: 'First of each month' },
];

/** One entry point for the dialog, whichever cadence was chosen. */
export function occurrences({ repeats, startDate, endDate, weekday, skip }) {
  if (repeats === 'monthly-last') return monthlyDates(startDate, endDate, weekday, -1, skip);
  if (repeats === 'monthly-first') return monthlyDates(startDate, endDate, weekday, 1, skip);
  return weeklyDates(startDate, endDate, weekday, skip);
}

/** The weekday a date falls on, so a form can default to it. */
export function weekdayOf(dateString) {
  if (!isDate(dateString)) return null;
  return new Date(`${dateString}T12:00:00Z`).getUTCDay();
}

export function weekdayLabel(weekday) {
  return WEEKDAYS.find((day) => day.value === Number(weekday))?.label || '';
}

/** A sensible semester window: today through about fifteen weeks later. */
export function defaultTermWindow(today = new Date()) {
  const start = toDateString(today);
  const end = new Date(today.getTime());
  end.setDate(end.getDate() + 7 * 15);
  return { startDate: start, endDate: toDateString(end) };
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
