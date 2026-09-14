/** Projektarbeitsbereich mit Reitern für alle projektbezogenen Funktionen. */
import { useState } from 'react';
import type { Project } from '../domain/types';
import type { ProjektTab, Route } from '../lib/router';
import { Adressbuch } from './projekt/Adressbuch';
import { Einstellungen } from './projekt/Einstellungen';
import { ExportDialog } from './projekt/ExportDialog';
import { Plaene } from './projekt/Plaene';
import { Uebersicht } from './projekt/Uebersicht';
import { Prozessketten } from './Prozessketten';
import { Fristen } from './Fristen';
import { Icon } from '../components/icons';

const TABS: { id: ProjektTab; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'plaene', label: 'Pläne & Planläufe' },
  { id: 'adressbuch', label: 'Adressbuch' },
  { id: 'ketten', label: 'Prozessketten' },
  { id: 'einstellungen', label: 'Einstellungen' },
];

export function ProjektDetail({
  project,
  tab,
  navigate,
}: {
  project: Project;
  tab: ProjektTab;
  navigate: (r: Route) => void;
}) {
  const [exportOffen, setExportOffen] = useState(false);
  const gotoTab = (t: ProjektTab) => navigate({ view: 'projekt', projectId: project.id, tab: t });
  const oeffneLauf = (runId: string) => navigate({ view: 'planlauf', projectId: project.id, runId });

  return (
    <div className="stack">
      <div className="row-between wrap" style={{ gap: 8 }}>
        <div className="tabs" style={{ flex: 1, minWidth: 0 }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={t.id === tab ? 'active' : ''} onClick={() => gotoTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setExportOffen(true)}>
          <Icon name="export" size={13} /> Export
        </button>
      </div>

      {tab === 'uebersicht' ? <Uebersicht project={project} gotoTab={gotoTab} oeffneLauf={oeffneLauf} /> : null}
      {tab === 'plaene' ? (
        <>
          <Plaene project={project} oeffneLauf={oeffneLauf} />
          <div style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 10 }}>Fristen in diesem Projekt</h2>
            <Fristen navigate={navigate} projectId={project.id} />
          </div>
        </>
      ) : null}
      {tab === 'adressbuch' ? <Adressbuch project={project} /> : null}
      {tab === 'ketten' ? <Prozessketten projectId={project.id} /> : null}
      {tab === 'einstellungen' ? <Einstellungen project={project} /> : null}

      {exportOffen ? <ExportDialog project={project} onClose={() => setExportOffen(false)} /> : null}
    </div>
  );
}
