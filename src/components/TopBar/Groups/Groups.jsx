import React, { useState } from 'react';
import Modal from '../../Modal/Modal';
import './Groups.css';

function Groups({ groups, onSave, onClose, people }) {
  const [activeTab, setActiveTab] = useState('people');
  const [formData, setFormData] = useState([...groups]);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(formData[0]?.id || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);

  const addGroup = () => {
    if (newGroupName.trim()) {
      const newGroup = {
        id: Date.now(),
        name: newGroupName.trim(),
        color: generateRandomColor(),
        memberIds: []
      };
      setFormData([...formData, newGroup]);
      setSelectedGroup(newGroup.id);
      setNewGroupName('');
    }
  };

  const generateRandomColor = () => {
    // Generate random RGB values
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    
    // Convert to hex
    const toHex = (n) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const deleteGroup = (groupId) => {
    setFormData(formData.filter(g => g.id !== groupId));
    if (selectedGroup === groupId) {
      setSelectedGroup(formData[0]?.id || null);
    }
  };

  const filteredPeople = people.filter(person =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal 
      title="Manage Groups" 
      onClose={onClose} 
      className="groups-modal"
      preventOutsideClose={true}
    >
      <div className="groups-layout">
        <div className="groups-container">
          <div className="tabs">
            <button 
              className={`tab-button ${activeTab === 'people' ? 'active' : ''}`}
              onClick={() => setActiveTab('people')}
            >
              People Groups
            </button>
            <button 
              className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              Event Folders
            </button>
          </div>

          {activeTab === 'people' && (
            <>
              <div className="groups-panel">
                <div className="add-group-form">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name"
                    onKeyPress={(e) => e.key === 'Enter' && addGroup()}
                  />
                  <button onClick={addGroup} disabled={!newGroupName.trim()}>
                    Add Group
                  </button>
                </div>
                
                <div className="groups-list custom-scrollbar">
                  {formData.map(group => (
                    <div 
                      key={group.id}
                      className={`group-item ${selectedGroup === group.id ? 'selected' : ''}`}
                      onClick={() => setSelectedGroup(group.id)}
                    >
                      <div className="group-color">
                        <input
                          type="color"
                          value={group.color}
                          onChange={(e) => {
                            setFormData(formData.map(g =>
                              g.id === group.id ? { ...g, color: e.target.value } : g
                            ));
                          }}
                        />
                      </div>
                      
                      {editingGroup === group.id ? (
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => {
                            setFormData(formData.map(g =>
                              g.id === group.id ? { ...g, name: e.target.value } : g
                            ));
                          }}
                          onBlur={() => setEditingGroup(null)}
                          onKeyPress={(e) => e.key === 'Enter' && setEditingGroup(null)}
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="group-name"
                          onDoubleClick={() => setEditingGroup(group.id)}
                        >
                          {group.name}
                        </span>
                      )}
                      
                      <span className="member-count">
                        {group.memberIds.length} members
                      </span>
                      
                      <button 
                        className="delete-group"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteGroup(group.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="members-panel">
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="members-list custom-scrollbar">
                  {filteredPeople.map(person => {
                    const isSelected = formData.find(g => g.id === selectedGroup)
                      ?.memberIds.includes(person.id);
                    return (
                      <div 
                        key={person.id} 
                        className={`member-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (selectedGroup) {
                            setFormData(formData.map(group => {
                              if (group.id === selectedGroup) {
                                const memberIds = group.memberIds.includes(person.id)
                                  ? group.memberIds.filter(id => id !== person.id)
                                  : [...group.memberIds, person.id];
                                return { ...group, memberIds };
                              }
                              return group;
                            }));
                          }
                        }}
                      >
                        <div className="member-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent div click
                            onClick={(e) => e.stopPropagation()} // Prevent double-toggle
                          />
                        </div>
                        <span className="member-name">{person.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'events' && (
            <div className="events-tab-placeholder">
              Event folder management will be implemented here
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={() => {
            onSave(formData);
            onClose();
          }}>Save Changes</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

export default Groups; 