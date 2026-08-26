import { useState } from 'react';
import { clampCredit } from '../../data/model';
import './StatusEditor.css';

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'status';

/**
 * Attendance statuses and what each one is worth.
 *
 * "Doesn't count" (credit `null`) removes the event from that person's score
 * entirely — numerator and denominator — which is different from a credit of 0,
 * where the event still counts against them.
 */
function StatusEditor({ statuses, attendance, onChange }) {
  const [newName, setNewName] = useState('');

  const usageOf = (id) => Object.values(attendance).filter((value) => value === id).length;

  const update = (id, changes) =>
    onChange(statuses.map((status) => (status.id === id ? { ...status, ...changes } : status)));

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    let id = slug(name);
    const taken = new Set(statuses.map((status) => status.id));
    while (taken.has(id)) id = `${slug(name)}-${Math.random().toString(36).slice(2, 5)}`;
    onChange([...statuses, { id, name, credit: 1, color: '#e9ecef' }]);
    setNewName('');
  };

  const remove = (status) => {
    const used = usageOf(status.id);
    const message = used
      ? `Delete “${status.name}”? ${used} cell${used === 1 ? '' : 's'} using it will be cleared.`
      : `Delete “${status.name}”?`;
    if (window.confirm(message)) onChange(statuses.filter((entry) => entry.id !== status.id));
  };

  return (
    <div className="statuses">
      <div className="statuses__head">
        <span>Status</span>
        <span>Counts as</span>
        <span />
        <span />
      </div>

      {statuses.map((status) => {
        const ignored = status.credit === null;
        return (
          <div key={status.id} className="status-row">
            <input
              className="input"
              value={status.name}
              aria-label="Status name"
              onChange={(event) => update(status.id, { name: event.target.value })}
            />

            <div className="status-row__credit">
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.25"
                aria-label={`Credit for ${status.name}`}
                value={ignored ? '' : status.credit}
                disabled={ignored}
                onChange={(event) => update(status.id, { credit: clampCredit(event.target.value) })}
              />
              <label className="status-row__ignore">
                <input
                  type="checkbox"
                  checked={ignored}
                  onChange={(event) => update(status.id, { credit: event.target.checked ? null : 1 })}
                />
                <span>Doesn’t count</span>
              </label>
            </div>

            <input
              type="color"
              className="status-row__color"
              value={status.color}
              aria-label={`Colour for ${status.name}`}
              onChange={(event) => update(status.id, { color: event.target.value })}
            />

            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => remove(status)}
              disabled={statuses.length <= 1}
              aria-label={`Delete ${status.name}`}
            >
              ✕
            </button>
          </div>
        );
      })}

      <form
        className="statuses__add"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          className="input"
          placeholder="New status name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button type="submit" className="btn" disabled={!newName.trim()}>Add status</button>
      </form>

      <p className="hint">
        A credit of 1 is full attendance and 0 counts against the score. “Doesn’t count” leaves the
        event out of that person’s score altogether — use it for excused absences.
      </p>
    </div>
  );
}

export default StatusEditor;
