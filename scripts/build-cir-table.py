"""Builds the CIR Fall 2026 starter table from the two source workbooks.

    python scripts/build-cir-table.py [path/to/downloads]

Writes public/cir-fall-2026.json. Everything it emits traces back to a cell in
one of those workbooks; nothing is invented.
"""
import io, json, os, re, sys, datetime, unicodedata
import pandas as pd

SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads')
CHECKIN_XLSX = os.path.join(SOURCE, 'Check-In Attendance.xlsx')
EVENTS_XLSX = os.path.join(SOURCE, 'FY26_EVENTS_ATTENDANCE.xlsx')

SHIFT_RE = re.compile(r'^(mon|tue|tues|wed|thur|thurs|fri|sat|sun)', re.I)


def _is_date(v):
    return isinstance(v, (pd.Timestamp, datetime.datetime, datetime.date))


def read_checkin(path):
    """Each sheet is a semester; each block is a weekly session."""
    book = pd.ExcelFile(path)
    sheets = {}
    for name in book.sheet_names:
        df = book.parse(name, header=None)
        blocks, current = [], None
        for _, row in df.iterrows():
            vals = row.tolist()
            label = '' if pd.isna(vals[0]) else str(vals[0]).strip()
            dates = [(j, v) for j, v in enumerate(vals[1:], start=1) if _is_date(v)]

            if label and SHIFT_RE.match(label) and len(dates) >= 3:
                current = {'shift': label, 'dates': dates, 'people': []}
                blocks.append(current)
                continue
            if current and label and not SHIFT_RE.match(label):
                marks = {}
                for j, d in current['dates']:
                    v = vals[j] if j < len(vals) else None
                    if not pd.isna(v) and str(v).strip():
                        marks[str(pd.Timestamp(d).date())] = str(v).strip()
                current['people'].append({'name': label, 'marks': marks})
        if blocks:
            sheets[name] = blocks
    return sheets


def read_events(path, sheet):
    """Event blocks are `<title>` above a `Name | <date> | Staff` header row."""
    df = pd.ExcelFile(path).parse(sheet, header=None)
    rows, cols = df.shape
    found = []
    for i in range(rows):
        for j in range(cols):
            v = df.iat[i, j]
            if not (isinstance(v, str) and v.strip().lower() == 'name'):
                continue
            date = df.iat[i, j + 1] if j + 1 < cols else None
            title = df.iat[i - 1, j] if i > 0 else None
            if _is_date(date) and isinstance(title, str) and title.strip():
                found.append((title.strip(), str(pd.Timestamp(date).date())))
    return found


checkin = read_checkin(CHECKIN_XLSX)

_counter = [0]

def nid(prefix):
    _counter[0] += 1
    return f"{prefix}_seed{_counter[0]:04d}"

# ---------------------------------------------------------------- name tidying

def norm(name):
    n = unicodedata.normalize('NFD', name)
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z ]', '', n.lower()).strip()

# Same student, different spellings across the sheets. Canonical name first.
ALIAS_GROUPS = [
    ('Matt Hwang', ['Matt Huang', 'Matt H']),
    ('Johnnie Gelehrte', ['Johnnie Gelherte', 'Johnny Gelehrte', 'Johnnie']),
    ('Chandler Bowick', ['Chandler Bowlick', 'Chandler']),
    ('Olivia Frank', ['Liv Frank', 'Liv']),
    # No bare 'Charles': there are two of them in this roster, and an alias that
    # shadows another student's name puts attendance on the wrong row.
    ('Charles Levy-Thiebaut', ['Charles LT', 'Charles Levy']),
    ('Charles Van Meter', ['Charles VanMeter', 'Charles V']),
    ('Collin Hull', ['Colin Hull', 'Collin', 'Colin']),
    ('Anisa Casteneda', ['Anissa Casteneda', 'Anissa C', 'Anisa C']),
    ('Anisa Limon', ['Anisa L', 'Anisa l']),
    ('William Villanueva', ['William Villanuevo']),
    ('William Breeding', ['Will Breeding']),
    ('Dani Hilliker', ['Dani H.', 'Dani H']),
    ('Hailey Ruiz', ['Hailey']),
    ('Sekoi Henry', ['Sekoi']),
    ('Aidan Lindsey', ['Aidan L', 'Aidan linsey']),
    ('Aidan Fulton', ['Aidan F']),
    ('Sam Harwell', ['Sam H']),
    ('Lauren Dickerson', ['Lauren D', 'Lauren']),
    ('Josie Muschel', ['Josie']),
    ('Molly Roden', ['Molly']),
    ('Adam Nelson-Archer', ['Adam']),
    ('Harper Corona', ['Harper']),
    ('Aleia Sen', ['Aleia']),
    ('Ash Rozelle', ['Ash']),
    ('Caroline Oman', ['Caroline']),
    ('Connor Sweeney', ['Connor']),
    ('Josh Regner', ['Josh']),
    ('Sam Berryman', ['Sam B']),
    ('Emmalee S', ['Emmalee']),
    ('Oscar Perez', ['Oscar']),
    ('Martha Wagner', ['Martha']),
    ('Kamryn Jimenez', ['Kammy']),
]

canon = {}
aliases_for = {}
for primary, alts in ALIAS_GROUPS:
    canon[norm(primary)] = primary
    aliases_for.setdefault(primary, set()).update(alts)
    for a in alts:
        canon[norm(a)] = primary

def canonical(name):
    return canon.get(norm(name), name.strip())

# ------------------------------------------------------------------ the roster
# Fall 26 is the semester being set up; the two before it are who is likely to
# come back. Anyone seen in those is on the roster so nobody retypes them.
FALL26 = 'Fall 26'
PRIOR = 'Spring 26'          # most recent completed semester
RECENT = [PRIOR, "Fall '25"]

fall_assign = {}
for block in checkin.get(FALL26, []):
    shift = block['shift'].strip()
    for p in block['people']:
        fall_assign.setdefault(shift, []).append(canonical(p['name']))

# Students almost always keep the same slot term to term, so last semester's
# assignment is the right starting point; Fall 26's own entries win where they
# exist. Staff confirm the list rather than rebuilding it.
prior_assign = {}
for block in checkin.get(PRIOR, []):
    shift = block['shift'].strip()
    for p in block['people']:
        prior_assign.setdefault(shift, []).append(canonical(p['name']))

returning = [n for names in prior_assign.values() for n in names]

DROP = {'chloe', 'ellie', 'raquell'}          # staff, tracked separately
placed = {n for names in fall_assign.values() for n in names}
roster_order = []
seen = set()
for n in [x for names in fall_assign.values() for x in names] + returning:
    k = norm(n)
    if k in seen or k in DROP or not k:
        continue
    seen.add(k)
    roster_order.append(n)

# An alias that is also another student's first name is dropped rather than
# shipped: matching it would be a coin flip between two people.
first_names = {}
for name in roster_order:
    first_names.setdefault(norm(name).split()[0], []).append(name)

people = []
by_name = {}
dropped_aliases = []
for name in roster_order:
    keep = []
    for alias in sorted(aliases_for.get(name, [])):
        others = [o for o in first_names.get(norm(alias), []) if o != name]
        if others:
            dropped_aliases.append((name, alias, others))
            continue
        keep.append(alias)
    person = {'id': nid('p'), 'name': name, 'aliases': keep}
    people.append(person)
    by_name[name] = person

# ------------------------------------------------------------------- the shifts
# Taken from the Fall 26 tab, with the dates regenerated rather than copied: the
# Monday block in that tab carries a date from the previous Spring.
SHIFTS = [
    ('Monday 2pm', 0),
    ('Tuesday 10am', 1),
    ('Tuesday 3pm', 1),
    ('Wednesday 10am', 2),
    ('Wednesday 3pm', 2),
    ('Thursday 10am', 3),
    ('Thursday 3pm', 3),
    ('Friday 2pm', 4),
]

SHIFT_ALIASES = {
    'thurs 10am': 'Thursday 10am',
    'thurs 3pm': 'Thursday 3pm',
    'wed 10am': 'Wednesday 10am',
    'wed 3pm': 'Wednesday 3pm',
}

def shift_key(label):
    key = label.strip().lower()
    return SHIFT_ALIASES.get(key, label.strip())

# Someone listed in two Spring blocks either transferred mid-semester or really
# attends both. Real marks tell them apart: a block that is nearly all
# holiday/blank after a transfer carries very few. Anything under 40% of the
# person's busiest block is treated as the one they left.
real_marks = {}
for block in checkin.get(PRIOR, []):
    key = shift_key(block['shift'])
    for person in block['people']:
        name = canonical(person['name'])
        count = sum(1 for m in person['marks'].values() if m.strip() and m.strip() != '\u26aa')
        real_marks.setdefault(name, {})[key] = count

abandoned = set()
for name, per_shift in real_marks.items():
    if len(per_shift) < 2:
        continue
    best = max(per_shift.values())
    for shift, count in per_shift.items():
        if best > 0 and count < best * 0.4:
            abandoned.add((name, shift))
            print(f'dropped {name} from {shift} ({count} real marks vs {best} in their main block)')

assign_by_shift = {}
for shift, names in prior_assign.items():
    key = shift_key(shift)
    assign_by_shift.setdefault(key, []).extend(n for n in names if (n, key) not in abandoned)

# Anyone Fall 26 already placed moves to that slot and out of the old one.
moved = {n for names in fall_assign.values() for n in names}
for key in assign_by_shift:
    assign_by_shift[key] = [n for n in assign_by_shift[key] if n not in moved]
for shift, names in fall_assign.items():
    assign_by_shift.setdefault(shift_key(shift), []).extend(names)

# Fall 2026: first class 2026-08-24 (Mon) through 2026-12-04 (Fri).
# Weekly sessions run to the last week of class; the term itself runs on to
# cover the end-of-semester socials, which is where White Elephant sits.
TERM = {'id': nid('t'), 'name': 'Fall 2026', 'startDate': '2026-08-24', 'endDate': '2026-12-18'}
FIRST = datetime.date(2026, 8, 24)
LAST = datetime.date(2026, 12, 4)
# Thanksgiving week: no sessions.
BREAK = {datetime.date(2026, 11, 23) + datetime.timedelta(days=i) for i in range(5)}

def weekly(weekday):
    d = FIRST + datetime.timedelta(days=(weekday - FIRST.weekday()) % 7)
    out = []
    while d <= LAST:
        if d not in BREAK:
            out.append(d.isoformat())
        d += datetime.timedelta(days=7)
    return out

folders, groups, events = [], [], []
for label, weekday in SHIFTS:
    seen_ids = []
    for n in assign_by_shift.get(label, []):
        if n in by_name and by_name[n]['id'] not in seen_ids:
            seen_ids.append(by_name[n]['id'])

    group = {
        'id': nid('g'),
        'name': label,
        'color': ['#5b8def', '#e8955a', '#3fae7d', '#b06ad8', '#d95b6b', '#3ca6b8', '#c9a227', '#7a8290'][len(groups) % 8],
        'memberIds': seen_ids,
    }
    groups.append(group)

    # The series belongs to its cohort. Only these students get a cell under
    # these dates, and only they are scored on them — which is how the block
    # read in the spreadsheet this replaces.
    folder = {'id': nid('f'), 'name': label, 'isOpen': True, 'groupId': group['id']}
    folders.append(folder)

    for date in weekly(weekday):
        m, d = date.split('-')[1:]
        events.append({
            'id': nid('e'),
            'name': f'{int(m)}/{int(d)}',
            'weight': 1,
            'folderId': folder['id'],
            'termId': TERM['id'],
            'startDate': date,
            'endDate': None,
        })

# Anyone on the roster without a slot yet, so they are one click from having one
# rather than invisible.
assigned_ids = {i for g in groups for i in g['memberIds']}
unplaced = [p['id'] for p in people if p['id'] not in assigned_ids]
if unplaced:
    groups.append({
        'id': nid('g'),
        'name': 'Needs a session',
        'color': '#9aa5b1',
        'memberIds': unplaced,
    })

# ------------------------------------------------------------ community events
# The recurring fixtures from the events workbook, so staff recognise the shape.
# No cohort: anyone in the programme can turn up to a tailgate.
EVENT_FOLDER = {'id': nid('f'), 'name': 'Community events', 'isOpen': True, 'groupId': None}
folders.append(EVENT_FOLDER)

# Read from the FY26 workbook's own Fall 26 tab rather than guessed at, so
# every column here is one staff already have on their calendar.
COMMUNITY = sorted(set(read_events(EVENTS_XLSX, 'Fall 26')), key=lambda e: (e[1], e[0]))
print(f'community events from the workbook: {len(COMMUNITY)}')
for name, date in COMMUNITY:
    weight = 1
    events.append({
        'id': nid('e'),
        'name': name,
        'weight': weight,
        'folderId': EVENT_FOLDER['id'],
        'termId': TERM['id'],
        'startDate': date,
        'endDate': None,
    })

# ------------------------------------------------------------------ the table
STATUSES = [
    {'id': 'present', 'name': 'Present', 'credit': 1, 'color': '#dcf5e2'},
    {'id': 'virtual', 'name': 'Virtual', 'credit': 1, 'color': '#dbeafe'},
    {'id': 'made-up', 'name': 'Made up', 'credit': 1, 'color': '#e6f6ea'},
    {'id': 'needs-makeup', 'name': 'Needs make-up', 'credit': 0, 'color': '#fdf0d5'},
    {'id': 'absent', 'name': 'Absent', 'credit': 0, 'color': '#fbdedd'},
    {'id': 'excused', 'name': 'Excused / holiday', 'credit': None, 'color': '#e9ecef'},
]

table = {
    'version': 2,
    'people': people,
    'groups': groups,
    'folders': folders,
    'terms': [TERM],
    'events': events,
    'attendance': {},
    'settings': {
        'name': 'CIR Attendance',
        'statuses': STATUSES,
        'countUnmarkedAsAbsent': False,
        'showTitle': False,
        'colorCells': True,
        'colorDropdown': False,
        'highlightHover': True,
        'stickyColumns': True,
    },
}

out = os.path.join('public', 'cir-fall-2026.json')
io.open(out, 'w', encoding='utf-8', newline='\n').write(json.dumps(table, indent=2) + '\n')

for name, alias, others in dropped_aliases:
    print(f'dropped ambiguous alias {alias!r} for {name} (also matches {others})')
print(f'people   {len(people)}')
print(f'groups   {len(groups)} (assigned: {sum(len(g["memberIds"]) for g in groups)})')
print(f'folders  {len(folders)}')
print(f'events   {len(events)}')
for g in groups:
    linked = next((f['name'] for f in folders if f.get('groupId') == g['id']), '-')
    print(f'  {g["name"]:<16} {len(g["memberIds"]):>2} members   sessions: {linked}')
print('wrote', out)
