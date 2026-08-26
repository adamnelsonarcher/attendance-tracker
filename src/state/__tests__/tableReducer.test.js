import { initialState, tableReducer, reconcile } from '../tableReducer';
import { emptyTable } from '../../data/model';

function seed() {
  const table = emptyTable();
  table.people = [
    { id: 'p1', name: 'Avery Chen' },
    { id: 'p2', name: 'Jordan Blake' },
  ];
  table.folders = [{ id: 'f1', name: 'Meetings', isOpen: true }];
  table.events = [
    { id: 'e1', name: 'One', weight: 1, folderId: 'f1', startDate: null, endDate: null },
    { id: 'e2', name: 'Two', weight: 1, folderId: null, startDate: null, endDate: null },
  ];
  table.attendance = { 'p1-e1': 'present', 'p2-e1': 'absent', 'p1-e2': 'late' };
  table.groups = [{ id: 'g1', name: 'Exec', color: '#000000', memberIds: ['p1', 'p2'] }];
  return initialState(table);
}

const run = (state, ...actions) => actions.reduce(tableReducer, state);

describe('removing things', () => {
  it('takes a person out of attendance and every group', () => {
    const next = run(seed(), { type: 'people/remove', id: 'p1' });

    expect(next.table.people.map((p) => p.id)).toEqual(['p2']);
    expect(next.table.attendance).toEqual({ 'p2-e1': 'absent' });
    expect(next.table.groups[0].memberIds).toEqual(['p2']);
  });

  it('queues the removed cells so the deletion reaches other clients', () => {
    const next = run(seed(), { type: 'people/remove', id: 'p1' });
    expect(next.outbox.attendance).toEqual({ 'p1-e1': null, 'p1-e2': null });
  });

  it('clears an event out of attendance too', () => {
    const next = run(seed(), { type: 'events/remove', id: 'e1' });
    expect(next.table.attendance).toEqual({ 'p1-e2': 'late' });
  });

  it('releases a deleted folder-s events instead of deleting them', () => {
    const next = run(seed(), { type: 'folders/remove', id: 'f1' });

    expect(next.table.folders).toHaveLength(0);
    expect(next.table.events).toHaveLength(2);
    expect(next.table.events.find((e) => e.id === 'e1').folderId).toBeNull();
  });
});

describe('attendance', () => {
  it('clears a cell rather than storing an empty status', () => {
    const next = run(seed(), { type: 'attendance/set', personId: 'p1', eventId: 'e1', statusId: null });
    expect('p1-e1' in next.table.attendance).toBe(false);
    expect(next.outbox.attendance['p1-e1']).toBeNull();
  });

  it('ignores a write that changes nothing', () => {
    const state = seed();
    const next = run(state, { type: 'attendance/set', personId: 'p1', eventId: 'e1', statusId: 'present' });
    expect(next).toBe(state);
  });

  it('fills only the blanks', () => {
    const next = run(seed(), {
      type: 'attendance/fillColumn',
      eventId: 'e1',
      statusId: 'present',
      personIds: ['p1', 'p2'],
    });

    // p2 was explicitly marked absent and must survive a bulk fill.
    expect(next.table.attendance['p2-e1']).toBe('absent');
  });

  it('clears a whole column for the rows it was given', () => {
    const next = run(seed(), { type: 'attendance/clearColumn', eventId: 'e1', personIds: ['p1', 'p2'] });
    expect(next.table.attendance).toEqual({ 'p1-e2': 'late' });
  });
});

describe('statuses', () => {
  it('unmarks cells whose status was deleted', () => {
    const state = seed();
    const remaining = state.table.settings.statuses.filter((status) => status.id !== 'late');
    const next = run(state, { type: 'settings/setStatuses', statuses: remaining });

    expect('p1-e2' in next.table.attendance).toBe(false);
    expect(next.outbox.attendance['p1-e2']).toBeNull();
    expect(next.table.attendance['p1-e1']).toBe('present');
  });
});

describe('sync bookkeeping', () => {
  it('marks only the slice an action touched', () => {
    const next = run(seed(), { type: 'people/add', names: ['New Person'] });
    expect(next.outbox.roster).toBe(true);
    expect(next.outbox.schedule).toBe(false);
    expect(next.outbox.settings).toBe(false);
  });

  it('applies a remote attendance diff without touching other cells', () => {
    const next = run(seed(), {
      type: 'remote/merge',
      slice: 'attendance',
      data: { 'p2-e2': 'present', 'p1-e1': null },
    });

    expect(next.table.attendance['p2-e2']).toBe('present');
    expect('p1-e1' in next.table.attendance).toBe(false);
    expect(next.table.attendance['p1-e2']).toBe('late');
  });

  it('does not queue a remote merge for sending back', () => {
    const next = run(seed(), { type: 'remote/merge', slice: 'attendance', data: { 'p2-e2': 'present' } });
    expect(next.outbox.attendance).toEqual({});
  });

  it('leaves the local roster alone when a remote schedule arrives', () => {
    const next = run(seed(), {
      type: 'remote/merge',
      slice: 'schedule',
      data: { folders: [], events: [] },
    });
    expect(next.table.people).toHaveLength(2);
  });

  it('keeps unsent edits when the table is pruned', () => {
    const edited = run(seed(), { type: 'attendance/set', personId: 'p2', eventId: 'e2', statusId: 'present' });
    const pruned = run(edited, { type: 'table/prune', table: edited.table });
    expect(pruned.outbox.attendance['p2-e2']).toBe('present');
  });

  it('asks for a wholesale attendance replace when the table is cleared', () => {
    const next = run(seed(), { type: 'table/clear' });

    expect(next.table.people).toHaveLength(0);
    expect(next.table.attendance).toEqual({});
    // A per-cell merge would leave every deleted mark in the shared copy.
    expect(next.outbox.attendanceReplace).toBe(true);
    expect(next.outbox.roster).toBe(true);
    expect(next.outbox.schedule).toBe(true);
  });

  it('keeps the statuses when clearing', () => {
    const state = seed();
    const next = run(state, { type: 'table/clear' });
    expect(next.table.settings.statuses).toEqual(state.table.settings.statuses);
  });

  it('keeps the outbox a set of cells, never a boolean', () => {
    // `attendance` is a map of changed cells; marking it `true` the way the
    // structural slices are marked would make the next flush send nothing.
    const cleared = run(seed(), { type: 'table/clear' });
    const edited = run(cleared, { type: 'people/add', names: ['Someone'] });
    expect(typeof edited.outbox.attendance).toBe('object');
  });

  it('clears the replace flag once it has been sent', () => {
    const cleared = run(seed(), { type: 'table/clear' });
    const drained = run(cleared, {
      type: 'sync/drained',
      slices: ['roster', 'schedule'],
      cells: [],
      attendanceReplace: true,
    });
    expect(drained.outbox.attendanceReplace).toBe(false);
  });

  it('empties the outbox when a table is loaded', () => {
    const edited = run(seed(), { type: 'people/add', names: ['Someone'] });
    const loaded = run(edited, { type: 'table/replace', table: emptyTable() });
    expect(loaded.outbox.roster).toBe(false);
    expect(loaded.outbox.attendance).toEqual({});
  });

  it('drains what it was told was sent, and nothing else', () => {
    const edited = run(
      seed(),
      { type: 'attendance/set', personId: 'p2', eventId: 'e2', statusId: 'present' },
      { type: 'people/add', names: ['Later'] }
    );
    const drained = run(edited, { type: 'sync/drained', slices: ['roster'], cells: ['p2-e2'] });

    expect(drained.outbox.roster).toBe(false);
    expect(drained.outbox.attendance).toEqual({});
  });
});

describe('reconcile', () => {
  it('drops cells left behind by a remote deletion', () => {
    const state = seed();
    const afterRemote = run(state, {
      type: 'remote/merge',
      slice: 'roster',
      data: { people: [{ id: 'p2', name: 'Jordan Blake' }], groups: [] },
    });

    expect(reconcile(afterRemote.table).attendance).toEqual({ 'p2-e1': 'absent' });
  });

  it('returns the same table when there is nothing to clean', () => {
    const state = seed();
    expect(reconcile(state.table)).toBe(state.table);
  });
});
