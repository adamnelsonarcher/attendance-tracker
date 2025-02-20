import React, { useState } from 'react';
import './Table.css';
import EventFolder from './EventFolder/EventFolder';
import GroupFilter from './GroupFilter/GroupFilter';
import EventContextMenu from './EventContextMenu';
import FolderContextMenu from './FolderContextMenu/FolderContextMenu';
import filterIcon from '../../assets/icons/filter.png';

function Table({ 
  people, 
  events, 
  attendance, 
  onAttendanceChange, 
  calculateScores,
  sorting,
  onEventHeaderClick,
  onNameHeaderClick,
  onFolderClick,
  getStatusPriority,
  onNameHeaderContextMenu,
  settings,
  groups,
  onMoveEvent,
  onRemoveEvent,
  onRenameEvent,
  onEditEventDates,
  onEditEventWeight,
  onRenameFolder
}) {
  const [activeGroupFilters, setActiveGroupFilters] = useState({});
  const [activeFolderFilters, setActiveFolderFilters] = useState({});
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [eventContextMenu, setEventContextMenu] = useState(null);
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [hoveredCell, setHoveredCell] = useState({ row: null, col: null });

  const attendanceStatus = ['Present', 'Absent', 'Late', 'DNA'];

  // Handle filter changes from GroupFilter component
  const handleFilterChange = (newFilters) => {
    // Separate group and folder filters
    const groupFilters = {};
    const folderFilters = {};
    
    Object.entries(newFilters).forEach(([id, state]) => {
      if (events.some(e => e.isFolder && e.id === id)) {
        folderFilters[id] = state;
      } else {
        groupFilters[id] = state;
      }
    });
    
    setActiveGroupFilters(groupFilters);
    setActiveFolderFilters(folderFilters);
  };

  // Filter people based on active group filters and folders
  const filteredPeople = Object.keys(activeGroupFilters).length > 0
    ? people.filter(person => {
        // Get all active filters
        const activeFilters = Object.entries(activeGroupFilters);
        
        if (activeFilters.length > 0) {
          // Check for positive filters (1)
          const hasAnyPositiveFilter = activeFilters.some(([_, state]) => state === 1);
          
          if (hasAnyPositiveFilter) {
            // If there are positive filters, person must match at least one
            const hasPositiveMatch = person.groups.some(g => activeGroupFilters[g.id] === 1);
            if (!hasPositiveMatch) return false;
          }
          
          // Check for negative filters (-1)
          const hasNegativeMatch = person.groups.some(g => activeGroupFilters[g.id] === -1);
          if (hasNegativeMatch) return false;
          
          // Neutral filters (0) don't affect visibility
        }
        
        return true;
      })
    : people;

  // Filter events based on folder filters only
  const filteredEvents = events.map(event => {
    if (!event.isFolder) {
      // Handle non-folder events
      const hasAnyPositiveFolder = Object.values(activeFolderFilters).some(state => state === 1);
      if (hasAnyPositiveFolder) {
        return { ...event, hidden: true };
      }
      return event;
    }
    
    // Handle folders
    const folderState = activeFolderFilters[event.id] || 0;
    
    if (folderState === -1) {
      return { ...event, isOpen: false, hidden: true };
    }

    const hasAnyPositiveFolder = Object.values(activeFolderFilters).some(state => state === 1);
    if (hasAnyPositiveFolder) {
      return { 
        ...event, 
        isOpen: folderState === 1,
        hidden: folderState !== 1
      };
    }

    return event;
  });

  // Sort people if needed
  const sortedPeople = [...filteredPeople].sort((a, b) => {
    if (sorting.type === 'firstName') {
      const [aFirst] = a.name.split(' ');
      const [bFirst] = b.name.split(' ');
      return sorting.direction === 'asc' 
        ? aFirst.localeCompare(bFirst)
        : bFirst.localeCompare(aFirst);
    }
    if (sorting.type === 'lastName') {
      const aLast = a.name.split(' ').slice(-1)[0];
      const bLast = b.name.split(' ').slice(-1)[0];
      return sorting.direction === 'asc' 
        ? aLast.localeCompare(bLast)
        : bLast.localeCompare(aLast);
    }
    if (sorting.type === 'event') {
      const aStatus = attendance[`${a.id}-${sorting.eventId}`] || '';
      const bStatus = attendance[`${b.id}-${sorting.eventId}`] || '';
      return getStatusPriority(aStatus) - getStatusPriority(bStatus);
    }
    if (sorting.type === 'group') {
      // Put people with no groups at the end
      if (!a.groups?.length && !b.groups?.length) return 0;
      if (!a.groups?.length) return 1;
      if (!b.groups?.length) return -1;
      
      // Get the first group's name from the groups array
      const aGroup = groups.find(g => g.id === a.groups[0].id)?.name || '';
      const bGroup = groups.find(g => g.id === b.groups[0].id)?.name || '';
      return aGroup.localeCompare(bGroup);
    }
    if (sorting.type === 'score') {
      const aScore = calculateScores(a.id)[sorting.scoreType];
      const bScore = calculateScores(b.id)[sorting.scoreType];
      return sorting.direction === 'asc' 
        ? aScore - bScore
        : bScore - aScore;
    }
    return 0;
  });

  const handleNameHeaderClick = (e) => {
    // Don't trigger the sort if clicking within the filter dropdown
    if (e.target.closest('.group-filter-dropdown') || e.target.closest('.group-filter-button')) {
      return;
    }
    onNameHeaderClick();
  };

  const handleScoreHeaderClick = (scoreType) => {
    onEventHeaderClick(null, 'score', scoreType);
  };

  const handleEventContextMenu = (e, eventId, currentFolderId) => {
    e.preventDefault();
    setEventContextMenu({
      x: e.clientX,
      y: e.clientY,
      eventId,
      currentFolderId
    });
  };

  const handleSetAll = (status) => {
    const eventId = eventContextMenu.eventId;
    // Use filteredPeople instead of all people
    const visiblePeople = Object.keys(activeGroupFilters).length > 0
      ? people.filter(person => {
          const activeFilters = Object.entries(activeGroupFilters);
          
          if (activeFilters.length > 0) {
            const hasAnyPositiveFilter = activeFilters.some(([_, state]) => state === 1);
            
            if (hasAnyPositiveFilter) {
              const hasPositiveMatch = person.groups.some(g => activeGroupFilters[g.id] === 1);
              if (!hasPositiveMatch) return false;
            }
            
            const hasNegativeMatch = person.groups.some(g => activeGroupFilters[g.id] === -1);
            if (hasNegativeMatch) return false;
          }
          
          return true;
        })
      : people;

    visiblePeople.forEach(person => {
      const key = `${person.id}-${eventId}`;
      if (status === 'reset') {
        onAttendanceChange(person.id, eventId, 'Select');
      } else if (!attendance[key] || attendance[key] === 'Select') {
        onAttendanceChange(person.id, eventId, status);
      }
    });
  };

  const handleCellHover = (rowIndex, colIndex) => {
    setHoveredCell({ row: rowIndex, col: colIndex });
  };

  // Add folder context menu handler
  const handleFolderContextMenu = (e, folderId) => {
    e.preventDefault();
    setFolderContextMenu({
      x: e.pageX,
      y: e.pageY,
      folderId
    });
  };

  return (
    <div className="table-wrapper">
      <div className="table-controls">
        <div className="filter-container">
          <button 
            className="group-filter-button"
            onClick={(e) => {
              e.stopPropagation();
              setShowGroupFilter(!showGroupFilter);
            }}
          >
            <img src={filterIcon} alt="Filter" />
            Filter
          </button>
          {showGroupFilter && (
            <GroupFilter
              groups={groups}
              folders={events.filter(e => e.isFolder)}
              activeFilters={{ ...activeGroupFilters, ...activeFolderFilters }}
              onFilterChange={handleFilterChange}
              onClose={() => setShowGroupFilter(false)}
            />
          )}
        </div>
      </div>
      <div className={`table-container ${settings.enableStickyColumns ? '' : 'sticky-disabled'} ${settings.colorCodeAttendance ? 'color-coded' : ''} ${settings.onlyCountAbsent ? 'treat-select-as-dna' : ''}`}>
        <table>
          <thead>
            <tr>
              <th 
                rowSpan="2" 
                className="name-column sortable-header"
                onClick={handleNameHeaderClick}
                onContextMenu={onNameHeaderContextMenu}
              >
                <div className="name-header">
                  <span>Name</span>
                </div>
                {(sorting.type === 'firstName' || sorting.type === 'lastName' || sorting.type === 'group') && (
                  <small>
                    {` (${
                      sorting.type === 'firstName' ? 'First' : 
                      sorting.type === 'lastName' ? 'Last' : 
                      'Group'
                    }) `}
                    {sorting.direction === 'asc' ? '↓' : '↑'}
                  </small>
                )}
              </th>
              {filteredEvents
                .filter(folder => !folder.hidden)
                .map(folder => (
                  folder.isFolder ? (
                    <th 
                      key={folder.id} 
                      colSpan={folder.isOpen ? folder.events.length : 1} 
                      className="event-folder"
                      onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                    >
                      <div 
                        className="folder-header"
                        onClick={() => onFolderClick(folder.id)}
                      >
                        <span className="folder-icon">
                          {folder.isOpen ? '▼' : '▶'}
                        </span>
                        {folder.name}
                      </div>
                    </th>
                  ) : null
                ))}
              {/* Non-folder events */}
              {filteredEvents
                .filter(event => !event.isFolder && !event.hidden)
                .map((event, eventIndex) => (
                  <th 
                    key={event.id} 
                    rowSpan="2" 
                    className="event-column sortable-header"
                    onClick={() => onEventHeaderClick(event.id)}
                    onContextMenu={(e) => handleEventContextMenu(e, event.id, null)}
                  >
                    {event.name}
                    <br />
                    <small>
                      {event.startDate && (
                        <>
                          {new Date(event.startDate + 'T12:00:00Z').toLocaleDateString()}
                          {event.endDate && ` - ${new Date(event.endDate + 'T12:00:00Z').toLocaleDateString()}`}
                          <br />
                        </>
                      )}
                      (Weight: {event.weight})
                      {sorting.type === 'event' && sorting.eventId === event.id && ' ↓'}
                    </small>
                  </th>
                ))}
              <th 
                rowSpan="2" 
                className="score-column sortable-header"
                onClick={() => handleScoreHeaderClick('raw')}
              >
                Raw
                {sorting.type === 'score' && sorting.scoreType === 'raw' && (
                  <small> {sorting.direction === 'asc' ? '↓' : '↑'}</small>
                )}
              </th>
              <th 
                rowSpan="2" 
                className="score-column sortable-header"
                onClick={() => handleScoreHeaderClick('weighted')}
              >
                Weighted
                {sorting.type === 'score' && sorting.scoreType === 'weighted' && (
                  <small> {sorting.direction === 'asc' ? '↓' : '↑'}</small>
                )}
              </th>
            </tr>
            {/* Second header row for folder events */}
            <tr>
              {filteredEvents
                .filter(folder => !folder.hidden)
                .map((folder, folderIndex) => 
                  folder.isFolder ? (
                    folder.isOpen ? 
                      folder.events.map((event, eventIndex) => (
                        <th 
                          key={event.id} 
                          className="event-column sortable-header"
                          onClick={() => onEventHeaderClick(event.id)}
                          onContextMenu={(e) => handleEventContextMenu(e, event.id, folder.id)}
                        >
                          {event.name}
                          <br />
                          <small>
                            {event.startDate && (
                              <>
                                {new Date(event.startDate + 'T12:00:00Z').toLocaleDateString()}
                                {event.endDate && ` - ${new Date(event.endDate + 'T12:00:00Z').toLocaleDateString()}`}
                                <br />
                              </>
                            )}
                            (Weight: {event.weight})
                            {sorting.type === 'event' && sorting.eventId === event.id && ' ↓'}
                          </small>
                        </th>
                      ))
                      : [<th key={folder.id} className="collapsed-folder"></th>]
                  ) : null
                )}
            </tr>
          </thead>
          <tbody>
            {sortedPeople.map(person => (
              <tr key={person.id}>
                <td 
                  className="name-column"
                  style={{
                    '--group-bars': person.groups?.length > 0 
                      ? person.groups.map((g, i) => 
                          `linear-gradient(${g.color}, ${g.color}) ${i * 5}px 0 / 4px 100% no-repeat`
                        ).join(', ')
                      : 'none',
                    paddingLeft: person.groups?.length > 0 ? (5 * person.groups.length + 8) + 'px' : '5px'
                  }}
                  title={person.groups?.length > 0 
                    ? `Groups: ${person.groups.map(g => groups.find(group => group.id === g.id)?.name).join(', ')}` 
                    : ''}
                >
                  {person.name}
                </td>
                {/* Render cells for each event */}
                {filteredEvents
                  .filter(folder => !folder.hidden)
                  .map((folder, folderIndex) => 
                    folder.isFolder ? (
                      folder.isOpen ? 
                        folder.events.map((event, eventIndex) => (
                          <td 
                            key={event.id}
                            className={`attendance-cell ${
                              settings.showHoverHighlight && hoveredCell.row === person.id ? 'highlight-row' : ''
                            } ${
                              settings.showHoverHighlight && hoveredCell.col === `${folderIndex}-${eventIndex}` ? 'highlight-column' : ''
                            }`}
                            onMouseEnter={() => settings.showHoverHighlight && handleCellHover(person.id, `${folderIndex}-${eventIndex}`)}
                            onMouseLeave={() => settings.showHoverHighlight && handleCellHover(null, null)}
                          >
                            <select
                              value={attendance[`${person.id}-${event.id}`] || 'Select'}
                              onChange={(e) => onAttendanceChange(person.id, event.id, e.target.value)}
                              data-status={attendance[`${person.id}-${event.id}`] || 'Select'}
                            >
                              <option value="Select"></option>
                              <option value="Present">Present</option>
                              <option value="Absent">Absent</option>
                              <option value="Late">Late</option>
                              <option value="DNA">N/A</option>
                            </select>
                          </td>
                        ))
                        : <td key={folder.id} className="collapsed-folder"></td>
                    ) : null
                  )}
                {/* Non-folder events */}
                {filteredEvents
                  .filter(event => !event.isFolder && !event.hidden)
                  .map((event, eventIndex) => (
                    <td 
                      key={event.id}
                      className={`attendance-cell ${
                        settings.showHoverHighlight && hoveredCell.row === person.id ? 'highlight-row' : ''
                      } ${
                        settings.showHoverHighlight && hoveredCell.col === `no-folder-${eventIndex}` ? 'highlight-column' : ''
                      }`}
                      onMouseEnter={() => settings.showHoverHighlight && handleCellHover(person.id, `no-folder-${eventIndex}`)}
                      onMouseLeave={() => settings.showHoverHighlight && handleCellHover(null, null)}
                    >
                      <select
                        value={attendance[`${person.id}-${event.id}`] || 'Select'}
                        onChange={(e) => onAttendanceChange(person.id, event.id, e.target.value)}
                        data-status={attendance[`${person.id}-${event.id}`] || 'Select'}
                      >
                        <option value="Select"></option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Late">Late</option>
                        <option value="DNA">N/A</option>
                      </select>
                    </td>
                  ))}
                <td className="score-column">{calculateScores(person.id).raw}%</td>
                <td className="score-column">{calculateScores(person.id).weighted}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {eventContextMenu && (
          <EventContextMenu
            x={eventContextMenu.x}
            y={eventContextMenu.y}
            folders={events.filter(e => e.isFolder)}
            onMove={(toFolderId) => {
              onMoveEvent(eventContextMenu.eventId, eventContextMenu.currentFolderId, toFolderId);
              setEventContextMenu(null);
            }}
            onRemove={() => {
              onRemoveEvent(eventContextMenu.currentFolderId, eventContextMenu.eventId);
              setEventContextMenu(null);
            }}
            onRename={(newName) => {
              onRenameEvent(eventContextMenu.currentFolderId, eventContextMenu.eventId, newName);
              setEventContextMenu(null);
            }}
            onSetAll={(status) => {
              handleSetAll(status);
              setEventContextMenu(null);
            }}
            onEditDates={(startDate, endDate) => {
              onEditEventDates(eventContextMenu.currentFolderId, eventContextMenu.eventId, startDate, endDate);
              setEventContextMenu(null);
            }}
            onEditWeight={(weight) => {
              onEditEventWeight(eventContextMenu.currentFolderId, eventContextMenu.eventId, weight);
              setEventContextMenu(null);
            }}
            onClose={() => setEventContextMenu(null)}
          />
        )}
        {folderContextMenu && (
          <FolderContextMenu
            x={folderContextMenu.x}
            y={folderContextMenu.y}
            onRename={(newName) => {
              onRenameFolder(folderContextMenu.folderId, newName);
              setFolderContextMenu(null);
            }}
            onClose={() => setFolderContextMenu(null)}
          />
        )}
      </div>
    </div>
  );
}

export default Table; 