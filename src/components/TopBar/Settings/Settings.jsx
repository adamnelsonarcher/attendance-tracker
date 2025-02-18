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

  const handleChange = (nameOrEvent, value) => {
    if (typeof nameOrEvent === 'string') {
      // Direct value change
      setLocalSettings(prev => ({
        ...prev,
        [nameOrEvent]: value
      }));
    } else {
      // Event object
      const { name, value: eventValue, type, checked } = nameOrEvent.target;
      setLocalSettings(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : eventValue
      }));
    }
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
                onChange={(e) => handleChange(e.target.name, e.target.checked)}
              />
              <span>Hide Title</span>
            </label>

            <label className="setting-row">
              <input
                type="checkbox"
                name="onlyCountAbsent"
                checked={localSettings.onlyCountAbsent}
                onChange={(e) => handleChange(e.target.name, e.target.checked)}
              />
              <span>Treat 'not selected' events as N/A</span>
            </label>

            <label className="setting-row">
              <input
                type="checkbox"
                name="colorCodeAttendance"
                checked={localSettings.colorCodeAttendance}
                onChange={(e) => handleChange(e.target.name, e.target.checked)}
              />
              <span>Color-code attendance status</span>
            </label>

            <label className="setting-row">
              <input
                type="checkbox"
                name="showHoverHighlight"
                checked={localSettings.showHoverHighlight}
                onChange={(e) => handleChange(e.target.name, e.target.checked)}
              />
              <span>Highlight rows with mouse hover</span>
            </label>

            <div className="setting-row late-credit">
              <label>Late Credit:
                <input
                  type="number"
                  name="lateCredit"
                  value={localSettings.lateCredit}
                  onChange={(e) => handleChange(e.target.name, e.target.value)}
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