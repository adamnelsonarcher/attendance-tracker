import React, { useState } from 'react';
import './Table.css';
import EventFolder from './EventFolder/EventFolder';
import GroupFilter from './GroupFilter/GroupFilter';
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
  groups
}) {
  const [activeGroupFilters, setActiveGroupFilters] = useState(new Set());
  const [showGroupFilter, setShowGroupFilter] = useState(false);

  const attendanceStatus = ['Present', 'Absent', 'Late', 'DNA'];

  // Filter people based on active group filters
  const filteredPeople = activeGroupFilters.size > 0
    ? people.filter(person => 
        person.groups.some(group => activeGroupFilters.has(group.id))
      )
    : people;

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

  return (
    <div className={`table-container ${settings.colorCodeAttendance ? 'color-coded' : ''} ${settings.onlyCountAbsent ? 'treat-select-as-dna' : ''}`}>
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
                <button 
                  className="group-filter-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGroupFilter(!showGroupFilter);
                  }}
                >
                  <img src={filterIcon} alt="Filter groups" />
                </button>
                {showGroupFilter && (
                  <GroupFilter
                    groups={groups}
                    activeFilters={activeGroupFilters}
                    onFilterChange={setActiveGroupFilters}
                    onClose={() => setShowGroupFilter(false)}
                  />
                )}
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
            {events.filter(folder => folder.isFolder).map(folder => (
              <th 
                key={folder.id} 
                colSpan={folder.isOpen ? folder.events.length : 1} 
                className="event-folder"
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
            ))}
            {/* Non-folder events */}
            {events.filter(folder => !folder.isFolder).flatMap(folder => 
              folder.events.map(event => (
                <th 
                  key={event.id} 
                  rowSpan="2" 
                  className="event-column sortable-header"
                  onClick={() => onEventHeaderClick(event.id)}
                >
                  {event.name}
                  <br />
                  <small>
                    (Weight: {event.weight})
                    {sorting.type === 'event' && sorting.eventId === event.id && ' ↓'}
                  </small>
                </th>
              ))
            )}
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
            {events.filter(folder => folder.isFolder).flatMap(folder => 
              folder.isOpen ? folder.events.map(event => (
                <th 
                  key={event.id} 
                  className="event-column sortable-header"
                  onClick={() => onEventHeaderClick(event.id)}
                >
                  {event.name}
                  <br />
                  <small>
                    (Weight: {event.weight})
                    {sorting.type === 'event' && sorting.eventId === event.id && ' ↓'}
                  </small>
                </th>
              )) : [<th key={folder.id} className="collapsed-folder"></th>]
            )}
          </tr>
        </thead>
        <tbody>
          {sortedPeople.map(person => (
            <tr key={person.id}>
              <td 
                className="name-column"
                style={{
                  '--group-color': person.groups?.length > 0 ? person.groups[0].color : 'transparent',
                  paddingLeft: person.groups?.length > 0 ? '12px' : '5px'
                }}
              >
                {person.name}
              </td>
              {/* Render cells for each event */}
              {events.map(folder => 
                folder.isFolder ? (
                  folder.isOpen ? 
                    folder.events.map(event => (
                      <td key={event.id}>
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
                ) : (
                  folder.events.map(event => (
                    <td key={event.id}>
                      <select
                        value={attendance[`${person.id}-${event.id}`] || 'Select'}
                        onChange={(e) => onAttendanceChange(person.id, event.id, e.target.value)}
                        data-status={attendance[`${person.id}-${event.id}`] || 'Select'}
                      >
                        <option value="Select"></option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Late">Late</option>
                        <option value="DNA">DNA</option>
                      </select>
                    </td>
                  ))
                )
              )}
              <td className="score-column">{calculateScores(person.id).raw}%</td>
              <td className="score-column">{calculateScores(person.id).weighted}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table; 