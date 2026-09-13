/** Projektarbeitsbereich mit Reitern für alle projektbezogenen Funktionen. */
import { useState } from 'react';
import type { PlanDocument, Project } from '../domain/types';
import type { ProjektTab, Route } from '../lib/router';
import { Adressbuch } from './projekt/Adressbuch';
import { Einstellungen } from './projekt/Einstellungen';
import { Plaene } from './projekt/Plaene';
import { Planlaeufe } from './projekt/Planlaeufe';
import { Uebersicht } from './projekt/Uebersicht';
import { Prozessketten } from './Prozessketten';
import { Fristen } from './Fristen';

const TABS: { id: ProjektTab; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'plaene', label: 'Pläne & Pakete' },
  { id: 'planlaeufe', label: 'Planläufe' },
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
  const [startFuer, setStartFuer] = useState<PlanDocument | null>(null);
  const gotoTab = (t: ProjektTab) => navigate({ view: 'projekt', projectId: project.id, tab: t });
  const oeffneLauf = (runId: string) => navigate({ view: 'planlauf', projectId: project.id, runId });

  return (
    <div className="stack">
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === tab ? 'active' : ''} onClick={() => gotoTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'uebersicht' ? <Uebersicht project={project} gotoTab={gotoTab} oeffneLauf={oeffneLauf} /> : null}
      {tab === 'plaene' ? (
        <Plaene
          project={project}
          onPlanlaufStarten={(doc) => {
            setStartFuer(doc);
            gotoTab('planlaeufe');
          }}
        />
      ) : null}
      {tab === 'planlaeufe' ? (
        <>
          <Planlaeufe
            project={project}
            onOeffnen={oeffneLauf}
            startFuerDokument={startFuer}
            onStartDialogSchliessen={() => setStartFuer(null)}
          />
          <div style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 10 }}>Fristen in diesem Projekt</h2>
            <Fristen navigate={navigate} projectId={project.id} />
          </div>
        </>
      ) : null}
      {tab === 'adressbuch' ? <Adressbuch project={project} /> : null}
      {tab === 'ketten' ? <Prozessketten projectId={project.id} /> : null}
      {tab === 'einstellungen' ? <Einstellungen project={project} /> : null}
    </div>
  );
}
