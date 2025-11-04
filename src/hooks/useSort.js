import { useMemo, useState } from 'react';

export function useSort(settings) {
  const [sorting, setSorting] = useState({
    type: 'none',
    direction: 'asc',
    eventId: null,
    scoreType: null
  });

  // Build a priority map based on current customStatuses order
  const statusPriorityMap = useMemo(() => {
    const map = new Map();
    const list = settings?.customStatuses || [];
    list.forEach((s, idx) => map.set(s.id, idx));
    return map;
  }, [settings?.customStatuses]);

  const getStatusPriority = (status) => {
    if (!status) return Number.MAX_SAFE_INTEGER;
    if (statusPriorityMap.has(status)) return statusPriorityMap.get(status);
    return Number.MAX_SAFE_INTEGER;
  };

  const handleSort = (type, direction = null, eventId = null, scoreType = null) => {
    if (type === 'event') {
      setSorting(prev => {
        if (prev.type === 'event' && prev.eventId === eventId) {
          // If already sorting by this event, turn off sorting
          return { type: 'none', direction: 'asc', eventId: null, scoreType: null };
        }
        return {
          type: 'event',
          direction: 'asc',
          eventId,
          scoreType: null
        };
      });
      return;
    }

    if (type === 'score') {
      setSorting(prev => {
        if (prev.type === 'score' && prev.scoreType === scoreType) {
          if (prev.direction === 'asc') {
            return { type: 'score', direction: 'desc', eventId: null, scoreType };
          }
          return { type: 'none', direction: 'asc', eventId: null, scoreType: null };
        }
        return {
          type: 'score',
          direction: 'asc',
          eventId: null,
          scoreType
        };
      });
      return;
    }

    if (type === 'group') {
      setSorting({
        type: 'group',
        direction: 'asc',
        eventId: null
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