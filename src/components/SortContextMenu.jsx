import React from 'react';

function SortContextMenu({ x, y, onSort, onClose }) {
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
        <div onClick={() => onSort('firstName', 'asc')}>Sort by First Name ↓</div>
        <div onClick={() => onSort('firstName', 'desc')}>Sort by First Name ↑</div>
        <div onClick={() => onSort('lastName', 'asc')}>Sort by Last Name ↓</div>
        <div onClick={() => onSort('lastName', 'desc')}>Sort by Last Name ↑</div>
        <div onClick={() => onSort('none')}>Original Order</div>
      </div>
    </>
  );
}

export default SortContextMenu; 