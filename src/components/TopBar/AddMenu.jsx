import Popover from '../ui/Popover';

const ITEMS = [
  { dialog: 'people', label: 'People…', hint: 'paste a roster' },
  { dialog: 'recurring', label: 'Weekly session…', hint: 'a term at a time' },
  { dialog: 'event', label: 'One-off event…', hint: 'tailgate, workshop' },
  { dialog: 'import', label: 'Import a spreadsheet…', hint: 'paste a grid' },
];

function AddMenu({ x, y, onOpen, onClose }) {
  return (
    <Popover x={x} y={y} onClose={onClose}>
      {ITEMS.map((item) => (
        <button
          key={item.dialog}
          type="button"
          className="menu-item"
          onClick={() => {
            onOpen(item.dialog);
            onClose();
          }}
        >
          <span>{item.label}</span>
          <span className="menu-item__hint">{item.hint}</span>
        </button>
      ))}
    </Popover>
  );
}

export default AddMenu;
