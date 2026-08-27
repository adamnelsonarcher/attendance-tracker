import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import './components/dialogs/dialogs.css';
import TopBar from './components/TopBar/TopBar';
import AttendanceTable from './components/Table/AttendanceTable';
import AddPeopleDialog from './components/dialogs/AddPeopleDialog';
import AddEventDialog from './components/dialogs/AddEventDialog';
import AddRecurringDialog from './components/dialogs/AddRecurringDialog';
import ImportGridDialog from './components/dialogs/ImportGridDialog';
import GroupsDialog from './components/dialogs/GroupsDialog';
import SettingsDialog from './components/dialogs/SettingsDialog';
import ShareDialog from './components/dialogs/ShareDialog';
import JoinDialog from './components/dialogs/JoinDialog';
import { useTableStore } from './state/useTableStore';
import { ALL_TERMS } from './data/selectors';
import { currentTerm } from './data/model';

const NO_FILTERS = { groups: {}, folders: {} };
const NO_SORT = { type: 'none', direction: 'asc', eventId: null, scoreType: null };

function App() {
  const store = useTableStore();
  const { table, dispatch, tableId, tableEpoch, code, tables, viewOnly, sync, join, actions } = store;

  // Filters, sort and the chosen term are per-view, not part of the table: they
  // should not sync to everyone else, and they are not data.
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState(NO_SORT);
  const [dialog, setDialog] = useState(null);
  const [activeTermId, setActiveTermId] = useState(null);

  // Open on the term we are actually in. "All terms" is a deliberate choice and
  // is left alone — but opening a different table starts that choice over, or a
  // restored table would sit on All terms with a year of history in one grid.
  const lastEpoch = useRef(null);

  useEffect(() => {
    const swapped = lastEpoch.current !== tableEpoch;
    lastEpoch.current = tableEpoch;

    setActiveTermId((current) => {
      // `null` means "nothing chosen yet" and is distinct from ALL_TERMS, which
      // is a choice. Collapsing the two meant that with no terms the view sat
      // on ALL_TERMS, and creating the first term did not select it — so the
      // sessions added next were filed under no term at all.
      const stillValid =
        !swapped &&
        current !== null &&
        (current === ALL_TERMS ? table.terms.length > 0 : table.terms.some((term) => term.id === current));
      if (stillValid) return current;
      return currentTerm(table.terms)?.id ?? null;
    });
  }, [table.terms, tableEpoch]);

  const close = useCallback(() => setDialog(null), []);
  // The name lives in the table, so it is the same for everyone sharing it.
  const tableName = table.settings.name;
  const termId = activeTermId || ALL_TERMS;

  return (
    <div className="app">
      <TopBar
        table={table}
        dispatch={dispatch}
        filters={filters}
        onFiltersChange={setFilters}
        tables={tables}
        tableId={tableId}
        code={code}
        sync={sync}
        viewOnly={viewOnly}
        actions={actions}
        activeTermId={termId}
        onTermChange={setActiveTermId}
        onOpen={setDialog}
      />

      {join.status === 'error' && (
        <p className="app__banner app__banner--error" role="alert">
          {join.error}
        </p>
      )}
      {join.status === 'loading' && <p className="app__banner">Opening shared table…</p>}

      {table.settings.showTitle && <h1 className="app__title">{tableName}</h1>}

      <AttendanceTable
        table={table}
        dispatch={dispatch}
        filters={filters}
        sort={sort}
        onSortChange={setSort}
        termId={termId}
        readOnly={viewOnly}
      />

      {dialog === 'people' && (
        <AddPeopleDialog people={table.people} dispatch={dispatch} onClose={close} />
      )}
      {dialog === 'event' && (
        <AddEventDialog
          folders={table.folders}
          terms={table.terms}
          activeTermId={termId}
          dispatch={dispatch}
          onClose={close}
        />
      )}
      {dialog === 'recurring' && (
        <AddRecurringDialog table={table} dispatch={dispatch} activeTermId={termId} onClose={close} />
      )}
      {dialog === 'import' && (
        <ImportGridDialog table={table} dispatch={dispatch} activeTermId={termId} onClose={close} />
      )}
      {dialog === 'groups' && (
        <GroupsDialog
          groups={table.groups}
          people={table.people}
          folders={table.folders}
          dispatch={dispatch}
          onClose={close}
        />
      )}
      {dialog === 'share' && (
        <ShareDialog
          code={code}
          tableName={tableName}
          sync={sync}
          actions={actions}
          viewOnly={viewOnly}
          onClose={close}
        />
      )}
      {dialog === 'join' && <JoinDialog join={join} onClose={close} />}
      {dialog === 'settings' && (
        <SettingsDialog
          table={table}
          dispatch={dispatch}
          tableId={tableId}
          code={code}
          sync={sync}
          actions={actions}
          readOnly={viewOnly}
          termId={termId}
          onClose={close}
        />
      )}
    </div>
  );
}

export default App;
