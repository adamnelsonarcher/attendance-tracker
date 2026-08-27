import { memo, useCallback, useMemo, useState } from 'react';
import './AttendanceTable.css';
import {
  ALL_TERMS,
  buildApplicability,
  buildColumns,
  buildMembership,
  computeScores,
  eventsInTerm,
  filterPeople,
  formatCount,
  formatScore,
  sortPeople,
  withSessionsInView,
} from '../../data/selectors';
import { cellKey, formatDateRange } from '../../data/model';
import EventMenu from './EventMenu';
import FolderMenu from './FolderMenu';
import PersonMenu from './PersonMenu';
import SortMenu from './SortMenu';

/**
 * The attendance grid.
 *
 * Header cells, sub-header cells and body cells all walk the same `columns`
 * array from `buildColumns`, so a folder, a collapsed folder and a loose event
 * are laid out by one piece of code. v1 wrote each of those three renders twice
 * — once for events inside folders and once for events outside them — and the
 * two copies drifted apart.
 */
function AttendanceTable({ table, dispatch, filters, sort, onSortChange, termId = ALL_TERMS, readOnly }) {
  const [eventMenu, setEventMenu] = useState(null);
  const [folderMenu, setFolderMenu] = useState(null);
  const [personMenu, setPersonMenu] = useState(null);
  const [sortMenu, setSortMenu] = useState(null);
  const [hoverColumn, setHoverColumn] = useState(null);

  const { settings } = table;

  const membership = useMemo(() => buildMembership(table.groups), [table.groups]);
  const applies = useMemo(() => buildApplicability(table), [table]);

  // Scores describe the term on screen. A semester percentage that silently
  // included last year's sessions would be worse than useless.
  const termEvents = useMemo(() => eventsInTerm(table, termId), [table, termId]);
  const scores = useMemo(() => computeScores(table, termEvents), [table, termEvents]);

  const { groups: headerGroups, columns } = useMemo(
    () => buildColumns(table, filters.folders, termId),
    [table, filters.folders, termId]
  );

  const statusOrder = useMemo(
    () => new Map(settings.statuses.map((status, index) => [status.id, index])),
    [settings.statuses]
  );
  const statusById = useMemo(
    () => new Map(settings.statuses.map((status) => [status.id, status])),
    [settings.statuses]
  );

  const visiblePeople = useMemo(() => {
    let filtered = filterPeople(table.people, membership, filters.groups);
    // Narrowing the columns to one session narrows the roster to that session's
    // students, so picking a session is a single action rather than two.
    if (filters.onlyRelevantPeople !== false) {
      filtered = withSessionsInView(filtered, columns, applies);
    }
    return sortPeople(filtered, sort, {
      attendance: table.attendance,
      scores,
      membership,
      statusOrder,
    });
  }, [
    table.people,
    table.attendance,
    membership,
    filters.groups,
    filters.onlyRelevantPeople,
    columns,
    applies,
    sort,
    scores,
    statusOrder,
  ]);

  const setStatus = useCallback(
    (personId, eventId, statusId) => dispatch({ type: 'attendance/set', personId, eventId, statusId }),
    [dispatch]
  );

  // Column highlight is one state value updated by a delegated handler. v1
  // attached onMouseEnter and onMouseLeave to every cell and stored the hovered
  // row and column, re-rendering the whole grid on each pointer move.
  const handlePointer = useCallback(
    (event) => {
      if (!settings.highlightHover) return;
      const cell = event.target.closest('td[data-column]');
      setHoverColumn(cell ? cell.dataset.column : null);
    },
    [settings.highlightHover]
  );

  const eventColumns = columns.filter((column) => column.kind === 'event');
  const isEmpty = visiblePeople.length === 0 || eventColumns.length === 0;
  const hasTermFilter = termId !== ALL_TERMS && table.terms.length > 0;

  return (
    <div className="table-panel">
      <div className="table-scroll scroll-area">
        <table
          className={[
            'attendance-table',
            settings.stickyColumns ? 'is-sticky' : '',
            settings.highlightHover ? 'has-hover' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="col-name sortable"
                onClick={() => onSortChange(nextNameSort(sort))}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setSortMenu({ x: event.clientX, y: event.clientY });
                }}
                title="Click to sort by name, right-click for more options"
              >
                <span>Name</span>
                <SortHint sort={sort} />
              </th>

              {headerGroups.map((group) =>
                group.kind === 'folder' ? (
                  <th
                    key={group.folder.id}
                    colSpan={group.span}
                    className="col-folder"
                    onClick={() => dispatch({ type: 'folders/toggle', id: group.folder.id })}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      // Every command in these menus is an edit, so on a
                      // view-only link they would open and then do nothing.
                      if (readOnly) return;
                      setFolderMenu({ x: event.clientX, y: event.clientY, folder: group.folder });
                    }}
                    title={group.folder.isOpen ? 'Collapse folder' : 'Expand folder'}
                  >
                    <span className="folder-toggle">{group.collapsed ? '▶' : '▼'}</span>
                    {group.folder.name}
                    {group.folder.groupId && (
                      <span className="col-folder__cohort" title="Only this group attends these sessions">
                        {cohortSize(table, group.folder.groupId)}
                      </span>
                    )}
                    {group.collapsed && group.events.length > 0 && (
                      <span className="col-folder__count">{group.events.length}</span>
                    )}
                  </th>
                ) : (
                  <EventHeader
                    key={group.event.id}
                    event={group.event}
                    rowSpan={2}
                    sort={sort}
                    onSort={() => onSortChange(nextEventSort(sort, group.event.id))}
                    onMenu={readOnly ? null : (x, y) => setEventMenu({ x, y, event: group.event })}
                  />
                )
              )}

              {/* The old sheets kept this beside the percentage, and it answers
                  a different question: how many sessions someone actually made. */}
              <th rowSpan={2} className="col-score" title="Sessions attended out of those that counted">
                Present
              </th>
              <th
                rowSpan={2}
                className="col-score sortable"
                onClick={() => onSortChange(nextScoreSort(sort, 'raw'))}
                title="Share of counted events attended"
              >
                Raw
                <ScoreHint sort={sort} scoreType="raw" />
              </th>
              <th
                rowSpan={2}
                className="col-score sortable"
                onClick={() => onSortChange(nextScoreSort(sort, 'weighted'))}
                title="Same, but each event counts for its weight"
              >
                Weighted
                <ScoreHint sort={sort} scoreType="weighted" />
              </th>
            </tr>

            <tr>
              {headerGroups.map((group) => {
                if (group.kind !== 'folder') return null;
                if (group.collapsed) {
                  return <th key={group.folder.id} className="col-collapsed" aria-hidden="true" />;
                }
                return group.events.map((event) => (
                  <EventHeader
                    key={event.id}
                    event={event}
                    sort={sort}
                    onSort={() => onSortChange(nextEventSort(sort, event.id))}
                    onMenu={readOnly ? null : (x, y) => setEventMenu({ x, y, event })}
                  />
                ));
              })}
            </tr>
          </thead>

          <tbody onMouseOver={handlePointer} onMouseLeave={() => setHoverColumn(null)}>
            {visiblePeople.map((person) => {
              const score = scores.get(person.id);
              const personGroups = membership.get(person.id) || [];
              return (
                <tr key={person.id}>
                  <td
                    className="col-name"
                    title={
                      personGroups.length > 0
                        ? `${person.name} — ${personGroups.map((group) => group.name).join(', ')}`
                        : person.name
                    }
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (readOnly) return;
                      setPersonMenu({ x: event.clientX, y: event.clientY, person });
                    }}
                  >
                    <div className="name-cell">
                      <span className="group-bars">
                        {personGroups.map((group) => (
                          <span
                            key={group.id}
                            className="group-bars__bar"
                            style={{ background: group.color }}
                            title={group.name}
                          />
                        ))}
                      </span>
                      <span className="person-name">{person.name}</span>
                    </div>
                  </td>

                  {columns.map((column) => {
                    if (column.kind !== 'event') {
                      return <td key={column.id} className="col-collapsed" aria-hidden="true" />;
                    }
                    // Not this person's session: no control, nothing to mark by
                    // accident, and nothing counted either way.
                    if (!applies(person.id, column.event)) {
                      return (
                        <td
                          key={column.id}
                          className={`col-event col-event--n-a${
                            hoverColumn === column.id ? ' is-hover-column' : ''
                          }`}
                          data-column={column.id}
                          title={`${person.name} is not in ${column.folder?.name || 'this session'}`}
                        />
                      );
                    }

                    const statusId = table.attendance[cellKey(person.id, column.event.id)] || '';
                    return (
                      <AttendanceCell
                        key={column.id}
                        columnId={column.id}
                        personId={person.id}
                        eventId={column.event.id}
                        eventName={column.event.name}
                        personName={person.name}
                        statusId={statusId}
                        statuses={settings.statuses}
                        statusById={statusById}
                        colorCells={settings.colorCells}
                        colorDropdown={settings.colorDropdown}
                        highlighted={hoverColumn === column.id}
                        readOnly={readOnly}
                        onChange={setStatus}
                      />
                    );
                  })}

                  <td className="col-score col-score--count">{formatCount(score)}</td>
                  <td className="col-score">{formatScore(score?.raw)}</td>
                  <td className="col-score">{formatScore(score?.weighted)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {isEmpty && (
          <p className="table-empty">
            {table.people.length === 0
              ? 'No people yet — use Add → People to paste in your roster.'
              : eventColumns.length === 0 && hasTermFilter && table.events.length > 0
                ? 'Nothing scheduled in this term yet. Use Add → Weekly session, or switch to All terms.'
                : eventColumns.length === 0
                  ? 'No sessions yet — use Add → Weekly session to build out a term.'
                  : 'Nobody attends the sessions in view. Clear the filter, or add people to this group.'}
          </p>
        )}
      </div>

      {eventMenu && (
        <EventMenu
          {...eventMenu}
          table={table}
          dispatch={dispatch}
          visiblePeople={visiblePeople}
          onClose={() => setEventMenu(null)}
        />
      )}
      {folderMenu && (
        <FolderMenu
          {...folderMenu}
          groups={table.groups}
          dispatch={dispatch}
          onClose={() => setFolderMenu(null)}
        />
      )}
      {personMenu && (
        <PersonMenu
          {...personMenu}
          people={table.people}
          dispatch={dispatch}
          onClose={() => setPersonMenu(null)}
        />
      )}
      {sortMenu && (
        <SortMenu
          {...sortMenu}
          sort={sort}
          onSortChange={onSortChange}
          onClose={() => setSortMenu(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* cells                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Memoised so that marking one cell re-renders that cell and not the other few
 * hundred. Everything it receives is a primitive or a stable reference.
 */
const AttendanceCell = memo(function AttendanceCell({
  columnId,
  personId,
  eventId,
  personName,
  eventName,
  statusId,
  statuses,
  statusById,
  colorCells,
  colorDropdown,
  highlighted,
  readOnly,
  onChange,
}) {
  const status = statusById.get(statusId);
  const background = colorCells && status ? status.color : undefined;

  return (
    <td className={`col-event${highlighted ? ' is-hover-column' : ''}`} data-column={columnId}>
      <select
        className="attendance-select"
        value={statusId}
        disabled={readOnly}
        style={{ background }}
        aria-label={`${personName} — ${eventName}`}
        onChange={(event) => onChange(personId, eventId, event.target.value || null)}
      >
        <option value="">—</option>
        {statuses.map((option) => (
          <option
            key={option.id}
            value={option.id}
            style={colorDropdown ? { background: option.color } : undefined}
          >
            {option.name}
          </option>
        ))}
      </select>
    </td>
  );
});

function cohortSize(table, groupId) {
  const group = table.groups.find((entry) => entry.id === groupId);
  return group ? `${group.memberIds.length}` : '';
}

function EventHeader({ event, rowSpan, sort, onSort, onMenu }) {
  const active = sort.type === 'event' && sort.eventId === event.id;
  const dates = formatDateRange(event.startDate, event.endDate);

  return (
    <th
      rowSpan={rowSpan}
      className={`col-event sortable${active ? ' is-sorted' : ''}`}
      onClick={onSort}
      onContextMenu={(domEvent) => {
        if (!onMenu) return;
        domEvent.preventDefault();
        onMenu(domEvent.clientX, domEvent.clientY);
      }}
      title="Click to sort, right-click to edit"
    >
      <span className="col-event__name">{event.name}</span>
      <span className="col-event__meta">
        {dates}
        {/* Weight is noise when everything counts the same. */}
        {event.weight !== 1 && <span className="col-event__weight">×{event.weight}</span>}
      </span>
    </th>
  );
}

/* -------------------------------------------------------------------------- */
/* sort transitions                                                           */
/* -------------------------------------------------------------------------- */

const ASC = 'asc';
const DESC = 'desc';

/** Name header cycles A→Z, Z→A, off. */
export function nextNameSort(sort) {
  if (sort.type !== 'firstName') return { ...sort, type: 'firstName', direction: ASC };
  if (sort.direction === ASC) return { ...sort, direction: DESC };
  return { type: 'none', direction: ASC, eventId: null, scoreType: null };
}

export function nextEventSort(sort, eventId) {
  if (sort.type !== 'event' || sort.eventId !== eventId) {
    return { type: 'event', direction: ASC, eventId, scoreType: null };
  }
  // v1 had no reverse here at all: clicking an event twice just switched sorting off.
  if (sort.direction === ASC) return { ...sort, direction: DESC };
  return { type: 'none', direction: ASC, eventId: null, scoreType: null };
}

export function nextScoreSort(sort, scoreType) {
  if (sort.type !== 'score' || sort.scoreType !== scoreType) {
    // Lowest attendance first is what anyone opening this column is looking for.
    return { type: 'score', direction: ASC, eventId: null, scoreType };
  }
  if (sort.direction === ASC) return { ...sort, direction: DESC };
  return { type: 'none', direction: ASC, eventId: null, scoreType: null };
}

const ARROW = { asc: '↑', desc: '↓' };

function SortHint({ sort }) {
  if (!['firstName', 'lastName', 'group'].includes(sort.type)) return null;
  const label = { firstName: 'first', lastName: 'last', group: 'group' }[sort.type];
  return <span className="sort-hint">{label} {ARROW[sort.direction]}</span>;
}

function ScoreHint({ sort, scoreType }) {
  if (sort.type !== 'score' || sort.scoreType !== scoreType) return null;
  return <span className="sort-hint">{ARROW[sort.direction]}</span>;
}

export default AttendanceTable;
