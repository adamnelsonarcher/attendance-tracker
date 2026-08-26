/**
 * The app's single entry point to its data: which table is open, what is in it,
 * how to change it, and how it is shared.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { initialState, tableReducer } from './tableReducer';
import { MAX_TABLE_NAME, emptyTable } from '../data/model';
import {
  LOCAL_TABLE_ID,
  bootstrapLocalTable,
  defaultName,
  forgetTable,
  getActiveTableId,
  listTables,
  loadTable,
  newLocalTableId,
  rememberTable,
  saveTable,
  setActiveTableId,
} from '../data/storage';
import {
  codeFromLocation,
  generateTableCode,
  isValidTableCode,
  isViewOnlyLocation,
  shareLink,
} from '../data/tableCode';
import { createTable, fetchTable, isFirebaseConfigured } from '../sync/firebase';
import { isLegacyRemote, remoteTableName, tableFromRemote } from '../sync/remoteTable';
import { useSync } from '../sync/useSync';

/**
 * Which table to open on mount: the one named in the URL, else the last one
 * used, else the local one.
 *
 * A code in the URL is only adopted here if this browser already holds a copy.
 * Naming a code we have never joined would mean the reducer starts on the local
 * table while `tableId` says otherwise — and the persist effect then writes the
 * local table under the shared code, which both hides the real table and arms
 * sync to push our roster over theirs. Staying local until `fetchTable` has
 * actually returned keeps those two in step.
 */
export function resolveInitialTableId() {
  const fromUrl = codeFromLocation();
  if (fromUrl) return loadTable(fromUrl) ? fromUrl : LOCAL_TABLE_ID;

  const active = getActiveTableId();
  if (active && (active === LOCAL_TABLE_ID || loadTable(active))) return active;
  return LOCAL_TABLE_ID;
}

export function useTableStore() {
  const [tableId, setTableId] = useState(resolveInitialTableId);
  const [tables, setTables] = useState(listTables);
  const [joinState, setJoinState] = useState({ status: 'idle', error: null });
  const viewOnly = useMemo(() => isViewOnlyLocation(), []);

  const [state, rawDispatch] = useReducer(
    tableReducer,
    undefined,
    () => initialState(loadTable(resolveInitialTableId()) || bootstrapLocalTable())
  );

  // Blocks edits on a view-only link. Remote merges and sync bookkeeping still
  // flow, so the page keeps updating live while it stays read-only, and
  // collapsing a folder still works — it changes nothing anyone else can see.
  const dispatch = useCallback(
    (action) => {
      if (!viewOnly) {
        rawDispatch(action);
        return;
      }
      const allowed =
        action.type.startsWith('remote/') ||
        action.type.startsWith('sync/') ||
        action.type === 'table/replace' ||
        action.type === 'table/adopt' ||
        action.type === 'folders/toggle';
      if (allowed) rawDispatch(action);
    },
    [viewOnly]
  );

  const { table, outbox } = state;
  // Only share-code shaped ids are cloud tables; everything else stays local.
  const code = isValidTableCode(tableId) ? tableId : null;
  const {
    status: syncStatus,
    error: syncError,
    flushNow,
    pushAll,
  } = useSync({ code, table, outbox, dispatch });

  /* ------------------------------------------------------------- persist */

  useEffect(() => {
    saveTable(tableId, table);
  }, [tableId, table]);

  useEffect(() => {
    setActiveTableId(tableId);
  }, [tableId]);

  /* ------------------------- join the table named in the URL, if any ----- */

  const joinedFromUrl = useRef(false);

  useEffect(() => {
    const urlCode = codeFromLocation();
    if (!urlCode || joinedFromUrl.current) return;
    joinedFromUrl.current = true;

    // Already have a local copy: open it and let the subscription catch it up.
    if (loadTable(urlCode)) {
      openTable(urlCode);
      return;
    }
    if (!isFirebaseConfigured) {
      setJoinState({ status: 'error', error: 'Sharing is not configured for this deployment.' });
      return;
    }

    setJoinState({ status: 'loading', error: null });
    fetchTable(urlCode)
      .then((remote) => {
        if (!remote) {
          setJoinState({ status: 'error', error: `No table found with the code ${urlCode}.` });
          return;
        }
        adoptRemote(urlCode, remote);
        setJoinState({ status: 'idle', error: null });
      })
      .catch((err) => setJoinState({ status: 'error', error: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshTables = useCallback(() => setTables(listTables()), []);

  const adoptRemote = useCallback(
    (nextCode, remote) => {
      flushNow();

      const loaded = tableFromRemote(remote);
      // A table shared by an older build has its name only on the parent
      // document, so seed the table's own name from wherever it was found —
      // otherwise it reads as "Untitled table" everywhere but the switcher.
      const name = remoteTableName(remote, defaultName(nextCode));
      const next = { ...loaded, settings: { ...loaded.settings, name } };

      saveTable(nextCode, next);
      rememberTable(nextCode, name);
      setTableId(nextCode);
      rawDispatch({ type: 'table/adopt', table: next, upgrade: isLegacyRemote(remote) });
      refreshTables();
    },
    [flushNow, refreshTables]
  );

  /* -------------------------------------------------------------- actions */

  /** Switches to a table already stored in this browser. */
  const openTable = useCallback(
    (nextId) => {
      // Anything still waiting on the flush debounce belongs to the table we
      // are leaving, and `table/replace` empties the outbox — so send it first.
      flushNow();

      const next = loadTable(nextId) || (nextId === LOCAL_TABLE_ID ? bootstrapLocalTable() : emptyTable());
      setTableId(nextId);
      rawDispatch({ type: 'table/replace', table: next, fromRemote: true });
      rememberTable(nextId, next.settings.name || defaultName(nextId));
      refreshTables();
      updateAddress(nextId);
    },
    [flushNow, refreshTables]
  );

  /** Turns the open table into a shared one and returns its link. */
  const share = useCallback(async () => {
    if (code) return shareLink(code);
    if (!isFirebaseConfigured) throw new Error('Sharing is not configured for this deployment.');

    const newCode = generateTableCode();
    await createTable(newCode, table);
    saveTable(newCode, table);
    rememberTable(newCode, table.settings.name);
    setTableId(newCode);
    refreshTables();
    updateAddress(newCode);
    return shareLink(newCode);
  }, [code, table, refreshTables]);

  /** Opens someone else's table. The current one stays on disk. */
  const join = useCallback(
    async (nextCode) => {
      if (nextCode === tableId) return true;
      if (loadTable(nextCode)) {
        openTable(nextCode);
        return true;
      }
      if (!isFirebaseConfigured) throw new Error('Sharing is not configured for this deployment.');

      setJoinState({ status: 'loading', error: null });
      const remote = await fetchTable(nextCode);
      if (!remote) {
        setJoinState({ status: 'error', error: `No table found with the code ${nextCode}.` });
        return false;
      }
      adoptRemote(nextCode, remote);
      updateAddress(nextCode);
      setJoinState({ status: 'idle', error: null });
      return true;
    },
    [tableId, openTable, adoptRemote]
  );

  /**
   * Starts an empty table alongside the existing ones. It gets its own id, so
   * it never overwrites the table already open.
   */
  const createBlank = useCallback(() => {
    flushNow();
    const id = newLocalTableId();
    const next = emptyTable();
    saveTable(id, next);
    setTableId(id);
    rawDispatch({ type: 'table/replace', table: next, fromRemote: true });
    rememberTable(id, defaultName(id));
    refreshTables();
    updateAddress(id);
  }, [flushNow, refreshTables]);

  /**
   * Renames the table. The name lives in the table, not in this browser, so
   * everyone opening the share link sees what it is called rather than a code.
   */
  const rename = useCallback(
    (name) => {
      dispatch({ type: 'settings/update', changes: { name } });
    },
    [dispatch]
  );

  /**
   * Detaches from the shared copy by taking a private one.
   *
   * There is no way to un-share a table outright: with no accounts, the link is
   * the only credential and anyone holding it still has it. So this is honest
   * about what it does — you stop reading and writing the shared copy, and it
   * carries on existing for whoever else has the link.
   */
  const makePrivateCopy = useCallback(() => {
    // Anything still on the debounce belongs to the shared table; send it
    // before detaching, or the collaborators never see the last edit.
    flushNow();

    const id = newLocalTableId();
    const next = { ...table, settings: { ...table.settings, name: privateName(table.settings.name) } };
    saveTable(id, next);
    rememberTable(id, next.settings.name);
    setTableId(id);
    rawDispatch({ type: 'table/replace', table: next, fromRemote: true });
    refreshTables();
    updateAddress(id);
    return id;
  }, [table, flushNow, refreshTables]);

  /** Removes this browser's copy. The shared table itself is left alone. */
  const forget = useCallback(
    (targetId) => {
      forgetTable(targetId);
      refreshTables();
      if (targetId === tableId) openTable(LOCAL_TABLE_ID);
    },
    [tableId, openTable, refreshTables]
  );

  return {
    table,
    dispatch,
    tableId,
    code,
    tables,
    viewOnly,
    sync: {
      status: syncStatus,
      error: syncError,
      flushNow,
      pushAll,
      configured: isFirebaseConfigured,
    },
    join: { ...joinState, run: join },
    actions: { share, openTable, createBlank, forget, rename, makePrivateCopy },
  };
}

const PRIVATE_SUFFIX = ' (private)';

/**
 * Names the detached copy without stacking suffixes, and leaves room for the
 * suffix inside the name limit so it cannot be truncated back off.
 */
function privateName(name) {
  if (name.endsWith(PRIVATE_SUFFIX)) return name;
  const base = name.slice(0, MAX_TABLE_NAME - PRIVATE_SUFFIX.length).trimEnd();
  return base + PRIVATE_SUFFIX;
}

/** Keeps the address bar in step without a router or a reload. */
function updateAddress(tableId) {
  const path = isValidTableCode(tableId) ? `/${tableId}` : '/';
  if (window.location.pathname !== path) {
    window.history.replaceState(null, '', path + window.location.search.replace(/[?&]t=[^&]*/, ''));
  }
}
