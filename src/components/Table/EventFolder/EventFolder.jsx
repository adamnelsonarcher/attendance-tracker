import React from 'react';
import './EventFolder.css';

function EventFolder({ folder, events, onFolderClick, onEventHeaderClick, sorting }) {
  const folderEvents = events.filter(event => event.folder === folder.id);
  
  return (
    <>
      <th 
        colSpan={folder.isOpen ? folderEvents.length : 1} 
        className="event-folder"
      >
        <div 
          className="folder-header"
          onClick={() => onFolderClick(folder.id)}
        >
          <span className="folder-icon">
            {folder.isOpen ? '▼' : '▶'}
          </span>
          {folder.name}
        </div>
      </th>
      {folder.isOpen && folderEvents.map(event => (
        <th 
          key={event.id}
          onClick={() => onEventHeaderClick(event.id)}
          className={`event-header ${sorting.eventId === event.id ? 'sorted' : ''}`}
        >
          {event.name}
        </th>
      ))}
    </>
  );
}

export default EventFolder; 