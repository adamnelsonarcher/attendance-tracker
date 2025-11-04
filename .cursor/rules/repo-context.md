# Attendance Tracker – Repository Context Rule

## Purpose
Provide shared context and invariants so future edits align with how data, state, and cloud sync work across the app. This rule applies to all code under `src/` and to any additions that touch the same domains.

## Architecture Overview
- React (CRA) single-page app. Entry at `src/index.js` renders `src/App.jsx`.
- `App.jsx` orchestrates domain hooks (`usePeople`, `useEvents`, `useAttendance`, `useSort`, `useCalculateScores`) and optional cloud sync via `useCloudSync`.
- Local-first: state lives in hooks and is persisted to `localStorage`. Cloud sync is optional and layered on top.
- UI composed of `TopBar`, `Table`, modals/forms under `components/TopBar/*`, plus dynamic styling via `DynamicStyles`.

## Data Domains (source of truth shapes)
- people (`usePeople`)
  - Shape: `{ id: string|number, name: string, groups: Array<{ id: string|number, color: string }> }`
  - IDs generated at creation (e.g., `Date.now()` or composite strings). Treat IDs as opaque.
  - `groups` here are lightweight chips derived from `groups.memberIds`; do not hand-edit `person.groups`—use `updatePeopleGroups(groups)`.
- groups (edited via `components/TopBar/Groups/Groups.jsx`)
  - Shape: `{ id: string|number, name: string, color: string, memberIds: Array<personId> }`
  - Groups own membership; people display derived group chips. Persist to `localStorage` as a whole array.
- events (`useEvents`)
  - Two kinds of items in one array:
    - Folder: `{ id, name, isFolder: true, isOpen: boolean, events: Array<Event> }`
    - Event: `{ id, name, weight: number, startDate: 'YYYY-MM-DD'|null, endDate: 'YYYY-MM-DD'|null, isFolder?: false }`
  - Folder event arrays are date-sorted (noon UTC to avoid TZ drift). Event IDs are opaque (often numbers via `Date.now()`).
- attendance (`useAttendance`)
  - Flat map keyed by `${personId}-${eventId}` → statusId (string). Example: `{ 'p1-e1': 'Present' }`.
  - `Select` indicates unset; not stored as null.
- settings (in `App.jsx` default + `Settings` modal)
  - Keys: `hideTitle`, `onlyCountAbsent`, `colorCodeAttendance`, `showHoverHighlight`, `enableStickyColumns`, `colorChangeDropdown`, `cloudSync`, `tableCode?`, `customStatuses`.
  - `customStatuses`: `{ id, name, credit: number|null, color, isDefault }[]`. `credit=null` means N/A.

## Persistence Rules (local-first)
- Every domain hook mirrors state to `localStorage` on change. When loading from cloud, write to `localStorage` before calling `setState`.
- Do not mutate `localStorage` directly outside the places already established (hooks and sync flows). New features should prefer updating state via setters, letting effects write to `localStorage`.

## Cloud Sync Rules (useCloudSync)
- Model: local-first with debounced write-only updates; one-time initial cloud fetch.
  - Initial load: When `settings.cloudSync === true` and a valid `tableCode` exists, fetch once via `getTableData`; seed `localStorage` and state; set `lastSyncedData` and status `'saved'`.
  - Ongoing: local is the source of truth. Changes are detected by deep-compare of `{ people, events, attendance, groups, settings }` without timestamps.
  - Debounce: push to cloud after 30,000ms of inactivity. During debounce, status is `'unsaved'`; on push `'saving'`; after success `'saved'`.
  - Timestamp: include `lastUpdated: new Date().toISOString()` when writing.
- Do not subscribe to remote changes in this hook. If you add remote subscriptions, you must define conflict resolution (e.g., LWW with timestamps, field-level merges, or vector clocks) and update invariants accordingly.
- Table switching / joining: use `loadTableData(code)` from `useCloudSync`; it ensures `settings.tableCode` and `cloudSync: true` are set and state/localStorage are repopulated.
- Adding new top-level synced keys: update both the compare logic and `lastSyncedData` writes in `useCloudSync` so change detection continues to work.
- Attendance migration: `migrateAttendanceData` normalizes any legacy status values; extend its mapping when adding new statuses/aliases.

## Sorting and Filtering Semantics
- Sorting (`useSort`):
  - Types: `'firstName' | 'lastName' | 'event' | 'group' | 'score' | 'none'`.
  - Event sort uses status priority: Present < Absent < Late < DNA < Select (implicit).
  - Score sort toggles direction; event sort toggles off if re-clicked.
- Filters (`Table` with `GroupFilter`):
  - Group filters: state 1 (include), -1 (exclude), 0 (neutral). If any include exists, person must match at least one include and no excludes.
  - Folder filters: can hide/show entire folders; when any folder is positively filtered, non-matching folders/events are hidden.

## UI/UX Invariants
- `DynamicStyles` injects CSS rules for `select[data-status="$STATUS"]` when `settings.colorCodeAttendance` is active. Keep `data-status` attributes in selects accurate.
- `Table` adds classes for hover highlighting and a `treat-select-as-dna` class when `settings.onlyCountAbsent` is enabled; ensure new UI respects these toggles.
- Folder headers control `isOpen`; respect `colSpan` semantics in headers and maintain alignment.

## IDs and Consistency
- Person/group/event IDs can be numbers or strings. Treat IDs as opaque, stable identifiers—never coerce or parse them for logic.
- When generating new IDs, prefer monotonic strategies (`Date.now()` plus random suffix) to reduce collision risk.

## Firebase Integration
- Config from `REACT_APP_FIREBASE_*` envs. Firestore doc: `tables/{tableCode}`.
- Writes via `setDoc`; reads via `getDoc`. A `subscribeToTable` helper exists but is not consumed by `useCloudSync`.
- On first enabling sync (`Settings`), generate a table code, persist it, and push a full snapshot.

## Extending Statuses and Scoring
- `customStatuses` drive scoring via `credit` values and UI colors.
- `useCalculateScores` computes raw and weighted percentages from flat events and attendance map. If adding status types, ensure:
  - A `customStatuses` entry exists for the new status.
  - Any migration mapping in `useCloudSync` is updated if legacy values may appear.

## Performance Considerations
- Rendering computes scores per person by flattening events and looking up attendance; acceptable for small-to-medium tables. For larger data, memoize derived structures (flat event list, person scores) or virtualize rows.
- Event sorting within folders uses noon-UTC dates to avoid TZ issues—preserve this.

## Operational Guidance
- Resetting/creating a new table should clear local storage for affected domains and, if cloud sync is active, optionally push the cleared snapshot.
- When adding new features that touch synced domains, adjust: localStorage mirrors, `useCloudSync` compare/set, Settings UI (if needed), and `DynamicStyles`/Table behaviors.


---
By following these rules, new code will interoperate correctly with persistence, sorting/filtering, and cloud sync behaviors established across the app.

