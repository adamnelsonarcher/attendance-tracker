import Popover from '../ui/Popover';
import './FilterMenu.css';

const NEXT_STATE = { 0: 1, 1: -1, '-1': 0 };
const SYMBOL = { 0: '', 1: '+', '-1': '−' };
const TITLE = { 0: 'Not filtered', 1: 'Only these', '-1': 'Hide these' };

/**
 * Tri-state filters: neutral → only these → hide these. Groups filter rows,
 * folders filter columns.
 */
function FilterMenu({ x, y, groups, folders, filters, onChange, onClose }) {
  const activeCount =
    Object.values(filters.groups).filter(Boolean).length +
    Object.values(filters.folders).filter(Boolean).length;

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
          onClick={() => onChange({ groups: {}, folders: {} })}
        >
          Clear
        </button>
      </div>

      {groups.length > 0 && (
        <>
          <div className="menu-label">People in group</div>
          {groups.map((group) => renderRow('groups', group, group.color))}
        </>
      )}

      {folders.length > 0 && (
        <>
          <div className="menu-divider" />
          <div className="menu-label">Event folders</div>
          {folders.map((folder) => renderRow('folders', folder, null))}
        </>
      )}

      {groups.length === 0 && folders.length === 0 && (
        <p className="hint filter-menu__empty">Create a group or an event folder to filter by it.</p>
      )}
    </Popover>
  );
}

export default FilterMenu;
