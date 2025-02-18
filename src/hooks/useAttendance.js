import { useState, useEffect } from 'react';

const showcaseAttendance = {
  // Team Meeting attendance
  'p1-e1': 'Present', 'p2-e1': 'Present', 'p3-e1': 'Late', 'p4-e1': 'Absent',
  'p5-e1': 'Present', 'p6-e1': 'Present', 'p7-e1': 'DNA', 'p8-e1': 'Present',
  
  // Code Review attendance (mostly devs)
  'p1-e2': 'Present', 'p2-e2': 'Present', 'p3-e2': 'Present', 
  'p9-e2': 'Late', 'p11-e2': 'Present', 'p14-e2': 'Absent',
  'p17-e2': 'Present', 'p20-e2': 'Present',
  
  // Sprint Planning
  'p1-e3': 'Present', 'p4-e3': 'Present', 'p6-e3': 'Present',
  'p2-e3': 'Late', 'p3-e3': 'Absent', 'p5-e3': 'Present',
  
  // Training Day (everyone)
  'p1-e8': 'Present', 'p2-e8': 'Present', 'p3-e8': 'Present', 'p4-e8': 'Present',
  'p5-e8': 'Late', 'p6-e8': 'Present', 'p7-e8': 'Absent', 'p8-e8': 'Present',
  'p9-e8': 'Present', 'p10-e8': 'Late', 'p11-e8': 'Present', 'p12-e8': 'Present',
  'p13-e8': 'Absent', 'p14-e8': 'Present', 'p15-e8': 'Present', 'p16-e8': 'Present',
  'p17-e8': 'Late', 'p18-e8': 'Present', 'p19-e8': 'Present', 'p20-e8': 'Present'
};

export function useAttendance(initialAttendance = showcaseAttendance) {
  const [attendance, setAttendance] = useState(() => {
    const stored = localStorage.getItem('attendance');
    if (stored) return JSON.parse(stored);
    
    localStorage.setItem('attendance', JSON.stringify(initialAttendance));
    return initialAttendance;
  });

  useEffect(() => {
    localStorage.setItem('attendance', JSON.stringify(attendance));
  }, [attendance]);

  const handleAttendanceChange = (personId, eventId, status) => {
    setAttendance(prev => {
      const newAttendance = {
        ...prev,
        [`${personId}-${eventId}`]: status,
      };
      localStorage.setItem('attendance', JSON.stringify(newAttendance));
      return newAttendance;
    });
  };

  const resetAttendance = () => {
    localStorage.removeItem('attendance');
    setAttendance({});
  };

  return [attendance, handleAttendanceChange, resetAttendance, setAttendance];
} 