import { useState } from 'react';
import Popover from '../ui/Popover';
import { ALL_TERMS } from '../../data/selectors';
import { defaultTermWindow } from '../../data/recurrence';
import { formatDateRange } from '../../data/model';

/**
 * Moves between semesters.
 *
 * The spreadsheets kept a tab per semester, which meant the roster was retyped
 * each August and no one could see a student across terms. Here a term is a
 * lens over one continuous table, so switching is a filter, not a new file.
 */
function TermSwitcher({ x, y, terms, activeTermId, onSelect, dispatch, readOnly, onClose }) {
  const [mode, setMode] = useState('root');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => ({ name: '', ...defaultTermWindow() }));

  const counts = terms.length;

  if (mode === 'new' || mode === 'edit') {
    const isEdit = mode === 'edit';
    return (
      <Popover x={x} y={y} onClose={onClose}>
        <form
          className="menu-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) return;
            if (isEdit) {
              dispatch({
                type: 'terms/update',
                id: editing,
                changes: {
                  name: form.name.trim(),
                  startDate: form.startDate || null,
                  endDate: form.endDate || null,
                },
              });
            } else {
              dispatch({
                type: 'terms/add',
                name: form.name.trim(),
                startDate: form.startDate,
                endDate: form.endDate,
              });
            }
            onClose();
          }}
        >
          <label className="field">
            <span>Term name</span>
            <input
              className="input"
              autoFocus
              placeholder="Fall 2026"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>First day</span>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Last day</span>
            <input
              className="input"
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          </label>
          <div className="menu-form__row">
            <button type="submit" className="btn btn--primary btn--small" disabled={!form.name.trim()}>
              {isEdit ? 'Save' : 'Add term'}
            </button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
            {isEdit && (
              <button
                type="button"
                className="btn btn--danger btn--small"
                onClick={() => {
                  // The sessions survive; they just stop belonging to a term.
                  if (window.confirm('Remove this term? Its sessions stay, without a term.')) {
                    dispatch({ type: 'terms/remove', id: editing });
                    onClose();
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </Popover>
    );
  }

  return (
    <Popover x={x} y={y} onClose={onClose}>
      <div className="menu-label">Term</div>

      {terms.map((term) => (
        <div key={term.id} className="term-row">
          <button
            type="button"
            className="menu-item term-row__select"
            onClick={() => {
              onSelect(term.id);
              onClose();
            }}
          >
            <span>{term.name}</span>
            <span className="menu-item__hint">
              {term.id === activeTermId ? '✓' : formatDateRange(term.startDate, term.endDate)}
            </span>
          </button>
          {!readOnly && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              aria-label={`Edit ${term.name}`}
              onClick={() => {
                setForm({ name: term.name, startDate: term.startDate || '', endDate: term.endDate || '' });
                setEditing(term.id);
                setMode('edit');
              }}
            >
              ✎
            </button>
          )}
        </div>
      ))}

      {counts === 0 && <p className="hint menu-form">No terms yet. Add one to group a semester's events.</p>}

      <div className="menu-divider" />

      <button
        type="button"
        className="menu-item"
        onClick={() => {
          onSelect(ALL_TERMS);
          onClose();
        }}
      >
        <span>All terms</span>
        <span className="menu-item__hint">{activeTermId === ALL_TERMS ? '✓' : 'everything'}</span>
      </button>

      {!readOnly && (
        <>
          <div className="menu-divider" />
          <button type="button" className="menu-item" onClick={() => setMode('new')}>
            New term…
          </button>
        </>
      )}
    </Popover>
  );
}

export default TermSwitcher;
