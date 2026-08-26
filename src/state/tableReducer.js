/**
 * One reducer for the whole table.
 *
 * v1 spread this across five hooks that each returned a positional array —
 * `useEvents` returned eleven elements — so adding an operation meant editing
 * every consumer. Every edit is now an action, which also gives sync something
 * precise to send: each action marks the slices it touched in `outbox`, and the
 * sync layer drains it. That is what makes concurrent editing safe, because we
 * push the cells that changed rather than overwriting the whole document.
 */

import { cellKey, clampWeight, newId, normalizeTable, pruneAttendance } from '../data/model';

export function initialState(table) {
  return { table, outbox: emptyOutbox() };
}

/**
 * What still needs sending. The structural slices are booleans — they are sent
 * whole — while `attendance` is the set of individual cells that changed, so
 * two people marking different rows never overwrite each other.
 * `attendanceReplace` is the exception: the whole column set is being replaced,
 * so the document is overwritten rather than merged.
 */
function emptyOutbox() {
  return { roster: false, schedule: false, settings: false, attendance: {}, attendanceReplace: false };
}

const mark = (outbox, ...slices) => {
  const next = { ...outbox };
  for (const slice of slices) next[slice] = true;
  return next;
};

const markCells = (outbox, cells) => ({
  ...outbox,
  attendance: { ...outbox.attendance, ...cells },
});

export function tableReducer(state, action) {
  const { table, outbox } = state;

  switch (action.type) {
    /* ---------------------------------------------------------------- people */

    case 'people/add': {
      const people = action.names.map((name) => ({ id: newId('p'), name }));
      if (people.length === 0) return state;
      return {
        table: { ...table, people: [...table.people, ...people] },
        outbox: mark(outbox, 'roster'),
      };
    }

    case 'people/rename': {
      return {
        table: {
          ...table,
          people: table.people.map((p) => (p.id === action.id ? { ...p, name: action.name } : p)),
        },
        outbox: mark(outbox, 'roster'),
      };
    }

    case 'people/remove': {
      // Drop their attendance too. v1 left these behind forever and shipped the
      // orphans to the cloud on every write.
      const cells = {};
      for (const event of table.events) cells[cellKey(action.id, event.id)] = null;
      return {
        table: {
          ...table,
          people: table.people.filter((p) => p.id !== action.id),
          groups: table.groups.map((g) => ({
            ...g,
            memberIds: g.memberIds.filter((id) => id !== action.id),
          })),
          attendance: without(table.attendance, Object.keys(cells)),
        },
        outbox: markCells(mark(outbox, 'roster'), cells),
      };
    }

    /* ---------------------------------------------------------------- groups */

    case 'groups/replace': {
      const known = new Set(table.people.map((p) => p.id));
      const groups = action.groups.map((group) => ({
        ...group,
        memberIds: group.memberIds.filter((id) => known.has(id)),
      }));
      return { table: { ...table, groups }, outbox: mark(outbox, 'roster') };
    }

    /* --------------------------------------------------------------- folders */

    case 'folders/add': {
      const folder = { id: newId('f'), name: action.name, isOpen: true };
      return {
        table: { ...table, folders: [...table.folders, folder] },
        outbox: mark(outbox, 'schedule'),
      };
    }

    case 'folders/rename': {
      return {
        table: {
          ...table,
          folders: table.folders.map((f) => (f.id === action.id ? { ...f, name: action.name } : f)),
        },
        outbox: mark(outbox, 'schedule'),
      };
    }

    case 'folders/toggle': {
      return {
        table: {
          ...table,
          folders: table.folders.map((f) => (f.id === action.id ? { ...f, isOpen: !f.isOpen } : f)),
        },
        outbox: mark(outbox, 'schedule'),
      };
    }

    case 'folders/remove': {
      // Deleting a folder releases its events. v1 did the reverse — deleting the
      // last event in a folder silently deleted the folder with it.
      return {
        table: {
          ...table,
          folders: table.folders.filter((f) => f.id !== action.id),
          events: table.events.map((e) => (e.folderId === action.id ? { ...e, folderId: null } : e)),
        },
        outbox: mark(outbox, 'schedule'),
      };
    }

    /* ---------------------------------------------------------------- events */

    case 'events/add': {
      let folders = table.folders;
      let folderId = action.folderId || null;

      if (action.newFolderName) {
        const folder = { id: newId('f'), name: action.newFolderName, isOpen: true };
        folders = [...folders, folder];
        folderId = folder.id;
      }

      const event = {
        id: newId('e'),
        name: action.name,
        weight: clampWeight(action.weight),
        folderId,
        startDate: action.startDate || null,
        endDate: action.endDate || null,
      };
      return {
        table: { ...table, folders, events: [...table.events, event] },
        outbox: mark(outbox, 'schedule'),
      };
    }

    case 'events/update': {
      const changes = { ...action.changes };
      if ('weight' in changes) changes.weight = clampWeight(changes.weight);
      return {
        table: {
          ...table,
          events: table.events.map((e) => (e.id === action.id ? { ...e, ...changes } : e)),
        },
        outbox: mark(outbox, 'schedule'),
      };
    }

    case 'events/remove': {
      const cells = {};
      for (const person of table.people) cells[cellKey(person.id, action.id)] = null;
      return {
        table: {
          ...table,
          events: table.events.filter((e) => e.id !== action.id),
          attendance: without(table.attendance, Object.keys(cells)),
        },
        outbox: markCells(mark(outbox, 'schedule'), cells),
      };
    }

    /* ------------------------------------------------------------ attendance */

    case 'attendance/set':
      return applyCells(state, [action]);

    case 'attendance/setMany':
      return applyCells(state, action.entries);

    case 'attendance/fillColumn': {
      // Only fills blanks, so it never overwrites a mark somebody made by hand.
      const entries = action.personIds
        .filter((personId) => !table.attendance[cellKey(personId, action.eventId)])
        .map((personId) => ({ personId, eventId: action.eventId, statusId: action.statusId }));
      return applyCells(state, entries);
    }

    case 'attendance/clearColumn': {
      const entries = action.personIds.map((personId) => ({
        personId,
        eventId: action.eventId,
        statusId: null,
      }));
      return applyCells(state, entries);
    }

    /* -------------------------------------------------------------- settings */

    case 'settings/update': {
      return {
        table: { ...table, settings: { ...table.settings, ...action.changes } },
        outbox: mark(outbox, 'settings'),
      };
    }

    case 'settings/setStatuses': {
      // Cells holding a status that no longer exists become unmarked, so scores
      // never silently reference a status nobody can see.
      const kept = new Set(action.statuses.map((s) => s.id));
      const cells = {};
      for (const [key, statusId] of Object.entries(table.attendance)) {
        if (!kept.has(statusId)) cells[key] = null;
      }
      return {
        table: {
          ...table,
          settings: { ...table.settings, statuses: action.statuses },
          attendance: without(table.attendance, Object.keys(cells)),
        },
        outbox: markCells(mark(outbox, 'settings'), cells),
      };
    }

    /* ----------------------------------------------------------------- table */

    /** Loading a table: from the cloud, from storage, or switching between them. */
    case 'table/replace':
      return { table: normalizeTable(action.table), outbox: emptyOutbox() };

    /**
     * Empties the table but keeps its statuses. Attendance is marked for
     * wholesale replacement rather than as a set of changed cells, so the
     * shared copy is emptied too instead of keeping every deleted mark.
     */
    case 'table/clear':
      return {
        table: { ...table, people: [], groups: [], folders: [], events: [], attendance: {} },
        outbox: { ...mark(outbox, 'roster', 'schedule'), attendance: {}, attendanceReplace: true },
      };

    /**
     * Housekeeping after a remote merge. Keeps the outbox — unlike
     * `table/replace`, this is not a new table, just the same one tidied, and
     * dropping the outbox here would discard local edits that have not been
     * sent yet.
     */
    case 'table/prune':
      return { ...state, table: action.table };

    /**
     * A slice arrived from another device. Remote wins for that slice only —
     * the rest of the local table is untouched, which is why two people editing
     * different columns no longer overwrite each other.
     */
    case 'remote/merge': {
      const merged = mergeSlice(table, action.slice, action.data);
      return merged === table ? state : { table: merged, outbox };
    }

    case 'sync/drained': {
      const attendance = { ...outbox.attendance };
      for (const key of action.cells || []) delete attendance[key];
      const next = { ...outbox, attendance };
      for (const slice of action.slices || []) next[slice] = false;
      if (action.attendanceReplace) next.attendanceReplace = false;
      return { ...state, outbox: next };
    }

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function without(source, keys) {
  if (keys.length === 0) return source;
  const next = { ...source };
  for (const key of keys) delete next[key];
  return next;
}

/**
 * Writes a batch of cells. `statusId: null` clears the cell, and clearing sends
 * an explicit null so the other end deletes it rather than keeping a stale mark.
 */
function applyCells(state, entries) {
  if (!entries || entries.length === 0) return state;

  const attendance = { ...state.table.attendance };
  const cells = {};
  let changed = false;

  for (const { personId, eventId, statusId } of entries) {
    const key = cellKey(personId, eventId);
    const next = statusId || null;
    if ((attendance[key] || null) === next) continue;
    changed = true;
    cells[key] = next;
    if (next) attendance[key] = next;
    else delete attendance[key];
  }

  if (!changed) return state;
  return {
    table: { ...state.table, attendance },
    outbox: markCells(state.outbox, cells),
  };
}

function mergeSlice(table, slice, data) {
  switch (slice) {
    case 'roster':
      return { ...table, people: data.people ?? table.people, groups: data.groups ?? table.groups };
    case 'schedule':
      return { ...table, folders: data.folders ?? table.folders, events: data.events ?? table.events };
    case 'settings':
      return { ...table, settings: { ...table.settings, ...data } };
    case 'attendance': {
      // Field-level: only the keys the sender actually touched.
      const attendance = { ...table.attendance };
      for (const [key, value] of Object.entries(data)) {
        if (value === null) delete attendance[key];
        else attendance[key] = value;
      }
      return { ...table, attendance };
    }
    default:
      return table;
  }
}

/**
 * Run after any remote merge that could have removed a person, event or status,
 * so no cell outlives what it points at.
 */
export function reconcile(table) {
  const statusIds = new Set(table.settings.statuses.map((s) => s.id));
  const attendance = pruneAttendance(table.attendance, table.people, table.events, statusIds);
  return Object.keys(attendance).length === Object.keys(table.attendance).length
    ? table
    : { ...table, attendance };
}
