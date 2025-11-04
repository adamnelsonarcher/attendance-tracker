import React, { useState } from 'react';
import './Settings.css';
import Modal from '../../Modal/Modal';
import { syncTable } from '../../../services/firebase';
import StatusManager from './StatusManager';
import { generateTableCode } from '../../../utils/tableCode';

function Settings({ settings, onSave, onClose, onResetData, loadTableData, onMigrateAttendance }) {
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
  const [showAttendanceOptions, setShowAttendanceOptions] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);

  // table code utilities centralized in utils/tableCode

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
        // Get the latest settings that were loaded from the cloud
        const cloudSettings = JSON.parse(localStorage.getItem('settings'));
        
        // Ensure the table code and cloud sync are set correctly
        const newSettings = {
          ...cloudSettings,
          cloudSync: true,
          tableCode: joinTableCode
        };
        
        // Update localStorage and state
        localStorage.setItem('settings', JSON.stringify(newSettings));
        localStorage.setItem('tableCode', joinTableCode);
        setFormData(newSettings);
        
        // Clear the input and error
        setJoinTableCode('');
        setJoinError('');
        
        // Close the settings modal
        onClose();
      } else {
        setJoinError('Invalid table code or network error');
      }
    }
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

  const handleSwitchToNewTable = async () => {
    if (!window.confirm('Switch to a new table? This will clear all local data.')) return;
    onResetData();
    const newCode = generateTableCode();
    const newSettings = {
      ...formData,
      tableCode: newCode,
      cloudSync: true
    };
    localStorage.setItem('settings', JSON.stringify(newSettings));
    localStorage.setItem('tableCode', newCode);
    setFormData(newSettings);
    await syncTable(newCode, {
      people: [],
      events: [],
      attendance: {},
      groups: [],
      settings: newSettings,
      lastUpdated: new Date().toISOString()
    });
    window.location.assign(`/${newCode}`);
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings-list">
        <div className="settings-credits">
          Developed and built by <a href="https://nelsonarcher.com" target="_blank" rel="noopener noreferrer">Adam Nelson-Archer</a>
          <br />
          v0.8.5 pre-release, <a href="https://github.com/adamnelsonarcher/attendance-tracker/releases" target="_blank" rel="noopener noreferrer">see changelogs</a>
        </div>

        <div className="setting-section">
          <div className="switch-table-container">
            <button className="join-button" onClick={handleSwitchToNewTable}>
              Switch to New Table
            </button>
          </div>
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
                onChange={(newStatuses) => {
                  const prev = formData.customStatuses || [];
                  const prevIds = new Set(prev.map(s => s.id));
                  const newIds = new Set(newStatuses.map(s => s.id));
                  const deleted = Array.from(prevIds).filter(id => !newIds.has(id));
                  if (deleted.length > 0) {
                    const attendance = JSON.parse(localStorage.getItem('attendance') || '{}');
                    const counts = deleted.map(id => ({ id, count: Object.values(attendance).filter(v => v === id).length }));
                    const summary = counts.map(c => `${c.id}: ${c.count}`).join('\n');
                    const proceed = window.confirm(`Deleting statuses will migrate existing selections to 'Select':\n${summary}\n\nContinue?`);
                    if (!proceed) {
                      return; // abort status change
                    }
                    const migratedAttendance = Object.fromEntries(Object.entries(attendance).map(([k, v]) => [k, deleted.includes(v) ? 'Select' : v]));
                    localStorage.setItem('attendance', JSON.stringify(migratedAttendance));
                    if (onMigrateAttendance) onMigrateAttendance(migratedAttendance);
                  }
                  handleChange('customStatuses', newStatuses);
                }}
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
              <div className="switch-table-container">
                <button className="join-button" onClick={handleSwitchToNewTable}>
                  Switch to New Table
                </button>
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