/**
 * Local persistence.
 *
 * v1 kept exactly one table in five loose top-level localStorage keys, so
 * opening a shared link overwrote whatever you had. Tables are now keyed by id
 * and listed in a registry, which is what makes "switch back to my table" a
 * real action instead of a warning dialog.
 */

import { normalizeTable, emptyTable, demoTable } from './model';
import { isValidTableCode } from './tableCode';

const REGISTRY_KEY = 'at:registry';
const ACTIVE_KEY = 'at:active';
const TABLE_PREFIX = 'at:table:';

/** The id of the table that has never been shared. Everything else is a code. */
export const LOCAL_TABLE_ID = 'local';

/** v1's JSON-encoded keys. `tableCode` is deliberately absent — see below. */
const LEGACY_KEYS = ['people', 'events', 'attendance', 'groups', 'settings'];
const LEGACY_CODE_KEY = 'tableCode';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    // Corrupt or unavailable (private mode, quota). Fall back rather than crash.
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* registry                                                                   */
/* -------------------------------------------------------------------------- */

/** @returns {Array<{id: string, name: string, updatedAt: string}>} */
export function listTables() {
  const entries = readJson(REGISTRY_KEY, []);
  return Array.isArray(entries) ? entries.filter((e) => e && typeof e.id === 'string') : [];
}

const REGISTRY_LIMIT = 12;

export function rememberTable(id, name) {
  const existing = listTables().find((entry) => entry.id === id);
  const entries = listTables().filter((entry) => entry.id !== id);
  entries.unshift({
    id,
    name: name || existing?.name || defaultName(id),
    updatedAt: new Date().toISOString(),
  });

  // A shared table can be reopened from its link; a local one cannot, and
  // dropping it from the list would strand its data with no route back. So the
  // cap only ever evicts shared tables.
  const kept = [];
  const evicted = [];
  for (const entry of entries) {
    if (kept.length < REGISTRY_LIMIT || isLocalTableId(entry.id)) kept.push(entry);
    else evicted.push(entry);
  }

  writeJson(REGISTRY_KEY, kept);
  for (const entry of evicted) {
    try {
      localStorage.removeItem(TABLE_PREFIX + entry.id);
    } catch {
      /* nothing to do */
    }
  }
}

export function isLocalTableId(id) {
  return id === LOCAL_TABLE_ID || id.startsWith(LOCAL_PREFIX);
}

export function forgetTable(id) {
  writeJson(REGISTRY_KEY, listTables().filter((entry) => entry.id !== id));
  try {
    localStorage.removeItem(TABLE_PREFIX + id);
  } catch {
    /* nothing to do */
  }
}

/** Ids for extra local tables. Deliberately not share-code shaped. */
const LOCAL_PREFIX = 'local-';

/** Only used before a table has been loaded and its real name is known. */
export function defaultName(id) {
  if (id === LOCAL_TABLE_ID) return 'My table';
  return id.startsWith(LOCAL_PREFIX) ? 'Untitled table' : `Table ${id}`;
}

export function newLocalTableId() {
  return `${LOCAL_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------- */
/* tables                                                                     */
/* -------------------------------------------------------------------------- */

export function loadTable(id) {
  const stored = readJson(TABLE_PREFIX + id, null);
  return stored ? normalizeTable(stored) : null;
}

export function saveTable(id, table) {
  const saved = writeJson(TABLE_PREFIX + id, table);

  // The registry's name is only a cache so the switcher can list tables it has
  // not loaded. The table's own name is the source of truth, and it syncs.
  const name = table?.settings?.name;
  if (saved && name) {
    const entries = listTables();
    const entry = entries.find((item) => item.id === id);
    if (entry && entry.name !== name) {
      writeJson(
        REGISTRY_KEY,
        entries.map((item) => (item.id === id ? { ...item, name } : item))
      );
    }
  }

  return saved;
}

export function getActiveTableId() {
  try {
    return localStorage.getItem(ACTIVE_KEY) || LOCAL_TABLE_ID;
  } catch {
    return LOCAL_TABLE_ID;
  }
}

export function setActiveTableId(id) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* nothing to do */
  }
}

/**
 * First run for this browser: pull a v1 table across if there is one, otherwise
 * seed the demo so the table is never an empty grid with no explanation.
 */
export function bootstrapLocalTable() {
  const existing = loadTable(LOCAL_TABLE_ID);
  if (existing) return existing;

  const migrated = migrateLegacyStorage();
  const table = migrated || demoTable();
  saveTable(LOCAL_TABLE_ID, table);
  rememberTable(LOCAL_TABLE_ID, defaultName(LOCAL_TABLE_ID));
  return table;
}

/**
 * Reads the v1 layout and, if it finds one, converts it and moves the old keys
 * aside under `at:legacy:*` rather than deleting them — this runs against
 * someone's only copy of real data.
 */
export function migrateLegacyStorage() {
  const legacy = {};
  let found = false;

  for (const key of LEGACY_KEYS) {
    const value = readJson(key, undefined);
    if (value !== undefined) {
      legacy[key] = value;
      found = true;
    }
  }

  // v1 stored the share code as a bare string, so it is read directly. Putting
  // it through readJson meant JSON.parse('QK4M9P') threw, the code came back
  // undefined, and every table that was already being shared quietly became a
  // local-only one with no way back to it.
  const code = readLegacyCode();
  if (code) found = true;

  if (!found) return null;

  const table = normalizeTable({
    people: legacy.people,
    events: legacy.events,
    groups: legacy.groups,
    attendance: legacy.attendance,
    // v1 had no table name, and "Untitled table" is a poor thing to greet
    // someone with on the table they have been using all year.
    settings: { ...(legacy.settings || {}), name: legacy.settings?.name || 'My table' },
  });

  // Write the converted table before touching the originals: this runs against
  // what may be the only copy of someone's data.
  if (code) {
    saveTable(code, table);
    rememberTable(code, defaultName(code));
    setActiveTableId(code);
  }
  saveTable(LOCAL_TABLE_ID, table);

  for (const key of [...LEGACY_KEYS, LEGACY_CODE_KEY]) {
    const value = key === LEGACY_CODE_KEY ? code : legacy[key];
    if (value === undefined || value === null) continue;
    // Only drop the original once the backup is definitely written.
    if (!writeJson(`at:legacy:${key}`, value)) continue;
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to do */
    }
  }

  return table;
}

/** v1 wrote `tableCode` as a raw string, never as JSON. */
function readLegacyCode() {
  let raw = null;
  try {
    raw = localStorage.getItem(LEGACY_CODE_KEY);
  } catch {
    return null;
  }
  if (typeof raw !== 'string') return null;
  const code = raw.trim().replace(/^"|"$/g, '').toUpperCase();
  return isValidTableCode(code) ? code : null;
}

export { emptyTable };
