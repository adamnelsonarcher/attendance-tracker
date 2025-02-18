import { useState } from 'react';

export function usePeople() {
  const [people, setPeople] = useState([
    { id: 'p1', name: 'John Smith', groups: [] },
    { id: 'p2', name: 'Jane Doe', groups: [] },
    { id: 'p3', name: 'Bob Johnson', groups: [] },
    { id: 'p4', name: 'Alice Brown', groups: [] },
    { id: 'p5', name: 'Charlie Davis', groups: [] },
    { id: 'p6', name: 'Eva Wilson', groups: [] },
    { id: 'p7', name: 'Frank Miller', groups: [] },
    { id: 'p8', name: 'Grace Taylor', groups: [] },
    { id: 'p9', name: 'Henry Anderson', groups: [] },
    { id: 'p10', name: 'Ivy Martinez', groups: [] },
    { id: 'p11', name: 'Jack Thompson', groups: [] },
    { id: 'p12', name: 'Kelly White', groups: [] },
    { id: 'p13', name: 'Leo Garcia', groups: [] },
    { id: 'p14', name: 'Mary Rodriguez', groups: [] },
    { id: 'p15', name: 'Nathan Lee', groups: [] },
    { id: 'p16', name: 'Olivia King', groups: [] },
    { id: 'p17', name: 'Peter Wright', groups: [] },
  ]);

  const handleAddPerson = (newPeople) => {
    setPeople(prev => [...prev, ...newPeople.map(p => ({ ...p, groups: [] }))]);
  };

  const updatePeopleGroups = (groups) => {
    setPeople(prev => prev.map(person => {
      // Find all groups this person belongs to
      const personGroups = groups
        .filter(group => group.memberIds.includes(person.id))
        .map(group => ({
          id: group.id,
          color: group.color,
          name: group.name // Adding name for sorting purposes
        }));

      return {
        ...person,
        groups: personGroups
      };
    }));
  };

  return [people, handleAddPerson, updatePeopleGroups];
} 