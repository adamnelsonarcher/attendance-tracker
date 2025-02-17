import React from 'react';
import './TopBar.css';
import AddEventForm from './AddEventForm/AddEventForm';
import AddPersonForm from './AddPersonForm/AddPersonForm';

function TopBar({ onSettingsClick, onAddPersonClick, onAddEventClick }) {
  return (
    <div className="top-bar">
      <button 
        className="settings-button"
        onClick={onSettingsClick}
      >
        ⚙️ Settings
      </button>
      <div className="action-buttons">
        <button onClick={onAddPersonClick}>Add Person</button>
        <button onClick={onAddEventClick}>Add Event</button>
      </div>
    </div>
  );
}

export default TopBar; 