import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { matchNames } from '../../data/selectors';
import './BulkAssignDialog.css';

/**
 * Marks a column from a pasted sign-in sheet.
 *
 * The match is shown before anything is applied. v1 applied first and reported
 * failures in an `alert()` afterwards, so a typo silently marked the wrong
 * person and there was no way to see it had happened.
 */
function BulkAssignDialog({ event, people, statuses, onApply, onClose }) {
  const [text, setText] = useState('');
  const [statusId, setStatusId] = useState(statuses[0]?.id || '');

  const names = useMemo(
    () => text.split(/[\n,;\t]/).map((name) => name.trim()).filter(Boolean),
    [text]
  );
  const result = useMemo(() => matchNames(names, people), [names, people]);

  const apply = () => {
    onApply(
      result.matched.map((person) => ({ personId: person.id, eventId: event.id, statusId }))
    );
  };

  return (
    <Modal
      title={`Mark attendance for ${event.name}`}
      description="Paste names from a sign-in sheet. Nothing is applied until you press Mark."
      size="large"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={apply}
            disabled={result.matched.length === 0}
          >
            Mark {result.matched.length || ''} {result.matched.length === 1 ? 'person' : 'people'}
          </button>
        </>
      }
    >
      <div className="bulk">
        <div className="bulk__input">
          <label className="field">
            <span>Names — one per line, or separated by commas</span>
            <textarea
              className="textarea"
              rows={12}
              value={text}
              placeholder={'Avery Chen\nJordan Blake\nRiley Okafor'}
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Mark them as</span>
            <select className="select" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>{status.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="bulk__preview scroll-area">
          {names.length === 0 && <p className="hint">Matches will appear here as you paste.</p>}

          {result.matched.length > 0 && (
            <section className="bulk__section">
              <h3 className="bulk__heading bulk__heading--ok">
                Will be marked ({result.matched.length})
              </h3>
              <ul className="bulk__list">
                {result.matched.map((person) => (
                  <li key={person.id}>{person.name}</li>
                ))}
              </ul>
            </section>
          )}

          {result.ambiguous.length > 0 && (
            <section className="bulk__section">
              <h3 className="bulk__heading bulk__heading--warn">
                Matched more than one person ({result.ambiguous.length})
              </h3>
              <ul className="bulk__list">
                {result.ambiguous.map((entry) => (
                  <li key={entry.query}>
                    <strong>{entry.query}</strong> — {entry.candidates.map((c) => c.name).join(', ')}
                  </li>
                ))}
              </ul>
              <p className="hint">These are skipped. Use a fuller name to pick one.</p>
            </section>
          )}

          {result.unmatched.length > 0 && (
            <section className="bulk__section">
              <h3 className="bulk__heading bulk__heading--bad">
                Not on the roster ({result.unmatched.length})
              </h3>
              <ul className="bulk__list">
                {result.unmatched.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default BulkAssignDialog;
