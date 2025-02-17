import React, { useState } from 'react';
import './App.css';
import Table from './components/Table/Table';
import Settings from './components/TopBar/Settings/Settings';
import TopBar from './components/TopBar/TopBar';
import AddEventForm from './components/TopBar/AddEventForm/AddEventForm';
import AddPersonForm from './components/TopBar/AddPersonForm/AddPersonForm';
import { useAttendance } from './hooks/useAttendance';
import { useEvents } from './hooks/useEvents';
import { usePeople } from './hooks/usePeople';
import { useSort } from './hooks/useSort';
import { useCalculateScores } from './hooks/useCalculateScores';
import SortContextMenu from './components/Table/SortContextMenu';
import Groups from './components/TopBar/Groups/Groups';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [settings, setSettings] = useState({
    lateCredit: 0.5,
    onlyCountAbsent: true,
    colorCodeAttendance: true
  });
  const [contextMenu, setContextMenu] = useState(null);
  
  const [people, handleAddPerson, updatePeopleGroups] = usePeople();
  const [events, handleAddEvent, toggleFolder] = useEvents();
  const [attendance, handleAttendanceChange] = useAttendance();
  const [sorting, handleSort, getStatusPriority] = useSort();
  const calculateScores = useCalculateScores(events, attendance, settings);
  const [groups, setGroups] = useState([]);

  const handleEventHeaderClick = (eventId) => {
    handleSort('event', null, eventId);
  };

  const handleNameHeaderClick = () => {
    if (sorting.type === 'firstName') {
      handleSort('firstName', sorting.direction === 'asc' ? 'desc' : null);
    } else {
      handleSort('firstName', 'asc');
    }
  };

  const handleNameHeaderContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <div className="App">
      <TopBar 
        onSettingsClick={() => setShowSettings(true)}
        onAddPersonClick={() => setShowAddPerson(true)}
        onAddEventClick={() => setShowAddEvent(true)}
        onGroupsClick={() => setShowGroups(true)}
      />

      <h1>Attendance Tracker</h1>

      <Table 
        people={people}
        events={events}
        attendance={attendance}
        onAttendanceChange={handleAttendanceChange}
        calculateScores={calculateScores}
        sorting={sorting}
        onEventHeaderClick={handleEventHeaderClick}
        onNameHeaderClick={handleNameHeaderClick}
        onFolderClick={toggleFolder}
        getStatusPriority={getStatusPriority}
        onNameHeaderContextMenu={handleNameHeaderContextMenu}
        settings={settings}
        groups={groups}
      />

      {contextMenu && (
        <SortContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSort={handleSort}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showSettings && (
        <Settings
          settings={settings}
          onSave={setSettings}
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

      {showGroups && (
        <Groups
          groups={groups}
          people={people}
          onSave={(newGroups) => {
            setGroups(newGroups);
            updatePeopleGroups(newGroups);
          }}
          onClose={() => setShowGroups(false)}
        />
      )}
    </div>
  );
}

export default App; 