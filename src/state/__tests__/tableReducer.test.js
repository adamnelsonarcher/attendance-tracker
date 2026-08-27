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
    { id: 'e1', name: 'One', weight: 1, folderId: 'f1', termId: null, startDate: null, endDate: null },
    { id: 'e2', name: 'Two', weight: 1, folderId: null, termId: null, startDate: null, endDate: null },
  ];
  table.attendance = { 'p1-e1': 'present', 'p2-e1': 'absent', 'p1-e2': 'virtual' };
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
    expect(next.table.attendance).toEqual({ 'p1-e2': 'virtual' });
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
    expect(next.table.attendance).toEqual({ 'p1-e2': 'virtual' });
  });
});

describe('statuses', () => {
  it('unmarks cells whose status was deleted', () => {
    const state = seed();
    const remaining = state.table.settings.statuses.filter((status) => status.id !== 'virtual');
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
    expect(next.table.attendance['p1-e2']).toBe('virtual');
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

  it('queues the whole table when adopting one still in the old cloud layout', () => {
    const adopted = run(seed(), { type: 'table/adopt', table: emptyTable(), upgrade: true });

    expect(adopted.outbox.roster).toBe(true);
    expect(adopted.outbox.schedule).toBe(true);
    expect(adopted.outbox.settings).toBe(true);
    expect(adopted.outbox.attendanceReplace).toBe(true);
  });

  it('sends nothing back when adopting an already-migrated table', () => {
    const adopted = run(seed(), { type: 'table/adopt', table: emptyTable(), upgrade: false });

    expect(adopted.outbox.roster).toBe(false);
    expect(adopted.outbox.attendanceReplace).toBe(false);
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

describe('remote payloads are untrusted', () => {
  it('keeps an incoming mark whose event has not arrived yet', () => {
    // The blocker this guards: pruning after every change deleted cells naming
    // an event this client had not received. The four slices are separate
    // documents with no ordering guarantee, and the sync layer had already
    // accepted the keys, so they were never re-delivered.
    const next = run(seed(), {
      type: 'remote/merge',
      slice: 'attendance',
      data: { 'p1-eNEW': 'present' },
    });

    expect(next.table.attendance['p1-eNEW']).toBe('present');
  });

  it('still drops cells orphaned by an incoming roster', () => {
    const next = run(seed(), {
      type: 'remote/merge',
      slice: 'roster',
      data: { people: [{ id: 'p2', name: 'Jordan Blake' }], groups: [] },
    });

    expect(next.table.attendance).toEqual({ 'p2-e1': 'absent' });
  });

  it('ignores a slice that is not an object', () => {
    const state = seed();
    for (const data of [null, undefined, 'nope', 42, []]) {
      expect(run(state, { type: 'remote/merge', slice: 'roster', data }).table).toBe(state.table);
    }
  });

  it('ignores a roster whose collections are the wrong type', () => {
    const state = seed();
    const next = run(state, {
      type: 'remote/merge',
      slice: 'roster',
      data: { people: 'everyone', groups: null },
    });

    expect(next.table.people).toEqual(state.table.people);
    expect(next.table.groups).toEqual(state.table.groups);
  });

  it('repairs a settings document that would otherwise crash every client', () => {
    // `statuses` not being an array threw during render, and with no error
    // boundary that blanked the page for everyone connected.
    const next = run(seed(), {
      type: 'remote/merge',
      slice: 'settings',
      data: { statuses: 'not an array', countUnmarkedAsAbsent: 'yes' },
    });

    expect(Array.isArray(next.table.settings.statuses)).toBe(true);
    expect(next.table.settings.statuses.length).toBeGreaterThan(0);
    expect(typeof next.table.settings.countUnmarkedAsAbsent).toBe('boolean');
  });

  it('ignores an attendance value that is not a status string', () => {
    const next = run(seed(), {
      type: 'remote/merge',
      slice: 'attendance',
      data: { 'p1-e1': { nested: true }, 'p2-e1': 'virtual' },
    });

    expect(next.table.attendance['p1-e1']).toBe('present');
    expect(next.table.attendance['p2-e1']).toBe('virtual');
  });
});

describe('a failed write', () => {
  it('hands the changes back instead of dropping them', () => {
    const edited = run(
      seed(),
      { type: 'attendance/set', personId: 'p2', eventId: 'e2', statusId: 'present' },
      { type: 'people/add', names: ['Later'] }
    );
    const cells = { ...edited.outbox.attendance };

    // The flush drains optimistically, then the write is rejected.
    const drained = run(edited, { type: 'sync/drained', slices: ['roster'], cells: Object.keys(cells) });
    const requeued = run(drained, { type: 'sync/requeue', slices: ['roster'], cells });

    expect(requeued.outbox.roster).toBe(true);
    expect(requeued.outbox.attendance['p2-e2']).toBe('present');
  });

  it('does not overwrite an edit made while the write was in flight', () => {
    const state = seed();
    const stale = { 'p1-e1': 'present' };
    const fresh = run(state, { type: 'attendance/set', personId: 'p1', eventId: 'e1', statusId: 'late' });
    const requeued = run(fresh, { type: 'sync/requeue', slices: [], cells: stale });

    expect(requeued.outbox.attendance['p1-e1']).toBe('late');
  });
});

describe('folder collapse', () => {
  it('survives a remote schedule arriving', () => {
    const collapsed = run(seed(), { type: 'folders/toggle', id: 'f1' });
    const next = run(collapsed, {
      type: 'remote/merge',
      slice: 'schedule',
      // The wire carries no isOpen at all.
      data: { folders: [{ id: 'f1', name: 'Meetings renamed' }], events: [] },
    });

    expect(next.table.folders[0].name).toBe('Meetings renamed');
    expect(next.table.folders[0].isOpen).toBe(false);
  });

  it('opens a folder this viewer has never seen', () => {
    const next = run(seed(), {
      type: 'remote/merge',
      slice: 'schedule',
      data: { folders: [{ id: 'fNEW', name: 'New folder' }], events: [] },
    });

    expect(next.table.folders[0].isOpen).toBe(true);
  });

  it('is not sent to everyone else', () => {
    // Whether a folder is collapsed is a view preference like the filters and
    // the sort; pushing it would fold the folder shut under everyone mid-meeting.
    const next = run(seed(), { type: 'folders/toggle', id: 'f1' });

    expect(next.table.folders[0].isOpen).toBe(false);
    expect(next.outbox.schedule).toBe(false);
  });
});

describe('terms', () => {
  it('adds a term and keeps them in date order', () => {
    const next = run(
      seed(),
      { type: 'terms/add', name: 'Spring 2027', startDate: '2027-01-11', endDate: '2027-05-07' },
      { type: 'terms/add', name: 'Fall 2026', startDate: '2026-08-24', endDate: '2026-12-18' }
    );

    expect(next.table.terms.map((term) => term.name)).toEqual(['Fall 2026', 'Spring 2027']);
    expect(next.outbox.schedule).toBe(true);
  });

  it('renames and re-dates a term', () => {
    const added = run(seed(), { type: 'terms/add', name: 'Fall', startDate: '2026-08-24', endDate: '2026-12-18' });
    const id = added.table.terms[0].id;
    const next = run(added, { type: 'terms/update', id, changes: { name: 'Fall 2026' } });

    expect(next.table.terms[0].name).toBe('Fall 2026');
  });

  it('keeps the sessions when a term is removed', () => {
    const added = run(seed(), { type: 'terms/add', name: 'Fall', startDate: '2026-08-24', endDate: '2026-12-18' });
    const id = added.table.terms[0].id;
    const withEvent = run(added, { type: 'events/add', name: 'One-off', weight: 1, termId: id });
    const next = run(withEvent, { type: 'terms/remove', id });

    // Deleting a semester must not delete the semester's attendance.
    expect(next.table.events).toHaveLength(withEvent.table.events.length);
    for (const event of next.table.events) expect(event.termId).toBeNull();
  });
});

describe('recurring sessions', () => {
  it('builds a term of one weekday in one action', () => {
    const next = run(seed(), {
      type: 'events/addRecurring',
      name: 'Monday 2pm',
      weekday: 1,
      startDate: '2026-08-24',
      endDate: '2026-09-28',
      weight: 1,
      newFolderName: 'Monday 2pm',
    });

    const added = next.table.events.filter((event) => event.name === 'Monday 2pm');
    expect(added).toHaveLength(6);
    expect(next.table.folders.map((f) => f.name)).toContain('Monday 2pm');
    for (const event of added) {
      expect(new Date(`${event.startDate}T12:00:00Z`).getUTCDay()).toBe(1);
    }
  });

  it('does nothing when the range contains no such day', () => {
    const state = seed();
    const next = run(state, {
      type: 'events/addRecurring',
      name: 'Nope',
      weekday: 0,
      startDate: '2026-08-24',
      endDate: '2026-08-26',
      weight: 1,
    });
    expect(next).toBe(state);
  });
});

describe('merging people', () => {
  it('survives a person stored without an aliases field', () => {
    // A roster written by an older build has none, and a remote roster is
    // installed verbatim.
    const state = seed();
    const legacy = {
      ...state,
      table: { ...state.table, people: state.table.people.map(({ id, name }) => ({ id, name })) },
    };

    expect(() => run(legacy, { type: 'people/merge', keepId: 'p1', mergeId: 'p2' })).not.toThrow();
  });

  it('folds the loser-s marks into the gaps and keeps its name as an alias', () => {
    const next = run(seed(), { type: 'people/merge', keepId: 'p1', mergeId: 'p2' });
    const kept = next.table.people.find((person) => person.id === 'p1');

    expect(next.table.people.map((p) => p.id)).toEqual(['p1']);
    expect(kept.aliases).toContain('Jordan Blake');
    // p1 already had e1; p2's own e1 must not overwrite it.
    expect(next.table.attendance['p1-e1']).toBe('present');
    expect('p2-e1' in next.table.attendance).toBe(false);
  });

  it('refuses to merge someone into themselves', () => {
    const state = seed();
    expect(run(state, { type: 'people/merge', keepId: 'p1', mergeId: 'p1' })).toBe(state);
  });
});

describe('importing', () => {
  it('folds two incoming groups of the same name together', () => {
    // Two blocks with the same label, or two blocks with no label at all.
    const next = run(seed(), {
      type: 'table/import',
      payload: {
        groups: [
          { id: 'gA', name: 'Imported', color: '#111111', memberIds: ['p1'] },
          { id: 'gB', name: 'Imported', color: '#111111', memberIds: ['p2'] },
        ],
      },
    });

    const imported = next.table.groups.filter((group) => group.name === 'Imported');
    expect(imported).toHaveLength(1);
    expect(imported[0].memberIds.sort()).toEqual(['p1', 'p2']);
  });

  it('re-files a session that already existed into the chosen term', () => {
    const next = run(seed(), {
      type: 'table/import',
      payload: { updatedEvents: [{ ...seed().table.events[0], termId: 't_new' }] },
    });

    expect(next.table.events[0].termId).toBe('t_new');
    expect(next.table.events).toHaveLength(seed().table.events.length);
  });
});
