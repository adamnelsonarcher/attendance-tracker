import Popover from '../ui/Popover';
import './FilterMenu.css';

const NEXT_STATE = { 0: 1, 1: -1, '-1': 0 };
const SYMBOL = { 0: '', 1: '+', '-1': '−' };
const TITLE = { 0: 'Not filtered', 1: 'Only these', '-1': 'Hide these' };

/**
 * Which people are shown. Tri-state: neutral → only these → hide these.
 *
 * Columns are the view picker's job. Listing the folders here as well meant the
 * same eight session names appeared twice in one menu, doing two different
 * things, which is not a distinction worth asking anyone to hold.
 */
function FilterMenu({ x, y, groups, folders, filters, onChange, onClose }) {
  // A group a folder points at is a session cohort — it says which sessions
  // apply to someone. Every other group is a label: a role, a status, a cohort
  // year. They filter the same way, but they answer different questions, and
  // showing them in one undifferentiated list is what made "group" ambiguous.
  const cohortIds = new Set(folders.map((folder) => folder.groupId).filter(Boolean));
  const sessionGroups = groups.filter((group) => cohortIds.has(group.id));
  const labelGroups = groups.filter((group) => !cohortIds.has(group.id));
  const activeCount = Object.values(filters.groups).filter(Boolean).length;

  const cycle = (kind, id) => {
    const current = filters[kind][id] || 0;
    const next = NEXT_STATE[current];
    const updated = { ...filters[kind] };
    if (next === 0) delete updated[id];
    else updated[id] = next;
    onChange({ ...filters, [kind]: updated });
  };

  const renderRow = (kind, item, swatch) => {
    const state = filters[kind][item.id] || 0;
    return (
      <button
        key={item.id}
        type="button"
        className="filter-row"
        onClick={() => cycle(kind, item.id)}
        title={TITLE[state]}
      >
        <span className={`filter-state filter-state--${state === 1 ? 'on' : state === -1 ? 'off' : 'neutral'}`}>
          {SYMBOL[state]}
        </span>
        {swatch && <span className="filter-swatch" style={{ background: swatch }} />}
        <span className="filter-name">{item.name}</span>
      </button>
    );
  };

  return (
    <Popover x={x} y={y} onClose={onClose} className="filter-menu">
      <div className="filter-menu__header">
        <span className="menu-label">Filter</span>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={activeCount === 0}
          onClick={() => onChange({ ...filters, groups: {} })}
        >
          Clear
        </button>
      </div>

      {labelGroups.length > 0 && (
        <>
          <div className="menu-label">Labels</div>
          {labelGroups.map((group) => renderRow('groups', group, group.color))}
        </>
      )}

      {sessionGroups.length > 0 && (
        <>
          <div className="menu-divider" />
          <div className="menu-label">Session groups</div>
          {sessionGroups.map((group) => renderRow('groups', group, group.color))}
        </>
      )}

      {groups.length > 0 && (
        <>
          <div className="menu-divider" />
          <label className="checkbox-row filter-menu__toggle">
            <input
              type="checkbox"
              checked={filters.onlyRelevantPeople !== false}
              onChange={(event) =>
                onChange({ ...filters, onlyRelevantPeople: event.target.checked })
              }
            />
            <span>
              <span className="checkbox-row__label">Hide people with nothing in view</span>
              <span className="checkbox-row__hint">
                So narrowing to one session shows only that session&rsquo;s students.
              </span>
            </span>
          </label>
        </>
      )}

      {groups.length === 0 && (
        <p className="hint filter-menu__empty">Create a group to filter the roster by it.</p>
      )}
    </Popover>
  );
}

export default FilterMenu;
