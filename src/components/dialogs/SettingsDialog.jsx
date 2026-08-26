import { useState } from 'react';
import Modal from '../ui/Modal';
import StatusEditor from './StatusEditor';
import { APP_VERSION } from '../../version';
import './SettingsDialog.css';

const DISPLAY_OPTIONS = [
  { key: 'colorCells', label: 'Colour the attendance cells', hint: 'Each cell takes its status colour.' },
  { key: 'colorDropdown', label: 'Colour the dropdown options', hint: 'Browser support for this varies.' },
  { key: 'highlightHover', label: 'Highlight the row and column under the cursor' },
  { key: 'stickyColumns', label: 'Pin the name and score columns', hint: 'Keeps them visible while scrolling sideways.' },
  { key: 'showTitle', label: 'Show the page title' },
];

function SettingsDialog({ table, dispatch, tableId, tableName, code, sync, actions, readOnly, onClose }) {
  const [name, setName] = useState(tableName);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadState, setUploadState] = useState(null);
  const { settings } = table;

  const set = (changes) => dispatch({ type: 'settings/update', changes });

  const forceUpload = async () => {
    if (!window.confirm('Overwrite the shared copy with this browser’s data? Anything another device has changed and not yet sent will be lost.')) {
      return;
    }
    setUploadState('working');
    try {
      await sync.pushAll();
      setUploadState('done');
    } catch (error) {
      setUploadState(error.message || 'Upload failed');
    }
  };

  const clearTable = () => {
    if (!window.confirm('Delete every person, event and mark in this table? This cannot be undone.')) return;
    dispatch({ type: 'table/clear' });
    onClose();
  };

  return (
    <Modal
      title="Settings"
      size="large"
      onClose={onClose}
      footer={<button type="button" className="btn btn--primary" onClick={onClose}>Done</button>}
    >
      <section className="settings-section">
        <h3>This table</h3>
        <label className="field">
          <span>Name (only you see this)</span>
          <input
            className="input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              actions.rename(event.target.value);
            }}
          />
        </label>
        {code && <p className="hint">Shared as code <strong>{code}</strong>.</p>}
      </section>

      {readOnly && (
        <p className="hint">
          You opened this table from a view-only link, so the shared settings below cannot be
          changed here. Open the edit link to change them.
        </p>
      )}

      <section className="settings-section">
        <h3>Scoring</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.countUnmarkedAsAbsent}
            disabled={readOnly}
            onChange={(event) => set({ countUnmarkedAsAbsent: event.target.checked })}
          />
          <span>
            <span className="checkbox-row__label">Count unmarked cells as missed</span>
            <span className="checkbox-row__hint">
              {settings.countUnmarkedAsAbsent
                ? 'An empty cell counts against the score, so people who were never marked score 0%.'
                : 'Empty cells are ignored, so a score only reflects events that were actually marked.'}
            </span>
          </span>
        </label>

        <h3 className="settings-subhead">Statuses</h3>
        <p className="hint">
          Statuses are part of the table, so everyone sharing it sees the same ones.
        </p>
        {readOnly ? (
          <ul className="status-summary">
            {settings.statuses.map((status) => (
              <li key={status.id}>
                <span className="status-swatch" style={{ background: status.color }} />
                {status.name}
                <span className="hint">
                  {status.credit === null ? 'does not count' : `counts as ${status.credit}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <StatusEditor
            statuses={settings.statuses}
            attendance={table.attendance}
            onChange={(statuses) => dispatch({ type: 'settings/setStatuses', statuses })}
          />
        )}
      </section>

      <section className="settings-section">
        <h3>Display</h3>
        <p className="hint">These are yours alone — they travel with the table but not with the people you share it with.</p>
        {DISPLAY_OPTIONS.map((option) => (
          <label key={option.key} className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(settings[option.key])}
              disabled={readOnly}
              onChange={(event) => set({ [option.key]: event.target.checked })}
            />
            <span>
              <span className="checkbox-row__label">{option.label}</span>
              {option.hint && <span className="checkbox-row__hint">{option.hint}</span>}
            </span>
          </label>
        ))}
      </section>

      <section className="settings-section">
        <button
          type="button"
          className="settings-disclosure"
          onClick={() => setShowAdvanced((current) => !current)}
          aria-expanded={showAdvanced}
        >
          Advanced {showAdvanced ? '▾' : '▸'}
        </button>

        {showAdvanced && (
          <div className="settings-danger">
            <div>
              <strong>Force upload to the shared copy</strong>
              <p className="hint">
                {code
                  ? 'Replaces every part of the shared table with what is in this browser. Sync does this on its own — this is only for when the two have drifted apart.'
                  : 'Only available once the table is shared.'}
              </p>
              {uploadState === 'done' && <p className="hint">Uploaded.</p>}
              {uploadState && uploadState !== 'done' && uploadState !== 'working' && (
                <p className="error-text">{uploadState}</p>
              )}
            </div>
            <button
              type="button"
              className="btn"
              onClick={forceUpload}
              disabled={!code || uploadState === 'working'}
            >
              {uploadState === 'working' ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        )}
      </section>

      <section className="settings-section settings-section--danger">
        <h3>Danger zone</h3>
        <div className="settings-danger">
          <div>
            <strong>Clear this table</strong>
            <p className="hint">Removes all people, events and marks but keeps your statuses.</p>
          </div>
          <button type="button" className="btn btn--danger" onClick={clearTable} disabled={readOnly}>
            Clear
          </button>
        </div>

        <div className="settings-danger">
          <div>
            <strong>Remove from this browser</strong>
            <p className="hint">
              {code
                ? 'Forgets your local copy. The shared table stays available to anyone with the link.'
                : 'Deletes this table. It is not shared, so this cannot be undone.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              const message = code
                ? 'Remove this table from this browser? You can open it again with the link.'
                : 'Delete this table? It is not shared anywhere, so this cannot be undone.';
              if (window.confirm(message)) {
                actions.forget(tableId);
                onClose();
              }
            }}
          >
            Remove
          </button>
        </div>
      </section>

      <p className="hint settings-credits">
        Attendance Tracker {APP_VERSION} — built by{' '}
        <a href="https://nelsonarcher.com" target="_blank" rel="noopener noreferrer">Adam Nelson-Archer</a>
        {' · '}
        <a
          href="https://github.com/adamnelsonarcher/attendance-tracker/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          changelog
        </a>
      </p>
    </Modal>
  );
}

export default SettingsDialog;
