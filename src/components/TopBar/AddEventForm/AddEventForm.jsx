import React, { useState } from 'react';
import Modal from '../../Modal/Modal';
import '../../../styles/common.css';
import './AddEventForm.css';

function AddEventForm({ onAdd, onClose, folders = [] }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(1);
  const [folderId, setFolderId] = useState('no-folder');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (showNewFolderInput && newFolderName.trim()) {
      const newFolderId = `folder-${Date.now()}`;
      onAdd({
        newFolder: {
          id: newFolderId,
          name: newFolderName.trim(),
          isFolder: true,
          isOpen: true,
          events: [{
            id: Date.now(),
            name,
            weight: Number(weight)
          }]
        }
      });
    } else {
      onAdd({
        folderId,
        event: {
          id: Date.now(),
          name,
          weight: Number(weight)
        }
      });
    }
    onClose();
  };

  return (
    <Modal title="Add New Event" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <div className="input-row">
            <label>Event Name:</label>
            <div className="input-group">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
        </div>
        <div className="form-group">
          <div className="input-row">
            <label>Weight:</label>
            <div className="input-group">
              <input
                type="number"
                min="0"
                max="4"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
          </div>
        </div>
        <div className="form-group">
          <div className="folder-section">
            <div className="input-row">
              <label>Folder:</label>
              <div className="input-group">
                {showNewFolderInput ? (
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                    autoFocus
                    required={showNewFolderInput}
                  />
                ) : (
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    required
                  >
                    <option value="no-folder">No Folder</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div 
              className="new-folder-link" 
              onClick={() => {
                setShowNewFolderInput(!showNewFolderInput);
                if (showNewFolderInput) {
                  setNewFolderName('');
                }
              }}
            >
              {showNewFolderInput ? '- Cancel' : '+ Add new folder'}
            </div>
          </div>
        </div>
        <div className="button-group">
          <button type="submit">Add Event</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export default AddEventForm; 