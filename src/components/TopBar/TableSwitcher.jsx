import Popover from '../ui/Popover';
import { LOCAL_TABLE_ID } from '../../data/storage';

/**
 * Every table this browser has opened. This is what makes joining a shared link
 * safe: v1 had one slot, so opening someone's code overwrote your own table and
 * the only warning was a confirm dialog.
 */
function TableSwitcher({ x, y, tables, tableId, actions, onJoin, onClose }) {
  const open = (id) => {
    actions.openTable(id);
    onClose();
  };

  return (
    <Popover x={x} y={y} onClose={onClose}>
      <div className="menu-label">Your tables</div>
      {tables.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="menu-item"
          onClick={() => open(entry.id)}
        >
          <span>{entry.name}</span>
          <span className="menu-item__hint">
            {entry.id === tableId ? '✓' : entry.id === LOCAL_TABLE_ID ? 'local' : entry.id}
          </span>
        </button>
      ))}

      <div className="menu-divider" />

      <button type="button" className="menu-item" onClick={() => { onJoin(); onClose(); }}>
        Open a shared table…
      </button>
      <button
        type="button"
        className="menu-item"
        onClick={() => {
          actions.createBlank();
          onClose();
        }}
      >
        Start an empty table
      </button>
    </Popover>
  );
}

export default TableSwitcher;
