import React from 'react';
import './GroupFilter.css';

function GroupFilter({ groups, activeFilters, onFilterChange, onClose }) {
  const toggleGroup = (groupId) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(groupId)) {
      newFilters.delete(groupId);
    } else {
      newFilters.add(groupId);
    }
    onFilterChange(newFilters);
  };

  const selectAll = () => {
    onFilterChange(new Set(groups.map(group => group.id)));
  };

  const clearAll = () => {
    onFilterChange(new Set());
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
            <input
              type="checkbox"
              checked={activeFilters.has(group.id)}
              onChange={() => toggleGroup(group.id)}
            />
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