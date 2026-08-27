/**
 * Reads a block of a check-in spreadsheet pasted straight out of Excel.
 *
 * The sheets this replaces are laid out as one block per weekly session: a
 * header row carrying the session name and a run of dates, then one row per
 * person with a mark under each date. Several blocks usually sit stacked in one
 * sheet, and the marks have changed vocabulary three times over nine semesters
 * — `1`/`x`, then `✓`/`✕`/`V`, then emoji. So the symbols are detected and
 * shown for confirmation rather than guessed at silently.
 */

import { cellKey, newId } from './model';
import { matchNames } from './selectors';

/* -------------------------------------------------------------------------- */
/* parsing                                                                     */
/* -------------------------------------------------------------------------- */

/** Splits a pasted table. Excel gives tabs; a CSV export gives commas. */
function splitRows(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const useTabs = lines.some((line) => line.includes('\t'));
  return lines.map((line) => (useTabs ? line.split('\t') : splitCsv(line)).map((cell) => cell.trim()));
}

function splitCsv(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else current += char;
  }
  cells.push(current);
  return cells;
}

/**
 * Recognises the date formats these sheets actually contain: ISO, US
 * month/day/year, and bare month/day, which is dated into `fallbackYear`.
 */
export function parseDateCell(value, fallbackYear) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return format(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = text.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : fallbackYear;
    if (slash[3] && slash[3].length === 2) year = 2000 + year;
    if (!year) return null;
    return format(year, month, day);
  }

  return null;
}

function format(year, month, day) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

const NOISE = /^(score|times present|total|name|staff|key)$/i;

/**
 * Splits pasted text into blocks. A row holding two or more dates starts one;
 * the rows beneath it are its people, until the next header or a blank run.
 */
export function parseGrid(text, fallbackYear = new Date().getFullYear()) {
  const rows = splitRows(text || '');
  const blocks = [];
  let current = null;
  let blanks = 0;

  for (const row of rows) {
    const dated = row
      .map((cell, index) => ({ index, date: parseDateCell(cell, fallbackYear) }))
      .filter((entry) => entry.date);

    if (dated.length >= 2) {
      current = { label: row[0] || '', columns: dated, people: [] };
      blocks.push(current);
      blanks = 0;
      continue;
    }

    if (!current) continue;

    const name = (row[0] || '').trim();
    if (!name) {
      blanks += 1;
      // Blank spacer rows are everywhere in these sheets; only a run of them
      // ends a block.
      if (blanks >= 3) current = null;
      continue;
    }
    if (NOISE.test(name)) continue;

    blanks = 0;
    const marks = {};
    for (const { index, date } of current.columns) {
      const mark = (row[index] || '').trim();
      if (mark) marks[date] = mark;
    }
    current.people.push({ name, marks });
  }

  return blocks.filter((block) => block.people.length > 0);
}

/** Every distinct mark in the parsed blocks, most frequent first. */
export function collectSymbols(blocks) {
  const counts = new Map();
  for (const block of blocks) {
    for (const person of block.people) {
      for (const mark of Object.values(person.marks)) {
        counts.set(mark, (counts.get(mark) || 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([symbol, count]) => ({ symbol, count }));
}

/* -------------------------------------------------------------------------- */
/* symbol vocabulary                                                           */
/* -------------------------------------------------------------------------- */

/**
 * What each mark has meant across the years. Anything unrecognised is left for
 * the person doing the import to map, rather than quietly dropped.
 *
 * `✕` is deliberately read as absent: one legend defines it as "needs to
 * makeup" and, two lines down, as "Absent". The later emoji legend settles it
 * by giving make-ups their own symbol.
 */
export const SYMBOL_GUESSES = [
  { match: ['✓', '✔', '✅', '1', 'p', 'present', 'x?in'], status: 'present' },
  { match: ['v', '💻', 'virtual', 'online', 'zoom'], status: 'virtual' },
  { match: ['🆗', 'ok', 'made up', 'makeup done'], status: 'made-up' },
  { match: ['⚠️', '⚠', '?', 'late', 'needs makeup', 'needs make-up'], status: 'needs-makeup' },
  { match: ['✕', '✗', '✘', '❌', 'x', '0', 'a', 'absent'], status: 'absent' },
  { match: ['⚪', '⬜', 'n/a', 'na', 'holiday', '-'], status: 'excused' },
];

/** A first pass at symbol → status, for the import dialog to show and correct. */
export function guessMapping(symbols, statuses) {
  const available = new Set(statuses.map((status) => status.id));
  const mapping = {};

  for (const { symbol } of symbols) {
    const key = symbol.toLowerCase();
    const guess = SYMBOL_GUESSES.find((entry) => entry.match.includes(key));
    mapping[symbol] = guess && available.has(guess.status) ? guess.status : '';
  }
  return mapping;
}

/* -------------------------------------------------------------------------- */
/* building the import                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Turns parsed blocks into something `table/import` can apply, and a summary
 * the dialog shows first. Nothing is applied until that summary is accepted.
 *
 * People are matched against the existing roster by name and alias, so
 * importing a second semester extends the students already there instead of
 * creating a duplicate of each one.
 */
export function buildImport({ blocks, mapping, table, termId = null, groupBlocks = true }) {
  const people = [];
  const groups = [];
  const folders = [];
  const events = [];
  const attendance = {};

  const roster = table.people.slice();
  const byKey = new Map();
  const registerPerson = (person) => {
    byKey.set(person.name.trim().toLowerCase(), person);
    for (const alias of person.aliases || []) byKey.set(alias.trim().toLowerCase(), person);
  };
  roster.forEach(registerPerson);

  // A folder or group of the same name already here is reused rather than
  // doubled — importing three semesters of "Monday 2pm" should leave one
  // "Monday 2pm", not three.
  const folderByName = new Map(table.folders.map((folder) => [folder.name.trim().toLowerCase(), folder]));
  const groupByName = new Map(table.groups.map((group) => [group.name.trim().toLowerCase(), group]));

  const summary = {
    blocks: blocks.length,
    events: 0,
    marks: 0,
    newPeople: [],
    matchedPeople: [],
    reusedFolders: [],
    ambiguous: [],
    unmappedSymbols: new Set(),
  };

  for (const block of blocks) {
    const label = block.label.trim() || 'Imported';
    const key = label.toLowerCase();

    let folder = folderByName.get(key);
    if (folder) {
      if (!summary.reusedFolders.includes(folder.name)) summary.reusedFolders.push(folder.name);
    } else {
      folder = { id: newId('f'), name: label, isOpen: true };
      folders.push(folder);
      folderByName.set(key, folder);
    }

    let group = null;
    if (groupBlocks) {
      const existing = groupByName.get(key);
      // An existing group keeps its id, so the reducer folds the members in.
      group = existing
        ? { id: existing.id, name: existing.name, color: existing.color, memberIds: [] }
        : { id: newId('g'), name: label, color: nextColor(groups.length), memberIds: [] };
      groups.push(group);
      groupByName.set(key, group);
    }

    // A session already recorded on this date in this folder is the same
    // session, so re-importing a corrected sheet updates it instead of
    // creating a second column for the same day.
    const existingByDate = new Map(
      table.events
        .filter((event) => event.folderId === folder.id && event.startDate)
        .map((event) => [event.startDate, event])
    );

    const dateEvents = new Map();
    for (const { date } of block.columns) {
      if (dateEvents.has(date)) continue;

      const already = existingByDate.get(date);
      if (already) {
        dateEvents.set(date, already);
        continue;
      }

      const event = {
        id: newId('e'),
        name: shortDate(date),
        weight: 1,
        folderId: folder.id,
        termId,
        startDate: date,
        endDate: null,
      };
      dateEvents.set(date, event);
      events.push(event);
      summary.events += 1;
    }

    for (const row of block.people) {
      const key = row.name.trim().toLowerCase();
      let person = byKey.get(key);

      if (!person) {
        // Fall back to the fuzzy matcher, which tolerates middle initials and
        // accents, before deciding somebody is new.
        const result = matchNames([row.name], roster);
        if (result.matched.length === 1) person = result.matched[0];
        else if (result.ambiguous.length > 0) {
          summary.ambiguous.push({
            name: row.name,
            candidates: result.ambiguous[0].candidates.map((c) => c.name),
          });
        }
      }

      if (person) {
        if (!summary.matchedPeople.includes(person.name)) summary.matchedPeople.push(person.name);
      } else {
        person = { id: newId('p'), name: row.name, aliases: [] };
        people.push(person);
        roster.push(person);
        registerPerson(person);
        summary.newPeople.push(person.name);
      }

      if (group && !group.memberIds.includes(person.id)) group.memberIds.push(person.id);

      for (const [date, mark] of Object.entries(row.marks)) {
        const statusId = mapping[mark];
        if (!statusId) {
          if (mapping[mark] === '') summary.unmappedSymbols.add(mark);
          continue;
        }
        const event = dateEvents.get(date);
        if (!event) continue;
        attendance[cellKey(person.id, event.id)] = statusId;
        summary.marks += 1;
      }
    }
  }

  summary.unmappedSymbols = Array.from(summary.unmappedSymbols);
  return { payload: { people, groups, folders, events, attendance }, summary };
}

const PALETTE = ['#5b8def', '#e8955a', '#3fae7d', '#b06ad8', '#d95b6b', '#3ca6b8', '#c9a227', '#7a8290'];
const nextColor = (index) => PALETTE[index % PALETTE.length];

function shortDate(date) {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}
