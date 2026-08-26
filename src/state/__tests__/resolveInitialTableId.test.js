import { resolveInitialTableId } from '../useTableStore';
import { LOCAL_TABLE_ID, saveTable, setActiveTableId } from '../../data/storage';
import { emptyTable } from '../../data/model';

const setUrl = (path, search = '') => {
  window.history.replaceState(null, '', path + search);
};

beforeEach(() => {
  localStorage.clear();
  setUrl('/');
});

describe('resolveInitialTableId', () => {
  it('recognises a valid share code in the path at all', () => {
    // Guards the tests below from passing for the wrong reason: '1' is not in
    // the code alphabet, so '/ABC123' would resolve to local either way.
    saveTable('ABC234', emptyTable());
    setUrl('/ABC234');
    expect(resolveInitialTableId()).toBe('ABC234');
  });

  it('stays local for a share code this browser has never joined', () => {
    // The blocker this guards: naming the code here made the reducer start on
    // the local table while tableId said otherwise, so the persist effect wrote
    // the local table under the shared code — hiding the real one and arming
    // sync to push our roster over theirs.
    setUrl('/ABC234');
    expect(resolveInitialTableId()).toBe(LOCAL_TABLE_ID);
  });

  it('opens a share code that has already been joined', () => {
    saveTable('ABC234', emptyTable());
    setUrl('/ABC234');
    expect(resolveInitialTableId()).toBe('ABC234');
  });

  it('reads a code from the ?t= form too', () => {
    saveTable('ABC234', emptyTable());
    setUrl('/', '?t=ABC234');
    expect(resolveInitialTableId()).toBe('ABC234');
  });

  it('falls back to the last table used', () => {
    saveTable('XYZ789', emptyTable());
    setActiveTableId('XYZ789');
    expect(resolveInitialTableId()).toBe('XYZ789');
  });

  it('ignores a remembered table whose data is gone', () => {
    setActiveTableId('XYZ789');
    expect(resolveInitialTableId()).toBe(LOCAL_TABLE_ID);
  });

  it('ignores a path that is not a share code', () => {
    setUrl('/settings');
    expect(resolveInitialTableId()).toBe(LOCAL_TABLE_ID);
  });

  it('agrees with itself across calls, which is what keeps id and table in step', () => {
    // useState and the reducer initialiser both call this; if they disagreed,
    // the persist effect would save one table under the other's id.
    setUrl('/ABC234');
    expect(resolveInitialTableId()).toBe(resolveInitialTableId());
  });
});
