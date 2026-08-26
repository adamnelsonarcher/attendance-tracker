import { useState } from 'react';
import Modal from '../ui/Modal';
import { parseTableCode } from '../../data/tableCode';

/**
 * Opens someone else's table. Nothing is replaced — the table you had stays in
 * the switcher — so this no longer needs v1's "this will replace your data"
 * confirmation.
 */
function JoinDialog({ join, onClose }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const code = parseTableCode(input);

  const submit = async (event) => {
    event.preventDefault();
    if (!code) {
      setError('That does not look like a table code or a share link.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await join.run(code);
      if (ok) onClose();
      else setError(`No table found with the code ${code}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Open a shared table"
      description="Paste a share link or type the six-character code."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="join-table" className="btn btn--primary" disabled={busy || !code}>
            {busy ? 'Opening…' : 'Open table'}
          </button>
        </>
      }
    >
      <form id="join-table" onSubmit={submit}>
        <label className="field">
          <span className="visually-hidden">Table code or link</span>
          <input
            className="input"
            autoFocus
            value={input}
            placeholder="ABC123 or https://…/ABC123"
            onChange={(event) => {
              setInput(event.target.value);
              setError(null);
            }}
          />
        </label>
      </form>

      {code && <p className="hint">Will open table {code}.</p>}
      {error && <p className="error-text">{error}</p>}
      <p className="hint">Your current table stays in this browser — switch back any time.</p>
    </Modal>
  );
}

export default JoinDialog;
