import React, { useState, useEffect } from 'react';
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
import { useCloudSync } from './hooks/useCloudSync';
import { syncTable } from './services/firebase';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [settings, setSettings] = useState(() => {
    const storedSettings = localStorage.getItem('settings');
    return storedSettings ? JSON.parse(storedSettings) : {
      lateCredit: 0.5,
      onlyCountAbsent: true,
      colorCodeAttendance: true,
      hideTitle: true,
      showHoverHighlight: true,
      enableStickyColumns: true,
      cloudSync: false
    };
  });
  const [contextMenu, setContextMenu] = useState(null);
  
  const [people, handleAddPerson, updatePeopleGroups, resetPeople, setPeople] = usePeople();
  const [events, handleAddEvent, handleRemoveEvent, handleMoveEvent, toggleFolder, handleRenameEvent, resetEvents, setEvents] = useEvents();
  const [attendance, handleAttendanceChange, resetAttendance, setAttendance] = useAttendance();
  const [sorting, handleSort, getStatusPriority] = useSort();
  const calculateScores = useCalculateScores(events, attendance, settings);
  const [groups, setGroups] = useState(() => {
    const stored = localStorage.getItem('groups');
    if (stored) return JSON.parse(stored);
    
    const initialGroups = [
      { id: 'dev', name: 'Developers', color: '#FF6B6B', memberIds: ['p1', 'p2', 'p9', 'p14', 'p17'] },
      { id: 'design', name: 'Designers', color: '#4ECDC4', memberIds: ['p4', 'p10', 'p12', 'p18'] },
      { id: 'qa', name: 'QA Team', color: '#45B7D1', memberIds: ['p7', 'p13', 'p16', 'p19'] },
      { id: 'leads', name: 'Team Leads', color: '#96CEB4', memberIds: ['p1', 'p6'] }
    ];
    localStorage.setItem('groups', JSON.stringify(initialGroups));
    return initialGroups;
  });

  const { loadTableData } = useCloudSync(
    localStorage.getItem('tableCode'),
    settings.cloudSync,
    {
      people,
      events,
      attendance,
      groups,
      settings,
      setPeople: setPeople || (() => {}),
      setEvents: setEvents || (() => {}),
      setAttendance: setAttendance || (() => {}),
      setGroups: setGroups || (() => {}),
      setSettings: setSettings || (() => {})
    }
  );

  useEffect(() => {
    localStorage.setItem('groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (settings.cloudSync && localStorage.getItem('tableCode')) {
      syncTable(localStorage.getItem('tableCode'), {
        people,
        events,
        attendance,
        groups,
        settings,
        lastUpdated: new Date().toISOString()
      });
    }
  }, [settings.cloudSync]);

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

      {!settings.hideTitle && <h1>Attendance Tracker</h1>}

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
        onMoveEvent={handleMoveEvent}
        onRemoveEvent={handleRemoveEvent}
        onRenameEvent={handleRenameEvent}
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
          onResetData={() => {
            if (window.confirm('Are you sure? This will clear ALL local data.')) {
              resetPeople();
              resetEvents();
              resetAttendance();
              setGroups([]);
              updatePeopleGroups([]);
              if (settings.cloudSync) {
                syncTable(localStorage.getItem('tableCode'), {
                  people: [],
                  events: [],
                  attendance: {},
                  groups: [],
                  settings: {
                    ...settings,
                    cloudSync: true
                  }
                });
              }
            }
          }}
          loadTableData={loadTableData}
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