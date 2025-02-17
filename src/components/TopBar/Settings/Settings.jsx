import React, { useState } from 'react';
import './Settings.css';

function Settings({ settings, onSave, onClose }) {
  const [formData, setFormData] = useState({ ...settings });

  const calculateLateExample = (credit) => {
    return `(${(credit * 100).toFixed(0)}%)`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Settings</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSave(formData);
          onClose();
        }}>
          <div className="form-group">
            <div className="setting-row">
              <label>Late Credit:</label>
              <div className="setting-input">
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.lateCredit}
                  onChange={(e) => setFormData({
                    ...formData,
                    lateCredit: Number(e.target.value)
                  })}
                />
                <span className="setting-example">
                  {calculateLateExample(formData.lateCredit)}
                </span>
              </div>
            </div>
          </div>
          <div className="form-group">
            <div className="setting-row">
              <label>Treat 'not selected' events as N/A</label>
              <div className="setting-input">
                <input
                  type="checkbox"
                  checked={formData.onlyCountAbsent}
                  onChange={(e) => setFormData({
                    ...formData,
                    onlyCountAbsent: e.target.checked
                  })}
                />
              </div>
            </div>
          </div>
          <div className="form-group">
            <div className="setting-row">
              <label>Color-code attendance status</label>
              <div className="setting-input">
                <input
                  type="checkbox"
                  checked={formData.colorCodeAttendance}
                  onChange={(e) => setFormData({
                    ...formData,
                    colorCodeAttendance: e.target.checked
                  })}
                />
              </div>
            </div>
          </div>
          <div className="button-group">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings; 