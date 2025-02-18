import { useState } from 'react';

export function useEvents() {
  const [events, setEvents] = useState([
    {
      id: 'weekly',
      name: 'Weekly Events',
      isFolder: true,
      isOpen: true,
      events: [
        { id: 'e1', name: 'Meeting 1', weight: 1 },
        { id: 'e2', name: 'Meeting 2', weight: 2 },
        { id: 'e3', name: 'Workshop', weight: 3 },
        { id: 'e8', name: 'Code Review', weight: 2 },
        { id: 'e9', name: 'Team Sync', weight: 1 }
      ]
    },
    {
      id: 'special',
      name: 'Special Events',
      isFolder: true,
      isOpen: true,
      events: [
        { id: 'e4', name: 'Conference', weight: 4 },
        { id: 'e5', name: 'Training', weight: 2 },
        { id: 'e10', name: 'Hackathon', weight: 3 },
        { id: 'e11', name: 'Workshop', weight: 2 }
      ]
    },
    {
      id: 'no-folder',
      events: [
        { id: 'e6', name: 'Team Building', weight: 1 },
        { id: 'e7', name: 'Project Review', weight: 2 }
      ]
    }
  ]);

  const sortEventsByDate = (events) => {
    return [...events].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate) - new Date(b.startDate);
    });
  };

  const handleAddEvent = ({ folderId = 'no-folder', event, newFolder }) => {
    if (newFolder) {
      newFolder.events = sortEventsByDate(newFolder.events);
      setEvents(prev => [...prev, newFolder]);
      return;
    }
    
    setEvents(prev => prev.map(folder => {
      if (folder.id === folderId) {
        const newEvents = sortEventsByDate([...folder.events, event]);
        return {
          ...folder,
          events: newEvents
        };
      }
      return folder;
    }));
  };

  const handleRemoveEvent = (folderId, eventId) => {
    setEvents(prev => prev.map(folder => {
      if (folder.id === folderId) {
        return {
          ...folder,
          events: folder.events.filter(event => event.id !== eventId)
        };
      }
      return folder;
    }));
  };

  const handleMoveEvent = (eventId, fromFolderId, toFolderId) => {
    setEvents(prev => {
      // Find the event to move
      const fromFolder = prev.find(f => f.id === fromFolderId);
      const eventToMove = fromFolder?.events.find(e => e.id === eventId);
      
      if (!eventToMove) return prev;

      return prev.map(folder => {
        if (folder.id === fromFolderId) {
          // Remove from old folder
          return {
            ...folder,
            events: folder.events.filter(e => e.id !== eventId)
          };
        }
        if (folder.id === toFolderId) {
          // Add to new folder
          return {
            ...folder,
            events: [...folder.events, eventToMove]
          };
        }
        return folder;
      });
    });
  };

  const toggleFolder = (folderId) => {
    setEvents(prev => prev.map(folder => 
      folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
    ));
  };

  const handleRenameEvent = (folderId, eventId, newName) => {
    setEvents(prev => prev.map(folder => {
      if (folder.id === folderId) {
        return {
          ...folder,
          events: folder.events.map(event => 
            event.id === eventId ? { ...event, name: newName } : event
          )
        };
      }
      return folder;
    }));
  };

  return [events, handleAddEvent, handleRemoveEvent, handleMoveEvent, toggleFolder, handleRenameEvent];
} 