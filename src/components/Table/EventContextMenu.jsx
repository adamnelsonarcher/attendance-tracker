import React, { useState } from 'react';
import './EventContextMenu.css';

function EventContextMenu({ x, y, onMove, onRemove, onClose, folders }) {
  const [showFolders, setShowFolders] = useState(false);

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
        <div 
          className="context-menu-item has-submenu"
          onMouseEnter={() => setShowFolders(true)}
          onMouseLeave={() => setShowFolders(false)}
        >
          <span>Move to folder</span>
          {showFolders && (
            <div className="submenu">
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
          )}
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