import React, { useState } from 'react';

function AddEventForm({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(1);
  const [folderId, setFolderId] = useState('no-folder'); // Changed default

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      folderId,
      event: {
        id: Date.now(),
        name,
        weight: Number(weight)
      }
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Add New Event</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Event Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Weight (0-4):</label>
            <input
              type="number"
              min="0"
              max="4"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Folder:</label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              required
            >
              <option value="weekly">Weekly Events</option>
              <option value="special">Special Events</option>
              <option value="no-folder">No Folder</option>
            </select>
          </div>
          <div className="button-group">
            <button type="submit">Add Event</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEventForm; 