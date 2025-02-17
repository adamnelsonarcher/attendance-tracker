import React, { useState } from 'react';
import Modal from '../../Modal/Modal';
import './Groups.css';

function Groups({ groups, onSave, onClose, people }) {
  const [formData, setFormData] = useState([...groups]);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);

  const addGroup = () => {
    if (newGroupName.trim()) {
      setFormData([...formData, {
        id: Date.now(),
        name: newGroupName.trim(),
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        memberIds: []
      }]);
      setNewGroupName('');
    }
  };

  const togglePersonInGroup = (groupId, personId) => {
    setFormData(formData.map(group => {
      if (group.id === groupId) {
        const memberIds = group.memberIds.includes(personId)
          ? group.memberIds.filter(id => id !== personId)
          : [...group.memberIds, personId];
        return { ...group, memberIds };
      }
      return group;
    }));
  };

  const handleColorChange = (groupId, color) => {
    setFormData(formData.map(group => 
      group.id === groupId ? { ...group, color } : group
    ));
  };

  return (
    <Modal title="Manage Groups" onClose={onClose}>
      <div className="groups-container">
        <div className="groups-list">
          <div className="add-group">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="New group name"
            />
            <button onClick={addGroup}>Add Group</button>
          </div>
          {formData.map(group => (
            <div 
              key={group.id}
              className={`group-item ${selectedGroup === group.id ? 'selected' : ''}`}
              onClick={() => setSelectedGroup(group.id)}
            >
              <input
                type="color"
                value={group.color}
                onChange={(e) => handleColorChange(group.id, e.target.value)}
              />
              <span>{group.name}</span>
              <span className="member-count">({group.memberIds.length})</span>
            </div>
          ))}
        </div>
        
        {selectedGroup && (
          <div className="group-members">
            <h3>Members</h3>
            {people.map(person => (
              <div key={person.id} className="member-item">
                <input
                  type="checkbox"
                  checked={formData.find(g => g.id === selectedGroup)?.memberIds.includes(person.id)}
                  onChange={() => togglePersonInGroup(selectedGroup, person.id)}
                />
                <span>{person.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="button-group">
        <button onClick={() => {
          onSave(formData);
          onClose();
        }}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export default Groups; 