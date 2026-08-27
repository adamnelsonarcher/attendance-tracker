/**
 * Everything derived from a table: scores, the column layout, filtering and
 * sorting. All pure functions of `(table, view)` so they can be memoised in one
 * place and unit-tested without React.
 */

import { cellKey, parseDate } from './model';

/* -------------------------------------------------------------------------- */
/* scoring                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Raw and weighted attendance for every person, as a Map of personId → score.
 *
 * A status with `credit: null` (Excused / N/A) is left out of both the
 * numerator and the denominator. An unmarked cell is left out too, unless
 * `countUnmarkedAsAbsent` is on — in which case it counts as a zero-credit
 * attendance. The old scorer ignored that setting and always excluded unmarked
 * cells, so anyone who was never marked scored the same as someone with perfect
 * attendance.
 *
 * `null` means nothing counted for that person — rendered as "—", because 0%
 * and "no data yet" are not the same thing.
 */
export function computeScores(table, scopedEvents) {
  const { people, attendance, settings } = table;
  const events = scopedEvents || table.events;
  const statusById = new Map(settings.statuses.map((s) => [s.id, s]));
  const scores = new Map();

  for (const person of people) {
    let credits = 0;
    let counted = 0;
    let present = 0;
    let weightedCredits = 0;
    let weightTotal = 0;

    for (const event of events) {
      const statusId = attendance[cellKey(person.id, event.id)];
      let credit;

      if (!statusId) {
        if (!settings.countUnmarkedAsAbsent) continue;
        credit = 0;
      } else {
        const status = statusById.get(statusId);
        if (!status || status.credit === null) continue;
        credit = status.credit;
      }

      counted += 1;
      if (credit >= 1) present += 1;
      credits += credit;
      weightTotal += event.weight;
      weightedCredits += event.weight * credit;
    }

    scores.set(person.id, {
      raw: counted > 0 ? (credits / counted) * 100 : null,
      weighted: weightTotal > 0 ? (weightedCredits / weightTotal) * 100 : null,
      // The old sheets kept a "times present" column beside the percentage, and
      // it answers a different question: how many sessions someone actually
      // made, rather than what share of the ones that counted.
      present,
      counted,
    });
  }

  return scores;
}

export function formatScore(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value)}%`;
}

export function formatCount(score) {
  if (!score || score.counted === 0) return '—';
  return `${score.present}/${score.counted}`;
}

/* -------------------------------------------------------------------------- */
/* group membership                                                           */
/* -------------------------------------------------------------------------- */

/**
 * personId → the groups they belong to. Membership lives on the group and
 * nowhere else; v1 also cached it on each person and the two copies drifted.
 */
export function buildMembership(groups) {
  const byPerson = new Map();
  for (const group of groups) {
    for (const personId of group.memberIds) {
      if (!byPerson.has(personId)) byPerson.set(personId, []);
      byPerson.get(personId).push(group);
    }
  }
  return byPerson;
}

/* -------------------------------------------------------------------------- */
/* columns                                                                    */
/* -------------------------------------------------------------------------- */

/** The sentinel for "show every term at once". */
export const ALL_TERMS = '__all__';

/**
 * The events a term covers. A term is a lens over one continuous table rather
 * than a separate copy of it, so switching terms changes what is shown and what
 * the scores are computed from — not which table is open.
 */
export function eventsInTerm(table, termId) {
  if (!termId || termId === ALL_TERMS) return table.events;
  return table.events.filter((event) => event.termId === termId);
}

const byDateThenName = (a, b) => {
  const dateA = parseDate(a.startDate);
  const dateB = parseDate(b.startDate);
  if (dateA && dateB && dateA.getTime() !== dateB.getTime()) return dateA - dateB;
  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;
  return a.name.localeCompare(b.name);
};

/**
 * The single ordered description of the table's columns, used by the header row,
 * the sub-header row and every body row alike. v1 built this inline three times
 * over, once for foldered events and once for loose ones in each place.
 *
 * Returns `groups` (what the top header row spans) and `columns` (the flat list
 * of body cells), which always line up.
 */
export function buildColumns(table, folderFilters = {}, termId = ALL_TERMS) {
  const included = includedFolders(table.folders, folderFilters);
  const eventsByFolder = new Map(table.folders.map((f) => [f.id, []]));
  const loose = [];

  for (const event of eventsInTerm(table, termId)) {
    const bucket = event.folderId ? eventsByFolder.get(event.folderId) : null;
    if (bucket) bucket.push(event);
    else loose.push(event);
  }

  const groups = [];
  const columns = [];

  for (const folder of table.folders) {
    if (!included.has(folder.id)) continue;
    const events = (eventsByFolder.get(folder.id) || []).slice().sort(byDateThenName);
    if (events.length === 0) {
      // An empty folder still gets a header, so it can be renamed or filled
      // rather than vanishing the way v1 deleted folders on last-event-delete.
      groups.push({ kind: 'folder', folder, events: [], collapsed: true, span: 1 });
      columns.push({ kind: 'placeholder', id: `empty-${folder.id}`, folderId: folder.id });
      continue;
    }
    if (folder.isOpen) {
      groups.push({ kind: 'folder', folder, events, collapsed: false, span: events.length });
      for (const event of events) columns.push({ kind: 'event', id: event.id, event, folder });
    } else {
      groups.push({ kind: 'folder', folder, events, collapsed: true, span: 1 });
      columns.push({ kind: 'collapsed', id: `collapsed-${folder.id}`, folder, count: events.length });
    }
  }

  // Ungrouped events sit after the folders and have no second header row.
  if (!hasPositiveFolderFilter(folderFilters)) {
    for (const event of loose.slice().sort(byDateThenName)) {
      groups.push({ kind: 'event', event });
      columns.push({ kind: 'event', id: event.id, event, folder: null });
    }
  }

  return { groups, columns };
}

function hasPositiveFolderFilter(folderFilters) {
  return Object.values(folderFilters).some((state) => state === 1);
}

function includedFolders(folders, folderFilters) {
  const anyPositive = hasPositiveFolderFilter(folderFilters);
  const included = new Set();
  for (const folder of folders) {
    const state = folderFilters[folder.id] || 0;
    if (state === -1) continue;
    if (anyPositive && state !== 1) continue;
    included.add(folder.id);
  }
  return included;
}

/* -------------------------------------------------------------------------- */
/* people: filter + sort                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Tri-state group filters: 1 include, -1 exclude, 0/absent neutral. If anything
 * is included, a person must match at least one include; any exclude match
 * always wins.
 */
export function filterPeople(people, membership, groupFilters) {
  const entries = Object.entries(groupFilters).filter(([, state]) => state !== 0);
  if (entries.length === 0) return people;

  const includes = new Set(entries.filter(([, s]) => s === 1).map(([id]) => id));
  const excludes = new Set(entries.filter(([, s]) => s === -1).map(([id]) => id));

  return people.filter((person) => {
    const groups = membership.get(person.id) || [];
    if (groups.some((g) => excludes.has(g.id))) return false;
    if (includes.size > 0 && !groups.some((g) => includes.has(g.id))) return false;
    return true;
  });
}

const firstName = (name) => name.trim().split(/\s+/)[0] || '';
const lastName = (name) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
};

export function sortPeople(people, sort, context) {
  const { attendance, scores, membership, statusOrder } = context;
  const direction = sort.direction === 'desc' ? -1 : 1;
  const sorted = people.slice();

  const compare = {
    firstName: (a, b) => firstName(a.name).localeCompare(firstName(b.name)),
    lastName: (a, b) => lastName(a.name).localeCompare(lastName(b.name)),
    group: (a, b) => {
      const nameOf = (p) => (membership.get(p.id) || [])[0]?.name;
      const groupA = nameOf(a);
      const groupB = nameOf(b);
      // People in no group sort last in both directions rather than leading.
      if (!groupA && !groupB) return a.name.localeCompare(b.name);
      if (!groupA) return 1 * direction;
      if (!groupB) return -1 * direction;
      return groupA.localeCompare(groupB) || a.name.localeCompare(b.name);
    },
    event: (a, b) => {
      const rank = (p) => {
        const status = attendance[cellKey(p.id, sort.eventId)];
        // Unmarked always trails the real statuses.
        return status && statusOrder.has(status) ? statusOrder.get(status) : Number.MAX_SAFE_INTEGER;
      };
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    },
    score: (a, b) => {
      const value = (p) => {
        const score = scores.get(p.id)?.[sort.scoreType];
        return score === null || score === undefined ? -1 : score;
      };
      return value(a) - value(b) || a.name.localeCompare(b.name);
    },
  }[sort.type];

  if (!compare) return sorted;
  return sorted.sort((a, b) => compare(a, b) * direction);
}

/* -------------------------------------------------------------------------- */
/* name matching for bulk assign                                              */
/* -------------------------------------------------------------------------- */

const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Resolves pasted names (from a sign-in sheet) against the roster. Tolerates
 * middle initials, extra whitespace and accents; returns unmatched and
 * ambiguous entries rather than silently guessing.
 */
export function matchNames(rawNames, people) {
  // Each alias is matchable in its own right, so "Liv" and "Charles LT" find
  // the same students the roster spells out in full.
  const roster = people.flatMap((person) =>
    [person.name, ...(person.aliases || [])].map((label) => {
      const full = normalize(label);
      return { person, full, tokens: full.split(/\s+/).filter(Boolean) };
    })
  );

  const matched = new Map();
  const unmatched = [];
  const ambiguous = [];

  for (const raw of rawNames) {
    const query = normalize(raw);
    if (!query) continue;

    const queryTokens = query.split(/\s+/).filter(Boolean);
    let hits = roster.filter((entry) => entry.full === query);

    // An exact hit that came from an alias must not shadow a different person
    // whose real name starts with the same word — "Charles" is an alias of one
    // Charles and the first name of another, and picking silently would put a
    // student's attendance on the wrong row.
    if (hits.length > 0) {
      const hitIds = new Set(hits.map((entry) => entry.person.id));
      const shadowed = people.filter(
        (person) => !hitIds.has(person.id) && normalize(person.name).startsWith(`${query} `)
      );
      if (shadowed.length > 0) {
        ambiguous.push({
          query: raw.trim(),
          candidates: [...hits.map((entry) => entry.person), ...shadowed],
        });
        continue;
      }
    }

    if (hits.length === 0) hits = roster.filter((entry) => entry.full.includes(query));
    if (hits.length === 0) {
      hits = roster.filter((entry) =>
        queryTokens.every((token) => entry.tokens.some((t) => t.startsWith(token)))
      );
    }

    // Two aliases of the same person are one hit, not an ambiguity.
    const people_ = new Map(hits.map((hit) => [hit.person.id, hit.person]));

    if (people_.size === 0) unmatched.push(raw.trim());
    else if (people_.size > 1) {
      ambiguous.push({ query: raw.trim(), candidates: Array.from(people_.values()) });
    } else matched.set(hits[0].person.id, hits[0].person);
  }

  return { matched: Array.from(matched.values()), unmatched, ambiguous };
}
