import React, { useState } from 'react';
import './App.css';

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

  return (
    <div className="App">
      <button 
        className="settings-button"
        onClick={() => setShowSettings(true)}
      >
        ⚙️ Settings
      </button>
      
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

      <h1>Attendance Tracker</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
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
          {people.map(person => {
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
    </div>
  );
}

export default App; 