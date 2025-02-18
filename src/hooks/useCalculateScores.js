import { useCallback } from 'react';

export function useCalculateScores(events, attendance, settings) {
  const calculateScores = useCallback((personId) => {
    let totalEvents = 0;
    let attendedEvents = 0;
    let weightedNumerator = 0;
    let weightedDenominator = 0;

    // Get all events from all folders and non-folders, respecting folder visibility
    const flatEvents = events.flatMap(group => {
      // If it's not a folder or if it's a folder with events, include its events
      if (!group.isFolder || group.events?.length > 0) {
        return group.events;
      }
      return []; // Skip empty folders
    });

    flatEvents.forEach(event => {
      if (!event) return; // Skip null/undefined events
      
      const status = attendance[`${personId}-${event.id}`];
      
      if (status === 'DNA' || (settings.onlyCountAbsent && !['Present', 'Absent', 'Late'].includes(status))) {
        return;
      }

      totalEvents++;
      weightedDenominator += event.weight;
      
      if (status === 'Present') {
        attendedEvents++;
        weightedNumerator += event.weight;
      } else if (status === 'Late') {
        attendedEvents += settings.lateCredit;
        weightedNumerator += event.weight * settings.lateCredit;
      }
    });

    const rawScore = totalEvents > 0 ? (attendedEvents / totalEvents) * 100 : 0;
    const weightedScore = weightedDenominator > 0 ? 
      (weightedNumerator / weightedDenominator) * 100 : 0;

    return {
      raw: rawScore.toFixed(0),
      weighted: weightedScore.toFixed(0)
    };
  }, [events, attendance, settings]);

  return calculateScores;
} 