import { act, renderHook } from '@testing-library/react';
import { useSync } from '../useSync';
import * as firebase from '../firebase';
import { emptyTable } from '../../data/model';

jest.mock('../firebase', () => ({
  isFirebaseConfigured: true,
  subscribeSlice: jest.fn(() => () => {}),
  touchTable: jest.fn(() => Promise.resolve()),
  writeCells: jest.fn(() => Promise.resolve()),
  writeSlice: jest.fn(() => Promise.resolve()),
}));

const FLUSH_DELAY = 600;

function outboxWithCell(cells = { 'p1-e1': 'present' }) {
  return { roster: false, schedule: false, settings: false, attendance: cells, attendanceReplace: false };
}

const emptyOutbox = () => outboxWithCell({});

/**
 * Lets the flush's promise chain run to completion inside act(). It awaits
 * Promise.all, then touchTable, then sets state, so one tick is not enough.
 */
const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  firebase.touchTable.mockImplementation(() => Promise.resolve());
  firebase.writeSlice.mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  jest.useRealTimers();
});

/** A write we control the outcome of, so the switch can happen mid-flight. */
function deferredWrite() {
  let handle;
  const promise = new Promise((resolve, reject) => {
    handle = { resolve, reject };
  });
  // A rejected promise nobody has attached to yet is an unhandled rejection.
  promise.catch(() => {});
  firebase.writeCells.mockImplementation(() => promise);
  return handle;
}

describe('a write that settles after the table has been switched', () => {
  it('does not requeue one table-s cells into another table-s outbox', async () => {
    // The switch flushes first, so a rejected write can land after the app has
    // already moved on. Requeueing then would send these cells under the new
    // table's code — one table's attendance written into another.
    const dispatch = jest.fn();
    const write = deferredWrite();

    const { rerender } = renderHook((props) => useSync(props), {
      initialProps: { code: 'AAAAAA', table: emptyTable(), outbox: outboxWithCell(), dispatch },
    });

    act(() => {
      jest.advanceTimersByTime(FLUSH_DELAY);
    });
    expect(firebase.writeCells).toHaveBeenCalledWith('AAAAAA', { 'p1-e1': 'present' });

    rerender({ code: 'BBBBBB', table: emptyTable(), outbox: emptyOutbox(), dispatch });

    await act(async () => {
      write.reject(new Error('permission-denied'));
    });
    await settle();

    expect(dispatch.mock.calls.map((call) => call[0].type)).not.toContain('sync/requeue');
  });

  it('still requeues when the same table is open', async () => {
    const dispatch = jest.fn();
    const write = deferredWrite();

    renderHook((props) => useSync(props), {
      initialProps: { code: 'AAAAAA', table: emptyTable(), outbox: outboxWithCell(), dispatch },
    });

    act(() => {
      jest.advanceTimersByTime(FLUSH_DELAY);
    });

    await act(async () => {
      write.reject(new Error('permission-denied'));
    });
    await settle();

    const requeue = dispatch.mock.calls.map((call) => call[0]).find((a) => a.type === 'sync/requeue');
    expect(requeue).toBeDefined();
    expect(requeue.cells).toEqual({ 'p1-e1': 'present' });
  });

  it('writes under the code that owned the data, not the one switched to', async () => {
    const dispatch = jest.fn();
    const table = emptyTable();
    table.settings.name = 'First table';

    const { rerender } = renderHook((props) => useSync(props), {
      initialProps: { code: 'AAAAAA', table, outbox: outboxWithCell(), dispatch },
    });

    act(() => {
      jest.advanceTimersByTime(FLUSH_DELAY);
    });

    rerender({ code: 'BBBBBB', table: emptyTable(), outbox: emptyOutbox(), dispatch });
    await settle();

    for (const call of firebase.writeCells.mock.calls) expect(call[0]).toBe('AAAAAA');
    // The name stamped on the parent document is the one that was open when the
    // write started, not whatever is open when it lands.
    for (const call of firebase.touchTable.mock.calls) {
      expect(call[0]).toBe('AAAAAA');
      expect(call[1]).toBe('First table');
    }
  });
});

describe('flushing', () => {
  it('waits for the debounce rather than writing on every keystroke', async () => {
    const dispatch = jest.fn();
    renderHook((props) => useSync(props), {
      initialProps: { code: 'AAAAAA', table: emptyTable(), outbox: outboxWithCell(), dispatch },
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(firebase.writeCells).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(FLUSH_DELAY);
    });
    expect(firebase.writeCells).toHaveBeenCalledTimes(1);
    await settle();
  });

  it('does nothing when there is nothing pending', () => {
    const dispatch = jest.fn();
    renderHook((props) => useSync(props), {
      initialProps: { code: 'AAAAAA', table: emptyTable(), outbox: emptyOutbox(), dispatch },
    });

    act(() => {
      jest.advanceTimersByTime(FLUSH_DELAY);
    });
    expect(firebase.writeCells).not.toHaveBeenCalled();
    expect(firebase.writeSlice).not.toHaveBeenCalled();
  });

  it('sends pending changes when the tab is hidden', async () => {
    const dispatch = jest.fn();
    renderHook((props) => useSync(props), {
      initialProps: { code: 'AAAAAA', table: emptyTable(), outbox: outboxWithCell(), dispatch },
    });

    // Closing the tab inside the debounce window used to lose the last edit.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(firebase.writeCells).toHaveBeenCalledWith('AAAAAA', { 'p1-e1': 'present' });
  });

  it('does nothing at all for a table that is not shared', () => {
    const dispatch = jest.fn();
    renderHook((props) => useSync(props), {
      initialProps: { code: null, table: emptyTable(), outbox: outboxWithCell(), dispatch },
    });

    act(() => {
      jest.advanceTimersByTime(FLUSH_DELAY);
    });
    expect(firebase.writeCells).not.toHaveBeenCalled();
    expect(firebase.subscribeSlice).not.toHaveBeenCalled();
  });
});
