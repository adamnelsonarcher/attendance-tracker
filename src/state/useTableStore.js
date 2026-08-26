/**
 * The app's single entry point to its data: which table is open, what is in it,
 * how to change it, and how it is shared.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { initialState, reconcile, tableReducer } from './tableReducer';
import { emptyTable, normalizeTable } from '../data/model';
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
  renameTable,
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
import { useSync } from '../sync/useSync';

/** Opens the table named in the URL, else the last one used, else the local one. */
function resolveInitialTableId() {
  const fromUrl = codeFromLocation();
  if (fromUrl) return fromUrl;
  const active = getActiveTableId();
  return active || LOCAL_TABLE_ID;
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
  // flow, so the page keeps updating live while it stays read-only.
  const dispatch = useCallback(
    (action) => {
      const isInternal = action.type.startsWith('remote/') || action.type.startsWith('sync/');
      if (viewOnly && !isInternal && action.type !== 'table/replace') return;
      rawDispatch(action);
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
      const next = normalizeTable({
        version: 2,
        people: remote.roster?.people,
        groups: remote.roster?.groups,
        folders: remote.schedule?.folders,
        events: remote.schedule?.events,
        settings: remote.settings,
        attendance: remote.attendance,
      });
      saveTable(nextCode, next);
      rememberTable(nextCode, remote.meta?.name || defaultName(nextCode));
      setTableId(nextCode);
      rawDispatch({ type: 'table/replace', table: next, fromRemote: true });
      refreshTables();
    },
    [refreshTables]
  );

  /* -------------------------------------------------------------- actions */

  /** Switches to a table already stored in this browser. */
  const openTable = useCallback(
    (nextId) => {
      const next = loadTable(nextId) || (nextId === LOCAL_TABLE_ID ? bootstrapLocalTable() : emptyTable());
      setTableId(nextId);
      rawDispatch({ type: 'table/replace', table: next, fromRemote: true });
      rememberTable(nextId, defaultName(nextId));
      refreshTables();
      updateAddress(nextId);
    },
    [refreshTables]
  );

  /** Turns the open table into a shared one and returns its link. */
  const share = useCallback(async () => {
    if (code) return shareLink(code);
    if (!isFirebaseConfigured) throw new Error('Sharing is not configured for this deployment.');

    const newCode = generateTableCode();
    await createTable(newCode, table, defaultName(newCode));
    saveTable(newCode, table);
    rememberTable(newCode, defaultName(newCode));
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
    const id = newLocalTableId();
    const next = emptyTable();
    saveTable(id, next);
    setTableId(id);
    rawDispatch({ type: 'table/replace', table: next, fromRemote: true });
    rememberTable(id, defaultName(id));
    refreshTables();
    updateAddress(id);
  }, [refreshTables]);

  /** Renames the open table in this browser's list. */
  const rename = useCallback(
    (name) => {
      renameTable(tableId, name);
      refreshTables();
    },
    [tableId, refreshTables]
  );

  /** Removes this browser's copy. The shared table itself is left alone. */
  const forget = useCallback(
    (targetId) => {
      forgetTable(targetId);
      refreshTables();
      if (targetId === tableId) openTable(LOCAL_TABLE_ID);
    },
    [tableId, openTable, refreshTables]
  );

  /* --------------------------------------------------------- reconciliation */

  // A remote roster or schedule change can orphan cells this client still holds.
  useEffect(() => {
    const cleaned = reconcile(table);
    if (cleaned !== table) rawDispatch({ type: 'table/prune', table: cleaned });
  }, [table]);

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
    actions: { share, openTable, createBlank, forget, rename },
  };
}

/** Keeps the address bar in step without a router or a reload. */
function updateAddress(tableId) {
  const path = isValidTableCode(tableId) ? `/${tableId}` : '/';
  if (window.location.pathname !== path) {
    window.history.replaceState(null, '', path + window.location.search.replace(/[?&]t=[^&]*/, ''));
  }
}
