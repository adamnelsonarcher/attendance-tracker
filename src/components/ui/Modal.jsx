import { useEffect, useRef } from 'react';
import './Modal.css';

/**
 * A dialog. Closes on Escape and on a click outside, restores focus to whatever
 * opened it, and moves focus inside on open so keyboard users are not stranded
 * at the top of the page.
 */
function Modal({
  title,
  description,
  children,
  footer,
  onClose,
  size = 'medium',
  /** Off for dialogs holding unsaved edits, so a stray click cannot discard them. */
  dismissOnOverlay = true,
}) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    const focusTarget = panelRef.current?.querySelector(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
    );
    focusTarget?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissOnOverlay && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal__panel modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
      >
        <header className="modal__header">
          <div>
            <h2>{title}</h2>
            {description && <p className="hint">{description}</p>}
          </div>
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="modal__body scroll-area">{children}</div>

        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

export default Modal;
