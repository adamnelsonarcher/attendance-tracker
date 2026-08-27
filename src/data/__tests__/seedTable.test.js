import seed from '../../../public/cir-fall-2026.json';
import { cellKey, currentTerm, normalizeTable } from '../model';
import { buildApplicability, buildColumns, computeScores, eventsInTerm, matchNames } from '../selectors';
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

  it('ships no alias that could name someone else', () => {
    // An alias matching two students is worse than no alias: it puts one
    // student's attendance on the other's row without saying so.
    const normalize = (value) => value.toLowerCase().replace(/[^a-z ]/g, '').trim();

    for (const person of table.people) {
      for (const alias of person.aliases) {
        const key = normalize(alias);
        const others = table.people.filter(
          (other) =>
            other.id !== person.id &&
            (normalize(other.name) === key || normalize(other.name).startsWith(`${key} `))
        );
        expect({ alias, of: person.name, alsoMatches: others.map((o) => o.name) }).toEqual({
          alias,
          of: person.name,
          alsoMatches: [],
        });
      }
    }
  });

  it('resolves each alias to exactly the person it belongs to', () => {
    for (const person of table.people) {
      for (const alias of person.aliases) {
        expect(matchNames([alias], table.people).matched.map((p) => p.id)).toEqual([person.id]);
      }
    }
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
    const section = table.folders.find((folder) => folder.name === 'Check-ins');
    const weeklyFolders = table.folders.filter((folder) => folder.parentId === section.id);
    expect(weeklyFolders.length).toBe(8);

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
    // Pick someone who actually attends the session being marked.
    const folder = table.folders.find(
      (f) => f.groupId && table.groups.find((g) => g.id === f.groupId).memberIds.length > 0
    );
    const cohort = table.groups.find((g) => g.id === folder.groupId);
    const person = table.people.find((p) => p.id === cohort.memberIds[0]);
    const event = table.events.find((e) => e.folderId === folder.id);
    const marked = { ...table, attendance: { [cellKey(person.id, event.id)]: 'present' } };

    expect(computeScores(marked, eventsInTerm(marked, event.termId)).get(person.id)).toMatchObject({
      raw: 100,
      present: 1,
      counted: 1,
    });
  });

  it('files the weekly folders under one Check-ins section', () => {
    const section = table.folders.find((folder) => folder.name === 'Check-ins');
    expect(section).toBeDefined();
    expect(section.parentId).toBeNull();

    const weekly = table.folders.filter((folder) => folder.parentId === section.id);
    expect(weekly).toHaveLength(8);
    // Each keeps its own cohort; the section itself is open to everyone.
    for (const folder of weekly) expect(folder.groupId).not.toBeNull();
    expect(section.groupId).toBeNull();
  });

  it('keeps Townhouse and Community events as flat folders of dates', () => {
    for (const name of ['Townhouse', 'Community events']) {
      const folder = table.folders.find((entry) => entry.name === name);
      expect(folder.parentId).toBeNull();
      expect(folder.groupId).toBeNull();
      expect(table.folders.some((entry) => entry.parentId === folder.id)).toBe(false);
      expect(table.events.some((event) => event.folderId === folder.id)).toBe(true);
    }
  });

  it('puts a townhouse meeting on the last Friday of each month', () => {
    const folder = table.folders.find((entry) => entry.name === 'Townhouse');
    const dates = table.events
      .filter((event) => event.folderId === folder.id)
      .map((event) => event.startDate)
      .sort();

    expect(dates.length).toBeGreaterThan(0);
    for (const date of dates) {
      const day = new Date(`${date}T12:00:00Z`);
      expect(day.getUTCDay()).toBe(5);
      // The last Friday is within seven days of the month's end.
      const endOfMonth = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0, 12));
      expect((endOfMonth - day) / 86400000).toBeLessThan(7);
    }
    // The workbook's own 8/28 meeting is the first of the series, not a duplicate.
    expect(dates[0]).toBe('2026-08-28');
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('shows a student only the sessions they attend', () => {
    // The whole point: 48 students x 112 weekly columns is 5,376 cells, of
    // which fewer than 700 mean anything.
    const applies = buildApplicability(table);
    const weekly = table.events.filter(
      (event) => table.folders.find((f) => f.id === event.folderId)?.groupId
    );

    let relevant = 0;
    for (const person of table.people) {
      for (const event of weekly) if (applies(person.id, event)) relevant += 1;
    }

    expect(relevant).toBeGreaterThan(0);
    expect(relevant).toBeLessThan(table.people.length * weekly.length * 0.25);
  });

  it('scores a student against their own sessions, not everyone-s', () => {
    // With unmarked cells counting, a student must not be measured against
    // seven other cohorts' sessions.
    const counting = { ...table, settings: { ...table.settings, countUnmarkedAsAbsent: true } };
    const folder = table.folders.find(
      (f) => f.groupId && table.groups.find((g) => g.id === f.groupId).memberIds.length > 0
    );
    const cohort = table.groups.find((g) => g.id === folder.groupId);
    const person = table.people.find((p) => p.id === cohort.memberIds[0]);

    const sessions = table.events.filter((event) => event.folderId === folder.id).length;
    const openEvents = table.events.filter(
      (event) => !table.folders.find((f) => f.id === event.folderId)?.groupId
    ).length;

    const score = computeScores(counting, eventsInTerm(counting, table.terms[0].id)).get(person.id);
    expect(score.counted).toBe(sessions + openEvents);
    expect(score.counted).toBeLessThan(table.events.length);
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
