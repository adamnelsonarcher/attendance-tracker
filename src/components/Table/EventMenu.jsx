import { useState } from 'react';
import Popover from '../ui/Popover';
import BulkAssignDialog from './BulkAssignDialog';

/**
 * Right-click menu for an event column. One `mode` drives which panel shows,
 * instead of v1's six independent `isRenaming` / `isEditingDates` / … booleans
 * that could all be true at once.
 */
function EventMenu({ x, y, event, table, dispatch, visiblePeople, onClose }) {
  const [mode, setMode] = useState('root');
  const [draft, setDraft] = useState({
    name: event.name,
    weight: String(event.weight),
    startDate: event.startDate || '',
    endDate: event.endDate || '',
  });

  const update = (changes) => {
    dispatch({ type: 'events/update', id: event.id, changes });
    onClose();
  };

  if (mode === 'bulk') {
    return (
      <BulkAssignDialog
        event={event}
        people={table.people}
        statuses={table.settings.statuses}
        onApply={(entries) => {
          dispatch({ type: 'attendance/setMany', entries });
          onClose();
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Popover x={x} y={y} onClose={onClose}>
      {mode === 'root' && (
        <>
          <div className="menu-label">{event.name}</div>
          <button type="button" className="menu-item" onClick={() => setMode('rename')}>
            Rename
          </button>
          <button type="button" className="menu-item" onClick={() => setMode('details')}>
            Dates and weight
          </button>
          <button type="button" className="menu-item" onClick={() => setMode('move')}>
            Move to folder<span className="menu-item__hint">›</span>
          </button>

          <div className="menu-divider" />

          <button type="button" className="menu-item" onClick={() => setMode('bulk')}>
            Mark from a list of names…
          </button>
          <button type="button" className="menu-item" onClick={() => setMode('fill')}>
            Fill blanks with<span className="menu-item__hint">›</span>
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              dispatch({
                type: 'attendance/clearColumn',
                eventId: event.id,
                personIds: visiblePeople.map((person) => person.id),
              });
              onClose();
            }}
          >
            Clear this column
            {/* Says which rows it affects, because filters change the answer. */}
            <span className="menu-item__hint">{visiblePeople.length} shown</span>
          </button>

          <div className="menu-divider" />

          <button
            type="button"
            className="menu-item menu-item--danger"
            onClick={() => {
              dispatch({ type: 'events/remove', id: event.id });
              onClose();
            }}
          >
            Delete event
          </button>
        </>
      )}

      {mode === 'rename' && (
        <form
          className="menu-form"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            if (draft.name.trim()) update({ name: draft.name.trim() });
          }}
        >
          <label className="field">
            <span>Event name</span>
            <input
              className="input"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="menu-form__row">
            <button type="submit" className="btn btn--primary btn--small">Save</button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </form>
      )}

      {mode === 'details' && (
        <form
          className="menu-form"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            update({
              startDate: draft.startDate || null,
              endDate: draft.endDate || null,
              weight: draft.weight,
            });
          }}
        >
          <label className="field">
            <span>Starts</span>
            <input
              className="input"
              type="date"
              autoFocus
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Ends (optional)</span>
            <input
              className="input"
              type="date"
              min={draft.startDate || undefined}
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Weight</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              value={draft.weight}
              onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
            />
          </label>
          <div className="menu-form__row">
            <button type="submit" className="btn btn--primary btn--small">Save</button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </form>
      )}

      {mode === 'move' && (
        <>
          <div className="menu-label">Move to</div>
          {table.folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="menu-item"
              disabled={folder.id === event.folderId}
              onClick={() => update({ folderId: folder.id })}
            >
              {folder.name}
              {folder.id === event.folderId && <span className="menu-item__hint">current</span>}
            </button>
          ))}
          <button
            type="button"
            className="menu-item"
            disabled={event.folderId === null}
            onClick={() => update({ folderId: null })}
          >
            No folder
          </button>
          <div className="menu-divider" />
          <button type="button" className="menu-item" onClick={() => setMode('root')}>Back</button>
        </>
      )}

      {mode === 'fill' && (
        <>
          <div className="menu-label">Fill blanks with</div>
          {table.settings.statuses.map((status) => (
            <button
              key={status.id}
              type="button"
              className="menu-item"
              onClick={() => {
                dispatch({
                  type: 'attendance/fillColumn',
                  eventId: event.id,
                  statusId: status.id,
                  personIds: visiblePeople.map((person) => person.id),
                });
                onClose();
              }}
            >
              <span>
                <span className="status-swatch" style={{ background: status.color }} />
                {status.name}
              </span>
            </button>
          ))}
          <div className="menu-divider" />
          <button type="button" className="menu-item" onClick={() => setMode('root')}>Back</button>
        </>
      )}
    </Popover>
  );
}

export default EventMenu;
