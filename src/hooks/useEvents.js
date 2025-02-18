import { useState, useEffect } from 'react';

const showcaseEvents = [
  {
    id: 'weekly',
    name: 'Weekly Events',
    isFolder: true,
    isOpen: true,
    events: [
      { id: 'e1', name: 'Team Meeting', weight: 1, startDate: '2024-01-01' },
      { id: 'e2', name: 'Code Review', weight: 1, startDate: '2024-01-08' },
      { id: 'e3', name: 'Sprint Planning', weight: 2, startDate: '2024-01-15' },
      { id: 'e4', name: 'Retrospective', weight: 1, startDate: '2024-01-22' },
      { id: 'e5', name: 'Tech Talk', weight: 1, startDate: '2024-01-29' }
    ]
  },
  {
    id: 'monthly',
    name: 'Monthly Events',
    isFolder: true,
    isOpen: true,
    events: [
      { id: 'e6', name: 'All Hands', weight: 2, startDate: '2024-01-05' },
      { id: 'e7', name: 'Department Sync', weight: 1, startDate: '2024-02-05' },
      { id: 'e8', name: 'Training Day', weight: 3, startDate: '2024-03-05' },
      { id: 'e9', name: 'Strategy Meeting', weight: 2, startDate: '2024-04-05' },
      { id: 'e10', name: 'Quarterly Review', weight: 3, startDate: '2024-05-05' }
    ]
  },
  {
    id: 'special',
    name: 'Special Events',
    isFolder: true,
    isOpen: true,
    events: [
      { id: 'e11', name: 'Conference', weight: 3, startDate: '2024-02-15' },
      { id: 'e12', name: 'Hackathon', weight: 2, startDate: '2024-03-20' },
      { id: 'e13', name: 'Team Building', weight: 1, startDate: '2024-04-10' },
      { id: 'e14', name: 'Workshop', weight: 2, startDate: '2024-05-15' },
      { id: 'e15', name: 'Year End Party', weight: 1, startDate: '2024-12-20' }
    ]
  }
];

const emptyEvents = [];

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
      return new Date(a.startDate) - new Date(b.startDate);
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

  const resetEvents = () => {
    localStorage.removeItem('events');
    setEvents([]);
  };

  return [events, handleAddEvent, handleRemoveEvent, handleMoveEvent, toggleFolder, handleRenameEvent, resetEvents];
}

export { showcaseEvents }; 