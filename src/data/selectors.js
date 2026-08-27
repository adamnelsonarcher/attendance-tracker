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
  const applies = buildApplicability(table);
  const scores = new Map();

  for (const person of people) {
    let credits = 0;
    let counted = 0;
    let present = 0;
    let weightedCredits = 0;
    let weightTotal = 0;

    for (const event of events) {
      // A session that is not this person's does not count for or against them.
      // Without this, someone in one weekly cohort is measured against every
      // other cohort's sessions too.
      if (!applies(person.id, event)) continue;

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
/* who a session is for                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `(personId, event) => boolean` — whether this session is one that person
 * attends at all.
 *
 * A folder can name a cohort: "Monday 2pm" is a series only the Monday 2pm
 * students ever attend. A folder with no cohort is open to everyone, which is
 * what community events are. This is the difference between a grid where every
 * student has a cell under every session and one that looks like the register
 * it replaces.
 */
export function buildApplicability(table) {
  const cohortByFolder = new Map(
    table.folders.filter((folder) => folder.groupId).map((folder) => [folder.id, folder.groupId])
  );
  if (cohortByFolder.size === 0) return () => true;

  const membersByGroup = new Map(table.groups.map((group) => [group.id, new Set(group.memberIds)]));

  return (personId, event) => {
    const groupId = event.folderId ? cohortByFolder.get(event.folderId) : null;
    if (!groupId) return true;
    return membersByGroup.get(groupId)?.has(personId) ?? false;
  };
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
/**
 * The column layout, and the header rows that sit above it.
 *
 * Folders nest one level: a section like "Check-ins" holds the weekly folders,
 * each of which holds its dates. So the header is built as a grid rather than
 * two hand-written rows — every leaf column gets a cell in every row, via
 * colSpan across siblings and rowSpan down through levels that do not apply.
 *
 * `columns` is the flat list of body cells and always lines up with the spans.
 */
export function buildColumns(table, folderFilters = {}, termId = ALL_TERMS) {
  const included = includedFolders(table.folders, folderFilters);
  const events = eventsInTerm(table, termId);

  const eventsByFolder = new Map(table.folders.map((folder) => [folder.id, []]));
  const loose = [];
  for (const event of events) {
    const bucket = event.folderId ? eventsByFolder.get(event.folderId) : null;
    if (bucket) bucket.push(event);
    else loose.push(event);
  }

  const childrenOf = new Map();
  for (const folder of table.folders) {
    if (!folder.parentId) continue;
    if (!childrenOf.has(folder.parentId)) childrenOf.set(folder.parentId, []);
    childrenOf.get(folder.parentId).push(folder);
  }

  const topLevel = table.folders.filter((folder) => !folder.parentId && included.has(folder.id));
  const sectioned = topLevel.some((folder) => (childrenOf.get(folder.id) || []).length > 0);
  const depth = sectioned ? 2 : 1;

  const columns = [];
  const rows = Array.from({ length: depth + 1 }, () => []);
  const eventRow = rows[depth];

  const ownEvents = (folder) => (eventsByFolder.get(folder.id) || []).slice().sort(byDateThenName);

  /** Emits an open folder's dates as leaf columns, and their header cells. */
  const emitEvents = (folder, list) => {
    for (const event of list) {
      columns.push({ kind: 'event', id: event.id, event, folder });
      eventRow.push({ kind: 'event', key: event.id, event, colSpan: 1, rowSpan: 1 });
    }
  };

  for (const folder of topLevel) {
    const children = (childrenOf.get(folder.id) || []).filter((child) => included.has(child.id));
    const direct = ownEvents(folder);

    // A collapsed section is a single column, and its header spans every row.
    if (!folder.isOpen) {
      const count = direct.length + children.reduce((n, child) => n + ownEvents(child).length, 0);
      columns.push({ kind: 'collapsed', id: `collapsed-${folder.id}`, folder, count });
      rows[0].push({ kind: 'folder', key: folder.id, folder, collapsed: true, count, colSpan: 1, rowSpan: depth + 1 });
      continue;
    }

    if (children.length === 0) {
      if (direct.length === 0) {
        // An empty folder keeps its header, so it can be renamed or filled
        // rather than silently vanishing.
        columns.push({ kind: 'placeholder', id: `empty-${folder.id}`, folder });
        rows[0].push({ kind: 'folder', key: folder.id, folder, colSpan: 1, rowSpan: depth + 1, empty: true });
        continue;
      }
      rows[0].push({ kind: 'folder', key: folder.id, folder, colSpan: direct.length, rowSpan: depth });
      emitEvents(folder, direct);
      continue;
    }

    // A section: its own row-0 cell spans everything beneath, and each folder
    // inside gets a cell on row 1.
    const leavesBefore = columns.length;
    const sectionCell = { kind: 'folder', key: folder.id, folder, colSpan: 0, rowSpan: 1, section: true };
    rows[0].push(sectionCell);

    for (const child of children) {
      const childEvents = ownEvents(child);
      if (!child.isOpen) {
        columns.push({ kind: 'collapsed', id: `collapsed-${child.id}`, folder: child, count: childEvents.length });
        rows[1].push({
          kind: 'folder', key: child.id, folder: child, collapsed: true,
          count: childEvents.length, colSpan: 1, rowSpan: 2,
        });
        continue;
      }
      if (childEvents.length === 0) {
        columns.push({ kind: 'placeholder', id: `empty-${child.id}`, folder: child });
        rows[1].push({ kind: 'folder', key: child.id, folder: child, colSpan: 1, rowSpan: 2, empty: true });
        continue;
      }
      rows[1].push({ kind: 'folder', key: child.id, folder: child, colSpan: childEvents.length, rowSpan: 1 });
      emitEvents(child, childEvents);
    }

    // Dates filed straight into the section, alongside its folders.
    if (direct.length > 0) {
      rows[1].push({ kind: 'spacer', key: `${folder.id}-direct`, colSpan: direct.length, rowSpan: 1 });
      emitEvents(folder, direct);
    }

    sectionCell.colSpan = columns.length - leavesBefore;
    if (sectionCell.colSpan === 0) rows[0].pop();
  }

  // Dates in no folder at all sit after the sections, spanning every header row.
  if (!hasPositiveFolderFilter(folderFilters)) {
    for (const event of loose.slice().sort(byDateThenName)) {
      columns.push({ kind: 'event', id: event.id, event, folder: null });
      rows[0].push({ kind: 'event', key: event.id, event, colSpan: 1, rowSpan: depth + 1 });
    }
  }

  return { columns, headerRows: rows, depth };
}

function hasPositiveFolderFilter(folderFilters) {
  return Object.values(folderFilters).some((state) => state === 1);
}

/**
 * Which folders survive the filter. Choosing a section chooses everything in
 * it, and choosing one folder keeps the section that holds it — otherwise
 * picking "Tuesday 10am" would hide the very header it sits under.
 */
function includedFolders(folders, folderFilters) {
  const anyPositive = hasPositiveFolderFilter(folderFilters);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  const state = (folder) => {
    const own = folderFilters[folder.id] || 0;
    if (own !== 0) return own;
    return folder.parentId ? folderFilters[folder.parentId] || 0 : 0;
  };

  const included = new Set();
  for (const folder of folders) {
    if (state(folder) === -1) continue;
    if (anyPositive && state(folder) !== 1) continue;
    included.add(folder.id);
  }

  // Keep the parent of anything included, so its header still draws.
  for (const id of Array.from(included)) {
    const parentId = byId.get(id)?.parentId;
    if (parentId) included.add(parentId);
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

/**
 * Drops people with no applicable session among the visible columns.
 *
 * This is what makes picking a session enough on its own: narrow the columns to
 * "Monday 2pm" and the roster becomes the Monday 2pm students, with no second
 * control to remember.
 */
export function withSessionsInView(people, columns, applies) {
  const events = columns.filter((column) => column.kind === 'event').map((column) => column.event);
  if (events.length === 0) return people;
  return people.filter((person) => events.some((event) => applies(person.id, event)));
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
