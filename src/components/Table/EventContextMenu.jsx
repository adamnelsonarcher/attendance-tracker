import React from 'react';
import './EventContextMenu.css';

function EventContextMenu({ x, y, onMove, onRemove, onClose, folders }) {
  const menuStyle = {
    position: 'fixed',
    top: `${y}px`,
    left: `${x}px`,
    zIndex: 1000,
  };

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose}></div>
      <div className="context-menu" style={menuStyle}>
        <div className="context-menu-group">
          <div className="context-menu-header">Move to folder:</div>
          {folders.map(folder => (
            <button 
              key={folder.id}
              className="context-menu-item"
              onClick={() => {
                onMove(folder.id);
                onClose();
              }}
            >
              {folder.name}
            </button>
          ))}
          <button 
            className="context-menu-item"
            onClick={() => {
              onMove('no-folder');
              onClose();
            }}
          >
            No Folder
          </button>
        </div>
        <div className="context-menu-divider"></div>
        <button 
          className="context-menu-item delete"
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          Delete Event
        </button>
      </div>
    </>
  );
}

export default EventContextMenu; 