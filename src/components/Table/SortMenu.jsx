import Popover from '../ui/Popover';

const OPTIONS = [
  { label: 'First name (A → Z)', sort: { type: 'firstName', direction: 'asc' } },
  { label: 'First name (Z → A)', sort: { type: 'firstName', direction: 'desc' } },
  { label: 'Last name (A → Z)', sort: { type: 'lastName', direction: 'asc' } },
  { label: 'Last name (Z → A)', sort: { type: 'lastName', direction: 'desc' } },
  { label: 'Group', sort: { type: 'group', direction: 'asc' } },
  { label: 'Original order', sort: { type: 'none', direction: 'asc' } },
];

function SortMenu({ x, y, sort, onSortChange, onClose }) {
  return (
    <Popover x={x} y={y} onClose={onClose}>
      <div className="menu-label">Sort people by</div>
      {OPTIONS.map((option) => {
        const active = sort.type === option.sort.type && sort.direction === option.sort.direction;
        return (
          <button
            key={option.label}
            type="button"
            className="menu-item"
            onClick={() => {
              onSortChange({ ...option.sort, eventId: null, scoreType: null });
              onClose();
            }}
          >
            {option.label}
            {active && <span className="menu-item__hint">✓</span>}
          </button>
        );
      })}
    </Popover>
  );
}

export default SortMenu;
