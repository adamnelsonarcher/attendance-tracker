import React, { useState } from 'react';
import './App.css';
import AddEventForm from './components/AddEventForm';
import AddPersonForm from './components/AddPersonForm';
import SortContextMenu from './components/SortContextMenu';
import EventFolder from './components/EventFolder';

function App() {
  // Initial people with more names
  const [people, setPeople] = useState([
    { id: 'p1', name: 'John Doe' },
    { id: 'p2', name: 'Jane Smith' },
    { id: 'p3', name: 'Bob Johnson' },
    { id: 'p4', name: 'Alice Williams' },
    { id: 'p5', name: 'Charlie Brown' },
    { id: 'p6', name: 'Diana Ross' },
    { id: 'p7', name: 'Edward Norton' },
    { id: 'p8', name: 'Fiona Apple' },
    { id: 'p9', name: 'George Lucas' },
    { id: 'p10', name: 'Helen Hunt' },
    { id: 'p11', name: 'Ian McKellen' },
    { id: 'p12', name: 'Julia Roberts' },
    { id: 'p13', name: 'Kevin Bacon' },
    { id: 'p14', name: 'Laura Palmer' },
    { id: 'p15', name: 'Michael Scott' },
    { id: 'p16', name: 'Nancy Wheeler' },
    { id: 'p17', name: 'Oscar Martinez' },
    { id: 'p18', name: 'Pam Beesly' }
  ]);

  // Initial events with folders and varied weights
  const [events, setEvents] = useState([
    {
      id: 'weekly',
      name: 'Weekly Events',
      isFolder: true,
      isOpen: true,
      events: [
        { id: 'e1', name: 'Meeting 1', weight: 1 },
        { id: 'e2', name: 'Meeting 2', weight: 2 },
        { id: 'e3', name: 'Workshop', weight: 3 },
        { id: 'e8', name: 'Code Review', weight: 2 },
        { id: 'e9', name: 'Team Sync', weight: 1 }
      ]
    },
    {
      id: 'special',
      name: 'Special Events',
      isFolder: true,
      isOpen: true,
      events: [
        { id: 'e4', name: 'Conference', weight: 4 },
        { id: 'e5', name: 'Training', weight: 2 },
        { id: 'e10', name: 'Hackathon', weight: 3 },
        { id: 'e11', name: 'Workshop', weight: 2 }
      ]
    },
    {
      id: 'no-folder',
      events: [
        { id: 'e6', name: 'Team Building', weight: 1 },
        { id: 'e7', name: 'Project Review', weight: 2 }
      ]
    }
  ]);

  // Initial attendance records
  const [attendance, setAttendance] = useState({
    'p1-e1': 'Present',
    'p1-e2': 'Late',
    'p1-e3': 'Absent',
    'p1-e4': 'Present',
    'p1-e5': 'Present',
    'p1-e6': 'DNA',
    'p1-e7': 'Present',
    
    'p2-e1': 'Late',
    'p2-e2': 'Present',
    'p2-e3': 'Present',
    'p2-e4': 'Absent',
    'p2-e5': 'Present',
    
    'p3-e1': 'Present',
    'p3-e2': 'Present',
    'p3-e3': 'Late',
    'p3-e4': 'Present',
    
    'p4-e1': 'Absent',
    'p4-e2': 'Present',
    'p4-e3': 'Present',
    
    'p5-e1': 'Present',
    'p5-e2': 'DNA',
    
    'p6-e1': 'Late',
    'p6-e2': 'Late',
    
    'p7-e1': 'Present',
    
    // p8 has no attendance records yet
    'p9-e1': 'Present',
    'p9-e2': 'Late',
    'p9-e8': 'Present',
    
    'p10-e1': 'Present',
    'p10-e2': 'Present',
    'p10-e10': 'Late',
    
    'p11-e3': 'Absent',
    'p11-e8': 'Present',
    'p11-e9': 'Present',
    
    'p12-e4': 'Present',
    'p12-e10': 'Present',
    'p12-e11': 'Late',
    
    'p13-e5': 'DNA',
    'p13-e6': 'Present',
    
    'p14-e7': 'Late',
    'p14-e8': 'Present',
    
    'p15-e9': 'Absent',
    'p15-e10': 'Present',
    
    'p16-e1': 'Present',
    'p16-e11': 'Present',
    
    'p17-e2': 'Late',
    'p17-e3': 'Present',
  });

  const attendanceStatus = ['Present', 'Absent', 'Late', 'DNA'];

  const [settings, setSettings] = useState({
    lateCredit: 0.5,
    onlyCountAbsent: true,
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

    // Get all events from all folders and non-folders
    const flatEvents = events.flatMap(group => group.events);

    flatEvents.forEach(event => {
      const status = attendance[`${personId}-${event.id}`];
      
      if (status === 'DNA' || (settings.onlyCountAbsent && !['Present', 'Absent', 'Late'].includes(status))) {
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

    const rawScore = totalEvents > 0 ? (attendedEvents / totalEvents) * 100 : 0;
    const weightedScore = weightedDenominator > 0 ? 
      (weightedNumerator / weightedDenominator) * 100 : 0;

    return {
      raw: rawScore.toFixed(0),
      weighted: weightedScore.toFixed(0)
    };
  };

  const handleAddEvent = ({ folderId = 'no-folder', event, newFolder }) => {
    if (newFolder) {
      setEvents([...events, newFolder]);
      return;
    }
    
    setEvents(events.map(folder => 
      folder.id === folderId
        ? { ...folder, events: [...folder.events, event] }
        : folder
    ));
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

  const SettingsForm = ({ settings, onSave, onClose }) => {
    const [formData, setFormData] = useState({ ...settings });

    const calculateLateExample = (credit) => {
      return `(${(credit * 100).toFixed(0)}%)`;
    };

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Settings</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
            onClose();
          }}>
            <div className="form-group">
              <div className="setting-row">
                <label>Late Credit:</label>
                <div className="setting-input">
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.lateCredit}
                    onChange={(e) => setFormData({
                      ...formData,
                      lateCredit: Number(e.target.value)
                    })}
                  />
                  <span className="setting-example">
                    {calculateLateExample(formData.lateCredit)}
                  </span>
                </div>
              </div>
            </div>
            <div className="form-group">
              <div className="setting-row">
                <label>Treat 'not selected' events as DNA</label>
                <div className="setting-input">
                  <input
                    type="checkbox"
                    checked={formData.onlyCountAbsent}
                    onChange={(e) => setFormData({
                      ...formData,
                      onlyCountAbsent: e.target.checked
                    })}
                  />
                </div>
              </div>
            </div>
            <div className="button-group">
              <button type="submit">Save</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
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
        <SettingsForm
          settings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
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
          folders={events.filter(e => e.isFolder)}
        />
      )}

      <h1>Attendance Tracker</h1>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th rowSpan="2" className="name-column">Name</th>
              {events.filter(folder => folder.isFolder).map(folder => (
                <th key={folder.id} colSpan={folder.isOpen ? folder.events.length : 1} className="event-folder">
                  <div className="folder-header" onClick={() => handleFolderToggle(folder.id)}>
                    <span className="folder-icon">{folder.isOpen ? '▼' : '▶'}</span>
                    {folder.name}
                  </div>
                </th>
              ))}
              {/* Add non-folder event headers in first row */}
              {events.filter(folder => !folder.isFolder).flatMap(folder => 
                folder.events.map(event => (
                  <th key={event.id} rowSpan="2" className="event-column">
                    {event.name}
                    <br />
                    <small>(Weight: {event.weight})</small>
                  </th>
                ))
              )}
              <th rowSpan="2" className="score-column">Raw</th>
              <th rowSpan="2" className="score-column">Weighted</th>
            </tr>
            <tr>
              {events.filter(folder => folder.isFolder).flatMap(folder => 
                folder.isOpen ? folder.events.map(event => (
                  <th key={event.id} className="event-column">
                    {event.name}
                    <br />
                    <small>(Weight: {event.weight})</small>
                  </th>
                )) : [<th key={folder.id} className="collapsed-folder"></th>]
              )}
            </tr>
          </thead>
          <tbody>
            {getSortedPeople().map(person => (
              <tr key={person.id}>
                <td className="name-column">{person.name}</td>
                {events.filter(folder => folder.isFolder).flatMap(folder => 
                  folder.isOpen ? folder.events.map(event => (
                    <td key={event.id}>
                      <select
                        value={attendance[`${person.id}-${event.id}`] || ''}
                        onChange={(e) => handleAttendanceChange(person.id, event.id, e.target.value)}
                      >
                        <option value="">Select</option>
                        {attendanceStatus.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  )) : [<td key={folder.id} className="collapsed-folder"></td>]
                )}
                {/* Add non-folder event cells */}
                {events.filter(folder => !folder.isFolder).flatMap(folder => 
                  folder.events.map(event => (
                    <td key={event.id}>
                      <select
                        value={attendance[`${person.id}-${event.id}`] || ''}
                        onChange={(e) => handleAttendanceChange(person.id, event.id, e.target.value)}
                      >
                        <option value="">Select</option>
                        {attendanceStatus.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  ))
                )}
                <td className="score-column">{calculateScores(person.id).raw}%</td>
                <td className="score-column">{calculateScores(person.id).weighted}%</td>
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