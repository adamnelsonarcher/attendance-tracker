import { useState } from 'react';

export function useEvents() {
  const [events, setEvents] = useState([
    { id: 'e1', name: 'Meeting 1', weight: 1, folder: 'weekly' },
    { id: 'e2', name: 'Meeting 2', weight: 2, folder: 'weekly' },
    { id: 'e3', name: 'Workshop', weight: 3, folder: 'weekly' },
    { id: 'e4', name: 'Conference', weight: 4, folder: 'special' },
    { id: 'e5', name: 'Training', weight: 2, folder: 'special' },
    { id: 'e6', name: 'Team Building', weight: 1, folder: null },
    { id: 'e7', name: 'Project Review', weight: 2, folder: null },
    { id: 'e8', name: 'Code Review', weight: 2, folder: 'weekly' },
    { id: 'e9', name: 'Team Sync', weight: 1, folder: 'weekly' },
    { id: 'e10', name: 'Hackathon', weight: 3, folder: 'special' },
    { id: 'e11', name: 'Workshop', weight: 2, folder: 'special' }
  ]);

  const [folders, setFolders] = useState([
    { id: 'weekly', name: 'Weekly Events', isOpen: true },
    { id: 'special', name: 'Special Events', isOpen: true }
  ]);

  const handleAddEvent = ({ folderId = null, event, newFolder }) => {
    if (newFolder) {
      setFolders(prev => [...prev, { 
        id: newFolder.id, 
        name: newFolder.name, 
        isOpen: true 
      }]);
      setEvents(prev => [...prev, { ...event, folder: newFolder.id }]);
      return;
    }
    
    setEvents(prev => [...prev, { ...event, folder: folderId }]);
  };

  const toggleFolder = (folderId) => {
    setFolders(prev => prev.map(folder => 
      folder.id === folderId
        ? { ...folder, isOpen: !folder.isOpen }
        : folder
    ));
  };

  return [events, folders, handleAddEvent, toggleFolder, setFolders];
}