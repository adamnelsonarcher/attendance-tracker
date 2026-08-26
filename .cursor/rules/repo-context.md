# Attendance Tracker — repository context

Invariants for anything under `src/`. Read before changing data, state or sync.

## Shape

A table is five flat collections plus settings. Nothing nests.

```
people      { id, name }
groups      { id, name, color, memberIds[] }
folders     { id, name, isOpen }
events      { id, name, weight, folderId, startDate, endDate }
attendance  { "personId-eventId": statusId }
settings    { statuses[], countUnmarkedAsAbsent, showTitle, colorCells,
              colorDropdown, highlightHover, stickyColumns }
```

- **Events point at folders; folders never contain events.** The previous model
  put both in one array with an `isFolder` flag, which forced every mutation to
  walk a tree and every render to have two branches. Do not reintroduce it.
- **Groups own membership and nothing else stores it.** Derive per-person groups
  with `buildMembership(groups)`. Never write a `groups` array onto a person.
- **Attendance keys come from `cellKey(personId, eventId)` and are never parsed.**
  To find orphans, rebuild the valid key set from people × events
  (`pruneAttendance`), don't split on `-`.
- **IDs are opaque.** Generate with `newId(prefix)`. Never parse or coerce one.
- **Dates are `YYYY-MM-DD` strings**, parsed at noon UTC via `parseDate` so a day
  never slips backwards west of UTC.
- `statuses[].credit === null` means "does not count" — the event leaves both
  sides of the fraction. That is different from `credit: 0`, which counts
  against the score.

## Rules of the layers

- `data/model.js` — shapes, ID generation, and `normalizeTable`, which accepts
  **any** historical shape and never throws. All external input (Firestore,
  localStorage) goes through it.
- `data/selectors.js` — every derived value: scores, columns, filtering,
  sorting, name matching. Pure functions of `(table, view)`. Put new derived
  logic here, not in components.
- `state/tableReducer.js` — the only place a table is mutated. Every edit is an
  action. **Each action must mark the slices it touched in `outbox`**, or the
  change will never sync.
- `sync/` — Firestore. `useSync` drains the outbox and applies remote slices.
- `components/` — rendering only. No business logic.

## Sync invariants

- One Firestore document per slice: `tables/{CODE}/slices/{roster|schedule|settings|attendance}`.
- **Attendance is written per field with `{ merge: true }`**, and `null` means
  `deleteField()`. Never write the attendance document whole except via
  `attendanceReplace` (a cleared table) or `pushAll` (the manual override).
- Incoming attendance is applied as a **diff against the last snapshot seen**,
  not as a wholesale replace, so local edits made during the round trip survive.
- Snapshots with `metadata.hasPendingWrites` are this client's own echo — ignore
  them.
- Never `list` the `tables` collection or the `slices` subcollection;
  `firestore.rules` denies it so codes cannot be enumerated. Fetch slices by name.
- Adding a synced field means updating `SLICE_PAYLOAD` in `useSync`, the matching
  `mergeSlice` case in the reducer, and `normalizeTable`.

## Local storage

- Keys are `at:table:{id}`, `at:registry`, `at:active`. **Multiple tables coexist**
  — opening a shared link must never overwrite another table.
- Table ids are either a six-character share code or a `local`/`local-xxxxxx` id.
  `isValidTableCode(id)` is what decides whether a table is shared.
- Legacy v1 keys (`people`, `events`, …) are migrated once and moved to
  `at:legacy:*` rather than deleted.

## Styling

- `styles/tokens.css` holds every colour, space, radius and z-index. Use the
  tokens; do not hard-code values.
- `styles/base.css` is the **only** file that styles bare elements. Component
  stylesheets style their own classes and never `body`, `table`, `button`, etc.
- Sticky cells take `background: inherit` from their row. Do not restate stripe
  colours per column position.
- The table fills the space left by the shell (`flex: 1; min-height: 0`). Never
  reintroduce a `calc(100vh - Npx)` height.

## Testing

`src/data/__tests__` and `src/state/__tests__` cover scoring, migration and the
reducer. Scoring and the v1 migration are the two places a silent regression
does real damage — add cases there when touching either.
