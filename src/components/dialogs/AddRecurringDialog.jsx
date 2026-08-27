import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { WEEKDAYS, weeklyDates } from '../../data/recurrence';
import { formatDateRange } from '../../data/model';
import { ALL_TERMS } from '../../data/selectors';

const NEW_FOLDER = '__new__';

/**
 * Creates a term's worth of a weekly session in one step.
 *
 * This is the shape of every check-in block in the sheets this replaces: one
 * weekday, repeated for a semester. Typed by hand each August, fifteen dates at
 * a time, per session, per semester.
 */
function AddRecurringDialog({ table, dispatch, activeTermId, onClose }) {
  const activeTerm = table.terms.find((term) => term.id === activeTermId);

  const [form, setForm] = useState(() => ({
    name: '',
    weekday: 1,
    startDate: activeTerm?.startDate || '',
    endDate: activeTerm?.endDate || '',
    weight: '1',
    folderId: NEW_FOLDER,
    newFolderName: '',
    termId: activeTermId === ALL_TERMS ? activeTerm?.id || '' : activeTermId || '',
  }));

  const set = (changes) => setForm((current) => ({ ...current, ...changes }));

  const dates = useMemo(
    () => weeklyDates(form.startDate, form.endDate, form.weekday),
    [form.startDate, form.endDate, form.weekday]
  );

  const creatingFolder = form.folderId === NEW_FOLDER;
  const folderName = creatingFolder ? form.newFolderName.trim() : '';
  const canSubmit = form.name.trim() && dates.length > 0 && (!creatingFolder || folderName);

  // Naming the folder after the session is what people almost always want, so
  // it is offered rather than demanded.
  const suggestFolder = () => {
    if (creatingFolder && !form.newFolderName && form.name.trim()) set({ newFolderName: form.name.trim() });
  };

  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    dispatch({
      type: 'events/addRecurring',
      name: form.name.trim(),
      weekday: form.weekday,
      startDate: form.startDate,
      endDate: form.endDate,
      weight: form.weight,
      folderId: creatingFolder ? null : form.folderId || null,
      newFolderName: creatingFolder ? folderName : null,
      termId: form.termId || null,
    });
    onClose();
  };

  return (
    <Modal
      title="Add a weekly session"
      description="One session, repeated for the whole term."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-recurring" className="btn btn--primary" disabled={!canSubmit}>
            Add {dates.length || ''} {dates.length === 1 ? 'session' : 'sessions'}
          </button>
        </>
      }
    >
      <form id="add-recurring" onSubmit={submit} className="stack">
        <div className="row">
          <label className="field">
            <span>Session name</span>
            <input
              className="input"
              autoFocus
              placeholder="Monday 2pm"
              value={form.name}
              onChange={(event) => set({ name: event.target.value })}
              onBlur={suggestFolder}
            />
          </label>
          <label className="field">
            <span>Day</span>
            <select
              className="select"
              value={form.weekday}
              onChange={(event) => set({ weekday: Number(event.target.value) })}
            >
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>From</span>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(event) => set({ startDate: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Until</span>
            <input
              className="input"
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              onChange={(event) => set({ endDate: event.target.value })}
            />
          </label>
          <label className="field field--narrow">
            <span>Weight</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              value={form.weight}
              onChange={(event) => set({ weight: event.target.value })}
            />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>Term</span>
            <select className="select" value={form.termId} onChange={(event) => set({ termId: event.target.value })}>
              <option value="">No term</option>
              {table.terms.map((term) => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Folder</span>
            <select
              className="select"
              value={form.folderId}
              onChange={(event) => set({ folderId: event.target.value })}
            >
              <option value="">No folder</option>
              {table.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
              <option value={NEW_FOLDER}>New folder…</option>
            </select>
          </label>
          {creatingFolder && (
            <label className="field">
              <span>New folder name</span>
              <input
                className="input"
                placeholder={form.name.trim() || 'Monday 2pm'}
                value={form.newFolderName}
                onChange={(event) => set({ newFolderName: event.target.value })}
              />
            </label>
          )}
        </div>

        {dates.length > 0 ? (
          <p className="hint">
            {dates.length} sessions, {formatDateRange(dates[0], dates[dates.length - 1])} — every{' '}
            {WEEKDAYS.find((day) => day.value === form.weekday)?.label}. You can delete or reschedule
            any single one afterwards.
          </p>
        ) : (
          <p className="hint">Pick a date range that contains at least one of the chosen weekday.</p>
        )}
      </form>
    </Modal>
  );
}

export default AddRecurringDialog;
