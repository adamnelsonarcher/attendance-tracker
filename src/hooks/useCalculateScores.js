import { useCallback } from 'react';

export function useCalculateScores(events, attendance, settings) {
  const calculateScores = useCallback((personId) => {
    let totalEvents = 0;
    let attendedEvents = 0;
    let weightedNumerator = 0;
    let weightedDenominator = 0;

    const flatEvents = events.flatMap(item => item.isFolder ? item.events : [item]);

    console.group(`Score Calculation for Person ${personId}`);
    
    flatEvents.forEach(event => {
      const status = attendance[`${personId}-${event.id}`];
      
      if (status === 'DNA' || (settings.onlyCountAbsent && !['Present', 'Absent', 'Late'].includes(status))) {
        return;
      }

      totalEvents++;
      weightedDenominator += Number(event.weight);
      
      if (status === 'Present') {
        attendedEvents += 1;
        weightedNumerator += Number(event.weight);
      } else if (status === 'Late') {
        attendedEvents += Number(settings.lateCredit);
        weightedNumerator += Number(event.weight) * Number(settings.lateCredit);
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