/** Projektübersicht: Kennzahlen, Fristenlage und letzte Aktivitäten. */
import { eigenstaendigeLaeufe, offeneFristen } from '../../domain/engine';
import { DOCUMENT_KIND_LABEL, type Project } from '../../domain/types';
import type { ProjektTab } from '../../lib/router';
import { useStore } from '../../store/store';
import { Card, CardHeader, EmptyState, Progress, Stat } from '../../components/ui';
import { Icon } from '../../components/icons';
import { PlanlaufListe } from '../../components/PlanlaufListe';

export function Uebersicht({
  project,
  gotoTab,
  oeffneLauf,
}: {
  project: Project;
  gotoTab: (t: ProjektTab) => void;
  oeffneLauf: (runId: string) => void;
}) {
  const { data } = useStore();
  const dokumente = data.documents.filter((d) => d.projectId === project.id);
  // Ohne die Läufe von Plänen, die in einem Planverzeichnis mitlaufen
  const laeufe = eigenstaendigeLaeufe(data.documents, data.runs).filter(
    (r) => r.projectId === project.id,
  );
  const aktiv = laeufe.filter((r) => r.status === 'laufend');
  const abgeschlossen = laeufe.filter((r) => r.status === 'abgeschlossen');

  // Wie in der Planliste: je Eintrag der maßgebliche Lauf – der laufende,
  // sonst der abgeschlossene, sonst der abgebrochene.
  const rang = (r: (typeof laeufe)[number]) =>
    r.status === 'laufend' ? 0 : r.status === 'abgeschlossen' ? 1 : 2;
  const massgeblich = [...laeufe]
    .sort((a, b) => rang(a) - rang(b))
    .filter((r, i, alle) => alle.findIndex((x) => x.documentId === r.documentId) === i);
  const fristen = offeneFristen(data, [project.id]);
  const ueberfaellig = fristen.filter((f) => f.ampel === 'ueberfaellig');
  const proArt = (['paket', 'plan', 'verzeichnis'] as const).map((k) => ({
    art: DOCUMENT_KIND_LABEL[k],
    anzahl: dokumente.filter((d) => d.kind === k).length,
  }));

  return (
    <div className="stack">
      <div className="grid grid-3">
        <Stat wert={dokumente.length} label="Pläne, Pakete & Verzeichnisse" onClick={() => gotoTab('plaene')} />
        <Stat wert={aktiv.length} label="Laufende Planläufe" ton="blue" onClick={() => gotoTab('plaene')} />
        <Stat wert={ueberfaellig.length} label="Überfällige Schritte" ton={ueberfaellig.length ? 'red' : 'green'} />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader titel="Planbestand" sub="Verteilung nach Art" />
          <div className="card-pad stack" style={{ gap: 12 }}>
            {proArt.map((a) => (
              <div key={a.art} className="row-between">
                <span className="small">{a.art}</span>
                <span className="row" style={{ gap: 10 }}>
                  <Progress wert={dokumente.length ? (a.anzahl / dokumente.length) * 100 : 0} />
                  <b style={{ minWidth: 22, textAlign: 'right' }}>{a.anzahl}</b>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          titel="Planläufe"
          sub={`${aktiv.length} laufend · ${abgeschlossen.length} abgeschlossen`}
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => gotoTab('plaene')}>
              Alle <Icon name="chevron" size={13} />
            </button>
          }
        />
        {massgeblich.length === 0 ? (
          <EmptyState
            icon="kette"
            titel="Noch kein Planlauf"
            text="Starten Sie einen Lauf für einen Plan oder ein Planverzeichnis."
          />
        ) : (
          <PlanlaufListe project={project} runs={massgeblich} alleRuns={laeufe} oeffneLauf={oeffneLauf} />
        )}
      </Card>
    </div>
  );
}
