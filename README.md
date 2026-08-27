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
| `people` | `{ id, name, aliases[] }` |
| `groups` | `{ id, name, color, memberIds[] }` |
| `folders` | `{ id, name, isOpen, parentId, groupId }` |
| `terms` | `{ id, name, startDate, endDate }` |
| `events` | `{ id, name, weight, folderId, termId, startDate, endDate }` |
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

### Sections

A folder can sit inside one other folder, one level deep. "Check-ins" is a
section holding the eight weekly folders, so the whole check-in block collapses
in a single click, the same way "Community events" collapses its own dates.
"Townhouse" and "Community events" are flat folders whose dates expand directly
inside them.

The header is drawn as a grid rather than fixed rows: each leaf column is
covered in every row, by colSpan across siblings and rowSpan down through the
levels that do not apply. With nothing nested it stays two rows, as before.

Sessions can repeat weekly or on the first or last given weekday of each month —
the townhouse meets on the last Friday.

### Who a session is for

A folder of sessions can name a cohort — `folder.groupId`. "Monday 2pm" is a
series only the Monday 2pm students ever attend, so only they get a cell under
those dates and only they are scored on them. A folder with no cohort is open to
everyone, which is what community events are.

Without this the grid is a cross-product: 48 students against 112 weekly
sessions is 5,376 cells, of which about 690 mean anything. The other 87% invite
marking the wrong row, and make "count unmarked as missed" score the whole
roster at around 11%.

The **view picker** in the top bar is the daily control. Choosing "Tuesday
10am" narrows the columns to that series and, because people with no applicable
session in view are hidden, the roster to those students — the register as it
appeared in the spreadsheet. "All weekly sessions" hides the one-off events;
picking an event folder shows the whole programme against it.

The **filter** is a separate question: which people, by label. Groups a folder
points at are session cohorts and are marked as such; every other group is a
label — a role, a status, a year — and they filter independently. Filtering to
one cohort while viewing the events folder answers "which of my Tuesday
students came to the tailgates".

### Terms

A term is a semester. Events are stamped with the one they belong to, and the
term picker in the top bar decides which sessions the grid shows and which ones
the scores are computed from. The table itself is continuous — one roster, one
history — so a student can be followed across years, and nobody retypes the
roster in August.

Whether a folder is collapsed, which filters are on, how the grid is sorted and
which term is selected are all per-viewer. Everything else about a table is
shared.

### Bringing a spreadsheet across

**Add → Import a spreadsheet** takes a block copied straight out of Excel: the
row of dates, then a row per person. It reads several stacked blocks at once,
ignores the `score` and `times present` columns, and turns each block into a
folder of sessions plus a group of the people in it.

Marks are *detected, not assumed*. The mark vocabulary in these sheets changed
three times — `1`/`x`, then `✓`/`✕`/`V`, then emoji — and one legend defines the
same symbol twice, so every distinct symbol is listed with its count and a
suggested meaning for someone to confirm. Nothing is written until the preview
is accepted.

Re-importing is safe. People are matched by name and by alias, folders and
groups of the same name are reused, and a session already recorded on the same
date is not duplicated. The term is chosen from the pasted dates rather than
from whatever is on screen, so importing last year's sheet does not file it
under this year.

Dates written as bare `8/25`, with no year, are dated into a year you pick — the
dialog says which, because this app prints its own session columns that way and
a historical block pasted back would otherwise land in the current term.

**Add → Weekly session** builds a term of one weekday in a single step, which is
the shape of every check-in block in those sheets — and removes the class of
error where a hand-typed column picks up a date from the wrong semester.

### Names

The same student appears as `Matt Hwang` and `Matt Huang`, `Liv` and
`Olivia Frank`, `Charles LT` and `Charles Levy-Thiebaut`. Each person carries a
list of aliases, matched whenever a name is looked up — pasted sign-in sheets,
bulk marking, imports. Right-click a name for **Also known as**, or **Merge
with…** to fold a duplicate row in: its marks fill the gaps in the kept row, its
groups carry over, and its name becomes an alias. An alias that would also name
somebody else is refused rather than guessed at.

### Getting data out

Settings → Data exports the visible grid as CSV, or the whole table — every
term, every mark — as JSON, which can be restored later. The table is never the
only copy.

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
