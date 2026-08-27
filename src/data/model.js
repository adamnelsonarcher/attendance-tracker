/**
 * The shape of a table, and everything needed to read an older one.
 *
 * A table is five flat collections plus settings. Folders and events used to
 * live in one nested array, which meant every edit had to walk a tree and every
 * render had two code paths. Events now carry a `folderId` instead, so a folder
 * is just a label some events point at.
 */

export const SCHEMA_VERSION = 2;

/**
 * The default vocabulary, matching the legend CIR has kept in its check-in
 * sheets: attended in person, attended online, missed but made it up, missed
 * and still owes a make-up, missed, and a session that did not happen.
 */
export const DEFAULT_STATUSES = [
  { id: 'present', name: 'Present', credit: 1, color: '#dcf5e2' },
  { id: 'virtual', name: 'Virtual', credit: 1, color: '#dbeafe' },
  { id: 'made-up', name: 'Made up', credit: 1, color: '#e6f6ea' },
  { id: 'needs-makeup', name: 'Needs make-up', credit: 0, color: '#fdf0d5' },
  { id: 'absent', name: 'Absent', credit: 0, color: '#fbdedd' },
  { id: 'excused', name: 'Excused / holiday', credit: null, color: '#e9ecef' },
];

export const DEFAULT_TABLE_NAME = 'Untitled table';
export const MAX_TABLE_NAME = 80;

export const DEFAULT_SETTINGS = {
  /**
   * Everything in here belongs to the table, not to the browser looking at it,
   * so it travels with a share link. The name is part of that on purpose:
   * whoever opens the link should see what the table is called, not a code.
   */
  name: DEFAULT_TABLE_NAME,
  /** Statuses are shared with everyone on the table — they change the scores. */
  statuses: DEFAULT_STATUSES,
  /** An unmarked cell counts as a miss. Off means unmarked cells are ignored. */
  countUnmarkedAsAbsent: false,
  showTitle: false,
  colorCells: true,
  colorDropdown: false,
  highlightHover: true,
  stickyColumns: true,
};

export const UNMARKED = '';

/* -------------------------------------------------------------------------- */
/* ids                                                                        */
/* -------------------------------------------------------------------------- */

let counter = 0;

/** Opaque, sortable-ish, collision-resistant even within a single millisecond. */
export function newId(prefix) {
  counter = (counter + 1) % 4096;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** The one place attendance keys are built. Never parse one — rebuild it. */
export function cellKey(personId, eventId) {
  return `${personId}-${eventId}`;
}

/* -------------------------------------------------------------------------- */
/* empty + demo tables                                                        */
/* -------------------------------------------------------------------------- */

export function defaultSettings() {
  return { ...DEFAULT_SETTINGS, statuses: DEFAULT_STATUSES.map((s) => ({ ...s })) };
}

export function emptyTable() {
  return {
    version: SCHEMA_VERSION,
    people: [],
    groups: [],
    folders: [],
    terms: [],
    events: [],
    attendance: {},
    settings: defaultSettings(),
  };
}

/* -------------------------------------------------------------------------- */
/* terms                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A term is a stretch of the calendar — a semester. CIR kept one spreadsheet
 * tab per semester, which meant the roster was retyped every time and nobody
 * could see a student's history. Here the table is continuous and events are
 * stamped with the term they belong to, so a semester is a lens rather than a
 * separate file.
 */
export function termForDate(terms, date) {
  const day = typeof date === 'string' ? date : toDateString(date);
  return (
    terms.find((term) => term.startDate && term.endDate && day >= term.startDate && day <= term.endDate) || null
  );
}

/** The term to show on open: the one we are in, else the most recent to start. */
export function currentTerm(terms, today = toDateString(new Date())) {
  if (terms.length === 0) return null;
  const active = termForDate(terms, today);
  if (active) return active;

  const started = terms.filter((term) => term.startDate && term.startDate <= today);
  const pool = started.length > 0 ? started : terms;
  return pool.reduce((latest, term) => ((term.startDate || '') > (latest.startDate || '') ? term : latest));
}

export function toDateString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function demoTable() {
  const table = emptyTable();
  table.settings.name = 'Example table';
  // The demo carries a term so the semester switcher has something in it the
  // first time someone opens the app.
  table.terms = [{ id: 't_fall25', name: 'Fall 2025', startDate: '2025-08-01', endDate: '2025-12-31' }];
  table.folders = [
    { id: 'f_general', name: 'General Meetings', isOpen: true },
    { id: 'f_service', name: 'Service Events', isOpen: true },
  ];
  table.events = [
    { id: 'e1', name: 'Kickoff', weight: 1, termId: 't_fall25', folderId: 'f_general', startDate: '2025-09-03', endDate: null },
    { id: 'e2', name: 'Week 2', weight: 1, termId: 't_fall25', folderId: 'f_general', startDate: '2025-09-10', endDate: null },
    { id: 'e3', name: 'Week 3', weight: 1, termId: 't_fall25', folderId: 'f_general', startDate: '2025-09-17', endDate: null },
    { id: 'e4', name: 'Park Cleanup', weight: 2, termId: 't_fall25', folderId: 'f_service', startDate: '2025-09-13', endDate: null },
    { id: 'e5', name: 'Food Bank', weight: 2, termId: 't_fall25', folderId: 'f_service', startDate: '2025-09-27', endDate: null },
    { id: 'e6', name: 'Fall Retreat', weight: 3, termId: 't_fall25', folderId: null, startDate: '2025-10-04', endDate: '2025-10-05' },
  ];
  table.people = [
    { id: 'p1', name: 'Avery Chen', aliases: [] },
    { id: 'p2', name: 'Jordan Blake', aliases: [] },
    { id: 'p3', name: 'Riley Okafor', aliases: [] },
    { id: 'p4', name: 'Sam Delgado', aliases: [] },
    { id: 'p5', name: 'Taylor Nguyen', aliases: [] },
    { id: 'p6', name: 'Morgan Reyes', aliases: [] },
  ];
  table.groups = [
    { id: 'g_exec', name: 'Exec Board', color: '#5b8def', memberIds: ['p1', 'p3'] },
    { id: 'g_new', name: 'New Members', color: '#e8955a', memberIds: ['p4', 'p5', 'p6'] },
  ];
  table.attendance = {
    'p1-e1': 'present', 'p1-e2': 'present', 'p1-e3': 'present', 'p1-e4': 'present', 'p1-e6': 'present',
    'p2-e1': 'present', 'p2-e2': 'virtual', 'p2-e3': 'present', 'p2-e4': 'absent',
    'p3-e1': 'present', 'p3-e2': 'present', 'p3-e3': 'excused', 'p3-e5': 'present',
    'p4-e1': 'absent', 'p4-e2': 'present', 'p4-e3': 'needs-makeup',
    'p5-e1': 'present', 'p5-e2': 'present', 'p5-e4': 'present', 'p5-e5': 'present',
    'p6-e2': 'made-up', 'p6-e3': 'absent',
  };
  return table;
}

/* -------------------------------------------------------------------------- */
/* normalising + migration                                                     */
/* -------------------------------------------------------------------------- */

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Accepts anything that has ever been a table — a v1 doc from Firestore, a
 * half-written localStorage blob, `undefined` — and returns a valid v2 table.
 * Never throws; anything unrecognisable is dropped rather than propagated.
 */
export function normalizeTable(raw) {
  if (!isObject(raw)) return emptyTable();

  const source = raw.version >= 2 ? raw : migrateV1(raw);
  const base = emptyTable();

  const people = asArray(source.people)
    .filter((p) => isObject(p) && p.id != null)
    .map((p) => ({
      id: String(p.id),
      name: typeof p.name === 'string' ? p.name : 'Unnamed',
      // Other spellings this person is known by, so a pasted sign-in sheet
      // saying "Liv" or "Charles LT" still finds them.
      aliases: asArray(p.aliases).filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim()),
    }));

  const groups = asArray(source.groups)
    .filter((g) => isObject(g) && g.id != null)
    .map((g) => ({
      id: String(g.id),
      name: typeof g.name === 'string' ? g.name : 'Group',
      color: isHexColor(g.color) ? g.color : '#9aa5b1',
      memberIds: asArray(g.memberIds).map(String),
    }));

  const folders = asArray(source.folders)
    .filter((f) => isObject(f) && f.id != null)
    .map((f) => ({
      id: String(f.id),
      name: typeof f.name === 'string' ? f.name : 'Folder',
      isOpen: f.isOpen !== false,
    }));

  const terms = asArray(source.terms)
    .filter((t) => isObject(t) && t.id != null)
    .map((t) => ({
      id: String(t.id),
      name: typeof t.name === 'string' ? t.name : 'Term',
      startDate: asDate(t.startDate),
      endDate: asDate(t.endDate),
    }))
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  const termIds = new Set(terms.map((t) => t.id));
  const folderIds = new Set(folders.map((f) => f.id));
  const events = asArray(source.events)
    .filter((e) => isObject(e) && e.id != null)
    .map((e) => ({
      id: String(e.id),
      name: typeof e.name === 'string' ? e.name : 'Event',
      weight: clampWeight(e.weight),
      folderId: e.folderId != null && folderIds.has(String(e.folderId)) ? String(e.folderId) : null,
      termId: e.termId != null && termIds.has(String(e.termId)) ? String(e.termId) : null,
      startDate: asDate(e.startDate),
      endDate: asDate(e.endDate),
    }));

  const settings = normalizeSettings(source.settings, base.settings);
  const statusIds = new Set(settings.statuses.map((s) => s.id));

  return {
    version: SCHEMA_VERSION,
    people,
    groups,
    folders,
    terms,
    events,
    attendance: pruneAttendance(source.attendance, people, events, statusIds),
    settings,
  };
}

export function normalizeSettings(raw, defaults) {
  if (!isObject(raw)) return defaults;

  const statuses = asArray(raw.statuses)
    .filter((s) => isObject(s) && s.id != null)
    .map((s) => ({
      id: String(s.id),
      name: typeof s.name === 'string' && s.name.trim() ? s.name : String(s.id),
      // null is meaningful: "does not count either way".
      credit: s.credit === null || s.credit === undefined ? null : clampCredit(s.credit),
      color: isHexColor(s.color) ? s.color : '#e9ecef',
    }));

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, MAX_TABLE_NAME) : null;

  return {
    ...defaults,
    ...(name ? { name } : {}),
    ...pickBooleans(raw, [
      'countUnmarkedAsAbsent',
      'showTitle',
      'colorCells',
      'colorDropdown',
      'highlightHover',
      'stickyColumns',
    ]),
    statuses: statuses.length > 0 ? statuses : defaults.statuses,
  };
}

/**
 * Drops attendance for people, events and statuses that no longer exist.
 * The old model never did this, so deleted rows kept their cells forever and
 * shipped them to the cloud on every write.
 */
export function pruneAttendance(raw, people, events, statusIds) {
  if (!isObject(raw)) return {};
  const out = {};
  for (const person of people) {
    for (const event of events) {
      const key = cellKey(person.id, event.id);
      const value = raw[key];
      if (typeof value === 'string' && statusIds.has(value)) out[key] = value;
    }
  }
  return out;
}

/**
 * v1 stored folders and events in one array, kept a denormalised copy of group
 * membership on each person, and named the scoring toggle after its inverse.
 */
function migrateV1(raw) {
  const folders = [];
  const events = [];

  for (const item of asArray(raw.events)) {
    if (!isObject(item)) continue;
    if (item.isFolder) {
      folders.push({ id: item.id, name: item.name, isOpen: item.isOpen !== false });
      for (const child of asArray(item.events)) {
        if (isObject(child)) events.push({ ...child, folderId: item.id });
      }
    } else {
      events.push({ ...item, folderId: null });
    }
  }

  // v1 wrote membership in two places and they drifted. `groups[].memberIds` was
  // the one the editor actually maintained, so it wins; `person.groups` is only
  // consulted for people no group claims.
  const groups = asArray(raw.groups)
    .filter(isObject)
    .map((g) => ({ ...g, memberIds: asArray(g.memberIds).map(String) }));
  const claimed = new Set(groups.flatMap((g) => g.memberIds));

  for (const person of asArray(raw.people)) {
    if (!isObject(person) || claimed.has(String(person.id))) continue;
    for (const chip of asArray(person.groups)) {
      // Chips were written as both `{ id, color }` and as a bare id string.
      const groupId = String(isObject(chip) ? chip.id : chip);
      const group = groups.find((g) => String(g.id) === groupId);
      if (group && !group.memberIds.includes(String(person.id))) {
        group.memberIds.push(String(person.id));
      }
    }
  }

  const legacy = isObject(raw.settings) ? raw.settings : {};
  const statuses = asArray(legacy.customStatuses)
    .filter(isObject)
    .map((s) => ({ id: String(s.id), name: s.name, credit: s.credit, color: s.color }));

  return {
    version: SCHEMA_VERSION,
    people: asArray(raw.people).map((p) => (isObject(p) ? { id: p.id, name: p.name } : p)),
    groups,
    folders,
    terms: [],
    events,
    attendance: isObject(raw.attendance) ? raw.attendance : {},
    settings: {
      ...legacy,
      statuses: statuses.length > 0 ? statuses : DEFAULT_STATUSES,
      // v1's `onlyCountAbsent: true` meant "ignore unmarked cells" — the
      // opposite of what the new name says, and the setting the old scorer
      // ignored entirely.
      countUnmarkedAsAbsent: legacy.onlyCountAbsent === false,
      showTitle: legacy.hideTitle === false,
      colorCells: legacy.colorCodeAttendance !== false,
      colorDropdown: legacy.colorChangeDropdown === true,
      highlightHover: legacy.showHoverHighlight !== false,
      stickyColumns: legacy.enableStickyColumns !== false,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* small coercions                                                            */
/* -------------------------------------------------------------------------- */

const asArray = (v) => (Array.isArray(v) ? v : []);

function pickBooleans(source, keys) {
  const out = {};
  for (const key of keys) {
    if (typeof source[key] === 'boolean') out[key] = source[key];
  }
  return out;
}

export function clampWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.min(n, 100);
}

export function clampCredit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** Dates are stored as plain `YYYY-MM-DD` — never as Date objects or epochs. */
function asDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * Parses a stored date at noon UTC. Midnight local would land on the previous
 * day for anyone west of UTC, which is how a Friday event used to display as
 * Thursday.
 */
export function parseDate(value) {
  return value ? new Date(`${value}T12:00:00Z`) : null;
}

export function formatDateRange(startDate, endDate) {
  const start = parseDate(startDate);
  if (!start) return '';
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  const end = parseDate(endDate);
  return end && endDate !== startDate ? `${fmt(start)}–${fmt(end)}` : fmt(start);
}
