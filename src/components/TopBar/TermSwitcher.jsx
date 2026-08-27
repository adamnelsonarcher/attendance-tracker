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
  const [form, setForm] = useState(() => ({ name: '', ...defaultTermWindow() }));

  const counts = terms.length;

  if (mode === 'new') {
    return (
      <Popover x={x} y={y} onClose={onClose}>
        <form
          className="menu-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) return;
            dispatch({
              type: 'terms/add',
              name: form.name.trim(),
              startDate: form.startDate,
              endDate: form.endDate,
            });
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
              Add term
            </button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </form>
      </Popover>
    );
  }

  return (
    <Popover x={x} y={y} onClose={onClose}>
      <div className="menu-label">Term</div>

      {terms.map((term) => (
        <button
          key={term.id}
          type="button"
          className="menu-item"
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
