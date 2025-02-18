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
import GroupFilter from './components/Table/GroupFilter/GroupFilter';
import filterIcon from './assets/icons/filter.png';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [settings, setSettings] = useState({
    lateCredit: 0.5,
    onlyCountAbsent: true,
    colorCodeAttendance: true
  });
  const [contextMenu, setContextMenu] = useState(null);
  
  const [people, handleAddPerson, updatePeopleGroups] = usePeople();
  const [events, folders, handleAddEvent, toggleFolder, setFolders] = useEvents();
  const [attendance, handleAttendanceChange] = useAttendance();
  const [sorting, handleSort, getStatusPriority] = useSort();
  const calculateScores = useCalculateScores(events, attendance, settings);
  const [groups, setGroups] = useState([]);
  const [activeGroupFilters, setActiveGroupFilters] = useState(new Map());
  const [activeFolderFilters, setActiveFolderFilters] = useState(new Map());
  const [activeTab, setActiveTab] = useState('people');

  const handleEventHeaderClick = (eventId, type = 'event', scoreType = null) => {
    if (type === 'score') {
      handleSort('score', null, null, scoreType);
    } else {
      handleSort('event', null, eventId);
    }
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

      <div className="title-row">
        <h1>Attendance Tracker</h1>
        <button 
          className="filter-button"
          onClick={() => setShowGroupFilter(!showGroupFilter)}
        >
          <img src={filterIcon} alt="Filter" /> Filter
        </button>
        {showGroupFilter && (
          <GroupFilter
            groups={groups}
            folders={folders}
            activeGroupFilters={activeGroupFilters}
            activeFolderFilters={activeFolderFilters}
            onGroupFilterChange={setActiveGroupFilters}
            onFolderFilterChange={setActiveFolderFilters}
            onClose={() => setShowGroupFilter(false)}
          />
        )}
      </div>

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
        activeGroupFilters={activeGroupFilters}
        activeFolderFilters={activeFolderFilters}
        folders={folders}
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
          folders={folders}
        />
      )}

      {showGroups && (
        <Groups
          groups={groups}
          people={people}
          events={events}
          folders={folders}
          setEvents={setFolders}
          onSave={(newGroups) => {
            if (activeTab === 'people') {
              setGroups(newGroups);
              updatePeopleGroups(newGroups);
            } else {
              const updatedEvents = events.map(event => {
                const updatedFolder = newGroups.find(g => g.id === event.folder);
                if (!updatedFolder) return event;
                return {
                  ...event,
                  folder: updatedFolder.id,
                  name: event.name,
                  color: updatedFolder.color
                };
              });
              setFolders(updatedEvents);
            }
          }}
          onClose={() => setShowGroups(false)}
        />
      )}
    </div>
  );
}

export default App; 