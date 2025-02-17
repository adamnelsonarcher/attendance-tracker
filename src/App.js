import React, { useState } from 'react';
import './App.css';

function App() {
  const [people, setPeople] = useState([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
    { id: 3, name: 'Bob Johnson' },
  ]);

  const [events, setEvents] = useState([
    { id: 1, name: 'Meeting 1' },
    { id: 2, name: 'Meeting 2' },
    { id: 3, name: 'Meeting 3' },
  ]);

  const [attendance, setAttendance] = useState({});

  const attendanceStatus = ['Present', 'Absent', 'Late', 'DNA'];

  const handleAttendanceChange = (personId, eventId, status) => {
    setAttendance({
      ...attendance,
      [`${personId}-${eventId}`]: status,
    });
  };

  return (
    <div className="App">
      <h1>Attendance Tracker</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {events.map(event => (
              <th key={event.id}>{event.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map(person => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App; 