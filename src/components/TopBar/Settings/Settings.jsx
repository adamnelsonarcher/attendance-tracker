import React, { useState, useEffect } from 'react';
import './Settings.css';
import Modal from '../../Modal/Modal';

function Settings({ settings, onSave, onClose, onResetData }) {
  const [formData, setFormData] = useState({
    ...settings,
    cloudSync: false,
    tableCode: '',
    isNewTable: true
  });

  const generateTableCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking characters
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  useEffect(() => {
    if (formData.cloudSync && !formData.tableCode) {
      setFormData(prev => ({
        ...prev,
        tableCode: generateTableCode()
      }));
    }
  }, [formData.cloudSync]);

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

        <div className="cloud-sync-section">
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={formData.cloudSync}
                onChange={(e) => setFormData({ ...formData, cloudSync: e.target.checked })}
              />
              <span>Enable Cloud Sync</span>
            </label>
          </div>

          {formData.cloudSync && (
            <div className="cloud-sync-options">
              <div className="code-display">
                <span>Table Code: </span>
                <input
                  type="text"
                  value={formData.tableCode}
                  readOnly
                  className="code-input"
                />
                <button 
                  className="use-existing-code"
                  onClick={() => {
                    const code = prompt('Enter existing table code:');
                    if (code) {
                      setFormData(prev => ({
                        ...prev,
                        tableCode: code.toUpperCase()
                      }));
                    }
                  }}
                >
                  Use Existing Code
                </button>
              </div>
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