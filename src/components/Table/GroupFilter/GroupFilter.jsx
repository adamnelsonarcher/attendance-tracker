import React from 'react';
import './GroupFilter.css';

function GroupFilter({ groups, activeFilters, onFilterChange, onClose }) {
  // Convert activeFilters Set to an object with states: 1 (plus), -1 (minus), 0 (empty)
  const toggleGroup = (groupId) => {
    const currentState = activeFilters[groupId] || 0;
    const newFilters = { ...activeFilters };
    
    // Cycle through states: 0 -> 1 -> -1 -> 0
    switch (currentState) {
      case 0:
        newFilters[groupId] = 1; // plus
        break;
      case 1:
        newFilters[groupId] = -1; // minus
        break;
      case -1:
        delete newFilters[groupId]; // empty (default)
        break;
    }
    
    onFilterChange(newFilters);
  };

  const selectAll = () => {
    onFilterChange(new Set(groups.map(group => group.id)));
  };

  const clearAll = () => {
    onFilterChange({});
  };

  return (
    <div className="group-filter-dropdown">
      <div className="group-filter-header">
        <span>Filter by Groups</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="group-filter-actions">
        <button onClick={selectAll}>Select All</button>
        <button onClick={clearAll}>Clear All</button>
      </div>
      
      <div className="group-filter-list">
        {groups.map(group => (
          <label key={group.id} className="group-filter-item">
            <button
              className={`filter-state-button ${activeFilters[group.id] === 1 ? 'plus' : activeFilters[group.id] === -1 ? 'minus' : ''}`}
              onClick={() => toggleGroup(group.id)}
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