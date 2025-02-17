import React, { useState } from 'react';
import Modal from '../../Modal/Modal';
import '../../../styles/common.css';
import './AddPersonForm.css';

function AddPersonForm({ onAdd, onClose }) {
  const [names, setNames] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const nameList = names
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    const newPeople = nameList.map(name => ({
      name,
      id: Date.now() + Math.random()
    }));
    
    onAdd(newPeople);
    onClose();
  };

  return (
    <Modal title="Add New Person(s)" onClose={onClose}>
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
    </Modal>
  );
}

export default AddPersonForm; 