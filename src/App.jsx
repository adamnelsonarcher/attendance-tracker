import { useState } from 'react';
import './App.css';
import './components/dialogs/dialogs.css';
import TopBar from './components/TopBar/TopBar';
import AttendanceTable from './components/Table/AttendanceTable';
import AddPeopleDialog from './components/dialogs/AddPeopleDialog';
import AddEventDialog from './components/dialogs/AddEventDialog';
import GroupsDialog from './components/dialogs/GroupsDialog';
import SettingsDialog from './components/dialogs/SettingsDialog';
import ShareDialog from './components/dialogs/ShareDialog';
import JoinDialog from './components/dialogs/JoinDialog';
import { useTableStore } from './state/useTableStore';

const NO_FILTERS = { groups: {}, folders: {} };
const NO_SORT = { type: 'none', direction: 'asc', eventId: null, scoreType: null };

function App() {
  const store = useTableStore();
  const { table, dispatch, tableId, code, tables, viewOnly, sync, join, actions } = store;

  // Filters and sort are per-view, not part of the table: they should not sync
  // to everyone else, and they should not persist as data.
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState(NO_SORT);
  const [dialog, setDialog] = useState(null);

  const close = () => setDialog(null);
  const tableName = tables.find((entry) => entry.id === tableId)?.name || 'My table';

  return (
    <div className="app">
      <TopBar
        table={table}
        filters={filters}
        onFiltersChange={setFilters}
        tables={tables}
        tableId={tableId}
        code={code}
        sync={sync}
        viewOnly={viewOnly}
        actions={actions}
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
        readOnly={viewOnly}
      />

      {dialog === 'people' && (
        <AddPeopleDialog people={table.people} dispatch={dispatch} onClose={close} />
      )}
      {dialog === 'event' && (
        <AddEventDialog folders={table.folders} dispatch={dispatch} onClose={close} />
      )}
      {dialog === 'groups' && (
        <GroupsDialog
          groups={table.groups}
          people={table.people}
          dispatch={dispatch}
          onClose={close}
        />
      )}
      {dialog === 'share' && (
        <ShareDialog code={code} sync={sync} actions={actions} onClose={close} />
      )}
      {dialog === 'join' && <JoinDialog join={join} onClose={close} />}
      {dialog === 'settings' && (
        <SettingsDialog
          table={table}
          dispatch={dispatch}
          tableId={tableId}
          tableName={tableName}
          code={code}
          sync={sync}
          actions={actions}
          readOnly={viewOnly}
          onClose={close}
        />
      )}
    </div>
  );
}

export default App;
