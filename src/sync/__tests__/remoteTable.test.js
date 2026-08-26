import { isLegacyRemote, remoteTableName, tableFromRemote } from '../remoteTable';

/** A table already stored as per-slice documents. */
const modern = {
  meta: { version: 2, name: 'Fall 2025' },
  roster: {
    people: [{ id: 'p1', name: 'Avery Chen' }],
    groups: [{ id: 'g1', name: 'Exec', color: '#5b8def', memberIds: ['p1'] }],
  },
  schedule: {
    folders: [{ id: 'f1', name: 'Meetings', isOpen: true }],
    events: [{ id: 'e1', name: 'Kickoff', weight: 1, folderId: 'f1', startDate: '2025-09-03' }],
  },
  settings: { countUnmarkedAsAbsent: true },
  attendance: { 'p1-e1': 'present' },
};

/**
 * A table shared by the pre-0.9 app: everything inside `tables/{CODE}` itself,
 * with folders nested inside the events array.
 */
const legacy = {
  meta: {
    people: [{ id: 'p1', name: 'Avery Chen', groups: [{ id: 'dev', color: '#FF6B6B' }] }],
    groups: [{ id: 'dev', name: 'Developers', color: '#FF6B6B', memberIds: ['p1'] }],
    events: [
      {
        id: 'f1',
        name: 'Sprint 1',
        isFolder: true,
        isOpen: true,
        events: [{ id: 'e1', name: 'Planning', weight: 2, startDate: '2024-01-01' }],
      },
    ],
    attendance: { 'p1-e1': 'Present' },
    settings: {
      onlyCountAbsent: true,
      customStatuses: [{ id: 'Present', name: 'Present', credit: 1, color: '#e6ffe6' }],
    },
    lastUpdated: '2025-01-01T00:00:00.000Z',
  },
};

describe('isLegacyRemote', () => {
  it('recognises a table that has no slices', () => {
    expect(isLegacyRemote(legacy)).toBe(true);
  });

  it('does not mistake a sliced table for a legacy one', () => {
    expect(isLegacyRemote(modern)).toBe(false);
  });

  it('treats a table with only some slices as already migrated', () => {
    expect(isLegacyRemote({ meta: { version: 2 }, roster: { people: [] } })).toBe(false);
  });

  it('is false for a brand new empty table document', () => {
    expect(isLegacyRemote({ meta: { version: 2, name: null } })).toBe(false);
  });

  it('handles nothing at all', () => {
    expect(isLegacyRemote(null)).toBe(false);
    expect(isLegacyRemote(undefined)).toBe(false);
  });
});

describe('tableFromRemote', () => {
  it('assembles a table from slices', () => {
    const table = tableFromRemote(modern);
    expect(table.people).toHaveLength(1);
    expect(table.events[0].folderId).toBe('f1');
    expect(table.attendance['p1-e1']).toBe('present');
    expect(table.settings.countUnmarkedAsAbsent).toBe(true);
  });

  it('reads a table shared by the old app rather than returning an empty one', () => {
    // The regression this guards: fetching by slice name finds nothing in a
    // legacy document, which would silently present an existing table as blank.
    const table = tableFromRemote(legacy);

    expect(table.people).toHaveLength(1);
    expect(table.folders.map((f) => f.id)).toEqual(['f1']);
    expect(table.events[0]).toMatchObject({ id: 'e1', weight: 2, folderId: 'f1' });
    expect(table.attendance['p1-e1']).toBe('Present');
    expect(table.settings.statuses[0].id).toBe('Present');
  });

  it('returns null for nothing', () => {
    expect(tableFromRemote(null)).toBeNull();
  });

  it('survives a document with no usable content', () => {
    expect(tableFromRemote({ meta: {} }).people).toEqual([]);
  });
});

describe('remoteTableName', () => {
  it('prefers the name inside the table, which is the one that syncs', () => {
    const named = { ...modern, settings: { ...modern.settings, name: 'Renamed' } };
    expect(remoteTableName(named, 'Table ABC234')).toBe('Renamed');
  });

  it('falls back to the copy on the parent document', () => {
    // Readable before the slices arrive.
    expect(remoteTableName(modern, 'Table ABC234')).toBe('Fall 2025');
  });

  it('falls back again when there is no name anywhere', () => {
    expect(remoteTableName(legacy, 'Table ABC234')).toBe('Table ABC234');
    expect(remoteTableName({ meta: { name: '  ' } }, 'fallback')).toBe('fallback');
  });
});
