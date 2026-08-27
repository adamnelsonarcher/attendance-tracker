import { useState } from 'react';
import Popover from '../ui/Popover';

function FolderMenu({ x, y, folder, groups = [], dispatch, onClose }) {
  const [mode, setMode] = useState('root');
  const [name, setName] = useState(folder.name);

  return (
    <Popover x={x} y={y} onClose={onClose}>
      {mode === 'root' ? (
        <>
          <div className="menu-label">{folder.name}</div>
          <button type="button" className="menu-item" onClick={() => setMode('rename')}>
            Rename folder
          </button>
          <button type="button" className="menu-item" onClick={() => setMode('cohort')}>
            Who attends
            <span className="menu-item__hint">
              {groups.find((group) => group.id === folder.groupId)?.name || 'everyone'}
            </span>
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              dispatch({ type: 'folders/toggle', id: folder.id });
              onClose();
            }}
          >
            {folder.isOpen ? 'Collapse' : 'Expand'}
          </button>
          <div className="menu-divider" />
          <button
            type="button"
            className="menu-item menu-item--danger"
            onClick={() => {
              dispatch({ type: 'folders/remove', id: folder.id });
              onClose();
            }}
          >
            Delete folder
            {/* Only the grouping goes; the events move out to the ungrouped
                section. v1 deleted a folder's events along with it. */}
            <span className="menu-item__hint">keeps events</span>
          </button>
        </>
      ) : mode === 'cohort' ? (
        <>
          <div className="menu-label">Who attends {folder.name}</div>
          {/* Naming a group here is what stops everyone else getting a cell
              under these sessions, and being scored against them. */}
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              dispatch({ type: 'folders/setGroup', id: folder.id, groupId: null });
              onClose();
            }}
          >
            <span>Everyone</span>
            <span className="menu-item__hint">{!folder.groupId ? '✓' : 'open event'}</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="menu-item"
              onClick={() => {
                dispatch({ type: 'folders/setGroup', id: folder.id, groupId: group.id });
                onClose();
              }}
            >
              <span>
                <span className="status-swatch" style={{ background: group.color }} />
                {group.name}
              </span>
              <span className="menu-item__hint">
                {folder.groupId === group.id ? '✓' : `${group.memberIds.length}`}
              </span>
            </button>
          ))}
          {groups.length === 0 && <p className="hint menu-form">No groups yet.</p>}
          <div className="menu-divider" />
          <button type="button" className="menu-item" onClick={() => setMode('root')}>Back</button>
        </>
      ) : (
        <form
          className="menu-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) {
              dispatch({ type: 'folders/rename', id: folder.id, name: name.trim() });
              onClose();
            }
          }}
        >
          <label className="field">
            <span>Folder name</span>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="menu-form__row">
            <button type="submit" className="btn btn--primary btn--small">Save</button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </form>
      )}
    </Popover>
  );
}

export default FolderMenu;
