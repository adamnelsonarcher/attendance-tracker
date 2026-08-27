import { useState } from 'react';
import './TopBar.css';
import FilterMenu from '../Table/FilterMenu';
import TableSwitcher from './TableSwitcher';
import TermSwitcher from './TermSwitcher';
import AddMenu from './AddMenu';
import SyncBadge from './SyncBadge';
import { ALL_TERMS } from '../../data/selectors';

function TopBar({
  table,
  dispatch,
  filters,
  onFiltersChange,
  tables,
  tableId,
  code,
  sync,
  viewOnly,
  actions,
  activeTermId,
  onTermChange,
  onOpen,
}) {
  const [anchor, setAnchor] = useState(null);

  const activeFilters =
    Object.values(filters.groups).filter(Boolean).length +
    Object.values(filters.folders).filter(Boolean).length;

  const open = (menu) => (domEvent) => {
    const rect = domEvent.currentTarget.getBoundingClientRect();
    setAnchor({ menu, x: rect.left, y: rect.bottom + 4 });
  };
  const close = () => setAnchor(null);

  const activeTerm = table.terms.find((term) => term.id === activeTermId);
  const termLabel = activeTermId === ALL_TERMS || !activeTerm ? 'All terms' : activeTerm.name;

  return (
    <header className="top-bar">
      <div className="top-bar__group">
        <button type="button" className="btn btn--ghost table-name" onClick={open('tables')}>
          <strong>{table.settings.name}</strong>
          <span className="table-name__caret">▾</span>
        </button>

        <span className="top-bar__divider" />

        {/* The term comes first: it decides which sessions the grid is showing
            at all, and which ones the scores are computed from. */}
        <button type="button" className="btn" onClick={open('terms')}>
          {termLabel}
          <span className="table-name__caret">▾</span>
        </button>

        {!viewOnly && (
          <>
            <button type="button" className="btn btn--primary" onClick={open('add')}>
              Add
              <span className="table-name__caret">▾</span>
            </button>
            <button type="button" className="btn" onClick={() => onOpen('groups')}>Groups</button>
          </>
        )}

        <button
          type="button"
          className={`btn${activeFilters > 0 ? ' btn--active' : ''}`}
          onClick={open('filter')}
        >
          Filter
          {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>
      </div>

      <div className="top-bar__group">
        {viewOnly && <span className="view-only-pill" title="Opened from a view-only link">View only</span>}
        <SyncBadge sync={sync} code={code} />
        <button type="button" className="btn btn--primary" onClick={() => onOpen('share')}>
          {code ? 'Share' : 'Share…'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onOpen('settings')} aria-label="Settings">
          ⚙
        </button>
      </div>

      {anchor?.menu === 'filter' && (
        <FilterMenu
          x={anchor.x}
          y={anchor.y}
          groups={table.groups}
          folders={table.folders}
          filters={filters}
          onChange={onFiltersChange}
          onClose={close}
        />
      )}

      {anchor?.menu === 'tables' && (
        <TableSwitcher
          x={anchor.x}
          y={anchor.y}
          tables={tables}
          tableId={tableId}
          actions={actions}
          onJoin={() => onOpen('join')}
          onClose={close}
        />
      )}

      {anchor?.menu === 'terms' && (
        <TermSwitcher
          x={anchor.x}
          y={anchor.y}
          terms={table.terms}
          activeTermId={activeTermId}
          onSelect={onTermChange}
          dispatch={dispatch}
          readOnly={viewOnly}
          onClose={close}
        />
      )}

      {anchor?.menu === 'add' && <AddMenu x={anchor.x} y={anchor.y} onOpen={onOpen} onClose={close} />}
    </header>
  );
}

export default TopBar;
