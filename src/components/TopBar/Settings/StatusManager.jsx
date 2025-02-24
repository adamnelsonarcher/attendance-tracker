import React, { useState } from 'react';
import './StatusManager.css';

function StatusManager({ statuses, onChange }) {
  const [newStatus, setNewStatus] = useState({ name: '', credit: 1, color: '#e6ffe6' });

  const handleStatusChange = (id, field, value) => {
    const updatedStatuses = statuses.map(status => {
      if (status.id === id) {
        return { ...status, [field]: value };
      }
      return status;
    });
    onChange(updatedStatuses);
  };

  const handleAddStatus = () => {
    if (!newStatus.name) return;
    const id = newStatus.name.toLowerCase().replace(/\s+/g, '-');
    onChange([...statuses, { ...newStatus, id }]);
    setNewStatus({ name: '', credit: 1, color: '#e6ffe6' });
  };

  const handleDeleteStatus = (id) => {
    onChange(statuses.filter(status => status.id !== id));
  };

  return (
    <div className="status-manager">
      <div className="status-list">
        {statuses.map(status => (
          <div key={status.id} className="status-item">
            <input
              type="text"
              value={status.name}
              onChange={(e) => handleStatusChange(status.id, 'name', e.target.value)}
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={status.credit}
              onChange={(e) => handleStatusChange(status.id, 'credit', parseFloat(e.target.value))}
              disabled={status.id === 'DNA'}
            />
            <input
              type="color"
              value={status.color}
              onChange={(e) => handleStatusChange(status.id, 'color', e.target.value)}
            />
            <button onClick={() => handleDeleteStatus(status.id)}>Delete</button>
          </div>
        ))}
      </div>
      <div className="add-status">
        <input
          type="text"
          placeholder="New Status Name"
          value={newStatus.name}
          onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={newStatus.credit}
          onChange={(e) => setNewStatus({ ...newStatus, credit: parseFloat(e.target.value) })}
        />
        <input
          type="color"
          value={newStatus.color}
          onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
        />
        <button onClick={handleAddStatus}>Add</button>
      </div>
    </div>
  );
}

export default StatusManager; 