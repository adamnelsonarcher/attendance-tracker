import React, { useState } from 'react';
import './FolderContextMenu.css';

function FolderContextMenu({ x, y, onRename, onClose }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');

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
        {isRenaming ? (
          <div className="context-menu-item rename-container">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  onRename(newName.trim());
                  onClose();
                }
                if (e.key === 'Escape') {
                  setIsRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button onClick={() => {
              if (newName.trim()) {
                onRename(newName.trim());
                onClose();
              }
            }}>✓</button>
          </div>
        ) : (
          <>
            <button className="context-menu-item" onClick={() => setIsRenaming(true)}>
              Rename Folder
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default FolderContextMenu; 