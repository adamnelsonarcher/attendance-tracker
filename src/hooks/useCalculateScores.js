import { useCallback } from 'react';

export function useCalculateScores(events, attendance, settings) {
  const calculateScores = useCallback((personId) => {
    let totalEvents = 0;
    let attendedEvents = 0;
    let weightedNumerator = 0;
    let weightedDenominator = 0;

    const flatEvents = events.flatMap(item => item.isFolder ? item.events : [item]);

    flatEvents.forEach(event => {
      const status = attendance[`${personId}-${event.id}`];
      const statusConfig = settings.customStatuses.find(s => s.id === status);
      
      if (!statusConfig || statusConfig.credit === null || (settings.onlyCountAbsent && !statusConfig)) {
        return;
      }

      totalEvents++;
      weightedDenominator += Number(event.weight);
      
      if (statusConfig) {
        attendedEvents += Number(statusConfig.credit);
        weightedNumerator += Number(event.weight) * Number(statusConfig.credit);
      }
    });

    const rawScore = totalEvents > 0 ? (attendedEvents / totalEvents) * 100 : 0;
    const weightedScore = weightedDenominator > 0 ? 
      (weightedNumerator / weightedDenominator) * 100 : 0;

    console.groupEnd();

    return {
      raw: Math.round(rawScore),
      weighted: Math.round(weightedScore)
    };
  }, [events, attendance, settings]);

  return calculateScores;
} 