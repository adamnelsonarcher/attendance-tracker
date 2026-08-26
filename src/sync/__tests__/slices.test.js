import { diffAttendance, toSlices } from '../slices';
import { tableFromRemote } from '../remoteTable';
import { demoTable, emptyTable } from '../../data/model';

describe('slice round trip', () => {
  /**
   * The write path and the read path have to name the same fields. Nothing in a
   * plain-JS codebase enforces that, and getting it wrong loses a whole slice of
   * a shared table silently — so pin it down here rather than in production.
   */
  const roundTrip = (table) => tableFromRemote({ meta: { version: 2 }, ...toSlices(table) });

  it('survives a full table unchanged', () => {
    const table = demoTable();
    expect(roundTrip(table)).toEqual(table);
  });

  it('survives an empty table unchanged', () => {
    const table = emptyTable();
    expect(roundTrip(table)).toEqual(table);
  });

  it('carries every collection across', () => {
    const table = demoTable();
    const result = roundTrip(table);

    expect(result.people).toHaveLength(table.people.length);
    expect(result.groups).toHaveLength(table.groups.length);
    expect(result.folders).toHaveLength(table.folders.length);
    expect(result.events).toHaveLength(table.events.length);
    expect(Object.keys(result.attendance)).toHaveLength(Object.keys(table.attendance).length);
  });

  it('keeps folder membership and weights', () => {
    const table = demoTable();
    const result = roundTrip(table);

    for (const event of table.events) {
      const same = result.events.find((e) => e.id === event.id);
      expect(same.folderId).toBe(event.folderId);
      expect(same.weight).toBe(event.weight);
      expect(same.startDate).toBe(event.startDate);
    }
  });

  it('keeps the statuses that scores depend on', () => {
    const table = demoTable();
    expect(roundTrip(table).settings.statuses).toEqual(table.settings.statuses);
  });

  it('writes exactly the four documents Firestore stores', () => {
    expect(Object.keys(toSlices(demoTable())).sort()).toEqual([
      'attendance',
      'roster',
      'schedule',
      'settings',
    ]);
  });
});

describe('diffAttendance', () => {
  it('reports nothing when nothing moved', () => {
    expect(diffAttendance({ 'p1-e1': 'present' }, { 'p1-e1': 'present' })).toEqual({});
  });

  it('reports an added cell', () => {
    expect(diffAttendance({}, { 'p1-e1': 'present' })).toEqual({ 'p1-e1': 'present' });
  });

  it('reports a changed cell', () => {
    expect(diffAttendance({ 'p1-e1': 'present' }, { 'p1-e1': 'late' })).toEqual({ 'p1-e1': 'late' });
  });

  it('reports a deleted cell as null', () => {
    expect(diffAttendance({ 'p1-e1': 'present' }, {})).toEqual({ 'p1-e1': null });
  });

  it('leaves untouched cells out, which is what protects a concurrent local edit', () => {
    // Another device marked p2 while this one was marking p1. The snapshot
    // carries both, but only p2 is new to us — replacing wholesale here is what
    // used to revert the local edit.
    const previous = { 'p1-e1': 'present', 'p2-e1': 'absent' };
    const next = { 'p1-e1': 'present', 'p2-e1': 'late' };

    expect(diffAttendance(previous, next)).toEqual({ 'p2-e1': 'late' });
  });

  it('handles a wholesale clear', () => {
    expect(diffAttendance({ a: 'x', b: 'y' }, {})).toEqual({ a: null, b: null });
  });
});
