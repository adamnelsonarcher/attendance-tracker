import { useState } from 'react';

const defaultPeople = [];

export function usePeople(initialPeople = defaultPeople) {
  const [people, setPeople] = useState(initialPeople);

  const handleAddPerson = (newPeople) => {
    setPeople(prev => [...prev, ...newPeople.map(p => ({ ...p, groups: [] }))]);
  };

  const updatePeopleGroups = (groups) => {
    setPeople(prev => prev.map(person => ({
      ...person,
      groups: groups
        .filter(group => group.memberIds.includes(person.id))
        .map(group => ({ id: group.id, color: group.color }))
    })));
  };

  const resetPeople = () => {
    setPeople(defaultPeople);
  };

  return [people, handleAddPerson, updatePeopleGroups, resetPeople];
} 