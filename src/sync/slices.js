/**
 * How a table is cut into Firestore documents, and how remote attendance is
 * turned into a set of changes.
 *
 * These are pure so they can be tested without a network or an emulator. The
 * write path and the read path have to agree on field names exactly; if they
 * drift, a shared table silently loses a whole slice, which is not something a
 * type-free codebase catches on its own. `slices.test.js` round-trips a table
 * through both to pin that down.
 */

export const SLICE_NAMES = ['roster', 'schedule', 'settings', 'attendance'];

/** The payload written for each structural slice. Attendance is handled per cell. */
export const SLICE_PAYLOAD = {
  roster: (table) => ({ people: table.people, groups: table.groups }),
  schedule: (table) => ({
    // `isOpen` is stripped on the way out. Whether a folder is collapsed is a
    // per-viewer preference, and shipping the folder objects whole meant any
    // schedule edit — adding an event, renaming a folder — folded everyone
    // else's folders to match the writer's screen.
    folders: table.folders.map(({ isOpen, ...folder }) => folder),
    events: table.events,
  }),
  settings: (table) => table.settings,
};

/** The whole table as the four documents Firestore stores. */
export function toSlices(table) {
  return {
    roster: SLICE_PAYLOAD.roster(table),
    schedule: SLICE_PAYLOAD.schedule(table),
    settings: SLICE_PAYLOAD.settings(table),
    attendance: table.attendance,
  };
}

/**
 * The cells that changed between two attendance snapshots. `null` marks a cell
 * the other end deleted.
 *
 * Applying the diff rather than the whole remote document is what stops a
 * snapshot from reverting a mark made locally while it was in flight.
 */
export function diffAttendance(previous, next) {
  const changed = {};

  for (const [key, value] of Object.entries(next)) {
    if (previous[key] !== value) changed[key] = value;
  }
  for (const key of Object.keys(previous)) {
    if (!(key in next)) changed[key] = null;
  }

  return changed;
}
