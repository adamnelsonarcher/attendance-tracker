import {
  LOCAL_TABLE_ID,
  forgetTable,
  getActiveTableId,
  listTables,
  loadTable,
  migrateLegacyStorage,
  rememberTable,
  saveTable,
} from '../storage';
import { emptyTable } from '../model';

beforeEach(() => localStorage.clear());

/** Exactly what v1 left behind in a browser that was sharing a table. */
function seedLegacy({ code = 'QK4M9P' } = {}) {
  localStorage.setItem(
    'people',
    JSON.stringify([{ id: 'p1', name: 'Avery Chen', groups: [{ id: 'dev', color: '#FF6B6B' }] }])
  );
  localStorage.setItem(
    'events',
    JSON.stringify([
      {
        id: 'f1',
        name: 'Sprint 1',
        isFolder: true,
        isOpen: true,
        events: [{ id: 'e1', name: 'Planning', weight: 1, startDate: '2024-01-01' }],
      },
    ])
  );
  localStorage.setItem('groups', JSON.stringify([{ id: 'dev', name: 'Devs', color: '#FF6B6B', memberIds: ['p1'] }]));
  localStorage.setItem('attendance', JSON.stringify({ 'p1-e1': 'Present' }));
  localStorage.setItem(
    'settings',
    JSON.stringify({
      onlyCountAbsent: true,
      customStatuses: [{ id: 'Present', name: 'Present', credit: 1, color: '#e6ffe6' }],
    })
  );
  // v1 wrote this as a bare string, NOT as JSON.
  if (code) localStorage.setItem('tableCode', code);
}

describe('migrateLegacyStorage', () => {
  it('keeps the share code of a table that was already being shared', () => {
    // The regression: reading `tableCode` through JSON.parse threw on a bare
    // string, so every existing shared table became local-only with no way back.
    seedLegacy({ code: 'QK4M9P' });
    migrateLegacyStorage();

    expect(loadTable('QK4M9P')).not.toBeNull();
    expect(getActiveTableId()).toBe('QK4M9P');
    expect(listTables().map((entry) => entry.id)).toContain('QK4M9P');
  });

  it('carries the data across, not just the code', () => {
    seedLegacy();
    const table = migrateLegacyStorage();

    expect(table.people).toHaveLength(1);
    expect(table.folders.map((f) => f.id)).toEqual(['f1']);
    expect(table.events[0].folderId).toBe('f1');
    expect(loadTable('QK4M9P').people).toHaveLength(1);
  });

  it('accepts an all-digit code, which JSON.parse would have turned into a number', () => {
    seedLegacy({ code: '234567' });
    migrateLegacyStorage();
    expect(loadTable('234567')).not.toBeNull();
  });

  it('ignores a code that is not a valid share code', () => {
    seedLegacy({ code: 'not-a-code' });
    migrateLegacyStorage();

    expect(getActiveTableId()).toBe(LOCAL_TABLE_ID);
    expect(loadTable(LOCAL_TABLE_ID)).not.toBeNull();
  });

  it('migrates a table that was never shared', () => {
    seedLegacy({ code: null });
    expect(migrateLegacyStorage().people).toHaveLength(1);
    expect(getActiveTableId()).toBe(LOCAL_TABLE_ID);
  });

  it('writes the converted table before removing the originals', () => {
    seedLegacy();
    migrateLegacyStorage();

    // Originals are moved aside rather than dropped — this runs against what
    // may be someone's only copy.
    expect(localStorage.getItem('people')).toBeNull();
    expect(JSON.parse(localStorage.getItem('at:legacy:people'))).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('at:legacy:tableCode'))).toBe('QK4M9P');
  });

  it('does nothing when there is no v1 data', () => {
    expect(migrateLegacyStorage()).toBeNull();
  });
});

describe('the table registry', () => {
  it('caches the table-s own name, which is what syncs', () => {
    const table = emptyTable();
    table.settings.name = 'Fall 2025';
    rememberTable('ABC234', 'Table ABC234');
    saveTable('ABC234', table);

    // The switcher lists tables it has not loaded, so the registry has to hold
    // a copy — but the table's name is the source of truth.
    expect(listTables().find((e) => e.id === 'ABC234').name).toBe('Fall 2025');
  });

  it('follows the name when it is renamed', () => {
    const table = emptyTable();
    table.settings.name = 'First';
    saveTable('ABC234', table);
    rememberTable('ABC234', 'First');

    saveTable('ABC234', { ...table, settings: { ...table.settings, name: 'Second' } });
    expect(listTables().find((e) => e.id === 'ABC234').name).toBe('Second');
  });

  it('keeps the name when the table is reloaded', () => {
    const table = emptyTable();
    table.settings.name = 'Fall 2025';
    saveTable('ABC234', table);
    expect(loadTable('ABC234').settings.name).toBe('Fall 2025');
  });

  it('moves the most recent table to the front', () => {
    rememberTable('AAAAAA', 'One');
    rememberTable('BBBBBB', 'Two');
    expect(listTables()[0].id).toBe('BBBBBB');
  });

  it('forgets a table and its data', () => {
    saveTable('ABC234', emptyTable());
    rememberTable('ABC234', 'Gone');
    forgetTable('ABC234');

    expect(loadTable('ABC234')).toBeNull();
    expect(listTables().map((e) => e.id)).not.toContain('ABC234');
  });

  it('survives a corrupt registry', () => {
    localStorage.setItem('at:registry', '{not json');
    expect(listTables()).toEqual([]);
  });
});
