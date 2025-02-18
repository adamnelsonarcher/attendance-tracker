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
  setSettings 
}) {
  const lastSyncedData = useRef(null);
  const syncTimeoutRef = useRef(null);

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

    // Check if data has changed
    const hasChanged = JSON.stringify(currentData) !== JSON.stringify(lastSyncedData.current);

    if (hasChanged) {
      // Clear existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      // Set new timeout
      syncTimeoutRef.current = setTimeout(() => {
        syncTable(tableCode, currentData);
        lastSyncedData.current = currentData;
      }, 30000); // 30 seconds delay
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

  return { loadTableData };
} 