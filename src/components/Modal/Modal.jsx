import React from 'react';
import './Modal.css';

function Modal({ children, onClose, title, className = '', preventOutsideClose = false }) {
  const handleOverlayClick = (e) => {
    if (!preventOutsideClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal-content ${className}`}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export default Modal; 