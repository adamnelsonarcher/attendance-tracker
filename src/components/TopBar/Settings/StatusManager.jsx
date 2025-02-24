import React, { useState } from 'react';
import './StatusManager.css';

function StatusManager({ statuses, onChange }) {
  const [newStatus, setNewStatus] = useState({ name: '', credit: 1, color: '#e6ffe6' });
  const [editingId, setEditingId] = useState(null);

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
    if (window.confirm(`Are you sure you want to delete this status? This will remove all current selections of this status across all events.`)) {
      onChange(statuses.filter(status => status.id !== id));
    }
  };

  return (
    <div className="status-manager">
      <div className="status-list">
        {statuses.map(status => (
          <div key={status.id} className={`status-item ${editingId === status.id ? 'editing' : ''}`}>
            {editingId === status.id ? (
              <>
                <div>
                  <label>Name:</label>
                  <input
                    type="text"
                    value={status.name}
                    onChange={(e) => handleStatusChange(status.id, 'name', e.target.value)}
                  />
                </div>
                <div className="status-field">
                  <label>Event Credit Multiplier:</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={status.credit}
                    onChange={(e) => handleStatusChange(status.id, 'credit', parseFloat(e.target.value))}
                  />
                </div>
                <div className="status-field">
                  <label>Color:</label>
                  <input
                    type="color"
                    value={status.color}
                    onChange={(e) => handleStatusChange(status.id, 'color', e.target.value)}
                  />
                </div>
                <div className="button-group">
                  <button onClick={() => setEditingId(null)}>Done</button>
                  <button onClick={() => handleDeleteStatus(status.id)}>Delete</button>
                </div>
              </>
            ) : (
              <>
                <span>{status.name}</span>
                <button className="edit-button" onClick={() => setEditingId(status.id)}>Edit</button>
              </>
            )}
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
        <div className="status-field">
          <label>Event Credit Multiplier:</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={newStatus.credit}
            onChange={(e) => setNewStatus({ ...newStatus, credit: parseFloat(e.target.value) })}
          />
        </div>
        <div className="status-field">
          <label>Color:</label>
          <input
            type="color"
            value={newStatus.color}
            onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
          />
        </div>
        <button onClick={handleAddStatus}>Add</button>
      </div>
    </div>
  );
}

export default StatusManager; 