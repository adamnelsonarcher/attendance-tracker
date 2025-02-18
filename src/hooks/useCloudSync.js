import { useEffect, useRef } from 'react';
import { syncTable, getTableData, subscribeToTable } from '../services/firebase';

export function useCloudSync(tableCode, cloudSync, { 
  people, 
  events, 
  attendance, 
  groups, 
  settings,
  setPeople,
  setEvents,
  setAttendance,
  setGroups,
  setSettings,
  onSyncStatusChange 
}) {
  const lastSyncedData = useRef(null);
  const syncTimeoutRef = useRef(null);
  const initialLoadDone = useRef(false);

  // Initial load of data
  useEffect(() => {
    if (!cloudSync || !tableCode || initialLoadDone.current) return;

    const loadInitialData = async () => {
      const data = await getTableData(tableCode);
      if (data) {
        console.log('Initial load of data:', data);
        
        // Force localStorage updates by using the state setters
        if (data.events) {
          localStorage.setItem('events', JSON.stringify(data.events));
          setEvents(data.events);
        }
        
        if (data.people) {
          localStorage.setItem('people', JSON.stringify(data.people));
          setPeople(data.people);
        }
        
        if (data.attendance) {
          localStorage.setItem('attendance', JSON.stringify(data.attendance));
          setAttendance(data.attendance);
        }
        
        if (data.groups) {
          localStorage.setItem('groups', JSON.stringify(data.groups));
          setGroups(data.groups);
        }
        
        if (data.settings) {
          const newSettings = {
            ...settings,
            ...data.settings,
            cloudSync: true
          };
          localStorage.setItem('settings', JSON.stringify(newSettings));
          setSettings(newSettings);
        }
        
        lastSyncedData.current = {
          people: data.people || [],
          events: data.events || [],
          attendance: data.attendance || {},
          groups: data.groups || [],
          settings: {
            ...settings,
            ...data.settings,
            cloudSync: true
          },
          lastUpdated: new Date().toISOString()
        };
        onSyncStatusChange('saved');
      }
      initialLoadDone.current = true;
    };

    loadInitialData();
  }, [cloudSync, tableCode, setEvents, setPeople, setAttendance, setGroups, setSettings, settings]);

  // Only sync TO cloud, don't subscribe to changes
  useEffect(() => {
    if (!cloudSync || !tableCode) return;

    const currentData = {
      people,
      events,
      attendance,
      groups,
      settings,
      lastUpdated: new Date().toISOString()
    };

    const hasChanged = JSON.stringify(currentData) !== JSON.stringify(lastSyncedData.current);

    if (hasChanged) {
      onSyncStatusChange('unsaved');
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        onSyncStatusChange('saving');
        await syncTable(tableCode, currentData);
        lastSyncedData.current = currentData;
        onSyncStatusChange('saved');
      }, 30000);
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [cloudSync, tableCode, people, events, attendance, groups, settings]);

  const loadTableData = async (code) => {
    const data = await getTableData(code);
    if (!data) return false;

    // Force localStorage updates before setting state
    if (data.events) localStorage.setItem('events', JSON.stringify(data.events));
    if (data.people) localStorage.setItem('people', JSON.stringify(data.people));
    if (data.attendance) localStorage.setItem('attendance', JSON.stringify(data.attendance));
    if (data.groups) localStorage.setItem('groups', JSON.stringify(data.groups));
    if (data.settings) localStorage.setItem('settings', JSON.stringify({
      ...settings,
      ...data.settings,
      cloudSync: true
    }));

    setPeople(data.people || []);
    setEvents(data.events || []);
    setAttendance(data.attendance || {});
    setGroups(data.groups || []);
    setSettings({
      ...settings,
      ...data.settings,
      cloudSync: true
    });

    lastSyncedData.current = {
      people: data.people || [],
      events: data.events || [],
      attendance: data.attendance || {},
      groups: data.groups || [],
      settings: {
        ...settings,
        ...data.settings,
        cloudSync: true
      },
      lastUpdated: new Date().toISOString()
    };
    return true;
  };

  return { loadTableData, syncTimeoutRef };
} 