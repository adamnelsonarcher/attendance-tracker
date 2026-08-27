import Popover from '../ui/Popover';

/**
 * What the grid is showing.
 *
 * The daily job is "take the register for Tuesday 10am", and doing that from a
 * generic filter panel means setting a column filter and a row filter and
 * remembering to clear both. This is that job as one choice: pick the session
 * and the grid becomes that session's students against that session's dates.
 *
 * The two bulk options matter as much. Weekly sessions and community events are
 * different kinds of thing, and wanting one without the other — mark a tailgate
 * across the whole programme, or hide the events to read the check-in record —
 * is the common case, not an advanced one.
 */
function ViewMenu({ x, y, folders, filters, onChange, onClose }) {
  const sections = folders.filter((folder) => folders.some((child) => child.parentId === folder.id));
  const cohortFolders = folders.filter((folder) => folder.groupId);
  const openFolders = folders.filter(
    (folder) => !folder.groupId && !sections.some((section) => section.id === folder.id)
  );

  const set = (next) => {
    onChange({ ...filters, folders: next });
    onClose();
  };

  const only = (ids) => set(Object.fromEntries(ids.map((id) => [id, 1])));

  const active = Object.entries(filters.folders).filter(([, state]) => state === 1);
  const isOnly = (ids) =>
    active.length === ids.length && ids.every((id) => filters.folders[id] === 1);

  const showingAll = Object.values(filters.folders).every((state) => !state);

  return (
    <Popover x={x} y={y} onClose={onClose}>
      <button type="button" className="menu-item" onClick={() => set({})}>
        <span>Everything</span>
        <span className="menu-item__hint">{showingAll ? '✓' : ''}</span>
      </button>

      {sections.length > 0 && (
        <>
          <div className="menu-divider" />
          <div className="menu-label">A whole section</div>
          {sections.map((section) => (
            <button key={section.id} type="button" className="menu-item" onClick={() => only([section.id])}>
              <span>{section.name}</span>
              <span className="menu-item__hint">{isOnly([section.id]) ? '✓' : ''}</span>
            </button>
          ))}
        </>
      )}

      {cohortFolders.length > 0 && (
        <>
          <div className="menu-divider" />
          <div className="menu-label">One session</div>
          {cohortFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="menu-item"
              onClick={() => only([folder.id])}
            >
              <span>{folder.name}</span>
              <span className="menu-item__hint">{isOnly([folder.id]) ? '✓' : ''}</span>
            </button>
          ))}
        </>
      )}

      {openFolders.length > 0 && (
        <>
          <div className="menu-divider" />
          <div className="menu-label">Open to everyone</div>
          {openFolders.map((folder) => (
            <button key={folder.id} type="button" className="menu-item" onClick={() => only([folder.id])}>
              <span>{folder.name}</span>
              <span className="menu-item__hint">{isOnly([folder.id]) ? '✓' : ''}</span>
            </button>
          ))}
        </>
      )}

      {folders.length === 0 && (
        <p className="hint menu-form">No session folders yet. Add → Weekly session builds one.</p>
      )}
    </Popover>
  );
}

export default ViewMenu;
