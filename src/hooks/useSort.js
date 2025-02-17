import { useState } from 'react';

export function useSort() {
  const [sorting, setSorting] = useState({
    type: 'none',
    direction: 'asc',
    eventId: null
  });

  const getStatusPriority = (status) => {
    switch(status) {
      case 'Present': return 0;
      case 'Absent': return 1;
      case 'Late': return 2;
      case 'DNA': return 3;
      default: return 4; // For "select" (empty) status
    }
  };

  const handleSort = (type, direction = null, eventId = null) => {
    if (type === 'event') {
      setSorting(prev => {
        if (prev.type === 'event' && prev.eventId === eventId) {
          // If already sorting by this event, turn off sorting
          return { type: 'none', direction: 'asc', eventId: null };
        }
        return {
          type: 'event',
          direction: 'asc',
          eventId
        };
      });
      return;
    }

    if (direction === null) {
      // Reset to original order
      setSorting({
        type: 'none',
        direction: 'asc',
        eventId: null
      });
      return;
    }

    setSorting({
      type,
      direction,
      eventId: null
    });
  };

  return [sorting, handleSort, getStatusPriority];
} 