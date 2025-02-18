import { useState, useEffect } from 'react';

const showcasePeople = [
  { id: 'p1', name: 'John Smith', groups: [
    { id: 'dev', color: '#FF6B6B' },
    { id: 'leads', color: '#96CEB4' }
  ]},
  { id: 'p2', name: 'Emma Johnson', groups: [
    { id: 'dev', color: '#FF6B6B' }
  ]},
  { id: 'p3', name: 'Michael Brown', groups: [] },
  { id: 'p4', name: 'Sarah Davis', groups: ['design'] },
  { id: 'p5', name: 'James Wilson', groups: [] },
  { id: 'p6', name: 'Emily Taylor', groups: ['leads'] },
  { id: 'p7', name: 'William Anderson', groups: ['qa'] },
  { id: 'p8', name: 'Olivia Martinez', groups: [] },
  { id: 'p9', name: 'Daniel Thompson', groups: ['dev'] },
  { id: 'p10', name: 'Sophia Garcia', groups: ['design'] },
  { id: 'p11', name: 'David Rodriguez', groups: [] },
  { id: 'p12', name: 'Isabella Lee', groups: ['design'] },
  { id: 'p13', name: 'Joseph White', groups: ['qa'] },
  { id: 'p14', name: 'Mia Harris', groups: ['dev'] },
  { id: 'p15', name: 'Alexander Clark', groups: [] },
  { id: 'p16', name: 'Ava Lewis', groups: ['qa'] },
  { id: 'p17', name: 'Benjamin Walker', groups: ['dev'] },
  { id: 'p18', name: 'Charlotte Hall', groups: ['design'] },
  { id: 'p19', name: 'Henry Young', groups: ['qa'] },
  { id: 'p20', name: 'Amelia King', groups: [] }
];

const emptyPeople = [];

export function usePeople(initialPeople = showcasePeople) {
  const [people, setPeople] = useState(() => {
    const stored = localStorage.getItem('people');
    if (stored) return JSON.parse(stored);
    
    // Get initial groups from localStorage or use showcase groups
    const storedGroups = localStorage.getItem('groups');
    const groups = storedGroups ? JSON.parse(storedGroups) : [
      { id: 'dev', name: 'Developers', color: '#FF6B6B', memberIds: ['p1', 'p2', 'p9', 'p14', 'p17'] },
      { id: 'design', name: 'Designers', color: '#4ECDC4', memberIds: ['p4', 'p10', 'p12', 'p18'] },
      { id: 'qa', name: 'QA Team', color: '#45B7D1', memberIds: ['p7', 'p13', 'p16', 'p19'] },
      { id: 'leads', name: 'Team Leads', color: '#96CEB4', memberIds: ['p1', 'p6'] }
    ];

    // Initialize people with their groups
    const peopleWithGroups = initialPeople.map(person => ({
      ...person,
      groups: groups
        .filter(group => group.memberIds.includes(person.id))
        .map(group => ({ id: group.id, color: group.color }))
    }));

    localStorage.setItem('people', JSON.stringify(peopleWithGroups));
    return peopleWithGroups;
  });

  useEffect(() => {
    localStorage.setItem('people', JSON.stringify(people));
  }, [people]);

  const updatePeopleGroups = (groups) => {
    setPeople(prev => prev.map(person => ({
      ...person,
      groups: groups
        .filter(group => group.memberIds.includes(person.id))
        .map(group => ({ id: group.id, color: group.color }))
    })));
  };

  const handleAddPerson = (newPeople) => {
    // Handle both single person and array of people
    const peopleToAdd = Array.isArray(newPeople) ? newPeople : [newPeople];
    
    setPeople(prev => [
      ...prev,
      ...peopleToAdd.map(person => ({
        id: `p${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: person.name,
        groups: []
      }))
    ]);
  };

  const resetPeople = () => {
    localStorage.removeItem('people');
    setPeople([]);
  };

  return [people, handleAddPerson, updatePeopleGroups, resetPeople];
}

export { showcasePeople }; 