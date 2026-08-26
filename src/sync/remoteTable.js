/**
 * Turns what Firestore returns into a table.
 *
 * Kept separate from the Firestore calls so it can be tested directly — this is
 * the code path that decides whether someone's existing shared table survives
 * the move to per-slice documents.
 */

import { normalizeTable } from '../data/model';

/**
 * Tables created before the split stored everything in `tables/{CODE}` itself
 * and have no `slices` subcollection. Recognise those by the fields the old
 * writer used, and hand the whole document to `normalizeTable`, which already
 * knows how to read the v1 shape.
 */
export function isLegacyRemote(remote) {
  if (!remote || !remote.meta) return false;
  const hasSlices = Boolean(remote.roster || remote.schedule || remote.attendance);
  if (hasSlices) return false;
  return Boolean(
    Array.isArray(remote.meta.people) ||
      Array.isArray(remote.meta.events) ||
      (remote.meta.attendance && typeof remote.meta.attendance === 'object')
  );
}

/** @returns {object|null} a normalized table, or null if the document is empty. */
export function tableFromRemote(remote) {
  if (!remote) return null;

  if (isLegacyRemote(remote)) {
    return normalizeTable({
      people: remote.meta.people,
      groups: remote.meta.groups,
      events: remote.meta.events,
      attendance: remote.meta.attendance,
      settings: remote.meta.settings,
    });
  }

  return normalizeTable({
    version: 2,
    people: remote.roster?.people,
    groups: remote.roster?.groups,
    folders: remote.schedule?.folders,
    events: remote.schedule?.events,
    settings: remote.settings,
    attendance: remote.attendance,
  });
}

export function remoteTableName(remote, fallback) {
  const name = remote?.meta?.name;
  return typeof name === 'string' && name.trim() ? name : fallback;
}
