/**
 * Connects one table to Firestore in both directions.
 *
 * Down: a subscription per slice. Attendance is applied as a diff against the
 * last snapshot we saw, so a remote update only touches the cells that actually
 * changed and leaves anything typed locally in the meantime alone.
 *
 * Up: the reducer's outbox is drained on a short debounce. Attendance goes as a
 * field-level merge; the structural slices go whole, since merging two people's
 * simultaneous roster edits is ambiguous in a way that per-cell marks are not.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isFirebaseConfigured,
  subscribeSlice,
  touchTable,
  writeCells,
  writeSlice,
} from './firebase';

const FLUSH_DELAY_MS = 500;

const SLICE_PAYLOAD = {
  roster: (table) => ({ people: table.people, groups: table.groups }),
  schedule: (table) => ({ folders: table.folders, events: table.events }),
  settings: (table) => table.settings,
};

export function useSync({ code, table, outbox, dispatch }) {
  const [status, setStatus] = useState(code ? 'connecting' : 'off');
  const [error, setError] = useState(null);

  const tableRef = useRef(table);
  tableRef.current = table;

  const outboxRef = useRef(outbox);
  outboxRef.current = outbox;

  const lastAttendance = useRef({});
  const flushTimer = useRef(null);
  const online = useRef(typeof navigator === 'undefined' ? true : navigator.onLine);

  /* ------------------------------------------------------------ subscribe */

  useEffect(() => {
    if (!code || !isFirebaseConfigured) {
      setStatus('off');
      return undefined;
    }

    setStatus('connecting');
    lastAttendance.current = {};
    let cancelled = false;

    const handleError = (err) => {
      if (cancelled) return;
      setError(err);
      setStatus('error');
    };

    const receive = (slice) => (data, isLocalEcho) => {
      if (cancelled || isLocalEcho) return;
      setStatus((current) => (current === 'saving' ? current : 'live'));

      if (slice !== 'attendance') {
        dispatch({ type: 'remote/merge', slice, data });
        return;
      }

      const previous = lastAttendance.current;
      const changed = {};
      for (const [key, value] of Object.entries(data)) {
        if (previous[key] !== value) changed[key] = value;
      }
      for (const key of Object.keys(previous)) {
        if (!(key in data)) changed[key] = null;
      }
      lastAttendance.current = data;
      if (Object.keys(changed).length > 0) {
        dispatch({ type: 'remote/merge', slice: 'attendance', data: changed });
      }
    };

    const unsubscribes = ['roster', 'schedule', 'settings', 'attendance'].map((slice) =>
      subscribeSlice(code, slice, receive(slice), handleError)
    );

    return () => {
      cancelled = true;
      unsubscribes.forEach((fn) => fn && fn());
    };
  }, [code, dispatch]);

  /* ---------------------------------------------------------------- flush */

  const flush = useCallback(async () => {
    if (!code || !isFirebaseConfigured) return;

    const current = outboxRef.current;
    const slices = ['roster', 'schedule', 'settings'].filter((slice) => current[slice]);
    const cells = current.attendance;
    const cellKeys = Object.keys(cells);
    const replaceAttendance = current.attendanceReplace;
    if (slices.length === 0 && cellKeys.length === 0 && !replaceAttendance) return;

    setStatus('saving');
    // Cleared optimistically: anything edited during the write marks the outbox
    // again and is picked up by the next flush.
    dispatch({ type: 'sync/drained', slices, cells: cellKeys, attendanceReplace: replaceAttendance });

    try {
      const writes = slices.map((slice) => writeSlice(code, slice, SLICE_PAYLOAD[slice](tableRef.current)));

      if (replaceAttendance) {
        // The whole set of marks was replaced (a cleared table), so the document
        // is overwritten. Merging would leave every deleted mark in place.
        const attendance = tableRef.current.attendance;
        lastAttendance.current = { ...attendance };
        writes.push(writeSlice(code, 'attendance', attendance));
      } else if (cellKeys.length > 0) {
        // Keep our own baseline in step so the next snapshot is not read as a
        // remote change and echoed back into state.
        for (const [key, value] of Object.entries(cells)) {
          if (value === null) delete lastAttendance.current[key];
          else lastAttendance.current[key] = value;
        }
        writes.push(writeCells(code, cells));
      }
      await Promise.all(writes);
      // Metadata only. If just this is rejected the table itself still saved,
      // so it must not turn a successful save into a reported failure.
      await touchTable(code).catch(() => {});
      setError(null);
      setStatus(online.current ? 'live' : 'offline');
    } catch (err) {
      // Firestore's offline cache keeps the write queued, so this is reported
      // rather than retried by hand.
      setError(err);
      setStatus('offline');
    }
  }, [code, dispatch]);

  useEffect(() => {
    if (!code || !isFirebaseConfigured) return undefined;
    const pending =
      outbox.roster ||
      outbox.schedule ||
      outbox.settings ||
      outbox.attendanceReplace ||
      Object.keys(outbox.attendance).length > 0;
    if (!pending) return undefined;

    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, FLUSH_DELAY_MS);
    return () => clearTimeout(flushTimer.current);
  }, [code, outbox, flush]);

  /**
   * Overwrites every slice in the cloud with this browser's copy — v1's
   * "Force Sync Local → Cloud". The escape hatch for when a table has drifted
   * and you know which copy is right.
   */
  const pushAll = useCallback(async () => {
    if (!code || !isFirebaseConfigured) throw new Error('This table is not shared.');
    setStatus('saving');
    try {
      const current = tableRef.current;
      await Promise.all([
        writeSlice(code, 'roster', SLICE_PAYLOAD.roster(current)),
        writeSlice(code, 'schedule', SLICE_PAYLOAD.schedule(current)),
        writeSlice(code, 'settings', SLICE_PAYLOAD.settings(current)),
        // Replaces the attendance document outright rather than merging, so
        // cells deleted locally are actually removed.
        writeSlice(code, 'attendance', current.attendance),
      ]);
      lastAttendance.current = { ...current.attendance };
      await touchTable(code).catch(() => {});
      dispatch({
        type: 'sync/drained',
        slices: ['roster', 'schedule', 'settings'],
        cells: [],
        attendanceReplace: true,
      });
      setError(null);
      setStatus('live');
    } catch (err) {
      setError(err);
      setStatus('error');
      throw err;
    }
  }, [code, dispatch]);

  /* ------------------------------------------------------------ liveness */

  useEffect(() => {
    const update = () => {
      online.current = navigator.onLine;
      setStatus((current) => {
        if (current === 'off' || current === 'error') return current;
        return navigator.onLine ? 'live' : 'offline';
      });
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return { status, error, flushNow: flush, pushAll };
}
