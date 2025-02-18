import React from 'react';
import './TopBar.css';

function TopBar({ onSettingsClick, onAddPersonClick, onAddEventClick, onGroupsClick, settings, syncStatus, onSyncClick }) {
  return (
    <div className="top-bar">
      <div className="left-buttons">
        <button onClick={onAddPersonClick}>Add Person</button>
        <button onClick={onAddEventClick}>Add Event</button>
        <button onClick={onGroupsClick}>Edit Groups</button>
      </div>
      <div className="right-buttons">
        {settings?.cloudSync && (
          syncStatus === 'unsaved' ? (
            <button className="sync-button" onClick={onSyncClick}>Save</button>
          ) : (
            <span className="sync-status">Saved ✓</span>
          )
        )}
        <button onClick={onSettingsClick}>
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}

export default TopBar; 