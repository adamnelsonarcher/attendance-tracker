import { useState, useEffect } from 'react';

const showcaseEvents = [
  {
    id: 'f1',
    name: 'Sprint 1',
    isFolder: true,
    isOpen: true,
    events: [
      { id: 'e1', name: 'Planning', weight: 1, startDate: '2024-01-01', endDate: '2024-01-01' },
      { id: 'e2', name: 'Review', weight: 2, startDate: '2024-01-05', endDate: '2024-01-05' }
    ]
  },
  // Non-folder events
  { id: 'e3', name: 'Team Building', weight: 1, startDate: '2024-01-07', endDate: '2024-01-07', isFolder: false },
  { id: 'e4', name: 'Training Session', weight: 2, startDate: '2024-01-10', endDate: '2024-01-10', isFolder: false },
  {
    id: 'f2',
    name: 'Sprint 2',
    isFolder: true,
    isOpen: true,
    events: [
      { id: 'e5', name: 'Planning', weight: 1, startDate: '2024-01-15', endDate: '2024-01-15' },
      { id: 'e6', name: 'Review', weight: 2, startDate: '2024-01-19', endDate: '2024-01-19' }
    ]
  },
  { id: 'e7', name: 'Company Meeting', weight: 3, startDate: '2024-01-22', endDate: '2024-01-22', isFolder: false },
  {
    id: 'f3',
    name: 'Sprint 3',
    isFolder: true,
    isOpen: true,
    events: [
      { id: 'e8', name: 'Planning', weight: 1, startDate: '2024-01-29', endDate: '2024-01-29' },
      { id: 'e9', name: 'Review', weight: 2, startDate: '2024-02-02', endDate: '2024-02-02' }
    ]
  }
];

export function useEvents(initialEvents = showcaseEvents) {
  const [events, setEvents] = useState(() => {
    const stored = localStorage.getItem('events');
    if (stored) return JSON.parse(stored);
    
    localStorage.setItem('events', JSON.stringify(initialEvents));
    return initialEvents;
  });

  useEffect(() => {
    localStorage.setItem('events', JSON.stringify(events));
  }, [events]);

  const sortEventsByDate = (events) => {
    return [...events].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      
      // Create dates at noon UTC to avoid timezone issues
      const dateA = new Date(a.startDate + 'T12:00:00Z');
      const dateB = new Date(b.startDate + 'T12:00:00Z');
      return dateA - dateB;
    });
  };

  const handleAddEvent = ({ folderId = 'no-folder', event, newFolder }) => {
    if (newFolder) {
      newFolder.events = sortEventsByDate(newFolder.events);
      setEvents(prev => [...prev, newFolder]);
      return;
    }
    
    if (folderId === 'no-folder') {
      setEvents(prev => [...prev, { ...event, isFolder: false }]);
    } else {
      setEvents(prev => prev.map(folder => {
        if (folder.id === folderId) {
          return {
            ...folder,
            events: sortEventsByDate([...folder.events, event])
          };
        }
        return folder;
      }));
    }
  };

  const handleRemoveEvent = (folderId, eventId) => {
    setEvents(prev => {
      if (folderId) {
        // Remove event from within a folder and filter out empty folders
        return prev
          .map(folder => {
            if (folder.id === folderId) {
              return {
                ...folder,
                events: folder.events.filter(event => event.id !== eventId)
              };
            }
            return folder;
          })
          .filter(folder => !folder.isFolder || folder.events.length > 0); // Remove empty folders
      } else {
        // Remove standalone event
        return prev.filter(event => event.isFolder || event.id !== eventId);
      }
    });
  };

  const handleMoveEvent = (eventId, fromFolderId, toFolderId) => {
    setEvents(prev => {
      let eventToMove;
      
      if (fromFolderId) {
        // Event is in a folder
        const fromFolder = prev.find(f => f.id === fromFolderId);
        eventToMove = fromFolder?.events.find(e => e.id === eventId);
      } else {
        // Event is not in a folder
        eventToMove = prev.find(e => !e.isFolder && e.id === eventId);
      }
      
      if (!eventToMove) return prev;

      // Remove the event from its current location
      const filteredEvents = fromFolderId 
        ? prev.map(folder => {
            if (folder.id === fromFolderId) {
              return {
                ...folder,
                events: folder.events.filter(e => e.id !== eventId)
              };
            }
            return folder;
          })
        : prev.filter(e => e.isFolder || e.id !== eventId);

      // Add to new location
      if (toFolderId === 'no-folder') {
        return [...filteredEvents, { ...eventToMove, isFolder: false }];
      } else {
        return filteredEvents.map(folder => {
          if (folder.id === toFolderId) {
            return {
              ...folder,
              events: sortEventsByDate([...folder.events, eventToMove])
            };
          }
          return folder;
        });
      }
    });
  };

  const toggleFolder = (folderId) => {
    setEvents(prev => prev.map(folder => 
      folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
    ));
  };

  const handleRenameEvent = (folderId, eventId, newName) => {
    setEvents(prev => prev.map(item => {
      if (folderId) {
        // Event is in a folder
        if (item.id === folderId) {
          return {
            ...item,
            events: item.events.map(event => 
              event.id === eventId ? { ...event, name: newName } : event
            )
          };
        }
        return item;
      } else {
        // Event is not in a folder
        return item.id === eventId ? { ...item, name: newName } : item;
      }
    }));
  };

  const handleEditEventDates = (folderId, eventId, startDate, endDate) => {
    setEvents(events.map(event => {
      if (event.isFolder) {
        if (event.id === folderId) {
          return {
            ...event,
            events: event.events.map(e => 
              e.id === eventId 
                ? { ...e, startDate, endDate }
                : e
            )
          };
        }
        return event;
      }
      return event.id === eventId ? { ...event, startDate, endDate } : event;
    }));
  };

  const handleEditEventWeight = (folderId, eventId, weight) => {
    setEvents(events.map(event => {
      if (event.isFolder) {
        if (event.id === folderId) {
          return {
            ...event,
            events: event.events.map(e => 
              e.id === eventId 
                ? { ...e, weight }
                : e
            )
          };
        }
        return event;
      }
      return event.id === eventId ? { ...event, weight } : event;
    }));
  };

  const handleRenameFolder = (folderId, newName) => {
    setEvents(prev => prev.map(folder => 
      folder.id === folderId 
        ? { ...folder, name: newName }
        : folder
    ));
  };

  const resetEvents = () => {
    localStorage.removeItem('events');
    setEvents([]);
  };

  return [
    events, 
    handleAddEvent, 
    handleRemoveEvent, 
    handleMoveEvent, 
    toggleFolder, 
    handleRenameEvent,
    handleEditEventDates,
    handleEditEventWeight,
    handleRenameFolder,
    resetEvents,
    setEvents
  ];
}

export { showcaseEvents }; 