import { useState } from 'react';

const showcasePeople = [
  { id: 'p1', name: 'John Smith', groups: [
    { id: 'dev', color: '#FF6B6B' },
    { id: 'leads', color: '#96CEB4' }
  ]},
  { id: 'p2', name: 'Emma Johnson', groups: [
    { id: 'dev', color: '#FF6B6B' }
  ]},
  { id: 'p3', name: 'Michael Brown', groups: ['dev'] },
  { id: 'p4', name: 'Sarah Davis', groups: ['design', 'leads'] },
  { id: 'p5', name: 'James Wilson', groups: ['design'] },
  { id: 'p6', name: 'Emily Taylor', groups: ['qa', 'leads'] },
  { id: 'p7', name: 'William Anderson', groups: ['qa'] },
  { id: 'p8', name: 'Olivia Martinez', groups: ['qa'] },
  { id: 'p9', name: 'Daniel Thompson', groups: ['dev'] },
  { id: 'p10', name: 'Sophia Garcia', groups: ['design'] },
  { id: 'p11', name: 'David Rodriguez', groups: ['dev'] },
  { id: 'p12', name: 'Isabella Lee', groups: ['design'] },
  { id: 'p13', name: 'Joseph White', groups: ['qa'] },
  { id: 'p14', name: 'Mia Harris', groups: ['dev'] },
  { id: 'p15', name: 'Alexander Clark', groups: ['design'] },
  { id: 'p16', name: 'Ava Lewis', groups: ['qa'] },
  { id: 'p17', name: 'Benjamin Walker', groups: ['dev'] },
  { id: 'p18', name: 'Charlotte Hall', groups: ['design'] },
  { id: 'p19', name: 'Henry Young', groups: ['qa'] },
  { id: 'p20', name: 'Amelia King', groups: ['dev'] }
];

const emptyPeople = [];

export function usePeople(initialPeople = showcasePeople) {
  const [people, setPeople] = useState(initialPeople);

  const handleAddPerson = (newPeople) => {
    setPeople(prev => [...prev, ...newPeople.map(p => ({ ...p, groups: [] }))]);
  };

  const updatePeopleGroups = (newGroups) => {
    setPeople(prev => prev.map(person => ({
      ...person,
      groups: newGroups
        .filter(group => group.memberIds?.includes(person.id))
        .map(group => ({ id: group.id, color: group.color }))
    })));
  };

  const resetPeople = () => {
    setPeople(emptyPeople);
  };

  return [people, handleAddPerson, updatePeopleGroups, resetPeople];
}

export { showcasePeople }; 