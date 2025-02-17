import React, { useState } from 'react';

function AddPersonForm({ onAdd, onClose }) {
  const [names, setNames] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Split names by newlines or commas and clean up whitespace
    const nameList = names
      .split(/[\n,]/) // Split on newline or comma
      .map(name => name.trim()) // Remove whitespace
      .filter(name => name.length > 0); // Remove empty entries
    
    // Create a person object for each name
    const newPeople = nameList.map(name => ({
      name,
      id: Date.now() + Math.random() // Ensure unique IDs even for bulk adds
    }));
    
    // Add all new people
    onAdd(newPeople);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Add New Person(s)</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name(s):</label>
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder="Enter names (separated by commas or new lines)&#10;Example:&#10;John Doe&#10;Jane Smith, Bob Johnson"
              rows="5"
              required
            />
          </div>
          <div className="button-group">
            <button type="submit">Add People</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPersonForm; 