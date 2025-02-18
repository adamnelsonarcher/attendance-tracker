import React from 'react';
import './Table.css';
import EventFolder from './EventFolder/EventFolder';
import PropTypes from 'prop-types';

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
  activeGroupFilters,
  activeFolderFilters
}) {
  const attendanceStatus = ['Present', 'Absent', 'Late', 'DNA'];

  // Filter people based on active group filters
  const filteredPeople = Array.from(activeGroupFilters.entries()).length > 0
    ? people.filter(person => {
        // Check if any of person's groups are explicitly hidden
        const isHidden = person.groups.some(group => 
          activeGroupFilters.get(group.id) === 'hide'
        );
        if (isHidden) return false;

        // If any groups are set to show, person must be in one of them
        const hasShowFilters = Array.from(activeGroupFilters.values()).includes('show');
        if (hasShowFilters) {
          return person.groups.some(group => activeGroupFilters.get(group.id) === 'show');
        }

        // If no show filters, show all non-hidden people
        return true;
      })
    : people;

  // Filter events based on active folder filters
  const filteredEvents = events.filter(folder => {
    if (folder.isFolder) {
      const filterState = activeFolderFilters.get(folder.id);
      if (filterState === 'hide') return false; // Hide explicitly hidden folders
      
      // If any folders are set to "show", only show those folders
      const hasShowFilters = Array.from(activeFolderFilters.values()).includes('show');
      if (hasShowFilters) {
        return filterState === 'show';
      }
      
      // Otherwise show all non-hidden folders
      return true;
    }
    
    // For non-folder events:
    // If any folder is set to "show", hide non-folder events
    const hasShowFilters = Array.from(activeFolderFilters.values()).includes('show');
    if (hasShowFilters) return false;
    
    // Otherwise show all non-folder events
    return true;
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
            {filteredEvents.filter(folder => folder.isFolder).map(folder => (
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
            {filteredEvents.filter(folder => !folder.isFolder).flatMap(folder => 
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
            {filteredEvents.filter(folder => folder.isFolder).flatMap(folder => 
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
                  borderLeft: person.groups?.length > 0 ? `4px solid ${person.groups[0].color}` : 'none',
                  paddingLeft: person.groups?.length > 0 ? '8px' : '12px'
                }}
              >
                {person.name}
              </td>
              {/* Render cells for each event */}
              {filteredEvents.map(folder => 
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

Table.propTypes = {
  people: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      groups: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          color: PropTypes.string.isRequired
        })
      ).isRequired
    })
  ).isRequired,
  events: PropTypes.array.isRequired,
  attendance: PropTypes.object.isRequired,
  onAttendanceChange: PropTypes.func.isRequired,
  calculateScores: PropTypes.func.isRequired,
  sorting: PropTypes.shape({
    type: PropTypes.string.isRequired,
    direction: PropTypes.string,
    eventId: PropTypes.string,
    scoreType: PropTypes.string
  }).isRequired,
  onEventHeaderClick: PropTypes.func.isRequired,
  onNameHeaderClick: PropTypes.func.isRequired,
  onFolderClick: PropTypes.func.isRequired,
  getStatusPriority: PropTypes.func.isRequired,
  onNameHeaderContextMenu: PropTypes.func.isRequired,
  settings: PropTypes.object.isRequired,
  groups: PropTypes.array.isRequired,
  activeGroupFilters: PropTypes.instanceOf(Map).isRequired,
  activeFolderFilters: PropTypes.instanceOf(Map).isRequired
};

export default Table; 