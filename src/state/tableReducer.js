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

import {
  cellKey,
  clampWeight,
  defaultSettings,
  newId,
  normalizeSettings,
  normalizeTable,
  pruneAttendance,
} from '../data/model';
import { occurrences } from '../data/recurrence';

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
      const people = action.names.map((name) => ({ id: newId('p'), name, aliases: [] }));
      if (people.length === 0) return state;
      return {
        table: { ...table, people: [...table.people, ...people] },
        outbox: mark(outbox, 'roster'),
      };
    }

    /** Records another spelling of someone's name, for matching pasted lists. */
    case 'people/setAliases': {
      return {
        table: {
          ...table,
          people: table.people.map((person) =>
            person.id === action.id ? { ...person, aliases: action.aliases } : person
          ),
        },
        outbox: mark(outbox, 'roster'),
      };
    }

    /**
     * Folds one person into another: alias lists, group memberships, and any
     * marks the loser has that the winner does not. The old rosters are full of
     * the same student under two spellings, so this is the cleanup after an
     * import.
     */
    case 'people/merge': {
      const winner = table.people.find((p) => p.id === action.keepId);
      const loser = table.people.find((p) => p.id === action.mergeId);
      if (!winner || !loser || winner.id === loser.id) return state;

      const aliases = Array.from(
        new Set([...(winner.aliases || []), ...(loser.aliases || []), loser.name])
      );
      const attendance = { ...table.attendance };
      const cells = {};

      for (const event of table.events) {
        const from = cellKey(loser.id, event.id);
        const to = cellKey(winner.id, event.id);
        if (!(from in attendance)) continue;
        // The kept person's own marks win; only their gaps are filled.
        if (!(to in attendance)) {
          attendance[to] = attendance[from];
          cells[to] = attendance[from];
        }
        delete attendance[from];
        cells[from] = null;
      }

      return {
        table: {
          ...table,
          people: table.people
            .filter((p) => p.id !== loser.id)
            .map((p) => (p.id === winner.id ? { ...p, aliases } : p)),
          groups: table.groups.map((group) => ({
            ...group,
            memberIds: group.memberIds.includes(loser.id)
              ? Array.from(new Set(group.memberIds.map((id) => (id === loser.id ? winner.id : id))))
              : group.memberIds,
          })),
          attendance,
        },
        outbox: markCells(mark(outbox, 'roster'), cells),
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

    /* ----------------------------------------------------------------- terms */

    case 'terms/add': {
      const term = {
        id: newId('t'),
        name: action.name,
        startDate: action.startDate || null,
        endDate: action.endDate || null,
      };
      return {
        table: { ...table, terms: sortTerms([...table.terms, term]) },
        outbox: mark(outbox, 'schedule'),
      };
    }

    case 'terms/update': {
      return {
        table: {
          ...table,
          terms: sortTerms(
            table.terms.map((term) => (term.id === action.id ? { ...term, ...action.changes } : term))
          ),
        },
        outbox: mark(outbox, 'schedule'),
      };
    }

    case 'terms/remove': {
      // The events survive and simply stop belonging to a term, so removing one
      // never destroys a semester's attendance.
      return {
        table: {
          ...table,
          terms: table.terms.filter((term) => term.id !== action.id),
          events: table.events.map((e) => (e.termId === action.id ? { ...e, termId: null } : e)),
        },
        outbox: mark(outbox, 'schedule'),
      };
    }

    /* --------------------------------------------------------------- folders */

    case 'folders/add': {
      const folder = {
        id: newId('f'),
        name: action.name,
        isOpen: true,
        parentId: action.parentId || null,
        groupId: action.groupId || null,
      };
      return {
        table: { ...table, folders: [...table.folders, folder] },
        outbox: mark(outbox, 'schedule'),
      };
    }

    /** Moves a folder into a section, or back out to the top level. */
    case 'folders/setParent': {
      // A folder with children cannot itself be filed inside one; two levels is
      // what the header can draw.
      const hasChildren = table.folders.some((f) => f.parentId === action.id);
      const target = table.folders.find((f) => f.id === action.parentId);
      if (action.parentId && (hasChildren || !target || target.parentId || target.id === action.id)) {
        return state;
      }
      return {
        table: {
          ...table,
          folders: table.folders.map((f) =>
            f.id === action.id ? { ...f, parentId: action.parentId || null } : f
          ),
        },
        outbox: mark(outbox, 'schedule'),
      };
    }

    /** Points a series of sessions at the cohort that attends it, or at nobody. */
    case 'folders/setGroup': {
      return {
        table: {
          ...table,
          folders: table.folders.map((f) =>
            f.id === action.id ? { ...f, groupId: action.groupId || null } : f
          ),
        },
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
      // Deliberately does not mark the outbox: whether a folder is collapsed is
      // a view preference like the filters and the sort, and pushing it would
      // fold the folder shut under everyone else mid-meeting.
      return {
        table: {
          ...table,
          folders: table.folders.map((f) => (f.id === action.id ? { ...f, isOpen: !f.isOpen } : f)),
        },
        outbox,
      };
    }

    case 'folders/remove': {
      // Deleting a folder releases its events, and lifts any folders inside it
      // to the top rather than taking them down with it. v1 did the reverse —
      // deleting the last event in a folder silently deleted the folder too.
      return {
        table: {
          ...table,
          folders: table.folders
            .filter((f) => f.id !== action.id)
            .map((f) => (f.parentId === action.id ? { ...f, parentId: null } : f)),
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
        const folder = {
          id: newId('f'),
          name: action.newFolderName,
          isOpen: true,
          parentId: action.folderParentId || null,
          groupId: action.folderGroupId || null,
        };
        folders = [...folders, folder];
        folderId = folder.id;
      }

      const event = {
        id: newId('e'),
        name: action.name,
        weight: clampWeight(action.weight),
        folderId,
        termId: action.termId || null,
        startDate: action.startDate || null,
        endDate: action.endDate || null,
      };
      return {
        table: { ...table, folders, events: [...table.events, event] },
        outbox: mark(outbox, 'schedule'),
      };
    }

    /**
     * Builds a whole semester of a weekly meeting at once.
     *
     * Every check-in block in the old spreadsheets is exactly this shape — one
     * weekday, fifteen weeks — and every one was typed out by hand. One of them
     * has a date from the wrong semester in the middle of it.
     */
    case 'events/addRecurring': {
      let folders = table.folders;
      let folderId = action.folderId || null;

      if (action.newFolderName) {
        const folder = {
          id: newId('f'),
          name: action.newFolderName,
          isOpen: true,
          parentId: action.folderParentId || null,
          groupId: action.folderGroupId || null,
        };
        folders = [...folders, folder];
        folderId = folder.id;
      }

      const dates = occurrences({
        repeats: action.repeats || 'weekly',
        startDate: action.startDate,
        endDate: action.endDate,
        weekday: action.weekday,
        skip: action.skipDates,
      });
      if (dates.length === 0) return state;

      const events = dates.map((date) => ({
        id: newId('e'),
        name: action.name,
        weight: clampWeight(action.weight),
        folderId,
        termId: action.termId || null,
        startDate: date,
        endDate: null,
      }));

      return {
        table: { ...table, folders, events: [...table.events, ...events] },
        outbox: mark(outbox, 'schedule'),
      };
    }

    /**
     * Applies a whole imported grid at once — new people, groups, folders,
     * terms, events and every mark — as a single action, so it is one step and
     * one sync write rather than hundreds.
     */
    case 'table/import': {
      const payload = action.payload || {};
      const attendance = payload.attendance || {};

      // Sessions that already existed come back as updates rather than
      // additions, so the term chosen in the dialog applies to every column
      // being imported and not only to the ones it had to create.
      const updates = new Map((payload.updatedEvents || []).map((event) => [event.id, event]));
      const events = table.events.map((event) => updates.get(event.id) || event);

      return {
        table: {
          ...table,
          people: [...table.people, ...(payload.people || [])],
          groups: mergeGroups(table.groups, payload.groups || []),
          folders: [...table.folders, ...(payload.folders || [])],
          terms: sortTerms([...table.terms, ...(payload.terms || [])]),
          events: [...events, ...(payload.events || [])],
          attendance: { ...table.attendance, ...attendance },
        },
        outbox: markCells(mark(outbox, 'roster', 'schedule'), attendance),
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
     * Opening a shared table. `upgrade` is set when the cloud copy still uses
     * the old single-document layout: the whole table is queued for writing so
     * the per-slice documents get laid down once, rather than appearing one at a
     * time as edits happen and leaving other clients reading a half-migrated
     * table.
     */
    case 'table/adopt':
      return {
        table: normalizeTable(action.table),
        outbox: action.upgrade
          ? { roster: true, schedule: true, settings: true, attendance: {}, attendanceReplace: true }
          : emptyOutbox(),
      };

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
      if (merged === table) return state;

      // Only a roster or schedule change can orphan a cell. Pruning after an
      // attendance merge would delete marks whose event or person simply has
      // not arrived yet — the four slices are separate documents and their
      // snapshots are not ordered — and `lastAttendance` in the sync layer has
      // already accepted them, so they would never be re-delivered.
      const cleaned = action.slice === 'attendance' ? merged : reconcile(merged);
      return { table: cleaned, outbox };
    }

    /**
     * A write failed. Put what it claimed back, without clobbering anything
     * edited while it was in flight — the drain is optimistic, so without this
     * a rejected write silently discards the edits it was carrying.
     */
    case 'sync/requeue': {
      const attendance = { ...(action.cells || {}), ...outbox.attendance };
      const next = { ...outbox, attendance };
      for (const slice of action.slices || []) next[slice] = true;
      if (action.attendanceReplace) next.attendanceReplace = true;
      return { ...state, outbox: next };
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

const sortTerms = (terms) =>
  terms.slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

/** An imported group folds into the existing one it matches, by id or by name. */
function mergeGroups(existing, incoming) {
  const merged = existing.map((group) => ({ ...group }));
  const byId = new Map(merged.map((group) => [group.id, group]));
  const byName = new Map(merged.map((group) => [group.name.toLowerCase(), group]));
  const added = [];

  for (const group of incoming) {
    const match = byId.get(group.id) || byName.get(group.name.toLowerCase());
    if (match) {
      match.memberIds = Array.from(new Set([...match.memberIds, ...group.memberIds]));
      continue;
    }
    // Register as we go, so two incoming groups sharing a name fold together
    // instead of both landing.
    const copy = { ...group };
    added.push(copy);
    byId.set(copy.id, copy);
    byName.set(copy.name.toLowerCase(), copy);
  }

  return [...merged, ...added];
}

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

/**
 * Splices a slice that arrived over the wire into the table.
 *
 * Everything here is untrusted. Joining a table runs the payload through
 * `normalizeTable`, but live updates arrive as raw snapshot data — so a
 * half-written or future-schema document would otherwise reach the renderer
 * unchecked, and something as small as `settings.statuses` not being an array
 * throws during render and blanks the page for every connected client.
 */
function mergeSlice(table, slice, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return table;

  switch (slice) {
    case 'roster':
      return {
        ...table,
        people: Array.isArray(data.people) ? data.people : table.people,
        groups: Array.isArray(data.groups) ? data.groups : table.groups,
      };
    case 'schedule':
      return {
        ...table,
        folders: Array.isArray(data.folders) ? withLocalCollapse(data.folders, table.folders) : table.folders,
        events: Array.isArray(data.events) ? data.events : table.events,
        terms: Array.isArray(data.terms) ? data.terms : table.terms,
      };
    case 'settings':
      return {
        ...table,
        settings: normalizeSettings({ ...table.settings, ...data }, defaultSettings()),
      };
    case 'attendance': {
      // Field-level: only the keys the sender actually touched.
      const attendance = { ...table.attendance };
      for (const [key, value] of Object.entries(data)) {
        if (value === null) delete attendance[key];
        else if (typeof value === 'string') attendance[key] = value;
      }
      return { ...table, attendance };
    }
    default:
      return table;
  }
}

/**
 * Keeps each folder collapsed or expanded the way this viewer left it. The
 * incoming folders carry no `isOpen` at all, and a folder nobody has seen
 * before opens.
 */
function withLocalCollapse(incoming, local) {
  const wasOpen = new Map(local.map((folder) => [folder.id, folder.isOpen]));
  return incoming.map((folder) => ({
    ...folder,
    isOpen: wasOpen.has(folder.id) ? wasOpen.get(folder.id) : folder.isOpen !== false,
  }));
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
