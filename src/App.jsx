import React, { useState } from 'react';
import './App.css';
import AddEventForm from './components/AddEventForm';
import AddPersonForm from './components/AddPersonForm';
import SortContextMenu from './components/SortContextMenu';

function App() {
  const [people, setPeople] = useState([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
    { id: 3, name: 'Bob Johnson' },
  ]);

  const [events, setEvents] = useState([
    { id: 1, name: 'Meeting 1', weight: 1 },
    { id: 2, name: 'Meeting 2', weight: 2 },
    { id: 3, name: 'Meeting 3', weight: 3 },
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

    events.forEach(event => {
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

    const rawScore = totalEvents > 0 ? (attendedEvents / totalEvents) * 100 : 0;
    const weightedScore = weightedDenominator > 0 ? 
      (weightedNumerator / weightedDenominator) * 100 : 0;

    return {
      raw: rawScore.toFixed(1),
      weighted: weightedScore.toFixed(1)
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

  const getSortedPeople = () => {
    if (sorting.direction === 'none') return people;
    
    return [...people].sort((a, b) => {
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
  };

  const handleNameHeaderClick = () => {
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
    setSorting({ type, direction });
    setContextMenu(null);
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

      <table>
        <thead>
          <tr>
            <th 
              onClick={handleNameHeaderClick}
              onContextMenu={handleNameHeaderContextMenu}
              className="sortable-header"
            >
              Name {sorting.direction !== 'none' && (
                <>
                  {sorting.direction === 'asc' ? '↓' : '↑'}
                  <small>
                    ({sorting.type === 'firstName' ? 'First' : 
                       sorting.type === 'lastName' ? 'Last' : 'Full'})
                  </small>
                </>
              )}
            </th>
            {events.map(event => (
              <th key={event.id}>
                {event.name}
                <br />
                <small>(Weight: {event.weight})</small>
              </th>
            ))}
            <th>Raw Score</th>
            <th>Weighted Score</th>
          </tr>
        </thead>
        <tbody>
          {getSortedPeople().map(person => {
            const scores = calculateScores(person.id);
            return (
              <tr key={person.id}>
                <td>{person.name}</td>
                {events.map(event => (
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
                ))}
                <td>{scores.raw}%</td>
                <td>{scores.weighted}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

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