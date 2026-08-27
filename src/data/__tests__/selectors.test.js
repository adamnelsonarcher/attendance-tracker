import {
  buildApplicability,
  buildColumns,
  buildMembership,
  computeScores,
  filterPeople,
  matchNames,
  sortPeople,
  withSessionsInView,
} from '../selectors';
import { DEFAULT_STATUSES, emptyTable } from '../model';

function tableWith(overrides) {
  return { ...emptyTable(), ...overrides };
}

const people = [
  { id: 'p1', name: 'Avery Chen' },
  { id: 'p2', name: 'Jordan Blake' },
];

const events = [
  { id: 'e1', name: 'One', weight: 1, folderId: null, startDate: null, endDate: null },
  { id: 'e2', name: 'Two', weight: 3, folderId: null, startDate: null, endDate: null },
];

describe('computeScores', () => {
  it('ignores unmarked cells when countUnmarkedAsAbsent is off', () => {
    const table = tableWith({
      people,
      events,
      attendance: { 'p1-e1': 'present' },
      settings: { ...emptyTable().settings, countUnmarkedAsAbsent: false },
    });

    expect(computeScores(table).get('p1')).toMatchObject({ raw: 100, weighted: 100, counted: 1 });
  });

  it('counts unmarked cells as missed when the setting is on', () => {
    const table = tableWith({
      people,
      events,
      attendance: { 'p1-e1': 'present' },
      settings: { ...emptyTable().settings, countUnmarkedAsAbsent: true },
    });

    // e2 is unmarked and now counts: 1 of 2 raw, and 1 of 4 by weight.
    expect(computeScores(table).get('p1')).toMatchObject({ raw: 50, weighted: 25, counted: 2 });
  });

  it('is the setting v1 ignored entirely', () => {
    // Someone never marked at any event.
    const base = { people, events, attendance: {} };
    const ignored = computeScores(
      tableWith({ ...base, settings: { ...emptyTable().settings, countUnmarkedAsAbsent: false } })
    ).get('p2');
    const counted = computeScores(
      tableWith({ ...base, settings: { ...emptyTable().settings, countUnmarkedAsAbsent: true } })
    ).get('p2');

    expect(ignored.raw).toBeNull();
    expect(counted.raw).toBe(0);
  });

  it('leaves null-credit statuses out of both sides of the fraction', () => {
    const table = tableWith({
      people,
      events,
      attendance: { 'p1-e1': 'present', 'p1-e2': 'excused' },
    });

    // The excused event drops out entirely rather than counting as a zero.
    expect(computeScores(table).get('p1')).toMatchObject({ raw: 100, weighted: 100, counted: 1 });
  });

  it('weights events by their weight', () => {
    const table = tableWith({
      people,
      events,
      attendance: { 'p1-e1': 'absent', 'p1-e2': 'present' },
    });

    const score = computeScores(table).get('p1');
    expect(score.raw).toBe(50);
    expect(score.weighted).toBe(75); // 3 of 4 available weight
  });

  it('gives partial credit for a partial-credit status', () => {
    const base = emptyTable();
    const table = tableWith({
      people,
      events: [events[0]],
      attendance: { 'p1-e1': 'half' },
      settings: {
        ...base.settings,
        statuses: [...base.settings.statuses, { id: 'half', name: 'Half', credit: 0.5, color: '#eeeeee' }],
      },
    });

    expect(computeScores(table).get('p1').raw).toBe(50);
  });

  it('counts times present alongside the percentage', () => {
    const table = tableWith({
      people,
      events,
      // Virtual counts as a full session, the way the old sheets treated it.
      attendance: { 'p1-e1': 'present', 'p1-e2': 'virtual', 'p2-e1': 'absent' },
    });

    const scores = computeScores(table);
    expect(scores.get('p1')).toMatchObject({ present: 2, counted: 2 });
    expect(scores.get('p2')).toMatchObject({ present: 0, counted: 1 });
  });

  it('returns null rather than 0 when nothing counted', () => {
    const table = tableWith({ people, events, attendance: {} });
    expect(computeScores(table).get('p1').raw).toBeNull();
  });
});

describe('buildColumns', () => {
  const table = tableWith({
    folders: [
      { id: 'f1', name: 'Meetings', isOpen: true },
      { id: 'f2', name: 'Service', isOpen: false },
    ],
    events: [
      { id: 'e1', name: 'B', weight: 1, folderId: 'f1', startDate: '2025-02-02', endDate: null },
      { id: 'e2', name: 'A', weight: 1, folderId: 'f1', startDate: '2025-01-01', endDate: null },
      { id: 'e3', name: 'Loose', weight: 1, folderId: null, startDate: null, endDate: null },
      { id: 'e4', name: 'Hidden', weight: 1, folderId: 'f2', startDate: null, endDate: null },
    ],
  });

  it('orders events in a folder by date', () => {
    const { columns } = buildColumns(table, {});
    expect(columns.slice(0, 2).map((column) => column.event.id)).toEqual(['e2', 'e1']);
  });

  it('collapses a closed folder to a single column', () => {
    const { groups, columns } = buildColumns(table, {});
    const closed = groups.find((group) => group.folder?.id === 'f2');
    expect(closed.span).toBe(1);
    expect(columns.filter((column) => column.kind === 'collapsed')).toHaveLength(1);
  });

  it('keeps header spans and body columns the same width', () => {
    const { groups, columns } = buildColumns(table, {});
    const spanned = groups.reduce((total, group) => total + (group.kind === 'folder' ? group.span : 1), 0);
    expect(spanned).toBe(columns.length);
  });

  it('hides everything outside a positively filtered folder', () => {
    const { columns } = buildColumns(table, { f1: 1 });
    expect(columns.every((column) => column.folder?.id === 'f1')).toBe(true);
  });

  it('keeps an empty folder visible instead of dropping it', () => {
    const withEmpty = tableWith({ folders: [{ id: 'f9', name: 'Empty', isOpen: true }], events: [] });
    const { groups } = buildColumns(withEmpty, {});
    expect(groups).toHaveLength(1);
  });
});

describe('filterPeople', () => {
  const groups = [
    { id: 'g1', name: 'Exec', color: '#000000', memberIds: ['p1'] },
    { id: 'g2', name: 'New', color: '#111111', memberIds: ['p2'] },
  ];
  const membership = buildMembership(groups);

  it('returns everyone when no filter is set', () => {
    expect(filterPeople(people, membership, {})).toHaveLength(2);
  });

  it('keeps only included groups', () => {
    expect(filterPeople(people, membership, { g1: 1 }).map((p) => p.id)).toEqual(['p1']);
  });

  it('drops excluded groups even when they are also included', () => {
    expect(filterPeople(people, membership, { g1: 1, g2: -1 }).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('sortPeople', () => {
  const context = {
    attendance: {},
    scores: new Map([
      ['p1', { raw: 80, weighted: 80 }],
      ['p2', { raw: null, weighted: null }],
    ]),
    membership: new Map(),
    statusOrder: new Map(DEFAULT_STATUSES.map((s, i) => [s.id, i])),
  };

  it('sorts by last name', () => {
    const sorted = sortPeople(people, { type: 'lastName', direction: 'asc' }, context);
    expect(sorted.map((p) => p.name)).toEqual(['Jordan Blake', 'Avery Chen']);
  });

  it('treats an unscored person as lowest', () => {
    const sorted = sortPeople(people, { type: 'score', direction: 'asc', scoreType: 'raw' }, context);
    expect(sorted[0].id).toBe('p2');
  });

  it('reverses event sort, which v1 could not do', () => {
    const attendance = { 'p1-e1': 'absent', 'p2-e1': 'present' };
    const withMarks = { ...context, attendance };
    const asc = sortPeople(people, { type: 'event', direction: 'asc', eventId: 'e1' }, withMarks);
    const desc = sortPeople(people, { type: 'event', direction: 'desc', eventId: 'e1' }, withMarks);
    expect(asc[0].id).toBe('p2');
    expect(desc[0].id).toBe('p1');
  });
});

describe('matchNames', () => {
  const roster = [
    { id: 'p1', name: 'Avery Chen' },
    { id: 'p2', name: 'Jordan A. Blake' },
    { id: 'p3', name: 'Jordan Reyes' },
  ];

  it('matches on a full name', () => {
    expect(matchNames(['Avery Chen'], roster).matched.map((p) => p.id)).toEqual(['p1']);
  });

  it('ignores middle initials and accents', () => {
    expect(matchNames(['Jordan Blake', 'Ávery Chen'], roster).matched.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('reports an ambiguous name instead of guessing', () => {
    const result = matchNames(['Jordan'], roster);
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous[0].candidates).toHaveLength(2);
  });

  it('reports names that are not on the roster', () => {
    expect(matchNames(['Nobody Here'], roster).unmatched).toEqual(['Nobody Here']);
  });

  it('never applies the same person twice', () => {
    expect(matchNames(['Avery Chen', 'avery chen'], roster).matched).toHaveLength(1);
  });

  it('matches an alias', () => {
    const withAlias = [{ id: 'p1', name: 'Olivia Frank', aliases: ['Liv', 'Liv F'] }];
    expect(matchNames(['Liv'], withAlias).matched.map((p) => p.id)).toEqual(['p1']);
  });

  it('counts two aliases of one person as one match, not an ambiguity', () => {
    const withAlias = [{ id: 'p1', name: 'Sam Harwell', aliases: ['Sam H', 'sam h'] }];
    expect(matchNames(['Sam H'], withAlias).ambiguous).toHaveLength(0);
  });

  it('refuses to let an alias shadow another person-s real name', () => {
    // "Charles" is an alias of one Charles and the first name of another.
    // Guessing would put a student's attendance on the wrong row.
    const two = [
      { id: 'p1', name: 'Charles Levy-Thiebaut', aliases: ['Charles'] },
      { id: 'p2', name: 'Charles Van Meter', aliases: [] },
    ];
    const result = matchNames(['Charles'], two);

    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous[0].candidates.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('still takes an unambiguous alias', () => {
    const two = [
      { id: 'p1', name: 'Olivia Frank', aliases: ['Liv'] },
      { id: 'p2', name: 'Charles Van Meter', aliases: [] },
    ];
    expect(matchNames(['Liv'], two).matched.map((p) => p.id)).toEqual(['p1']);
  });
});

describe('who a session is for', () => {
  /** Two weekly cohorts and one event open to everybody. */
  function programme() {
    const table = tableWith({
      people: [
        { id: 'p1', name: 'Monday Student', aliases: [] },
        { id: 'p2', name: 'Tuesday Student', aliases: [] },
      ],
      groups: [
        { id: 'gMon', name: 'Monday 2pm', color: '#000000', memberIds: ['p1'] },
        { id: 'gTue', name: 'Tuesday 10am', color: '#111111', memberIds: ['p2'] },
      ],
      folders: [
        { id: 'fMon', name: 'Monday 2pm', isOpen: true, groupId: 'gMon' },
        { id: 'fTue', name: 'Tuesday 10am', isOpen: true, groupId: 'gTue' },
        { id: 'fEvents', name: 'Community events', isOpen: true, groupId: null },
      ],
      events: [
        { id: 'mon1', name: '8/24', weight: 1, folderId: 'fMon', termId: null, startDate: '2026-08-24', endDate: null },
        { id: 'tue1', name: '8/25', weight: 1, folderId: 'fTue', termId: null, startDate: '2026-08-25', endDate: null },
        { id: 'tail', name: 'Tailgate', weight: 1, folderId: 'fEvents', termId: null, startDate: '2026-09-12', endDate: null },
      ],
    });
    return table;
  }

  it('gives a session only to its cohort', () => {
    const table = programme();
    const applies = buildApplicability(table);

    expect(applies('p1', table.events[0])).toBe(true);
    expect(applies('p2', table.events[0])).toBe(false);
    expect(applies('p1', table.events[1])).toBe(false);
  });

  it('gives an uncohorted folder to everyone', () => {
    const table = programme();
    const applies = buildApplicability(table);

    // A tailgate is open to the whole programme.
    expect(applies('p1', table.events[2])).toBe(true);
    expect(applies('p2', table.events[2])).toBe(true);
  });

  it('treats every session as everyone-s when no folder names a cohort', () => {
    const table = programme();
    const open = { ...table, folders: table.folders.map((f) => ({ ...f, groupId: null })) };
    const applies = buildApplicability(open);

    for (const event of open.events) {
      expect(applies('p1', event)).toBe(true);
      expect(applies('p2', event)).toBe(true);
    }
  });

  it('scores a student on their own sessions only', () => {
    const table = { ...programme(), settings: { ...programme().settings, countUnmarkedAsAbsent: true } };
    const scores = computeScores(table);

    // One weekly session plus the open event — not the other cohort's.
    expect(scores.get('p1').counted).toBe(2);
    expect(scores.get('p2').counted).toBe(2);
  });

  it('does not count a mark on a session that is not the person-s', () => {
    // A stray mark left by an import or an earlier cohort must not move a score.
    const table = programme();
    const stray = { ...table, attendance: { 'p2-mon1': 'present' } };

    expect(computeScores(stray).get('p2').counted).toBe(0);
  });

  it('narrows the roster to the cohort when the columns are narrowed', () => {
    const table = programme();
    const applies = buildApplicability(table);
    const { columns } = buildColumns(table, { fMon: 1 });

    const shown = withSessionsInView(table.people, columns, applies);
    expect(shown.map((person) => person.id)).toEqual(['p1']);
  });

  it('keeps everyone when an open folder is the one in view', () => {
    const table = programme();
    const applies = buildApplicability(table);
    const { columns } = buildColumns(table, { fEvents: 1 });

    expect(withSessionsInView(table.people, columns, applies)).toHaveLength(2);
  });

  it('leaves the roster alone when there are no columns to judge by', () => {
    const table = programme();
    const applies = buildApplicability(table);
    expect(withSessionsInView(table.people, [], applies)).toHaveLength(2);
  });
});
