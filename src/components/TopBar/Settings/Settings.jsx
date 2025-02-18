import React, { useState, useEffect } from 'react';
import './Settings.css';
import Modal from '../../Modal/Modal';

function Settings({ settings, onSave, onClose, onResetData }) {
  const [formData, setFormData] = useState(() => {
    const storedCode = localStorage.getItem('tableCode');
    const storedSettings = localStorage.getItem('settings');
    const parsedSettings = storedSettings ? JSON.parse(storedSettings) : settings;
    
    return {
      ...parsedSettings,
      tableCode: storedCode || '',
      isNewTable: !storedCode
    };
  });

  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [error, setError] = useState('');

  const generateTableCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, 
      () => chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  };

  useEffect(() => {
    if (formData.cloudSync && !formData.tableCode) {
      const newCode = generateTableCode();
      setFormData(prev => ({
        ...prev,
        tableCode: newCode
      }));
      localStorage.setItem('tableCode', newCode);
    }
  }, [formData.cloudSync]);

  const handleJoinTable = () => {
    if (joinCode.length !== 6) {
      setError('Table code must be 6 characters');
      return;
    }

    if (formData.tableCode && 
        !window.confirm('Joining a new table will remove all locally stored data. To get back to your existing table, you will need your existing code: ' + formData.tableCode + '. Continue?')) {
      return;
    }

    // Clear all localStorage data
    localStorage.clear();
    
    // Set the new table code
    localStorage.setItem('tableCode', joinCode.toUpperCase());
    setFormData(prev => ({
      lateCredit: 0.5,
      onlyCountAbsent: true,
      colorCodeAttendance: true,
      hideTitle: true,
      showHoverHighlight: true,
      enableStickyColumns: true,
      cloudSync: prev.cloudSync,
      tableCode: joinCode.toUpperCase(),
      isNewTable: false
    }));
    
    // Call parent reset functions
    onResetData();
    setShowJoinInput(false);
    setError('');
  };

  const handleCreateNewTable = () => {
    if (formData.tableCode && 
        !window.confirm('Creating a new table will remove all locally stored data. To get back to your old table, you need your existing code. Continue?')) {
      return;
    }

    // Generate new table code
    const newCode = generateTableCode();
    
    // Clear all localStorage data
    localStorage.clear();
    
    // Set only the new table code
    localStorage.setItem('tableCode', newCode);
    
    // Reset form data to defaults
    setFormData(prev => ({
      lateCredit: 0.5,
      onlyCountAbsent: true,
      colorCodeAttendance: true,
      hideTitle: true,
      showHoverHighlight: true,
      enableStickyColumns: true,
      cloudSync: prev.cloudSync,
      tableCode: newCode,
      isNewTable: true
    }));

    // Call parent reset functions
    onResetData();
  };

  const calculateLateExample = (credit) => {
    return `(${(credit * 100).toFixed(0)}%)`;
  };

  const handleChange = (nameOrEvent, value) => {
    if (typeof nameOrEvent === 'string') {
      // Direct value change
      setFormData(prev => ({
        ...prev,
        [nameOrEvent]: value
      }));
    } else {
      // Event object
      const { name, value: eventValue, type, checked } = nameOrEvent.target;
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : eventValue
      }));
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings-list">
        <label className="setting-row">
          <input
            type="checkbox"
            name="hideTitle"
            checked={formData.hideTitle}
            onChange={(e) => handleChange(e.target.name, e.target.checked)}
          />
          <span>Hide Title</span>
        </label>

        <label className="setting-row">
          <input
            type="checkbox"
            name="onlyCountAbsent"
            checked={formData.onlyCountAbsent}
            onChange={(e) => handleChange(e.target.name, e.target.checked)}
          />
          <span>Treat 'not selected' events as N/A</span>
        </label>

        <label className="setting-row">
          <input
            type="checkbox"
            name="colorCodeAttendance"
            checked={formData.colorCodeAttendance}
            onChange={(e) => handleChange(e.target.name, e.target.checked)}
          />
          <span>Color-code attendance status</span>
        </label>

        <label className="setting-row">
          <input
            type="checkbox"
            name="showHoverHighlight"
            checked={formData.showHoverHighlight}
            onChange={(e) => handleChange(e.target.name, e.target.checked)}
          />
          <span>Highlight rows with mouse hover</span>
        </label>

        <label className="setting-row">
          <input
            type="checkbox"
            name="enableStickyColumns"
            checked={formData.enableStickyColumns}
            onChange={(e) => handleChange(e.target.name, e.target.checked)}
          />
          <span>Sticky headers and names</span>
        </label>

        <div className="setting-row late-credit">
          <label>Late Credit:
            <input
              type="number"
              name="lateCredit"
              value={formData.lateCredit}
              onChange={(e) => handleChange(e.target.name, e.target.value)}
              step="0.1"
              min="0"
              max="1"
            />
            <span className="late-example">
              {calculateLateExample(formData.lateCredit)}
            </span>
          </label>
        </div>

        <label className="setting-row">
          <input
            type="checkbox"
            name="cloudSync"
            checked={formData.cloudSync}
            onChange={(e) => handleChange(e.target.name, e.target.checked)}
          />
          <span>Enable Cloud Sync</span>
        </label>

        {formData.cloudSync && (
          <div className="setting-section cloud-sync-section">
            <h3>Table Management</h3>
            <div className="current-table">
              {formData.tableCode && (
                <p>Current Table Code: {formData.tableCode}</p>
              )}
              <div className="button-group">
                <button onClick={handleCreateNewTable}>
                  {formData.tableCode ? 'Create New Table' : 'Generate Table Code'}
                </button>
                <button onClick={() => setShowJoinInput(true)}>
                  Join Existing Table
                </button>
              </div>
            </div>

            {showJoinInput && (
              <div className="join-table">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="code-input"
                />
                <button onClick={handleJoinTable} className="use-existing-code">
                  Join
                </button>
                <button 
                  onClick={() => {
                    setShowJoinInput(false);
                    setJoinCode('');
                    setError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        )}

        <div className="danger-zone">
          <button onClick={onResetData} className="reset-button">
            Reset Table Data
          </button>
        </div>
      </div>

      <div className="modal-actions">
        <button type="submit" onClick={() => {
          onSave(formData);
          onClose();
        }}>Save Changes</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export default Settings; 