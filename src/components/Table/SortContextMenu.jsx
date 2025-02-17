import React from 'react';
import './SortContextMenu.css';

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
        <div onClick={() => {
          onSort('firstName', 'asc');
          onClose();
        }}>Sort by First Name (A → Z)</div>
        <div onClick={() => {
          onSort('firstName', 'desc');
          onClose();
        }}>Sort by First Name (Z → A)</div>
        <div onClick={() => {
          onSort('lastName', 'asc');
          onClose();
        }}>Sort by Last Name (A → Z)</div>
        <div onClick={() => {
          onSort('lastName', 'desc');
          onClose();
        }}>Sort by Last Name (Z → A)</div>
        <div onClick={() => {
          onSort('none');
          onClose();
        }}>Original Order</div>
      </div>
    </>
  );
}

export default SortContextMenu; 