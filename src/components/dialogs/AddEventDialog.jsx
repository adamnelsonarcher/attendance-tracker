import { useState } from 'react';
import Modal from '../ui/Modal';

const NEW_FOLDER = '__new__';

function AddEventDialog({ folders, dispatch, onClose }) {
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    weight: '1',
    // Defaults to no folder, as v1 did. Defaulting to the first folder files
    // events somewhere the user did not choose — invisibly, if it is collapsed.
    folderId: '',
    newFolderName: '',
  });

  const set = (changes) => setForm((current) => ({ ...current, ...changes }));
  const creatingFolder = form.folderId === NEW_FOLDER;
  const canSubmit = form.name.trim() && (!creatingFolder || form.newFolderName.trim());

  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    dispatch({
      type: 'events/add',
      name: form.name.trim(),
      weight: form.weight,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      folderId: creatingFolder ? null : form.folderId || null,
      newFolderName: creatingFolder ? form.newFolderName.trim() : null,
    });
    onClose();
  };

  return (
    <Modal
      title="Add event"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-event" className="btn btn--primary" disabled={!canSubmit}>
            Add event
          </button>
        </>
      }
    >
      <form id="add-event" onSubmit={submit} className="stack">
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            autoFocus
            value={form.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </label>

        <div className="row">
          <label className="field">
            <span>Date</span>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(event) => set({ startDate: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Ends (optional)</span>
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

        <label className="field">
          <span>Folder</span>
          <select
            className="select"
            value={form.folderId}
            onChange={(event) => set({ folderId: event.target.value })}
          >
            <option value="">No folder</option>
            {folders.map((folder) => (
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
              autoFocus
              value={form.newFolderName}
              onChange={(event) => set({ newFolderName: event.target.value })}
            />
          </label>
        )}

        <p className="hint">
          Weight scales how much this event counts toward the weighted score. Leave it at 1 unless
          this event should matter more than the others.
        </p>
      </form>
    </Modal>
  );
}

export default AddEventDialog;
