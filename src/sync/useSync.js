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
import { SLICE_NAMES, SLICE_PAYLOAD, diffAttendance } from './slices';

const FLUSH_DELAY_MS = 500;
/** Ceiling on the retry backoff. Long enough to stop hammering, short enough
 *  that deploying corrected rules is noticed without a reload. */
const MAX_RETRY_DELAY_MS = 60000;

export function useSync({ code, table, outbox, dispatch }) {
  const [status, setStatus] = useState(code ? 'connecting' : 'off');
  const [error, setError] = useState(null);

  const tableRef = useRef(table);
  tableRef.current = table;

  const outboxRef = useRef(outbox);
  outboxRef.current = outbox;

  // Which table is open right now, so a write that settles after a table switch
  // can tell that it belongs to the previous one.
  const codeRef = useRef(code);
  codeRef.current = code;

  const lastAttendance = useRef({});
  const flushTimer = useRef(null);
  const failures = useRef(0);
  const online = useRef(typeof navigator === 'undefined' ? true : navigator.onLine);

  /* ------------------------------------------------------------ subscribe */

  useEffect(() => {
    if (!code || !isFirebaseConfigured) {
      setStatus('off');
      return undefined;
    }

    setStatus('connecting');
    lastAttendance.current = {};
    failures.current = 0;
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

      const changed = diffAttendance(lastAttendance.current, data);
      lastAttendance.current = data;
      if (Object.keys(changed).length > 0) {
        dispatch({ type: 'remote/merge', slice: 'attendance', data: changed });
      }
    };

    const unsubscribes = SLICE_NAMES.map((slice) =>
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

    // Everything this write needs is captured before the first await. Switching
    // tables is what makes that matter: `code` here is the table we are sending,
    // while the refs move on to whichever table is open when the write settles.
    const replacedAttendance = replaceAttendance ? { ...tableRef.current.attendance } : null;
    const name = tableRef.current.settings?.name;
    const isStillOpen = () => codeRef.current === code;

    try {
      const writes = slices.map((slice) => writeSlice(code, slice, SLICE_PAYLOAD[slice](tableRef.current)));

      if (replacedAttendance) {
        // The whole set of marks was replaced (a cleared table), so the document
        // is overwritten. Merging would leave every deleted mark in place.
        writes.push(writeSlice(code, 'attendance', replacedAttendance));
      } else if (cellKeys.length > 0) {
        writes.push(writeCells(code, cells));
      }
      await Promise.all(writes);

      // The baseline only moves once the write has actually landed. Advancing it
      // first meant a rejected write left us believing the server held values it
      // never received, so the next snapshot diffed them as unchanged forever.
      // It belongs to whichever table is subscribed now, so leave it alone if
      // that is no longer this one.
      if (isStillOpen()) {
        if (replacedAttendance) {
          lastAttendance.current = replacedAttendance;
        } else {
          for (const [key, value] of Object.entries(cells)) {
            if (value === null) delete lastAttendance.current[key];
            else lastAttendance.current[key] = value;
          }
        }
      }

      // Metadata only. If just this is rejected the table itself still saved,
      // so it must not turn a successful save into a reported failure.
      await touchTable(code, name).catch(() => {});
      if (!isStillOpen()) return;
      failures.current = 0;
      setError(null);
      setStatus(online.current ? 'live' : 'offline');
    } catch (err) {
      // The drain above was optimistic, so hand the changes back before
      // reporting; otherwise a rejected write throws away the edits it carried.
      // Only if we are still on this table — requeueing into a different one
      // would write these cells under the wrong code.
      if (!isStillOpen()) return;
      failures.current += 1;
      dispatch({ type: 'sync/requeue', slices, cells, attendanceReplace: replaceAttendance });
      setError(err);
      // Offline is a queue that will drain itself; a rejection while online is
      // not, and saying "offline" would hide a permissions problem.
      setStatus(online.current ? 'error' : 'offline');
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

    // Requeueing hands back a fresh outbox, which re-runs this effect — so a
    // permanently rejected write (rules not deployed, say) would otherwise
    // retry twice a second forever. Offline writes never reject; Firestore
    // queues them. So every rejection seen here is worth backing off from.
    const delay = Math.min(FLUSH_DELAY_MS * 2 ** failures.current, MAX_RETRY_DELAY_MS);

    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, delay);
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
      await touchTable(code, current.settings?.name).catch(() => {});

      // Same rule as the debounced flush: once the write settles, the refs and
      // the outbox may belong to a different table.
      if (codeRef.current !== code) return;

      lastAttendance.current = { ...current.attendance };
      dispatch({
        type: 'sync/drained',
        slices: ['roster', 'schedule', 'settings'],
        cells: [],
        attendanceReplace: true,
      });
      setError(null);
      setStatus('live');
    } catch (err) {
      if (codeRef.current === code) {
        setError(err);
        setStatus('error');
      }
      throw err;
    }
  }, [code, dispatch]);

  /* ------------------------------------------------------------ liveness */

  /**
   * Send anything still on the debounce before the page goes away.
   *
   * `visibilitychange` is the one the browser reliably delivers — `beforeunload`
   * is skipped on mobile and on tab discard. There is nothing to await: once
   * Firestore has accepted a write it is in the durable offline queue and will
   * be sent, on this page load or the next.
   */
  useEffect(() => {
    if (!code || !isFirebaseConfigured) return undefined;

    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', flushIfHidden);
    window.addEventListener('pagehide', flush);

    return () => {
      document.removeEventListener('visibilitychange', flushIfHidden);
      window.removeEventListener('pagehide', flush);
    };
  }, [code, flush]);

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
