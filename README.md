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
| `settings` | name, statuses, scoring and display options |

Groups own membership and nothing else stores it. Events point at a folder
rather than nesting inside one, which is what keeps the table rendering to a
single code path.

Everything in `settings` belongs to the table rather than to the browser looking
at it, so it travels with a share link — the name included. Whoever opens the
link sees what the table is called, not a code. The one exception is whether a
folder is collapsed, which is a per-viewer preference like the filters and the
sort and is deliberately never sent.

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

Tables shared by earlier versions kept everything in the `tables/{CODE}`
document itself. Opening one still works: it is converted on read and the slice
documents are written once, in full, on adoption.

Attendance is written per field with `{ merge: true }`, so two people marking
different rows of the same event both land. Incoming snapshots are applied as a
diff against the last one seen, so a remote update never reverts something typed
locally a moment earlier. Firestore's offline cache holds writes made without a
connection and sends them on reconnect.

Every table this browser has opened is kept separately, so opening someone's
share link never replaces your own table — switch between them from the name in
the top-left. Changes still on the debounce are sent before switching tables and
when the tab is hidden, so closing the page does not lose the last edit.

There is no un-share. With no accounts the link is the only credential, and
anyone holding it still holds it. "Make a private copy" in the share dialog is
honest about that: it takes a copy, switches you to it, and leaves the shared
table where it is.

### Access

There is no sign-in. Anyone with a table's link or code can read and write it.
The view-only link (`?view=1`) hides the editing controls as a courtesy; it is
not a permission boundary.

[`firestore.rules`](firestore.rules) blocks listing the `tables` collection, so
codes cannot be enumerated, and restricts writes to the four known slices.

**These rules must be deployed before sharing works at all.** The per-slice
paths (`tables/{CODE}/slices/*`) are new, and a rule set written for the old
single-document layout denies them — the app reports "Missing or insufficient
permissions" when you try to create a share link.

```bash
npm run firebase:login    # one-time Google sign-in
npm run deploy:rules
```

Verified against the live project: the config is correct and the deploy is
blocked only by that sign-in.

The rules cap a slice at 20,000 fields, which for attendance means people ×
events. That is well inside Firestore's own per-document limits and far beyond
a normal roster, but a table past it would have its writes rejected — the app
reports "sync error" rather than failing silently.

Deploying them also stops the pre-0.9 app from saving, since it wrote the whole
table into `tables/{CODE}` and the rules now only allow metadata there.

Optionally, register a reCAPTCHA v3 site key under Firebase App Check and set
`REACT_APP_APPCHECK_SITE_KEY`. Requests then have to prove they came from this
app, which closes off anonymous use of the endpoints — a cost concern rather
than a data one, since a caller still has to guess a code to reach a table.
With no key set, nothing changes.

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
