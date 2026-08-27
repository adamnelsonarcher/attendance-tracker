import { buildImport, collectSymbols, guessMapping, parseDateCell, parseGrid } from '../gridImport';
import { emptyTable } from '../model';

/** A block copied out of the check-in sheet, tabs and all. */
const BLOCK = [
  'Monday 2pm\t8/25/2025\t9/1/2025\t9/8/2025\tscore\ttimes present',
  'Chandler Bowlick\t✓\t\t✓\t2\t2',
  'Oscar Perez\tV\t❌\tV\t2\t2',
  'Anisa Casteneda\t✕\t✕\t⚪\t0\t0',
].join('\n');

describe('parseDateCell', () => {
  it('reads the formats these sheets actually contain', () => {
    expect(parseDateCell('2025-08-25', 2025)).toBe('2025-08-25');
    expect(parseDateCell('8/25/2025', 2025)).toBe('2025-08-25');
    expect(parseDateCell('8/25/25', 2025)).toBe('2025-08-25');
    expect(parseDateCell('8/25', 2025)).toBe('2025-08-25');
  });

  it('rejects anything that is not a date', () => {
    for (const value of ['score', '', 'Monday 2pm', '✓', null, undefined]) {
      expect(parseDateCell(value, 2025)).toBeNull();
    }
  });
});

describe('parseGrid', () => {
  const blocks = parseGrid(BLOCK, 2025);

  it('finds the block and its dates', () => {
    expect(blocks).toHaveLength(1);
    expect(blocks[0].label).toBe('Monday 2pm');
    expect(blocks[0].columns.map((c) => c.date)).toEqual(['2025-08-25', '2025-09-01', '2025-09-08']);
  });

  it('ignores the summary columns the sheets carry alongside', () => {
    // "score" and "times present" are not dates, so they never become sessions.
    expect(blocks[0].people[0].marks).toEqual({ '2025-08-25': '✓', '2025-09-08': '✓' });
  });

  it('keeps a blank cell blank rather than inventing a mark', () => {
    expect(blocks[0].people[0].marks['2025-09-01']).toBeUndefined();
  });

  it('reads several stacked blocks in one paste', () => {
    const two = parseGrid(`${BLOCK}\n\n\nTuesday 10am\t8/26/2025\t9/2/2025\nAidan Fulton\t✓\t✓`, 2025);
    expect(two.map((block) => block.label)).toEqual(['Monday 2pm', 'Tuesday 10am']);
  });

  it('handles a CSV paste as well as a tabbed one', () => {
    const csv = 'Monday 2pm,8/25/2025,9/1/2025\nChandler,✓,✓';
    expect(parseGrid(csv, 2025)[0].people[0].name).toBe('Chandler');
  });

  it('returns nothing when there are no dates to anchor on', () => {
    expect(parseGrid('just\tsome\ttext\nwith\tno\tdates', 2025)).toEqual([]);
    expect(parseGrid('', 2025)).toEqual([]);
  });
});

describe('symbols', () => {
  const symbols = collectSymbols(parseGrid(BLOCK, 2025));

  it('counts every distinct mark', () => {
    expect(symbols.find((s) => s.symbol === '✓').count).toBe(2);
    expect(symbols.find((s) => s.symbol === '✕').count).toBe(2);
  });

  it('guesses the vocabulary the sheets have used over the years', () => {
    const mapping = guessMapping(symbols, emptyTable().settings.statuses);
    expect(mapping['✓']).toBe('present');
    expect(mapping.V).toBe('virtual');
    expect(mapping['❌']).toBe('absent');
    expect(mapping['⚪']).toBe('excused');
  });

  it('leaves a mark it does not recognise for a human to map', () => {
    const mapping = guessMapping([{ symbol: '¿', count: 1 }], emptyTable().settings.statuses);
    expect(mapping['¿']).toBe('');
  });
});

describe('buildImport', () => {
  const blocks = parseGrid(BLOCK, 2025);
  const mapping = guessMapping(collectSymbols(blocks), emptyTable().settings.statuses);

  it('creates a session per date and a folder per block', () => {
    const { payload, summary } = buildImport({ blocks, mapping, table: emptyTable() });

    expect(payload.folders.map((f) => f.name)).toEqual(['Monday 2pm']);
    expect(payload.events).toHaveLength(3);
    expect(summary.events).toBe(3);
  });

  it('makes a group of the block, so the roster can be filtered by session', () => {
    const { payload } = buildImport({ blocks, mapping, table: emptyTable() });
    expect(payload.groups[0].name).toBe('Monday 2pm');
    expect(payload.groups[0].memberIds).toHaveLength(3);
  });

  it('can be told not to', () => {
    const { payload } = buildImport({ blocks, mapping, table: emptyTable(), groupBlocks: false });
    expect(payload.groups).toEqual([]);
  });

  it('writes the marks it was given a meaning for', () => {
    const { payload, summary } = buildImport({ blocks, mapping, table: emptyTable() });
    expect(Object.values(payload.attendance)).toContain('present');
    expect(Object.values(payload.attendance)).toContain('virtual');
    expect(summary.marks).toBe(8);
  });

  it('skips a mark left unmapped instead of guessing', () => {
    const partial = { ...mapping, '✓': '' };
    const { summary } = buildImport({ blocks, mapping: partial, table: emptyTable() });
    expect(summary.unmappedSymbols).toContain('✓');
    expect(summary.marks).toBe(6);
  });

  it('stamps the sessions with the chosen term', () => {
    const { payload } = buildImport({ blocks, mapping, table: emptyTable(), termId: 't1' });
    for (const event of payload.events) expect(event.termId).toBe('t1');
  });

  it('extends people who are already here rather than duplicating them', () => {
    // Importing a second semester must not create a second Chandler.
    const table = emptyTable();
    table.people = [{ id: 'p1', name: 'Chandler Bowlick', aliases: [] }];

    const { payload, summary } = buildImport({ blocks, mapping, table });

    expect(summary.matchedPeople).toContain('Chandler Bowlick');
    expect(payload.people.map((p) => p.name)).not.toContain('Chandler Bowlick');
    expect(Object.keys(payload.attendance).some((key) => key.startsWith('p1-'))).toBe(true);
  });

  it('matches through an alias, which is how these sheets spell people', () => {
    const table = emptyTable();
    table.people = [{ id: 'p9', name: 'Oscar Perez', aliases: ['Oscar P'] }];

    const { summary } = buildImport({
      blocks: parseGrid('Mon\t8/25/2025\t9/1/2025\nOscar P\t✓\t✓', 2025),
      mapping,
      table,
    });

    expect(summary.matchedPeople).toEqual(['Oscar Perez']);
    expect(summary.newPeople).toEqual([]);
  });

  it('adds people it has never seen', () => {
    const { summary } = buildImport({ blocks, mapping, table: emptyTable() });
    expect(summary.newPeople).toEqual(['Chandler Bowlick', 'Oscar Perez', 'Anisa Casteneda']);
  });

  it('never points a mark at a session that is not in the payload', () => {
    const { payload } = buildImport({ blocks, mapping, table: emptyTable() });
    const eventIds = new Set(payload.events.map((event) => event.id));
    const personIds = new Set(payload.people.map((person) => person.id));

    for (const key of Object.keys(payload.attendance)) {
      const eventId = key.slice(key.lastIndexOf('-') + 1);
      expect(eventIds.has(eventId) || personIds.size === 0).toBe(true);
    }
  });
});
