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
        setPeople(data.people);
        setEvents(data.events);
        setAttendance(data.attendance);
        setGroups(data.groups);
        setSettings(data.settings);
        
        // Add 3 second delay before setting lastSyncedData
        setTimeout(() => {
          lastSyncedData.current = {
            ...data,
            lastUpdated: new Date().toISOString()
          };
          onSyncStatusChange('saved');
        }, 200);
      }
      initialLoadDone.current = true;
    };

    loadInitialData();
  }, [cloudSync, tableCode]);

  // Subscribe to remote changes
  useEffect(() => {
    if (!cloudSync || !tableCode) return;

    const unsubscribe = subscribeToTable(tableCode, (data) => {
      if (!data) return;
      
      setPeople(data.people);
      setEvents(data.events);
      setAttendance(data.attendance);
      setGroups(data.groups);
      setSettings(data.settings);
    });

    return () => unsubscribe();
  }, [cloudSync, tableCode]);

  // Debounced sync to cloud
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

    setPeople(data.people);
    setEvents(data.events);
    setAttendance(data.attendance);
    setGroups(data.groups);
    setSettings(data.settings);
    lastSyncedData.current = data;
    return true;
  };

  return { loadTableData, syncTimeoutRef };
} 