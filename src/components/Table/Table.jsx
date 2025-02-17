import React from 'react';
import './Table.css';
import EventFolder from './EventFolder/EventFolder';

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
  settings
}) {
  const attendanceStatus = ['Present', 'Absent', 'Late', 'DNA'];

  // Sort people if needed
  const sortedPeople = [...people].sort((a, b) => {
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
    return 0;
  });

  return (
    <div className={`table-container ${settings.colorCodeAttendance ? 'color-coded' : ''} ${settings.onlyCountAbsent ? 'treat-select-as-dna' : ''}`}>
      <table>
        <thead>
          <tr>
            <th 
              rowSpan="2" 
              className="name-column sortable-header"
              onClick={onNameHeaderClick}
              onContextMenu={onNameHeaderContextMenu}
            >
              Name
              {(sorting.type === 'firstName' || sorting.type === 'lastName') && (
                <small>
                  {` (${sorting.type === 'firstName' ? 'First' : 'Last'}) `}
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
            <th rowSpan="2" className="score-column">Raw</th>
            <th rowSpan="2" className="score-column">Weighted</th>
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