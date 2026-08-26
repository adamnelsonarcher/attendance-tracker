# Attendance Tracker

A shared grid for tracking attendance and participation across recurring events —
people down the side, events across the top, a score per person.

Built for CIR operations, but nothing in it is CIR-specific.

## Running it

```bash
npm install
npm start
```

Sharing needs a Firebase project. Copy `.env.example` to `.env` and fill in the
keys from your Firebase web app config. Without them the app still runs — it
just stays local to the browser.

```bash
npm test          # unit tests for scoring, migration and the reducer
npm run build     # production bundle
```

## How it works

### Data

A table is five flat collections plus settings:

| Collection | Shape |
| --- | --- |
| `people` | `{ id, name }` |
| `groups` | `{ id, name, color, memberIds[] }` |
| `folders` | `{ id, name, isOpen }` |
| `events` | `{ id, name, weight, folderId, startDate, endDate }` |
| `attendance` | `{ "personId-eventId": statusId }` |
| `settings` | statuses, scoring and display options |

Groups own membership and nothing else stores it. Events point at a folder
rather than nesting inside one, which is what keeps the table rendering to a
single code path.

`normalizeTable` in [`src/data/model.js`](src/data/model.js) accepts any older
shape — including tables written by the pre-0.9 versions — and upgrades it. It
never throws; anything unrecognisable is dropped.

### State

Every edit is an action handled by one reducer in
[`src/state/tableReducer.js`](src/state/tableReducer.js). Each action records
which slices it touched in an `outbox`, which is what the sync layer sends.

### Sharing

A shared table lives in Firestore as one document per slice:

```
tables/{CODE}                    metadata
tables/{CODE}/slices/roster      { people, groups }
tables/{CODE}/slices/schedule    { folders, events }
tables/{CODE}/slices/settings    { ... }
tables/{CODE}/slices/attendance  { "personId-eventId": statusId }
```

Attendance is written per field with `{ merge: true }`, so two people marking
different rows of the same event both land. Incoming snapshots are applied as a
diff against the last one seen, so a remote update never reverts something typed
locally a moment earlier. Firestore's offline cache holds writes made without a
connection and sends them on reconnect.

Every table this browser has opened is kept separately, so opening someone's
share link never replaces your own table — switch between them from the name in
the top-left.

### Access

There is no sign-in. Anyone with a table's link or code can read and write it.
The view-only link (`?view=1`) hides the editing controls as a courtesy; it is
not a permission boundary.

[`firestore.rules`](firestore.rules) blocks listing the `tables` collection, so
codes cannot be enumerated, and caps document size. Deploy it with:

```bash
firebase deploy --only firestore:rules
```

### Hosting

Share links are paths (`/ABC123`), so the host has to serve `index.html` for
every route. `vercel.json` and `public/_redirects` cover Vercel and Netlify. On
a host without rewrites, `?t=ABC123` works instead.

## Layout

```
src/
  data/      model, migration, derived values (scores, columns, filters), storage
  state/     the reducer and the store hook
  sync/      Firestore setup and the two-way sync hook
  components/
    Table/   the grid, its context menus and the filter
    TopBar/  toolbar, table switcher, sync status
    dialogs/ add people, add event, groups, share, join, settings
    ui/      modal and popover primitives
  styles/    tokens and global element defaults
```

Only `styles/base.css` styles bare elements. Component stylesheets style their
own classes and nothing else.
