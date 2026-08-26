import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { newId } from '../../data/model';
import './GroupsDialog.css';

const PALETTE = ['#5b8def', '#e8955a', '#3fae7d', '#b06ad8', '#d95b6b', '#3ca6b8', '#c9a227', '#7a8290'];

function nextColor(groups) {
  const used = new Set(groups.map((group) => group.color));
  return PALETTE.find((color) => !used.has(color)) || PALETTE[groups.length % PALETTE.length];
}

/**
 * Groups own their membership, and nothing else stores it. v1 also cached a
 * copy on each person and the two drifted, which is why some people's colour
 * bars and filters disagreed with the group editor.
 */
function GroupsDialog({ groups, people, dispatch, onClose }) {
  const [draft, setDraft] = useState(() => groups.map((group) => ({ ...group, memberIds: [...group.memberIds] })));
  const [selectedId, setSelectedId] = useState(groups[0]?.id || null);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const selected = draft.find((group) => group.id === selectedId) || null;

  const visiblePeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? people.filter((person) => person.name.toLowerCase().includes(query)) : people;
  }, [people, search]);

  const updateGroup = (id, changes) =>
    setDraft((current) => current.map((group) => (group.id === id ? { ...group, ...changes } : group)));

  const addGroup = () => {
    const name = newName.trim();
    if (!name) return;
    const group = { id: newId('g'), name, color: nextColor(draft), memberIds: [] };
    setDraft((current) => [...current, group]);
    setSelectedId(group.id);
    setNewName('');
  };

  const toggleMember = (personId) => {
    if (!selected) return;
    updateGroup(selected.id, {
      memberIds: selected.memberIds.includes(personId)
        ? selected.memberIds.filter((id) => id !== personId)
        : [...selected.memberIds, personId],
    });
  };

  const save = () => {
    dispatch({ type: 'groups/replace', groups: draft });
    onClose();
  };

  return (
    <Modal
      title="Groups"
      description="Groups colour-code the name column and drive the row filters."
      size="large"
      dismissOnOverlay={false}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={save}>Save groups</button>
        </>
      }
    >
      <div className="groups">
        <div className="groups__list">
          <form
            className="groups__add"
            onSubmit={(event) => {
              event.preventDefault();
              addGroup();
            }}
          >
            <input
              className="input"
              placeholder="New group name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <button type="submit" className="btn" disabled={!newName.trim()}>Add</button>
          </form>

          <div className="groups__scroll scroll-area">
            {draft.length === 0 && <p className="hint">No groups yet.</p>}
            {draft.map((group) => (
              <div
                key={group.id}
                className={`group-row${group.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(group.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => event.key === 'Enter' && setSelectedId(group.id)}
              >
                <input
                  type="color"
                  className="group-row__color"
                  value={group.color}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateGroup(group.id, { color: event.target.value })}
                  aria-label={`Colour for ${group.name}`}
                />
                <input
                  className="group-row__name"
                  value={group.name}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                  aria-label="Group name"
                />
                <span className="group-row__count">{group.memberIds.length}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  aria-label={`Delete ${group.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDraft((current) => current.filter((entry) => entry.id !== group.id));
                    if (selectedId === group.id) setSelectedId(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="groups__members">
          <input
            className="input"
            placeholder="Search people"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {!selected ? (
            <p className="hint">Pick a group to choose its members.</p>
          ) : (
            <div className="groups__scroll scroll-area">
              {visiblePeople.map((person) => {
                const checked = selected.memberIds.includes(person.id);
                return (
                  <label key={person.id} className={`member-row${checked ? ' is-selected' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMember(person.id)} />
                    <span>{person.name}</span>
                  </label>
                );
              })}
              {visiblePeople.length === 0 && <p className="hint">No matching people.</p>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default GroupsDialog;
