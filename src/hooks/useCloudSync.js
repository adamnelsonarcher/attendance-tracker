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
  const isInitialLoad = useRef(true);
  const isFirstRender = useRef(true);

  // Initial load of data
  useEffect(() => {
    console.log('Initial load effect triggered:', {
      cloudSync,
      tableCode,
      initialLoadDone: initialLoadDone.current,
      isFirstRender: isFirstRender.current
    });

    if (!cloudSync || !tableCode || initialLoadDone.current) {
      console.log('Skipping initial load:', {
        reason: !cloudSync ? 'cloudSync disabled' : 
                !tableCode ? 'no tableCode' : 
                'already loaded'
      });
      return;
    }

    // Skip the first render since App.jsx already loaded from localStorage
    if (isFirstRender.current) {
      console.log('First render, setting initial lastSyncedData:', {
        people,
        events,
        attendance,
        groups,
        settings
      });
      isFirstRender.current = false;
      lastSyncedData.current = {
        people,
        events,
        attendance,
        groups,
        settings
      };
      return;
    }

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
          }
        };
        onSyncStatusChange('saved');
      }
      initialLoadDone.current = true;
      // Set a timeout to allow the initial load to complete before enabling change detection
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 1000);
    };

    loadInitialData();
  }, [cloudSync, tableCode]);

  // Only sync TO cloud, don't subscribe to changes
  useEffect(() => {
    console.log('Change detection effect triggered:', {
      cloudSync,
      tableCode,
      isInitialLoad: isInitialLoad.current,
      lastSyncedData: lastSyncedData.current,
      currentData: {
        people,
        events,
        attendance,
        groups,
        settings
      }
    });

    if (!cloudSync || !tableCode || isInitialLoad.current) {
      console.log('Change detection skipped:', {
        reason: !cloudSync ? 'cloudSync disabled' : 
                !tableCode ? 'no tableCode' : 
                'initial load in progress'
      });
      return;
    }

    const currentData = {
      people,
      events,
      attendance,
      groups,
      settings
    };

    // Deep compare objects without timestamps
    const compareData = (a, b) => {
      if (!a || !b) {
        console.log('Compare data received null/undefined:', { a, b });
        return false;
      }
      const stringA = JSON.stringify({
        people: a.people,
        events: a.events,
        attendance: a.attendance,
        groups: a.groups,
        settings: a.settings
      });
      const stringB = JSON.stringify({
        people: b.people,
        events: b.events,
        attendance: b.attendance,
        groups: b.groups,
        settings: b.settings
      });
      console.log('Comparing data:', {
        stringA: stringA.substring(0, 100) + '...',
        stringB: stringB.substring(0, 100) + '...',
        isDifferent: stringA !== stringB
      });
      return stringA !== stringB;
    };

    const hasChanged = compareData(currentData, lastSyncedData.current);

    if (hasChanged) {
      console.log('🔄 Data changed, scheduling sync');
      onSyncStatusChange('unsaved');
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        console.log('⏰ Sync timeout triggered');
        onSyncStatusChange('saving');
        const dataToSync = {
          ...currentData,
          lastUpdated: new Date().toISOString()
        };
        await syncTable(tableCode, dataToSync);
        lastSyncedData.current = dataToSync;
        onSyncStatusChange('saved');
      }, 30000);
    } else {
      console.log('No changes detected in data');
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [cloudSync, tableCode, people, events, attendance, groups, settings]);

  const migrateAttendanceData = (oldAttendance, oldSettings) => {
    const statusMap = {
      'Present': 'Present',
      'Absent': 'Absent',
      'Late': 'Late',
      'DNA': 'DNA'
    };

    const migratedAttendance = {};
    
    Object.entries(oldAttendance).forEach(([key, value]) => {
      migratedAttendance[key] = statusMap[value] || value;
    });

    return migratedAttendance;
  };

  const loadTableData = async (code) => {
    const data = await getTableData(code);
    if (!data) return false;

    // Force localStorage updates before setting state
    if (data.events) localStorage.setItem('events', JSON.stringify(data.events));
    if (data.people) localStorage.setItem('people', JSON.stringify(data.people));
    if (data.attendance) localStorage.setItem('attendance', JSON.stringify(data.attendance));
    if (data.groups) localStorage.setItem('groups', JSON.stringify(data.groups));
    if (data.settings) localStorage.setItem('settings', JSON.stringify(data.settings));

    setPeople(data.people || []);
    setEvents(data.events || []);
    setAttendance(migrateAttendanceData(data.attendance || {}, data.settings));
    setGroups(data.groups || []);
    setSettings(data.settings || {});

    lastSyncedData.current = {
      people: data.people || [],
      events: data.events || [],
      attendance: data.attendance || {},
      groups: data.groups || [],
      settings: data.settings || {},
      lastUpdated: new Date().toISOString()
    };
    return true;
  };

  return { loadTableData, syncTimeoutRef };
} 