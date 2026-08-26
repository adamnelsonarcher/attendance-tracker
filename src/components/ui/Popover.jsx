import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './Popover.css';

const MARGIN = 8;

/**
 * A floating panel anchored to a point — right-click menus and dropdowns.
 *
 * Clamps itself to the viewport after measuring, which the old context menus
 * did not: opening one near the right edge or the bottom of a long table put
 * half of it off-screen with no way to scroll to it.
 */
function Popover({ x, y, onClose, children, align = 'start', className = '' }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ left: x, top: y, ready: false });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();

    let left = align === 'end' ? x - rect.width : x;
    let top = y;

    if (left + rect.width > window.innerWidth - MARGIN) left = window.innerWidth - rect.width - MARGIN;
    if (top + rect.height > window.innerHeight - MARGIN) top = y - rect.height;
    setPosition({ left: Math.max(MARGIN, left), top: Math.max(MARGIN, top), ready: true });
  }, [x, y, align]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="popover__backdrop" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        className={`popover ${className}`}
        style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
        role="menu"
      >
        {children}
      </div>
    </>
  );
}

export default Popover;
