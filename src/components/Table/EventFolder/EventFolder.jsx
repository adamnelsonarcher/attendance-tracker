import React from 'react';

function EventFolder({ folder, events, onToggle, isOpen }) {
  return (
    <th colSpan={events.length} className="event-folder">
      <div className="folder-header" onClick={onToggle}>
        <span className="folder-icon">{isOpen ? '▼' : '▶'}</span>
        {folder}
      </div>
    </th>
  );
}

export default EventFolder; 