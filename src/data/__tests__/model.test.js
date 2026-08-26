import { normalizeTable, cellKey, formatDateRange, parseDate } from '../model';

/** A table exactly as v1 wrote it to Firestore and localStorage. */
const v1 = {
  people: [
    { id: 'p1', name: 'Avery Chen', groups: [{ id: 'dev', color: '#FF6B6B' }] },
    { id: 'p2', name: 'Jordan Blake', groups: ['design'] },
    { id: 'p3', name: 'Riley Okafor', groups: [] },
  ],
  groups: [
    { id: 'dev', name: 'Developers', color: '#FF6B6B', memberIds: ['p1'] },
    { id: 'design', name: 'Designers', color: '#4ECDC4', memberIds: [] },
  ],
  events: [
    {
      id: 'f1',
      name: 'Sprint 1',
      isFolder: true,
      isOpen: true,
      events: [{ id: 'e1', name: 'Planning', weight: 1, startDate: '2024-01-01', endDate: '2024-01-01' }],
    },
    { id: 'e2', name: 'Team Building', weight: 2, startDate: '2024-01-07', endDate: null, isFolder: false },
  ],
  attendance: { 'p1-e1': 'Present', 'p2-e2': 'Late', 'p9-e1': 'Present' },
  settings: {
    onlyCountAbsent: true,
    hideTitle: true,
    colorCodeAttendance: true,
    customStatuses: [
      { id: 'Present', name: 'Present', credit: 1, color: '#e6ffe6', isDefault: true },
      { id: 'Late', name: 'Late', credit: 0.5, color: '#fff3e6', isDefault: true },
      { id: 'DNA', name: 'N/A', credit: null, color: '#f2f2f2', isDefault: true },
    ],
  },
};

describe('normalizeTable migrating a v1 table', () => {
  const table = normalizeTable(v1);

  it('flattens folders and events into two collections', () => {
    expect(table.folders.map((f) => f.id)).toEqual(['f1']);
    expect(table.events.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(table.events.find((e) => e.id === 'e1').folderId).toBe('f1');
    expect(table.events.find((e) => e.id === 'e2').folderId).toBeNull();
  });

  it('recovers membership that only existed on the person', () => {
    // v1 stored `design` on p2 but never added p2 to the group's memberIds.
    const design = table.groups.find((g) => g.id === 'design');
    expect(design.memberIds).toEqual(['p2']);
  });

  it('keeps membership the group editor already knew about', () => {
    expect(table.groups.find((g) => g.id === 'dev').memberIds).toEqual(['p1']);
  });

  it('drops attendance for people who no longer exist', () => {
    expect(table.attendance['p9-e1']).toBeUndefined();
    expect(table.attendance['p1-e1']).toBe('Present');
  });

  it('inverts the scoring toggle to match its new name', () => {
    // v1's `onlyCountAbsent: true` meant "leave unmarked cells out".
    expect(table.settings.countUnmarkedAsAbsent).toBe(false);
  });

  it('carries custom statuses across, null credit included', () => {
    expect(table.settings.statuses.map((s) => s.id)).toEqual(['Present', 'Late', 'DNA']);
    expect(table.settings.statuses.find((s) => s.id === 'DNA').credit).toBeNull();
  });

  it('translates the display settings', () => {
    expect(table.settings.showTitle).toBe(false);
    expect(table.settings.colorCells).toBe(true);
  });
});

describe('normalizeTable defensiveness', () => {
  it('survives junk', () => {
    for (const input of [undefined, null, 42, 'nope', [], {}]) {
      expect(() => normalizeTable(input)).not.toThrow();
      expect(normalizeTable(input).version).toBe(2);
    }
  });

  it('drops events pointing at a folder that is gone', () => {
    const table = normalizeTable({
      version: 2,
      folders: [],
      events: [{ id: 'e1', name: 'Orphan', weight: 1, folderId: 'missing' }],
      people: [],
    });
    expect(table.events[0].folderId).toBeNull();
  });

  it('rejects a status value that is not a known status', () => {
    const table = normalizeTable({
      version: 2,
      people: [{ id: 'p1', name: 'A' }],
      events: [{ id: 'e1', name: 'E', weight: 1, folderId: null }],
      attendance: { 'p1-e1': 'ghost-status' },
    });
    expect(table.attendance).toEqual({});
  });

  it('repairs an invalid weight instead of poisoning every score', () => {
    const table = normalizeTable({
      version: 2,
      events: [{ id: 'e1', name: 'E', weight: 'abc', folderId: null }],
      people: [],
    });
    expect(table.events[0].weight).toBe(1);
  });
});

describe('dates', () => {
  it('parses at noon UTC so the day never slips backwards', () => {
    expect(parseDate('2025-03-14').toISOString()).toBe('2025-03-14T12:00:00.000Z');
  });

  it('collapses a single-day range', () => {
    expect(formatDateRange('2025-03-14', '2025-03-14')).toBe(formatDateRange('2025-03-14', null));
  });
});

describe('cellKey', () => {
  it('is the only way attendance keys are built', () => {
    expect(cellKey('p1', 'e2')).toBe('p1-e2');
  });
});
