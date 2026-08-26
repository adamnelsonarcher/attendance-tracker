import { useState } from 'react';
import './TopBar.css';
import FilterMenu from '../Table/FilterMenu';
import TableSwitcher from './TableSwitcher';
import SyncBadge from './SyncBadge';

function TopBar({
  table,
  filters,
  onFiltersChange,
  tables,
  tableId,
  code,
  sync,
  viewOnly,
  actions,
  onOpen,
}) {
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [switcherAnchor, setSwitcherAnchor] = useState(null);

  const activeFilters =
    Object.values(filters.groups).filter(Boolean).length +
    Object.values(filters.folders).filter(Boolean).length;

  const openBelow = (domEvent, setAnchor) => {
    const rect = domEvent.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <header className="top-bar">
      <div className="top-bar__group">
        <button type="button" className="btn btn--ghost table-name" onClick={(e) => openBelow(e, setSwitcherAnchor)}>
          <strong>{table.settings.name}</strong>
          <span className="table-name__caret">▾</span>
        </button>

        {!viewOnly && (
          <>
            <span className="top-bar__divider" />
            <button type="button" className="btn" onClick={() => onOpen('people')}>Add people</button>
            <button type="button" className="btn" onClick={() => onOpen('event')}>Add event</button>
            <button type="button" className="btn" onClick={() => onOpen('groups')}>Groups</button>
          </>
        )}

        <button
          type="button"
          className={`btn${activeFilters > 0 ? ' btn--active' : ''}`}
          onClick={(e) => openBelow(e, setFilterAnchor)}
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

      {filterAnchor && (
        <FilterMenu
          {...filterAnchor}
          groups={table.groups}
          folders={table.folders}
          filters={filters}
          onChange={onFiltersChange}
          onClose={() => setFilterAnchor(null)}
        />
      )}

      {switcherAnchor && (
        <TableSwitcher
          {...switcherAnchor}
          tables={tables}
          tableId={tableId}
          actions={actions}
          onJoin={() => onOpen('join')}
          onClose={() => setSwitcherAnchor(null)}
        />
      )}
    </header>
  );
}

export default TopBar;
