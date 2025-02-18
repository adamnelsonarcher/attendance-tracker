import React from 'react';
import './GroupFilter.css';

function GroupFilter({ groups, folders, activeFilters, onFilterChange, onClose }) {
  const toggleItem = (id, type) => {
    const currentState = activeFilters[id] || 0;
    const newFilters = { ...activeFilters };
    
    switch (currentState) {
      case 0:
        newFilters[id] = 1; // plus
        break;
      case 1:
        newFilters[id] = -1; // minus
        break;
      case -1:
        delete newFilters[id]; // empty (default)
        break;
    }
    
    onFilterChange(newFilters);
  };

  const clearAll = () => {
    onFilterChange({});
  };

  return (
    <div className="group-filter-dropdown">
      <div className="group-filter-header">
        <span>Filter</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="group-filter-actions">
        <button onClick={clearAll}>Clear All</button>
      </div>
      
      {folders.length > 0 && (
        <>
          <div className="filter-section-header">Event Folders</div>
          <div className="group-filter-list">
            {folders.map(folder => (
              <label key={folder.id} className="group-filter-item">
                <button
                  className={`filter-state-button ${activeFilters[folder.id] === 1 ? 'plus' : activeFilters[folder.id] === -1 ? 'minus' : ''}`}
                  onClick={() => toggleItem(folder.id, 'folder')}
                >
                  {activeFilters[folder.id] === 1 ? '+' : activeFilters[folder.id] === -1 ? '−' : ''}
                </button>
                <span className="folder-name">{folder.name}</span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="filter-section-header">Groups</div>
      <div className="group-filter-list">
        {groups.map(group => (
          <label key={group.id} className="group-filter-item">
            <button
              className={`filter-state-button ${activeFilters[group.id] === 1 ? 'plus' : activeFilters[group.id] === -1 ? 'minus' : ''}`}
              onClick={() => toggleItem(group.id, 'group')}
            >
              {activeFilters[group.id] === 1 ? '+' : activeFilters[group.id] === -1 ? '−' : ''}
            </button>
            <span 
              className="group-color-dot"
              style={{ backgroundColor: group.color }}
            ></span>
            <span className="group-name">{group.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default GroupFilter; 