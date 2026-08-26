/**
 * Local persistence.
 *
 * v1 kept exactly one table in five loose top-level localStorage keys, so
 * opening a shared link overwrote whatever you had. Tables are now keyed by id
 * and listed in a registry, which is what makes "switch back to my table" a
 * real action instead of a warning dialog.
 */

import { normalizeTable, emptyTable, demoTable } from './model';

const REGISTRY_KEY = 'at:registry';
const ACTIVE_KEY = 'at:active';
const TABLE_PREFIX = 'at:table:';

/** The id of the table that has never been shared. Everything else is a code. */
export const LOCAL_TABLE_ID = 'local';

const LEGACY_KEYS = ['people', 'events', 'attendance', 'groups', 'settings', 'tableCode'];

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

export function rememberTable(id, name) {
  const entries = listTables().filter((entry) => entry.id !== id);
  entries.unshift({ id, name: name || defaultName(id), updatedAt: new Date().toISOString() });
  writeJson(REGISTRY_KEY, entries.slice(0, 12));
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

export function defaultName(id) {
  if (id === LOCAL_TABLE_ID) return 'My table';
  return id.startsWith(LOCAL_PREFIX) ? 'Untitled table' : `Table ${id}`;
}

export function newLocalTableId() {
  return `${LOCAL_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
}

/** Renames a table for this browser only; it is not part of the shared data. */
export function renameTable(id, name) {
  const entries = listTables().map((entry) => (entry.id === id ? { ...entry, name } : entry));
  writeJson(REGISTRY_KEY, entries);
}

/* -------------------------------------------------------------------------- */
/* tables                                                                     */
/* -------------------------------------------------------------------------- */

export function loadTable(id) {
  const stored = readJson(TABLE_PREFIX + id, null);
  return stored ? normalizeTable(stored) : null;
}

export function saveTable(id, table) {
  return writeJson(TABLE_PREFIX + id, table);
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
  if (!found) return null;

  const table = normalizeTable({
    people: legacy.people,
    events: legacy.events,
    groups: legacy.groups,
    attendance: legacy.attendance,
    settings: legacy.settings,
  });

  for (const key of LEGACY_KEYS) {
    if (legacy[key] === undefined) continue;
    writeJson(`at:legacy:${key}`, legacy[key]);
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to do */
    }
  }

  // A v1 table that was already shared keeps its code, so the same link works.
  const code = typeof legacy.tableCode === 'string' ? legacy.tableCode.toUpperCase() : null;
  if (code) {
    saveTable(code, table);
    rememberTable(code, defaultName(code));
    setActiveTableId(code);
  }

  return table;
}

export { emptyTable };
