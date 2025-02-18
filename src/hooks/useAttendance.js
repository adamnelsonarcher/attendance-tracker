import { useState } from 'react';

const defaultAttendance = {};

export function useAttendance(initialAttendance = defaultAttendance) {
  const [attendance, setAttendance] = useState(initialAttendance);

  const handleAttendanceChange = (personId, eventId, status) => {
    setAttendance(prev => ({
      ...prev,
      [`${personId}-${eventId}`]: status,
    }));
  };

  const resetAttendance = () => {
    setAttendance(defaultAttendance);
  };

  return [attendance, handleAttendanceChange, resetAttendance];
} 