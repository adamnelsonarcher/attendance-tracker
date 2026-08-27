import { useMemo, useState } from 'react';
import Popover from '../ui/Popover';

/** Rename, record other spellings, merge a duplicate, or remove someone. */
function PersonMenu({ x, y, person, people, dispatch, onClose }) {
  const [mode, setMode] = useState('root');
  const [name, setName] = useState(person.name);
  const [aliasText, setAliasText] = useState((person.aliases || []).join(', '));
  const [search, setSearch] = useState('');

  const [mergeTarget, setMergeTarget] = useState(null);

  const others = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people
      .filter((candidate) => candidate.id !== person.id)
      .filter(
        (candidate) =>
          !query ||
          // Aliases are searchable too — the duplicate being hunted is often
          // the one spelled the other way.
          [candidate.name, ...(candidate.aliases || [])].some((label) =>
            label.toLowerCase().includes(query)
          )
      )
      .slice(0, 8);
  }, [people, person.id, search]);

  return (
    <Popover x={x} y={y} onClose={onClose}>
      {mode === 'root' && (
        <>
          <div className="menu-label">{person.name}</div>
          <button type="button" className="menu-item" onClick={() => setMode('rename')}>
            Rename
          </button>
          <button type="button" className="menu-item" onClick={() => setMode('aliases')}>
            Also known as
            <span className="menu-item__hint">{(person.aliases || []).length || 'none'}</span>
          </button>
          <button type="button" className="menu-item" onClick={() => setMode('merge')}>
            Merge with…
          </button>
          <div className="menu-divider" />
          <button type="button" className="menu-item menu-item--danger" onClick={() => setMode('confirm')}>
            Remove from table
          </button>
        </>
      )}

      {mode === 'rename' && (
        <form
          className="menu-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) {
              dispatch({ type: 'people/rename', id: person.id, name: name.trim() });
              onClose();
            }
          }}
        >
          <label className="field">
            <span>Name</span>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="menu-form__row">
            <button type="submit" className="btn btn--primary btn--small">Save</button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </form>
      )}

      {mode === 'aliases' && (
        <form
          className="menu-form"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({
              type: 'people/setAliases',
              id: person.id,
              aliases: aliasText.split(',').map((alias) => alias.trim()).filter(Boolean),
            });
            onClose();
          }}
        >
          <label className="field">
            <span>Other names for {person.name}</span>
            <input
              className="input"
              autoFocus
              placeholder="Liv, Liv F"
              value={aliasText}
              onChange={(e) => setAliasText(e.target.value)}
            />
          </label>
          {/* Sign-in sheets and event lists rarely use the roster spelling. */}
          <p className="hint">
            Comma separated. Pasted lists and imports will match any of these to {person.name}.
          </p>
          <div className="menu-form__row">
            <button type="submit" className="btn btn--primary btn--small">Save</button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </form>
      )}

      {mode === 'merge' && (
        <div className="menu-form">
          <label className="field">
            <span>Merge another row into {person.name}</span>
            <input
              className="input"
              autoFocus
              placeholder="Search the roster"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <p className="hint">
            The other row is removed. Its name becomes an alias, its groups carry over, and its
            marks fill any gaps in {person.name}&rsquo;s row.
          </p>
          <div className="menu-form__list">
            {others.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="menu-item"
                onClick={() => {
                  setMergeTarget(candidate);
                  setMode('mergeConfirm');
                }}
              >
                <span>{candidate.name}</span>
                {(candidate.aliases || []).length > 0 && (
                  <span className="menu-item__hint">{candidate.aliases.join(', ')}</span>
                )}
              </button>
            ))}
            {others.length === 0 && <p className="hint">No one else matches.</p>}
          </div>
          <div className="menu-form__row">
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Back</button>
          </div>
        </div>
      )}

      {mode === 'mergeConfirm' && mergeTarget && (
        <div className="menu-form">
          {/* Merging cannot be undone, and Remove already asks. */}
          <p className="hint">
            Fold <strong>{mergeTarget.name}</strong> into <strong>{person.name}</strong>? The other
            row disappears, its name becomes an alias, and its marks fill any gaps in this one.
            This cannot be undone.
          </p>
          <div className="menu-form__row">
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                dispatch({ type: 'people/merge', keepId: person.id, mergeId: mergeTarget.id });
                onClose();
              }}
            >
              Merge
            </button>
            <button type="button" className="btn btn--small" onClick={() => setMode('merge')}>Back</button>
          </div>
        </div>
      )}

      {mode === 'confirm' && (
        <div className="menu-form">
          <p className="hint">
            Remove <strong>{person.name}</strong> and all of their attendance? This cannot be undone.
          </p>
          <div className="menu-form__row">
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => {
                dispatch({ type: 'people/remove', id: person.id });
                onClose();
              }}
            >
              Remove
            </button>
            <button type="button" className="btn btn--small" onClick={() => setMode('root')}>Cancel</button>
          </div>
        </div>
      )}
    </Popover>
  );
}

export default PersonMenu;
