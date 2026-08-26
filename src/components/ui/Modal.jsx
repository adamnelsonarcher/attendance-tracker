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

  // Held in a ref so a caller passing an inline `onClose` cannot re-run the
  // effect below on every render — which would keep yanking focus back out of
  // whatever the user is typing into.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    openerRef.current = document.activeElement;

    // Search the body, not the whole panel: the header's ✕ comes first in the
    // DOM, so focusing the panel's first focusable landed on a dismiss control.
    // Space or Enter then threw away everything the user had entered.
    const body = panelRef.current?.querySelector('.modal__body');
    const focusTarget =
      body?.querySelector('[autofocus]') ||
      body?.querySelector('input:not([type="hidden"]), select, textarea') ||
      body?.querySelector('button, [tabindex]:not([tabindex="-1"])') ||
      panelRef.current;
    focusTarget?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, []);

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
        tabIndex={-1}
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
