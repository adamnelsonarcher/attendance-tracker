import seed from '../../../public/cir-fall-2026.json';
import { cellKey, currentTerm, normalizeTable } from '../model';
import { buildColumns, computeScores, eventsInTerm } from '../selectors';
import { toSlices } from '../../sync/slices';
import { tableFromRemote } from '../../sync/remoteTable';

/**
 * The starter table handed to CIR staff, built from their own spreadsheets.
 *
 * It is the first thing they will see, and a table that loses half its roster
 * on load would end the migration on the spot — so it is checked the same way
 * any other input is.
 */
describe('the CIR starter table', () => {
  const table = normalizeTable(seed);

  it('survives normalisation without losing anything', () => {
    expect(table.people).toHaveLength(seed.people.length);
    expect(table.groups).toHaveLength(seed.groups.length);
    expect(table.events).toHaveLength(seed.events.length);
    expect(table.folders).toHaveLength(seed.folders.length);
    expect(table.terms).toHaveLength(seed.terms.length);
  });

  it('has a roster, and every person is in a session group', () => {
    expect(table.people.length).toBeGreaterThan(40);

    const assigned = new Set(table.groups.flatMap((group) => group.memberIds));
    const orphans = table.people.filter((person) => !assigned.has(person.id));
    expect(orphans.map((person) => person.name)).toEqual([]);
  });

  it('carries the name variants that the old sheets disagreed on', () => {
    const byName = new Map(table.people.map((person) => [person.name, person]));
    // Two spellings of the same student across two semesters.
    expect(byName.get('Matt Hwang').aliases).toContain('Matt Huang');
    expect(byName.get('Olivia Frank').aliases).toContain('Liv');
    expect(table.people.filter((person) => person.aliases.length > 0).length).toBeGreaterThan(20);
  });

  it('has no duplicate people', () => {
    const names = table.people.map((person) => person.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('points every group member and every event at something real', () => {
    const peopleIds = new Set(table.people.map((person) => person.id));
    const folderIds = new Set(table.folders.map((folder) => folder.id));
    const termIds = new Set(table.terms.map((term) => term.id));

    for (const group of table.groups) {
      for (const id of group.memberIds) expect(peopleIds.has(id)).toBe(true);
    }
    for (const event of table.events) {
      expect(folderIds.has(event.folderId)).toBe(true);
      expect(termIds.has(event.termId)).toBe(true);
    }
  });

  it('opens on the Fall 2026 term', () => {
    const term = currentTerm(table.terms, '2026-09-15');
    expect(term.name).toBe('Fall 2026');
  });

  it('schedules each weekly session on one weekday, all term', () => {
    const weeklyFolders = table.folders.filter((folder) => folder.name !== 'Community events');
    expect(weeklyFolders.length).toBeGreaterThanOrEqual(8);

    for (const folder of weeklyFolders) {
      const dates = table.events
        .filter((event) => event.folderId === folder.id)
        .map((event) => event.startDate)
        .sort();

      expect(dates.length).toBeGreaterThan(10);
      const weekdays = new Set(dates.map((date) => new Date(`${date}T12:00:00Z`).getUTCDay()));
      // The Fall 26 tab this came from has a Spring date in the middle of one
      // block; generated dates cannot drift like that.
      expect(weekdays.size).toBe(1);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });

  it('keeps every session inside its term', () => {
    const term = table.terms[0];
    for (const event of table.events) {
      expect(event.startDate >= term.startDate).toBe(true);
      expect(event.startDate <= term.endDate).toBe(true);
    }
  });

  it('starts with nothing marked, so no one arrives with a score', () => {
    expect(table.attendance).toEqual({});
    const scores = computeScores(table, eventsInTerm(table, table.terms[0].id));
    for (const person of table.people) expect(scores.get(person.id).raw).toBeNull();
  });

  it('renders as a grid rather than an empty state', () => {
    const { columns } = buildColumns(table, {}, table.terms[0].id);
    expect(columns.filter((column) => column.kind === 'event').length).toBe(table.events.length);
  });

  it('can be marked and scored', () => {
    const person = table.people[0];
    const event = table.events.find((e) => e.folderId === table.folders[0].id);
    const marked = { ...table, attendance: { [cellKey(person.id, event.id)]: 'present' } };

    expect(computeScores(marked, eventsInTerm(marked, event.termId)).get(person.id)).toMatchObject({
      raw: 100,
      present: 1,
      counted: 1,
    });
  });

  it('uploads and comes back unchanged', () => {
    // It will be shared the moment it is handed over.
    expect(tableFromRemote({ meta: { version: 2 }, ...toSlices(table) })).toEqual(table);
  });

  it('uses the status vocabulary from their own legend', () => {
    const ids = table.settings.statuses.map((status) => status.id);
    expect(ids).toEqual(['present', 'virtual', 'made-up', 'needs-makeup', 'absent', 'excused']);
    // "Excused / holiday" must not drag anyone's percentage down.
    expect(table.settings.statuses.find((status) => status.id === 'excused').credit).toBeNull();
  });
});
