import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import StatusEditor from './StatusEditor';
import { MAX_TABLE_NAME, normalizeTable } from '../../data/model';
import { download, exportName, toCsv, toJson } from '../../data/exportTable';
import { APP_VERSION } from '../../version';
import './SettingsDialog.css';

const DISPLAY_OPTIONS = [
  { key: 'colorCells', label: 'Colour the attendance cells', hint: 'Each cell takes its status colour.' },
  { key: 'colorDropdown', label: 'Colour the dropdown options', hint: 'Browser support for this varies.' },
  { key: 'highlightHover', label: 'Highlight the row and column under the cursor' },
  { key: 'stickyColumns', label: 'Pin the name and score columns', hint: 'Keeps them visible while scrolling sideways.' },
  { key: 'showTitle', label: 'Show the page title' },
];

function SettingsDialog({ table, dispatch, tableId, code, sync, actions, readOnly, termId, onClose }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draftName, setDraftName] = useState(settingsName(table));
  const nameFocused = useRef(false);
  const [uploadState, setUploadState] = useState(null);
  const { settings } = table;

  const set = (changes) => dispatch({ type: 'settings/update', changes });

  // The name is synced, so someone else can change it while this dialog is
  // open. Typing into a field bound straight to synced state means a remote
  // update lands under the caret; a draft that only re-seeds when the field is
  // idle keeps the edit intact and still shows their rename once you are done.
  useEffect(() => {
    if (!nameFocused.current) setDraftName(settingsName(table));
  }, [table]);

  // Takes the value from the event rather than from state, so it does not
  // depend on React having re-rendered between the last keystroke and the blur.
  const commitName = (value) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === settings.name) {
      // Clearing the field is how you retype it, not a request to be nameless.
      setDraftName(settings.name);
      return;
    }
    actions.rename(trimmed);
  };

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

  const [importError, setImportError] = useState(null);

  const loadBackup = (file) => {
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onerror = () => setImportError('That file could not be read.');
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next = normalizeTable(parsed);
        if (next.people.length === 0 && next.events.length === 0) {
          setImportError('That file has no people or sessions in it.');
          return;
        }
        const message =
          `Replace this table with the backup?\n\n` +
          `${next.people.length} people, ${next.events.length} sessions, ` +
          `${next.terms.length} terms.\n\nThe table open now is overwritten.`;
        if (!window.confirm(message)) return;
        // `table/adopt` with `upgrade` queues the whole table for sending.
        // `table/replace` would empty the outbox, so on a shared table the
        // restore would stay local and be overwritten by the next snapshot.
        dispatch({ type: 'table/adopt', table: next, upgrade: true });
        onClose();
      } catch {
        setImportError('That does not look like a table backup.');
      }
    };
    reader.readAsText(file);
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
          <span>Name</span>
          <input
            className="input"
            value={draftName}
            disabled={readOnly}
            maxLength={MAX_TABLE_NAME}
            onFocus={() => {
              nameFocused.current = true;
            }}
            onBlur={(event) => {
              nameFocused.current = false;
              commitName(event.target.value);
            }}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setDraftName(settings.name);
                event.currentTarget.blur();
              }
            }}
          />
        </label>
        <p className="hint">
          {code
            ? <>Everyone who opens this table sees this name. Shared as code <strong>{code}</strong>.</>
            : 'The name travels with the table if you share it later.'}
        </p>
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
        <p className="hint">
          Like the name and the statuses, these belong to the table, so everyone sharing
          it sees the same choices — except collapsing a folder, which is yours alone.
        </p>
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
        <h3>Data</h3>
        <p className="hint">
          Everything here stays readable outside this app, so the table is never the only copy.
        </p>
        <div className="settings-danger">
          <div>
            <strong>Export the grid (CSV)</strong>
            <p className="hint">
              The sessions currently on screen, with each person&rsquo;s totals. Opens in Excel.
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => download(exportName(settings.name, 'csv'), toCsv(table, termId), 'text/csv')}
          >
            Export CSV
          </button>
        </div>

        <div className="settings-danger">
          <div>
            <strong>Back up everything (JSON)</strong>
            <p className="hint">Every term, every mark, the roster and the settings.</p>
            {importError && <p className="error-text">{importError}</p>}
          </div>
          <div className="settings-actions">
            <button
              type="button"
              className="btn"
              onClick={() =>
                download(exportName(settings.name, 'json', 'backup'), toJson(table), 'application/json')
              }
            >
              Back up
            </button>
            <label className={`btn${readOnly ? ' btn--disabled' : ''}`}>
              Restore…
              <input
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                disabled={readOnly}
                onChange={(event) => {
                  loadBackup(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
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
              disabled={!code || readOnly || uploadState === 'working'}
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

function settingsName(table) {
  return table.settings.name;
}

export default SettingsDialog;
