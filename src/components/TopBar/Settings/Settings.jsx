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

  const [joinTableCode, setJoinTableCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [error, setError] = useState('');
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [showAttendanceOptions, setShowAttendanceOptions] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);

  const generateTableCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, 
      () => chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  };

  const handleSyncThisTable = async (enabled) => {
    // Only generate new code if we don't have one yet and we're enabling sync
    if (enabled && !formData.tableCode) {
      const newCode = generateTableCode();
      const newFormData = {
        ...formData,
        tableCode: newCode,
        cloudSync: true
      };
      
      setFormData(newFormData);
      localStorage.setItem('tableCode', newCode);
      
      // Initial sync to Firebase
      await syncTable(newCode, {
        people: JSON.parse(localStorage.getItem('people') || '[]'),
        events: JSON.parse(localStorage.getItem('events') || '[]'),
        attendance: JSON.parse(localStorage.getItem('attendance') || '{}'),
        groups: JSON.parse(localStorage.getItem('groups') || '[]'),
        settings: newFormData,
        lastUpdated: new Date().toISOString()
      });
      
      onSave(newFormData);
    } else {
      // Just update cloud sync setting
      const newFormData = {
        ...formData,
        cloudSync: enabled
      };
      setFormData(newFormData);
      onSave(newFormData);
    }
  };

  const handleJoinTable = async () => {
    if (!joinTableCode.trim()) {
      setJoinError('Please enter a table code');
      return;
    }
    
    if (window.confirm('Joining a table will replace your current data. Continue?')) {
      const success = await loadTableData(joinTableCode);
      
      if (success) {
        // Update form data with the new settings that include cloud sync enabled
        const newSettings = JSON.parse(localStorage.getItem('settings'));
        newSettings.cloudSync = true;
        newSettings.tableCode = joinTableCode;
        localStorage.setItem('settings', JSON.stringify(newSettings));
        localStorage.setItem('tableCode', joinTableCode);
        
        // Update the form data to reflect the new settings
        setFormData({
          ...newSettings,
          customStatuses: newSettings.customStatuses || formData.customStatuses
        });
        
        onClose();
      } else {
        setJoinError('Invalid table code or network error');
      }
    }
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
          v0.8.5 pre-release, <a href="https://github.com/adamnelsonarcher/attendance-tracker/releases" target="_blank" rel="noopener noreferrer">see changelogs</a>
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

        <label className="setting-row">
          <input
            type="checkbox"
            name="colorChangeDropdown"
            checked={formData.colorChangeDropdown}
            onChange={(e) => handleChange(e.target.name, e.target.checked)}
          />
          <span>Color coded dropdown items</span>
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

        <div className="setting-section">
          <button 
            className={`attendance-options-btn ${showCloudSync ? 'active' : ''}`}
            onClick={() => setShowCloudSync(!showCloudSync)}
          >
            Cloud Sync {showCloudSync ? '▼' : '▶'}
          </button>
          
          {showCloudSync && (
            <div className="attendance-options">
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id="cloudSync"
                  checked={formData.cloudSync}
                  onChange={(e) => handleSyncThisTable(e.target.checked)}
                />
                <label htmlFor="cloudSync">Sync This Table</label>
              </div>
              
              {formData.cloudSync && formData.tableCode && (
                <div className="table-code-display">
                  <p>Your table code: <strong>{formData.tableCode}</strong></p>
                  <p><small>Share this code with others to let them join your table</small></p>
                </div>
              )}
              
              <div className="join-table-container">
                <span>Join Existing Table:</span>
                <div className="join-table-input-group">
                  <input
                    type="text"
                    value={joinTableCode}
                    onChange={(e) => {
                      setJoinTableCode(e.target.value.toUpperCase());
                      setJoinError('');
                    }}
                    placeholder="Enter table code"
                    maxLength={6}
                  />
                  <button 
                    className="join-button"
                    onClick={handleJoinTable}
                    disabled={!joinTableCode.trim()}
                  >
                    Join
                  </button>
                </div>
                {joinError && <p className="join-error">{joinError}</p>}
              </div>
            </div>
          )}
        </div>

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
              <button onClick={() => {
                if (window.confirm('Create a new table? This will clear all data.')) {
                  // Clear all data
                  onResetData();
                  
                  // Create new settings without sync and table code
                  const newSettings = {
                    ...settings, // Use the default settings as base
                    cloudSync: false,
                    tableCode: undefined // Explicitly set to undefined to remove it
                  };
                  
                  // Update form data
                  setFormData(newSettings);
                  
                  // Update localStorage
                  localStorage.setItem('settings', JSON.stringify(newSettings));
                  localStorage.removeItem('tableCode');
                  
                  // Force a refresh to ensure all state is clean
                  window.location.reload();
                }
              }}>
                Create New Table
              </button>
              <div className="danger-zone">
                <button onClick={onResetData} className="reset-button">
                  Reset Table Data
                </button>
              </div>
            </div>
          )}
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