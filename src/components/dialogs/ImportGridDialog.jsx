import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { buildImport, collectSymbols, guessMapping, parseGrid } from '../../data/gridImport';
import { ALL_TERMS } from '../../data/selectors';
import { termForDate } from '../../data/model';
import './ImportGridDialog.css';

/**
 * Brings a semester of check-in sheet across in one paste.
 *
 * Symbols are detected and shown for confirmation rather than guessed at, since
 * the mark vocabulary changed three times over the years these sheets cover and
 * one legend defines the same symbol twice. Nothing is written until the
 * preview is accepted.
 */
function ImportGridDialog({ table, dispatch, activeTermId, onClose }) {
  const [text, setText] = useState('');
  const [mapping, setMapping] = useState({});
  const [termId, setTermId] = useState(null);
  const [groupBlocks, setGroupBlocks] = useState(true);
  const [touched, setTouched] = useState(false);

  const blocks = useMemo(() => parseGrid(text), [text]);
  const symbols = useMemo(() => collectSymbols(blocks), [blocks]);

  const dates = useMemo(
    () => blocks.flatMap((block) => block.columns.map((column) => column.date)).sort(),
    [blocks]
  );

  // Importing history is the common case, and the pasted dates say which
  // semester it belongs to far better than whichever term happens to be on
  // screen. Defaulting to the open term would file Fall 2025 under Fall 2026.
  const datedTerm = useMemo(() => {
    if (dates.length === 0) return null;
    const first = termForDate(table.terms, dates[0]);
    const last = termForDate(table.terms, dates[dates.length - 1]);
    return first && first.id === last?.id ? first : null;
  }, [dates, table.terms]);

  const effectiveTermId =
    termId !== null ? termId : datedTerm?.id ?? (dates.length > 0 ? '' : activeTermId === ALL_TERMS ? '' : activeTermId || '');

  // The guess is only a starting point, and it must not stamp on a choice the
  // person has already made.
  const effectiveMapping = useMemo(() => {
    const guessed = guessMapping(symbols, table.settings.statuses);
    return touched ? { ...guessed, ...mapping } : guessed;
  }, [symbols, table.settings.statuses, mapping, touched]);

  const result = useMemo(
    () => buildImport({ blocks, mapping: effectiveMapping, table, termId: effectiveTermId || null, groupBlocks }),
    [blocks, effectiveMapping, table, effectiveTermId, groupBlocks]
  );

  const { summary } = result;
  const canImport = blocks.length > 0 && summary.events > 0;

  const setSymbol = (symbol, statusId) => {
    setTouched(true);
    setMapping((current) => ({ ...current, [symbol]: statusId }));
  };

  return (
    <Modal
      title="Import from a spreadsheet"
      description="Copy a block of your check-in sheet — the row of dates and the rows of names beneath it — and paste it here."
      size="large"
      dismissOnOverlay={false}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canImport}
            onClick={() => {
              dispatch({ type: 'table/import', payload: result.payload });
              onClose();
            }}
          >
            Import {summary.events || ''} {summary.events === 1 ? 'session' : 'sessions'}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Pasted grid</span>
        <textarea
          className="textarea import-grid__paste"
          rows={7}
          value={text}
          placeholder={'Monday 2pm\t8/25/2025\t9/1/2025\t9/8/2025\nChandler B\t✓\t\t✓\nOscar P\tV\t\tV'}
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      {text.trim() && blocks.length === 0 && (
        <p className="error-text">
          No dates found. The first row of the block needs to be the dates — include the header row
          when you copy, and paste it straight from the spreadsheet rather than as an image.
        </p>
      )}

      {blocks.length > 0 && (
        <>
          <section className="import-grid__section">
            <h3>Found</h3>
            <ul className="import-grid__facts">
              {blocks.map((block, index) => (
                <li key={`${block.label}-${index}`}>
                  <strong>{block.label || 'Untitled block'}</strong> — {block.columns.length} dates,{' '}
                  {block.people.length} people
                </li>
              ))}
            </ul>
          </section>

          <section className="import-grid__section">
            <h3>What the marks mean</h3>
            <p className="hint">
              Anything left unset is skipped, and the cell stays blank.
            </p>
            <div className="import-grid__symbols">
              {symbols.map(({ symbol, count }) => (
                <label key={symbol} className="import-grid__symbol">
                  <span className="import-grid__mark">{symbol}</span>
                  <span className="hint">×{count}</span>
                  <select
                    className="select"
                    value={effectiveMapping[symbol] || ''}
                    onChange={(event) => setSymbol(symbol, event.target.value)}
                  >
                    <option value="">Skip</option>
                    {table.settings.statuses.map((status) => (
                      <option key={status.id} value={status.id}>{status.name}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="import-grid__section">
            <h3>Where it goes</h3>
            <div className="row">
              <label className="field">
                <span>Term</span>
                <select
                  className="select"
                  value={effectiveTermId}
                  onChange={(event) => setTermId(event.target.value)}
                >
                  <option value="">No term</option>
                  {table.terms.map((term) => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {dates.length > 0 && (
              <p className="hint">
                These dates run {dates[0]} to {dates[dates.length - 1]}.{' '}
                {datedTerm
                  ? `They fall inside ${datedTerm.name}.`
                  : 'No term covers them, so they are filed without one until you add that semester.'}
              </p>
            )}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={groupBlocks}
                onChange={(event) => setGroupBlocks(event.target.checked)}
              />
              <span>
                <span className="checkbox-row__label">Make a group for each block</span>
                <span className="checkbox-row__hint">
                  So "Monday 2pm" becomes both a folder of sessions and a group you can filter the
                  roster by.
                </span>
              </span>
            </label>
          </section>

          <section className="import-grid__section">
            <h3>Before importing</h3>
            <ul className="import-grid__facts">
              <li>
                <strong>{summary.events}</strong> sessions and <strong>{summary.marks}</strong> marks
              </li>
              <li>
                <strong>{summary.matchedPeople.length}</strong> matched to people already here
                {summary.matchedPeople.length > 0 && (
                  <span className="hint"> — {summary.matchedPeople.slice(0, 8).join(', ')}
                    {summary.matchedPeople.length > 8 && ` +${summary.matchedPeople.length - 8} more`}</span>
                )}
              </li>
              <li>
                <strong>{summary.newPeople.length}</strong> added to the roster
                {summary.newPeople.length > 0 && (
                  <span className="hint"> — {summary.newPeople.slice(0, 8).join(', ')}
                    {summary.newPeople.length > 8 && ` +${summary.newPeople.length - 8} more`}</span>
                )}
              </li>
            </ul>

            {summary.reusedFolders.length > 0 && (
              <p className="hint">
                Adding to the existing {summary.reusedFolders.join(', ')} rather than making a second
                copy. A session already recorded on the same date is reused, not duplicated.
              </p>
            )}
            {summary.ambiguous.length > 0 && (
              <p className="hint">
                {summary.ambiguous.length} name{summary.ambiguous.length === 1 ? '' : 's'} could be more
                than one person and {summary.ambiguous.length === 1 ? 'was' : 'were'} added as new — merge
                them afterwards from the name column.
              </p>
            )}
            {summary.unmappedSymbols.length > 0 && (
              <p className="hint">
                Skipping unmapped marks: {summary.unmappedSymbols.join('  ')}
              </p>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}

export default ImportGridDialog;
