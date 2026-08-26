import { useState } from 'react';
import Modal from '../ui/Modal';
import { shareLink } from '../../data/tableCode';
import './ShareDialog.css';

/**
 * Sharing in one place.
 *
 * v1 buried this behind Settings → a "Cloud Sync" accordion → a checkbox, then
 * showed the code as plain text to be read aloud and retyped, even though the
 * app already understood `/CODE` links.
 */
function ShareDialog({ code, sync, actions, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const createLink = async () => {
    setBusy(true);
    setError(null);
    try {
      await actions.share();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!code) {
    return (
      <Modal
        title="Share this table"
        description="Right now this table only exists in this browser."
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn" onClick={onClose}>Not now</button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={createLink}
              disabled={busy || !sync.configured}
            >
              {busy ? 'Creating…' : 'Create share link'}
            </button>
          </>
        }
      >
        <ul className="share-points">
          <li>Everyone with the link sees edits as they happen.</li>
          <li>Two people can mark attendance at the same time without overwriting each other.</li>
          <li>Your copy keeps working offline and syncs when you reconnect.</li>
        </ul>

        <p className="hint">
          <strong>Anyone with the link can edit.</strong> There is no sign-in — treat the link the
          way you would treat an unlisted document.
        </p>

        {!sync.configured && (
          <p className="error-text">
            Sharing is not configured for this deployment. Add the Firebase keys to
            <code> .env</code> and rebuild.
          </p>
        )}
        {error && <p className="error-text">{error}</p>}
      </Modal>
    );
  }

  return (
    <Modal
      title="Share this table"
      description="Anyone with this link can open and edit the table."
      onClose={onClose}
      footer={<button type="button" className="btn btn--primary" onClick={onClose}>Done</button>}
    >
      <CopyField label="Edit link" value={shareLink(code)} />
      <CopyField label="View-only link" value={shareLink(code, { viewOnly: true })} />

      <div className="share-code">
        <span className="hint">Or read out the code</span>
        <strong className="share-code__value">{code}</strong>
      </div>

      <p className="hint">
        View-only hides the editing controls for whoever opens it. It is a courtesy, not a
        permission — the link still grants access to the data, so only send it to people you would
        let edit anyway.
      </p>
    </Modal>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API needs a secure context; select the text as a fallback.
      const input = document.getElementById(`copy-${label}`);
      input?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <label className="field">
      <span>{label}</span>
      <div className="copy-field">
        <input id={`copy-${label}`} className="input" readOnly value={value} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </label>
  );
}

export default ShareDialog;
