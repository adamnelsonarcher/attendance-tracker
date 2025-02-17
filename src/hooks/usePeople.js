import { useState } from 'react';

export function usePeople() {
  const [people, setPeople] = useState([
    { id: 'p1', name: 'John Doe' },
    { id: 'p2', name: 'Jane Smith' },
    { id: 'p3', name: 'Bob Johnson' },
    { id: 'p4', name: 'Alice Williams' },
    { id: 'p5', name: 'Charlie Brown' },
    { id: 'p6', name: 'Diana Ross' },
    { id: 'p7', name: 'Edward Norton' },
    { id: 'p8', name: 'Fiona Apple' },
    { id: 'p9', name: 'George Lucas' },
    { id: 'p10', name: 'Helen Hunt' },
    { id: 'p11', name: 'Ian McKellen' },
    { id: 'p12', name: 'Julia Roberts' },
    { id: 'p13', name: 'Kevin Bacon' },
    { id: 'p14', name: 'Laura Palmer' },
    { id: 'p15', name: 'Michael Scott' },
    { id: 'p16', name: 'Nancy Wheeler' },
    { id: 'p17', name: 'Oscar Martinez' },
    { id: 'p18', name: 'Pam Beesly' }
  ]);

  const handleAddPerson = (newPeople) => {
    const peopleToAdd = Array.isArray(newPeople) ? newPeople : [newPeople];
    setPeople([...people, ...peopleToAdd]);
  };

  return [people, handleAddPerson];
} 