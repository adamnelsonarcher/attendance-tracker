import React, { useState } from 'react';
import './Settings.css';

function Settings({ settings, onSave, onClose }) {
  const [localSettings, setLocalSettings] = useState({
    ...settings,
    hideTitle: settings.hideTitle || false
  });

  const calculateLateExample = (credit) => {
    return `(${(credit * 100).toFixed(0)}%)`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Settings</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSave(localSettings);
          onClose();
        }}>
          <div className="settings-list">
            <label className="setting-row">
              <input
                type="checkbox"
                name="hideTitle"
                checked={localSettings.hideTitle}
                onChange={handleChange}
              />
              <span>Hide Title</span>
            </label>

            <label className="setting-row">
              <input
                type="checkbox"
                name="onlyCountAbsent"
                checked={localSettings.onlyCountAbsent}
                onChange={handleChange}
              />
              <span>Treat 'not selected' events as N/A</span>
            </label>

            <label className="setting-row">
              <input
                type="checkbox"
                name="colorCodeAttendance"
                checked={localSettings.colorCodeAttendance}
                onChange={handleChange}
              />
              <span>Color-code attendance status</span>
            </label>

            <div className="setting-row late-credit">
              <label>Late Credit:
                <input
                  type="number"
                  name="lateCredit"
                  value={localSettings.lateCredit}
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  max="1"
                />
                <span className="late-example">
                  {calculateLateExample(localSettings.lateCredit)}
                </span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings; 