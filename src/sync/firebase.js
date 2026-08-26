/**
 * Firestore setup and the raw read/write primitives.
 *
 * A shared table is one document per slice rather than one document for
 * everything:
 *
 *   tables/{CODE}                    metadata
 *   tables/{CODE}/slices/roster      { people, groups }
 *   tables/{CODE}/slices/schedule    { folders, events }
 *   tables/{CODE}/slices/settings    { ... }
 *   tables/{CODE}/slices/attendance  { "personId-eventId": statusId }
 *
 * v1 wrote all of it as a single `setDoc` every 30 seconds, so whoever stopped
 * typing last erased everyone else's work. Splitting by slice means editing the
 * roster cannot clobber attendance, and writing attendance with `{ merge: true }`
 * means marking one cell cannot clobber the cell next to it.
 */

import { initializeApp } from 'firebase/app';
import {
  deleteField,
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

const config = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

/** Sharing is optional. With no config the app runs entirely on localStorage. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let db = null;

function database() {
  if (!isFirebaseConfigured) return null;
  if (!db) {
    const app = initializeApp(config);
    // The offline cache is what lets marks made on bad venue wifi survive and
    // send themselves later, instead of being lost on reload. The multi-tab
    // manager matters because having the table open in two tabs is normal, and
    // the single-tab default leaves the second tab without persistence.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return db;
}

const tableRef = (code) => doc(database(), 'tables', code);
const sliceRef = (code, slice) => doc(database(), 'tables', code, 'slices', slice);

/** The four documents a table is split across. */
export const SLICES = ['roster', 'schedule', 'settings', 'attendance'];

/**
 * Reads every slice at once, for joining a table the first time.
 *
 * Each slice is fetched by name rather than by listing the collection, because
 * `firestore.rules` denies `list` — that is what stops someone walking the
 * `tables` collection to harvest codes.
 *
 * Tables created before the split live entirely in the `tables/{CODE}` document
 * and have no slices; those come back as `legacy` and are converted on read.
 * The first write after that lays down the slices.
 */
export async function fetchTable(code) {
  if (!isFirebaseConfigured) return null;
  const meta = await getDoc(tableRef(code));
  if (!meta.exists()) return null;

  const snapshots = await Promise.all(SLICES.map((slice) => getDoc(sliceRef(code, slice))));
  const result = { meta: meta.data() };
  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists()) result[SLICES[index]] = snapshot.data();
  });
  return result;
}

/** Creates the table document and writes the first full snapshot of each slice. */
export async function createTable(code, table, name) {
  if (!isFirebaseConfigured) throw new Error('Sharing is not configured');
  await setDoc(tableRef(code), {
    version: table.version,
    name: name || null,
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });
  await Promise.all([
    writeSlice(code, 'roster', { people: table.people, groups: table.groups }),
    writeSlice(code, 'schedule', { folders: table.folders, events: table.events }),
    writeSlice(code, 'settings', table.settings),
    writeSlice(code, 'attendance', table.attendance),
  ]);
}

/** Replaces a whole slice. Used for roster, schedule and settings. */
export function writeSlice(code, slice, data) {
  return setDoc(sliceRef(code, slice), data);
}

/**
 * Writes only the cells that changed. `null` deletes the cell. Two people
 * marking different rows of the same event both land, because Firestore merges
 * per field rather than replacing the document.
 */
export function writeCells(code, cells) {
  const payload = {};
  for (const [key, value] of Object.entries(cells)) {
    payload[key] = value === null ? deleteField() : value;
  }
  return setDoc(sliceRef(code, 'attendance'), payload, { merge: true });
}

export function touchTable(code) {
  return setDoc(tableRef(code), { lastUpdated: serverTimestamp() }, { merge: true });
}

/**
 * Subscribes to one slice. `onData(data, isLocalEcho)` — an echo is a snapshot
 * that only reflects this client's own un-acknowledged write, which must not be
 * fed back into state.
 */
export function subscribeSlice(code, slice, onData, onError) {
  if (!isFirebaseConfigured) return () => {};
  return onSnapshot(
    sliceRef(code, slice),
    { includeMetadataChanges: false },
    (snapshot) => {
      if (!snapshot.exists()) return;
      onData(snapshot.data(), snapshot.metadata.hasPendingWrites);
    },
    onError
  );
}
