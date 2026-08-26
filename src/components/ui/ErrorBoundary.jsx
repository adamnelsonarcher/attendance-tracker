import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Last line of defence. A shared table is live data written by other people, so
 * a render crash must not leave a blank page with no way out — the recovery
 * actions here are what let someone get back to their own table when a shared
 * one is the thing that broke.
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Attendance Tracker crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash__panel">
          <h1>Something went wrong</h1>
          <p>
            Your tables are still saved in this browser. Reloading fixes most problems; if this
            table keeps failing, open a different one.
          </p>
          <pre className="crash__detail">{String(this.state.error?.message || this.state.error)}</pre>
          <div className="crash__actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                // Back to the local table, which no one else can have broken.
                try {
                  localStorage.setItem('at:active', 'local');
                } catch {
                  /* nothing to do */
                }
                window.location.assign('/');
              }}
            >
              Open my local table
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
