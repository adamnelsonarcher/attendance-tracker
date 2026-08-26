import './SyncBadge.css';

/**
 * Says what sharing is actually doing. v1 showed "Saved ✓" whenever it was not
 * mid-write — including when nothing had ever been uploaded, and when a write
 * had failed.
 */
const STATES = {
  off: { label: 'Local only', tone: 'muted', title: 'Saved in this browser. Share to sync it.' },
  connecting: { label: 'Connecting…', tone: 'muted', title: 'Opening the shared table' },
  live: { label: 'Live', tone: 'ok', title: 'Changes appear for everyone on this table' },
  saving: { label: 'Saving…', tone: 'ok', title: 'Sending your latest changes' },
  offline: { label: 'Offline', tone: 'warn', title: 'Saved locally and will sync when you reconnect' },
  error: { label: 'Sync error', tone: 'bad', title: 'Could not reach the shared table' },
};

function SyncBadge({ sync, code }) {
  if (!code && sync.status === 'off') {
    return <span className="sync-badge sync-badge--muted" title={STATES.off.title}>{STATES.off.label}</span>;
  }

  const state = STATES[sync.status] || STATES.connecting;
  const title = sync.error ? `${state.title} — ${sync.error.message || sync.error}` : state.title;

  // Clicking sends anything still queued, which is where v1's manual Save
  // button ended up. Sync no longer waits 30 seconds, so this is reassurance
  // rather than a step you have to remember.
  return (
    <button
      type="button"
      className={`sync-badge sync-badge--${state.tone}`}
      onClick={sync.flushNow}
      title={`${title}. Click to sync now.`}
    >
      <span className="sync-badge__dot" />
      {state.label}
    </button>
  );
}

export default SyncBadge;
