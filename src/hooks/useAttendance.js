import { useState } from 'react';

export function useAttendance(initialAttendance = {}) {
  const [attendance, setAttendance] = useState({
    'p1-e1': 'Present',
    'p1-e2': 'Late',
    'p1-e3': 'Absent',
    'p1-e4': 'Present',
    'p1-e5': 'Present',
    'p1-e6': 'DNA',
    'p1-e7': 'Present',
    
    'p2-e1': 'Late',
    'p2-e2': 'Present',
    'p2-e3': 'Present',
    'p2-e4': 'Absent',
    'p2-e5': 'Present',
    
    'p3-e1': 'Present',
    'p3-e2': 'Present',
    'p3-e3': 'Late',
    'p3-e4': 'Present',
    
    'p4-e1': 'Absent',
    'p4-e2': 'Present',
    'p4-e3': 'Present',
    
    'p5-e1': 'Present',
    'p5-e2': 'DNA',
    
    'p6-e1': 'Late',
    'p6-e2': 'Late',
    
    'p7-e1': 'Present',
    
    // p8 has no attendance records yet
    'p9-e1': 'Present',
    'p9-e2': 'Late',
    'p9-e8': 'Present',
    
    'p10-e1': 'Present',
    'p10-e2': 'Present',
    'p10-e10': 'Late',
    
    'p11-e3': 'Absent',
    'p11-e8': 'Present',
    'p11-e9': 'Present',
    
    'p12-e4': 'Present',
    'p12-e10': 'Present',
    'p12-e11': 'Late',
    
    'p13-e5': 'DNA',
    'p13-e6': 'Present',
    
    'p14-e7': 'Late',
    'p14-e8': 'Present',
    
    'p15-e9': 'Absent',
    'p15-e10': 'Present',
    
    'p16-e1': 'Present',
    'p16-e11': 'Present',
    
    'p17-e2': 'Late',
    'p17-e3': 'Present',
  });

  const handleAttendanceChange = (personId, eventId, status) => {
    setAttendance(prev => ({
      ...prev,
      [`${personId}-${eventId}`]: status,
    }));
  };

  return [attendance, handleAttendanceChange];
} 