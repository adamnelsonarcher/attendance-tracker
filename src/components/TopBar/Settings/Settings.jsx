import React, { useState, useEffect } from 'react';
import './Settings.css';
import Modal from '../../Modal/Modal';
import { syncTable } from '../../../services/firebase';
import StatusManager from './StatusManager';

function Settings({ settings, onSave, onClose, onResetData, loadTableData }) {
  const [formData, setFormData] = useState({
    ...settings,
    customStatuses: settings.customStatuses || [
      { id: 'Present', name: 'Present', credit: 1, color: '#e6ffe6', isDefault: true },
      { id: 'Absent', name: 'Absent', credit: 0, color: '#ffe6e6', isDefault: true },
      { id: 'Late', name: 'Late', credit: 0.5, color: '#fff3e6', isDefault: true },
      { id: 'DNA', name: 'N/A', credit: null, color: '#f2f2f2', isDefault: true }
    ]
  });

  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [error, setError] = useState('');
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [showAttendanceOptions, setShowAttendanceOptions] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const generateTableCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, 
      () => chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  };

  const handleJoinTable = async () => {
    if (joinCode.length !== 6) {
      setError('Table code must be 6 characters');
      return;
    }

    if (formData.tableCode && 
        !window.confirm('Joining a new table will remove all locally stored data. To get back to your existing table, you will need your existing code: ' + formData.tableCode + '. Continue?')) {
      return;
    }

    // Verify the table exists first
    const success = await loadTableData(joinCode.toUpperCase());
    if (!success) {
      setError('Could not find table with that code');
      return;
    }

    // Set the new table code and refresh the page
    localStorage.setItem('tableCode', joinCode.toUpperCase());
    
    // Clear any existing settings to ensure we get the new table's settings
    localStorage.removeItem('settings');
    
    window.location.reload();
  };

  const handleCreateNewTable = async () => {
    if (formData.tableCode && 
        !window.confirm('Creating a new table will remove all locally stored data. To get back to your old table, you need your existing code. Continue?')) {
      return;
    }

    // Generate new table code
    const newCode = generateTableCode();
    
    // Clear all localStorage data
    localStorage.clear();
    
    // Create new settings with the new table code
    const newSettings = {
      lateCredit: 0.5,
      onlyCountAbsent: true,
      colorCodeAttendance: true,
      hideTitle: true,
      showHoverHighlight: true,
      enableStickyColumns: true,
      cloudSync: true,
      tableCode: newCode,
      customStatuses: [
        { id: 'Present', name: 'Present', credit: 1, color: '#e6ffe6', isDefault: true },
        { id: 'Absent', name: 'Absent', credit: 0, color: '#ffe6e6', isDefault: true },
        { id: 'Late', name: 'Late', credit: 0.5, color: '#fff3e6', isDefault: true },
        { id: 'DNA', name: 'N/A', credit: null, color: '#f2f2f2', isDefault: true }
      ]
    };
    
    // Save to cloud first
    await syncTable(newCode, {
      people: [],
      events: [],
      attendance: {},
      groups: [],
      settings: newSettings,
      lastUpdated: new Date().toISOString()
    });

    // Set minimal required localStorage data
    localStorage.setItem('tableCode', newCode);
    localStorage.setItem('settings', JSON.stringify(newSettings));
    
    // Reload the page to start fresh
    window.location.reload();
  };

  const calculateLateExample = (credit) => {
    return `(${(credit * 100).toFixed(0)}%)`;
  };

  const handleChange = async (name, value) => {
    const newFormData = {
      ...formData,
      [name]: value
    };
    
    if (name === 'cloudSync' && value && !localStorage.getItem('tableCode')) {
      const newCode = generateTableCode();
      newFormData.tableCode = newCode;
      localStorage.setItem('tableCode', newCode);
      
      await syncTable(newCode, {
        people: JSON.parse(localStorage.getItem('people') || '[]'),
        events: JSON.parse(localStorage.getItem('events') || '[]'),
        attendance: JSON.parse(localStorage.getItem('attendance') || '{}'),
        groups: JSON.parse(localStorage.getItem('groups') || '[]'),
        settings: newFormData,
        lastUpdated: new Date().toISOString()
      });
    }
    
    setFormData(newFormData);
    onSave(newFormData);
  };

  const handleStatusesChange = (newStatuses) => {
    handleChange('customStatuses', newStatuses);
  };

  const handleForceSync = async () => {
    if (!formData.tableCode) {
      alert('No table code found. Enable cloud sync first.');
      return;
    }

    if (!window.confirm('This will force overwrite the cloud data with your local data. Continue?')) {
      return;
    }

    // Get all data from localStorage
    const localData = {
      people: JSON.parse(localStorage.getItem('people') || '[]'),
      events: JSON.parse(localStorage.getItem('events') || '[]'),
      attendance: JSON.parse(localStorage.getItem('attendance') || '{}'),
      groups: JSON.parse(localStorage.getItem('groups') || '[]'),
      settings: formData,
      lastUpdated: new Date().toISOString()
    };

    // Force sync to cloud
    await syncTable(formData.tableCode, localData);
    alert('Data synced to cloud!');
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings-list">
        <div className="settings-credits">
          Appeveloped and built by <a href="https://nelsonarcher.com" target="_blank" rel="noopener noreferrer">Adam Nelson-Archer</a>
          <br />
          v0.8.2 pre-release, <a href="https://github.com/adamnelsonarcher/attendance-tracker/releases" target="_blank" rel="noopener noreferrer">see changelogs</a>
        </div>

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

        <div className="setting-section">
          <button 
            className={`attendance-options-btn ${showAttendanceOptions ? 'active' : ''}`}
            onClick={() => setShowAttendanceOptions(!showAttendanceOptions)}
          >
            Edit Attendance Options {showAttendanceOptions ? '▼' : '▶'}
          </button>
          
          {showAttendanceOptions && (
            <div className="attendance-options">
              <StatusManager 
                statuses={formData.customStatuses || []}
                onChange={(newStatuses) => handleChange('customStatuses', newStatuses)}
              />
            </div>
          )}
        </div>

        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={formData.cloudSync}
              onChange={(e) => handleChange('cloudSync', e.target.checked)}
            />
            <span>Enable Cloud Sync</span>
          </label>
        </div>

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

        <div className="setting-section">
          <button 
            className={`attendance-options-btn ${showAdvancedSettings ? 'active' : ''}`}
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            Advanced Settings {showAdvancedSettings ? '▼' : '▶'}
          </button>
          
          {showAdvancedSettings && (
            <div className="advanced-settings">
              <button onClick={handleForceSync}>
                Force Sync Local → Cloud
              </button>
            </div>
          )}
        </div>

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