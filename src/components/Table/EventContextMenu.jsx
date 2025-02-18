import React, { useState } from 'react';
import './EventContextMenu.css';

function EventContextMenu({ x, y, onMove, onRemove, onClose, folders, onSetAll, onRename }) {
  const [showFolders, setShowFolders] = useState(false);
  const [showSetAll, setShowSetAll] = useState(false);
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
            <button 
              onClick={() => {
                if (newName.trim()) {
                  onRename(newName.trim());
                  onClose();
                }
              }}
            >
              ✓
            </button>
          </div>
        ) : (
          <button 
            className="context-menu-item"
            onClick={() => setIsRenaming(true)}
          >
            Rename
          </button>
        )}
        <div 
          className="context-menu-item has-submenu"
          onMouseEnter={() => {
            setShowFolders(true);
            setShowSetAll(false);
          }}
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
        <div 
          className="context-menu-item has-submenu"
          onMouseEnter={() => {
            setShowSetAll(true);
            setShowFolders(false);
          }}
          onMouseLeave={() => setShowSetAll(false)}
        >
          <span>Set all</span>
          {showSetAll && (
            <div className="submenu">
              <button 
                className="context-menu-item"
                onClick={() => {
                  onSetAll('Absent');
                  onClose();
                }}
              >
                unselected to absent
              </button>
              <button 
                className="context-menu-item"
                onClick={() => {
                  onSetAll('Present');
                  onClose();
                }}
              >
                unselected to present
              </button>
              <button 
                className="context-menu-item"
                onClick={() => {
                  onSetAll('Late');
                  onClose();
                }}
              >
                unselected to late
              </button>
              <button 
                className="context-menu-item"
                onClick={() => {
                  onSetAll('DNA');
                  onClose();
                }}
              >
                unselected to N/A
              </button>
              <button 
                className="context-menu-item"
                onClick={() => {
                  onSetAll('reset');
                  onClose();
                }}
              >
                Reset all in this column
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