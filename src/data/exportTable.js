/**
 * Getting data out again.
 *
 * A tool that holds a year of attendance and offers no way to retrieve it is a
 * worse place to put the data than the spreadsheet was. The CSV is for
 * reporting and for anyone who still wants Excel; the JSON is a whole-table
 * backup that can be loaded back in.
 */

import { cellKey, formatDateRange } from './model';
import { buildColumns, buildMembership, computeScores, eventsInTerm, formatScore } from './selectors';

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The grid as it is on screen, one row per person. Columns follow the same
 * `buildColumns` order the table renders, so the export matches what was
 * exported from.
 */
export function toCsv(table, termId) {
  const { columns } = buildColumns(table, {}, termId);
  const events = columns.filter((column) => column.kind === 'event').map((column) => column.event);
  const scores = computeScores(table, eventsInTerm(table, termId));
  const membership = buildMembership(table.groups);
  const statusName = new Map(table.settings.statuses.map((status) => [status.id, status.name]));

  const header = [
    'Name',
    'Groups',
    ...events.map((event) => {
      const date = formatDateRange(event.startDate, event.endDate);
      return date ? `${event.name} (${date})` : event.name;
    }),
    'Present',
    'Counted',
    'Raw %',
    'Weighted %',
  ];

  const rows = table.people.map((person) => {
    const score = scores.get(person.id);
    return [
      person.name,
      (membership.get(person.id) || []).map((group) => group.name).join('; '),
      ...events.map((event) => statusName.get(table.attendance[cellKey(person.id, event.id)]) || ''),
      score?.present ?? 0,
      score?.counted ?? 0,
      formatScore(score?.raw),
      formatScore(score?.weighted),
    ];
  });

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

/** The whole table, exactly as stored, for backup or for handing to someone. */
export function toJson(table) {
  return JSON.stringify({ ...table, exportedAt: new Date().toISOString() }, null, 2);
}

/** Triggers a download. A real page, so a blob URL is all this needs. */
export function download(filename, contents, type = 'text/plain') {
  const blob = new Blob([contents], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** A filename that sorts and says what it is. */
export function exportName(tableName, extension, suffix = '') {
  const safe = (tableName || 'table').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  return [safe, suffix, stamp].filter(Boolean).join('-') + `.${extension}`;
}
