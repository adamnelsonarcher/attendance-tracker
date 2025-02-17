import React, { useState } from 'react';
import './App.css';
import AddEventForm from './components/AddEventForm';
import AddPersonForm from './components/AddPersonForm';
import SortContextMenu from './components/SortContextMenu';
import EventFolder from './components/EventFolder';

function App() {
  const [people, setPeople] = useState([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
    { id: 3, name: 'Bob Johnson' },
  ]);

  const [events, setEvents] = useState([
    {
      id: 'weekly',
      name: 'Weekly Events',
      isFolder: true,
      isOpen: true,
      events: [
        { id: 1, name: 'Meeting 1', weight: 1 },
        { id: 2, name: 'Meeting 2', weight: 2 },
      ]
    },
    {
      id: 'special',
      name: 'Special Events',
      isFolder: true,
      isOpen: false,
      events: [
        { id: 3, name: 'Workshop', weight: 3 },
      ]
    }
  ]);

  const [attendance, setAttendance] = useState({});

  const attendanceStatus = ['Present', 'Absent', 'Late', 'DNA'];

  const [settings, setSettings] = useState({
    onlyCountAbsent: false,
    lateCredit: 0.5,
  });

  const [showSettings, setShowSettings] = useState(false);

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);

  const [sorting, setSorting] = useState({
    direction: 'none',
    type: 'fullName'
  });
  const [contextMenu, setContextMenu] = useState(null);

  // Add state for event column sorting
  const [eventSorting, setEventSorting] = useState({
    eventId: null,
    isActive: false
  });

  const handleAttendanceChange = (personId, eventId, status) => {
    setAttendance({
      ...attendance,
      [`${personId}-${eventId}`]: status,
    });
  };

  const calculateScores = (personId) => {
    let totalEvents = 0;
    let attendedEvents = 0;
    let weightedNumerator = 0;
    let weightedDenominator = 0;

    // Flatten ALL events regardless of folder state
    const flatEvents = events.flatMap(folder => folder.events);

    flatEvents.forEach(event => {
      const status = attendance[`${personId}-${event.id}`];
      
      if (status === 'DNA' || (settings.onlyCountAbsent && !['Present', 'Absent'].includes(status))) {
        return;
      }

      totalEvents++;
      weightedDenominator += event.weight;
      
      if (status === 'Present') {
        attendedEvents++;
        weightedNumerator += event.weight;
      } else if (status === 'Late') {
        attendedEvents += settings.lateCredit;
        weightedNumerator += event.weight * settings.lateCredit;
      }
    });

    const rawScore = totalEvents === 0 ? 0 : (attendedEvents / totalEvents) * 100;
    const weightedScore = weightedDenominator === 0 ? 0 : (weightedNumerator / weightedDenominator) * 100;

    return {
      raw: Math.round(rawScore),
      weighted: Math.round(weightedScore)
    };
  };

  const handleAddEvent = (newEvent) => {
    setEvents([...events, newEvent]);
  };

  const handleAddPerson = (newPeople) => {
    // If single person is added, wrap in array
    const peopleToAdd = Array.isArray(newPeople) ? newPeople : [newPeople];
    setPeople([...people, ...peopleToAdd]);
  };

  // Add function to get attendance status priority for sorting
  const getStatusPriority = (status) => {
    switch(status) {
      case 'Present': return 0;
      case 'Late': return 1;
      case 'Absent': return 2;
      case 'DNA': return 3;
      default: return 4; // Not selected
    }
  };

  // Update getSortedPeople to handle event column sorting
  const getSortedPeople = () => {
    let sortedPeople = [...people];
    
    if (eventSorting.isActive && eventSorting.eventId) {
      sortedPeople.sort((a, b) => {
        const statusA = attendance[`${a.id}-${eventSorting.eventId}`] || '';
        const statusB = attendance[`${b.id}-${eventSorting.eventId}`] || '';
        return getStatusPriority(statusA) - getStatusPriority(statusB);
      });
    } else if (sorting.direction !== 'none') {
      sortedPeople.sort((a, b) => {
        let compareA, compareB;
        
        if (sorting.type === 'firstName') {
          compareA = a.name.split(' ')[0];
          compareB = b.name.split(' ')[0];
        } else if (sorting.type === 'lastName') {
          compareA = a.name.split(' ').slice(-1)[0];
          compareB = b.name.split(' ').slice(-1)[0];
        } else {
          compareA = a.name;
          compareB = b.name;
        }
        
        const comparison = compareA.localeCompare(compareB);
        return sorting.direction === 'asc' ? comparison : -comparison;
      });
    }
    
    return sortedPeople;
  };

  // Update name sorting handlers to reset event sorting
  const handleNameHeaderClick = () => {
    // Reset event sorting
    setEventSorting({ eventId: null, isActive: false });
    
    // Update name sorting
    setSorting(current => ({
      type: current.type,
      direction: current.direction === 'none' ? 'asc' : 
                current.direction === 'asc' ? 'desc' : 'none'
    }));
  };

  const handleNameHeaderContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleSort = (type, direction = 'none') => {
    // Reset event sorting
    setEventSorting({ eventId: null, isActive: false });
    
    // Update name sorting
    setSorting({ type, direction });
    setContextMenu(null);
  };

  // Update event sorting handler to reset name sorting (already done in previous code)
  const handleEventHeaderClick = (eventId) => {
    setEventSorting(current => ({
      eventId: eventId,
      isActive: !(current.eventId === eventId && current.isActive)
    }));
    // Reset name sorting
    setSorting({ direction: 'none', type: 'fullName' });
  };

  // Add folder toggle handler
  const handleFolderToggle = (folderId) => {
    setEvents(events.map(item => 
      item.id === folderId 
        ? { ...item, isOpen: !item.isOpen }
        : item
    ));
  };

  return (
    <div className="App">
      <div className="top-bar">
        <button 
          className="settings-button"
          onClick={() => setShowSettings(true)}
        >
          ⚙️ Settings
        </button>
        <div className="action-buttons">
          <button onClick={() => setShowAddPerson(true)}>Add Person</button>
          <button onClick={() => setShowAddEvent(true)}>Add Event</button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-popup">
            <h2>Settings</h2>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.onlyCountAbsent}
                  onChange={(e) => setSettings({
                    ...settings,
                    onlyCountAbsent: e.target.checked
                  })}
                />
                Only include Present/Absent events in calculations
              </label>
            </div>
            <div className="setting-item">
              <label>
                Make 'Late' count for:
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.lateCredit}
                  onChange={(e) => setSettings({
                    ...settings,
                    lateCredit: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0))
                  })}
                />
                <span className="credit-label">({(settings.lateCredit * 100).toFixed(0)}% credit)</span>
              </label>
            </div>
            <button 
              className="close-button"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showAddPerson && (
        <AddPersonForm
          onAdd={handleAddPerson}
          onClose={() => setShowAddPerson(false)}
        />
      )}

      {showAddEvent && (
        <AddEventForm
          onAdd={handleAddEvent}
          onClose={() => setShowAddEvent(false)}
        />
      )}

      <h1>Attendance Tracker</h1>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th rowSpan="2" className="name-column">Name</th>
              {events.map(folder => (
                folder.isOpen ? (
                  // When open, span all event columns
                  <th key={folder.id} colSpan={folder.events.length} className="event-folder">
                    <div className="folder-header" onClick={() => handleFolderToggle(folder.id)}>
                      <span className="folder-icon">▼</span>
                      {folder.name}
                    </div>
                  </th>
                ) : (
                  // When closed, only take up one column
                  <th key={folder.id} colSpan="1" className="event-folder">
                    <div className="folder-header" onClick={() => handleFolderToggle(folder.id)}>
                      <span className="folder-icon">▶</span>
                      {folder.name}
                    </div>
                  </th>
                )
              ))}
              <th rowSpan="2" className="score-column">Raw</th>
              <th rowSpan="2" className="score-column">Weighted</th>
            </tr>
            <tr>
              {events.flatMap(folder => 
                folder.isOpen 
                  ? folder.events.map(event => (
                      <th 
                        key={event.id}
                        onClick={() => handleEventHeaderClick(event.id)}
                        className="sortable-header event-column"
                      >
                        {event.name}
                        <br />
                        <small>
                          (Weight: {event.weight})
                          {eventSorting.eventId === event.id && eventSorting.isActive && ' ↓'}
                        </small>
                      </th>
                    ))
                  : [<th key={folder.id} className="collapsed-folder"></th>] // Single column placeholder
              )}
            </tr>
          </thead>
          <tbody>
            {getSortedPeople().map(person => (
              <tr key={person.id}>
                <td>{person.name}</td>
                {events.flatMap(folder => 
                  folder.isOpen 
                    ? folder.events.map(event => (
                        <td key={event.id}>
                          <select
                            value={attendance[`${person.id}-${event.id}`] || ''}
                            onChange={(e) => handleAttendanceChange(person.id, event.id, e.target.value)}
                          >
                            <option value="">Select</option>
                            {attendanceStatus.map(status => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))
                    : [<td key={folder.id} className="collapsed-folder"></td>] // Single column placeholder
                )}
                <td>{calculateScores(person.id).raw}%</td>
                <td>{calculateScores(person.id).weighted}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <SortContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSort={handleSort}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default App; 