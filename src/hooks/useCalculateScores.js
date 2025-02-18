import { useCallback } from 'react';

export function useCalculateScores(events, attendance, settings) {
  const calculateScores = useCallback((personId) => {
    let totalEvents = 0;
    let attendedEvents = 0;
    let weightedNumerator = 0;
    let weightedDenominator = 0;

    events.forEach(event => {
      if (!event) return;
      
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