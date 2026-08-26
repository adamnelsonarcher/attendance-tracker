import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';

/** Paste a roster. Shows what will be added, and flags names already present. */
function AddPeopleDialog({ people, dispatch, onClose }) {
  const [text, setText] = useState('');

  const { fresh, duplicates } = useMemo(() => {
    const existing = new Set(people.map((person) => person.name.trim().toLowerCase()));
    const seen = new Set();
    const freshNames = [];
    const duplicateNames = [];

    for (const raw of text.split(/[\n,;\t]/)) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (existing.has(key) || seen.has(key)) duplicateNames.push(name);
      else {
        seen.add(key);
        freshNames.push(name);
      }
    }
    return { fresh: freshNames, duplicates: duplicateNames };
  }, [text, people]);

  const submit = () => {
    if (fresh.length === 0) return;
    dispatch({ type: 'people/add', names: fresh });
    onClose();
  };

  return (
    <Modal
      title="Add people"
      description="One name per line, or separated by commas."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={fresh.length === 0}>
            Add {fresh.length || ''} {fresh.length === 1 ? 'person' : 'people'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="visually-hidden">Names</span>
        <textarea
          className="textarea"
          rows={10}
          value={text}
          placeholder={'Avery Chen\nJordan Blake, Riley Okafor'}
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      {duplicates.length > 0 && (
        <p className="hint">
          Skipping {duplicates.length} name{duplicates.length === 1 ? '' : 's'} already on the roster:{' '}
          {duplicates.slice(0, 6).join(', ')}
          {duplicates.length > 6 && ` and ${duplicates.length - 6} more`}.
        </p>
      )}
    </Modal>
  );
}

export default AddPeopleDialog;
