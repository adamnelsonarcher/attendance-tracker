import { useState } from 'react';
import Popover from '../ui/Popover';

/** Rename or remove one person. v1 had no way to do either from the table. */
function PersonMenu({ x, y, person, dispatch, onClose }) {
  const [mode, setMode] = useState('root');
  const [name, setName] = useState(person.name);

  return (
    <Popover x={x} y={y} onClose={onClose}>
      {mode === 'root' && (
        <>
          <div className="menu-label">{person.name}</div>
          <button type="button" className="menu-item" onClick={() => setMode('rename')}>
            Rename
          </button>
          <div className="menu-divider" />
          <button type="button" className="menu-item menu-item--danger" onClick={() => setMode('confirm')}>
            Remove from table
          </button>
        </>
      )}

      {mode === 'rename' && (
        <form
          className="menu-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) {
              dispatch({ type: 'people/rename', id: person.id, name: name.trim() });
              onClose();
            }
          }}
        >
          <label className="field">
            <span>Name</span>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="menu-form__row">
            <button type="submit" className="btn btn--primary btn--small">Save</button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </form>
      )}

      {mode === 'confirm' && (
        <div className="menu-form">
          <p className="hint">
            Remove <strong>{person.name}</strong> and all of their attendance? This cannot be undone.
          </p>
          <div className="menu-form__row">
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => {
                dispatch({ type: 'people/remove', id: person.id });
                onClose();
              }}
            >
              Remove
            </button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Cancel</button>
          </div>
        </div>
      )}
    </Popover>
  );
}

export default PersonMenu;
