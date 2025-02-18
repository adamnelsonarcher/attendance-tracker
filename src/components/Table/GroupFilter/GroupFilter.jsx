import React, { useState } from 'react';
import './GroupFilter.css';

function GroupFilter({ 
  groups, 
  folders, 
  activeGroupFilters, 
  activeFolderFilters,
  onGroupFilterChange, 
  onFolderFilterChange,
  onClose 
}) {
  const [activeTab, setActiveTab] = useState('people'); // 'people' or 'events'

  const toggleFilter = (id, currentFilters, onFilterChange) => {
    const newFilters = new Map(currentFilters);
    const currentState = currentFilters.get(id);
    
    if (!currentState) {
      newFilters.set(id, 'show'); // First click: show
    } else if (currentState === 'show') {
      newFilters.set(id, 'hide'); // Second click: hide
    } else {
      newFilters.delete(id); // Third click: default behavior
    }
    
    onFilterChange(newFilters);
  };

  const getFilterIcon = (id, filters) => {
    const state = filters.get(id);
    if (state === 'show') return <span className="filter-icon show">+</span>;
    if (state === 'hide') return <span className="filter-icon hide">−</span>;
    return <span className="filter-icon neutral"></span>;
  };

  const selectAll = (items, onFilterChange) => {
    const newFilters = new Map();
    items.forEach(item => newFilters.set(item.id, 'show'));
    onFilterChange(newFilters);
  };

  const clearAll = (onFilterChange) => {
    onFilterChange(new Map());
  };

  return (
    <div className="group-filter-dropdown">
      <div className="group-filter-header">
        <span>Filters</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="filter-tabs">
        <button 
          className={`tab-button ${activeTab === 'people' ? 'active' : ''}`}
          onClick={() => setActiveTab('people')}
        >
          People
        </button>
        <button 
          className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
      </div>
      
      {activeTab === 'people' && (
        <div className="filter-section">
          <div className="group-filter-actions">
            <button onClick={() => selectAll(groups, onGroupFilterChange)}>
              Select All
            </button>
            <button onClick={() => clearAll(onGroupFilterChange)}>
              Clear All
            </button>
          </div>
          <div className="group-filter-list">
            {groups.map(group => (
              <div key={group.id} className="group-filter-item" onClick={() => toggleFilter(group.id, activeGroupFilters, onGroupFilterChange)}>
                <span className="filter-state-icon">
                  {getFilterIcon(group.id, activeGroupFilters)}
                </span>
                <span 
                  className="group-color-dot"
                  style={{ backgroundColor: group.color }}
                ></span>
                <span className="group-name">{group.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="filter-section">
          <div className="group-filter-actions">
            <button onClick={() => selectAll(folders, onFolderFilterChange)}>
              Select All
            </button>
            <button onClick={() => clearAll(onFolderFilterChange)}>
              Clear All
            </button>
          </div>
          <div className="group-filter-list">
            {folders.map(folder => (
              <div key={folder.id} className="group-filter-item" onClick={() => toggleFilter(folder.id, activeFolderFilters, onFolderFilterChange)}>
                <span className="filter-state-icon">
                  {getFilterIcon(folder.id, activeFolderFilters)}
                </span>
                <span className="folder-name">{folder.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="filter-section">
        <h3>Folders</h3>
        {folders.map(folder => (
          <div key={folder.id} className="filter-item">
            <span>{folder.name}</span>
            <select
              value={activeFolderFilters.get(folder.id) || 'none'}
              onChange={(e) => {
                const newFilters = new Map(activeFolderFilters);
                if (e.target.value === 'none') {
                  newFilters.delete(folder.id);
                } else {
                  newFilters.set(folder.id, e.target.value);
                }
                onFolderFilterChange(newFilters);
              }}
            >
              <option value="none">None</option>
              <option value="show">Show</option>
              <option value="hide">Hide</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GroupFilter; 